import { tx, getLocale, useI18n, txApi } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import {
  useAdminListInvoices,
  type AdminInvoice,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  Search,
  RefreshCw,
  ReceiptText,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  FileWarning,
  RotateCcw,
} from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(getLocale());
}

const STATUS_LABELS = (): Record<string, string> => ({
  pending: tx("待開立"),
  issued: tx("已開立"),
  failed: tx("開立失敗"),
  voided: tx("已作廢"),
});

const TYPE_LABELS = (): Record<string, string> => ({
  personal: tx("個人"),
  company: tx("公司（統編）"),
  donation: tx("捐贈"),
});

type FilterKey = "all" | "issued" | "pending" | "failed" | "voided";

const FILTERS = (): { key: FilterKey; label: string }[] => ([
  { key: "all", label: tx("全部") },
  { key: "issued", label: tx("已開立") },
  { key: "pending", label: tx("待開立") },
  { key: "failed", label: tx("開立失敗") },
  { key: "voided", label: tx("已作廢") },
]);

function statusBadge(status: string) {
  const label = STATUS_LABELS()[status] ?? status;
  const tone =
    status === "issued"
      ? "bg-green-100 text-green-700"
      : status === "failed"
        ? "bg-red-100 text-red-700"
        : status === "voided"
          ? "bg-slate-200 text-slate-600"
          : "bg-amber-100 text-amber-700";
  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

export default function InvoicesManage() {
  useI18n();
  const { hasRole } = useAuth();
  const canManage = hasRole("editor");
  const { data, isLoading, refetch, isRefetching } = useAdminListInvoices();
  const invoices = useMemo<AdminInvoice[]>(() => data ?? [], [data]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  // Backend retry/void operate on the LATEST invoice per paymentRef. The list is
  // sorted newest-first by id, so the first id seen per ref is the latest one —
  // only those rows may show actions, to avoid acting on the wrong record.
  const latestIdByRef = useMemo(() => {
    const m = new Map<string, number>();
    for (const inv of invoices) {
      if (!m.has(inv.paymentRef)) m.set(inv.paymentRef, inv.id);
    }
    return m;
  }, [invoices]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: invoices.length,
      issued: 0,
      pending: 0,
      failed: 0,
      voided: 0,
    };
    for (const inv of invoices) {
      if (inv.status === "issued") c.issued += 1;
      else if (inv.status === "failed") c.failed += 1;
      else if (inv.status === "voided") c.voided += 1;
      else c.pending += 1;
    }
    return c;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (filter !== "all") {
        const key = inv.status === "issued" || inv.status === "failed" || inv.status === "voided" ? inv.status : "pending";
        if (key !== filter) return false;
      }
      if (!q) return true;
      return (
        (inv.invoiceNumber ?? "").toLowerCase().includes(q) ||
        inv.paymentRef.toLowerCase().includes(q) ||
        (inv.buyerName ?? "").toLowerCase().includes(q) ||
        (inv.buyerEmail ?? "").toLowerCase().includes(q) ||
        (inv.taxId ?? "").toLowerCase().includes(q)
      );
    });
  }, [invoices, filter, search]);

  // A row is issuable only when it is the latest invoice for its order, not
  // already issued/voided, and the order is paid — same rule the action buttons use.
  const isIssuable = (inv: AdminInvoice) =>
    latestIdByRef.get(inv.paymentRef) === inv.id &&
    inv.status !== "issued" &&
    inv.status !== "voided" &&
    inv.paymentStatus === "paid";

  const eligibleRows = useMemo(
    () => filtered.filter(isIssuable),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, latestIdByRef],
  );
  // Issued invoices (latest per order) that can be reset back to 待開立.
  // Used to clear TEST invoices before re-issuing real ones in production.
  const resettableRows = useMemo(
    () =>
      filtered.filter(
        (inv) =>
          latestIdByRef.get(inv.paymentRef) === inv.id &&
          inv.status === "issued",
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, latestIdByRef],
  );

  // A row is selectable if it can be issued (pending/failed) OR reset (issued).
  // Actions only ever apply to the matching subset of the current selection.
  const selectableRows = useMemo(
    () => [...eligibleRows, ...resettableRows],
    [eligibleRows, resettableRows],
  );

  const selectedCount = eligibleRows.filter((inv) => selectedIds.has(inv.id)).length;
  const selectedResetCount = resettableRows.filter((inv) =>
    selectedIds.has(inv.id),
  ).length;
  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((inv) => selectedIds.has(inv.id));

  // Drop any selected ids that are no longer selectable (after refetch/filter
  // change) so the hidden selection count can't drift from what's visible.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(selectableRows.map((inv) => inv.id));
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectableRows]);

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      if (
        selectableRows.length > 0 &&
        selectableRows.every((inv) => prev.has(inv.id))
      ) {
        return new Set();
      }
      return new Set(selectableRows.map((inv) => inv.id));
    });
  };

  const handleBatchIssue = async () => {
    const targets = eligibleRows.filter((inv) => selectedIds.has(inv.id));
    if (targets.length === 0) return;
    if (
      !window.confirm(
        tx("要批量開立 {0} 張電子發票嗎？\n系統會逐筆向綠界送出開立要求。", [targets.length]),
      )
    ) {
      return;
    }
    setBatchBusy(true);
    let ok = 0;
    const errors: string[] = [];
    for (const inv of targets) {
      try {
        const res = await fetch(
          `/api/payments/invoices/${encodeURIComponent(inv.paymentRef)}/retry`,
          { method: "POST", credentials: "include" },
        );
        const result = (await res.json().catch(() => ({}))) as {
          status?: string;
          errorMessage?: string | null;
          error?: string;
        };
        if (res.ok && result.status === "issued") {
          ok += 1;
        } else {
          errors.push(
            tx("{0}：{1}", [inv.paymentRef, txApi(result.errorMessage) || txApi(result.error) || tx("未成功")]),
          );
        }
      } catch (err) {
        errors.push(
          tx("{0}：{1}", [inv.paymentRef, err instanceof Error ? txApi(err.message) : tx("連線錯誤")]),
        );
      }
    }
    setBatchBusy(false);
    setSelectedIds(new Set());
    await refetch();
    window.alert(
      tx("批量開立完成：成功 {0} 張，失敗 {1} 張。", [ok, errors.length]) +
        (errors.length
          ? tx("\n\n失敗明細：\n{0}{1}", [errors.slice(0, 10).join("\n"), errors.length > 10 ? "\n…" : ""])
          : ""),
    );
  };

  const handleRetry = async (inv: AdminInvoice) => {
    if (
      !window.confirm(
        tx("要為訂單「{0}」{1}開立電子發票嗎？\n系統會向綠界送出開立要求並回填發票號碼。", [inv.paymentRef, inv.status === "failed" ? tx("重新") : ""]),
      )
    ) {
      return;
    }
    setBusyRef(inv.paymentRef);
    try {
      const res = await fetch(
        `/api/payments/invoices/${encodeURIComponent(inv.paymentRef)}/retry`,
        { method: "POST", credentials: "include" },
      );
      const result = (await res.json().catch(() => ({}))) as {
        status?: string;
        invoiceNumber?: string | null;
        errorMessage?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(txApi(result?.error) || tx("開立失敗"));
      await refetch();
      if (result.status === "issued") {
        window.alert(tx("開立成功，發票號碼：{0}", [result.invoiceNumber ?? "—"]));
      } else {
        window.alert(
          tx("尚未開立成功（狀態：{0}）。\n{1}", [result.status ? (STATUS_LABELS()[result.status] ?? result.status) : tx("未知"), txApi(result.errorMessage) ?? tx("請確認此訂單已付款且已填寫發票資訊。")]),
        );
      }
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("開立失敗，請稍後再試"));
    } finally {
      setBusyRef(null);
    }
  };

  const handleVoid = async (inv: AdminInvoice) => {
    const reason = window.prompt(
      tx("要作廢發票「{0}」嗎？請輸入作廢原因：", [inv.invoiceNumber]),
      tx("訂單取消"),
    );
    if (reason === null) return;
    setBusyRef(inv.paymentRef);
    try {
      const res = await fetch(
        `/api/payments/invoices/${encodeURIComponent(inv.paymentRef)}/void`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason || "訂單取消" }),
        },
      );
      const result = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(txApi(result?.error) || tx("作廢失敗"));
      await refetch();
      if (result.success) {
        window.alert(tx("發票已作廢。"));
      } else {
        window.alert(tx("作廢未成功：{0}", [txApi(result.message) ?? tx("請稍後再試")]));
      }
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("作廢失敗，請稍後再試"));
    } finally {
      setBusyRef(null);
    }
  };

  const resetOne = async (paymentRef: string) => {
    const res = await fetch(
      `/api/payments/invoices/${encodeURIComponent(paymentRef)}/reset`,
      { method: "POST", credentials: "include" },
    );
    const result = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
    };
    if (!res.ok || !result.success) {
      throw new Error(txApi(result.error) || tx("重設失敗"));
    }
  };

  const handleReset = async (inv: AdminInvoice) => {
    if (
      !window.confirm(
        tx("要將發票「{0}」重設為「待開立」嗎？\n\n", [inv.invoiceNumber]) +
          tx("⚠️ 此功能僅用於清除「測試發票」紀錄，重設後即可重新開立正式發票。\n") +
          tx("若這是已開立的「正式發票」，請改用「作廢」，不要用重設。"),
      )
    ) {
      return;
    }
    setBusyRef(inv.paymentRef);
    try {
      await resetOne(inv.paymentRef);
      await refetch();
      window.alert(tx("已重設為待開立。"));
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("重設失敗，請稍後再試"));
    } finally {
      setBusyRef(null);
    }
  };

  const handleBulkReset = async () => {
    const targets = resettableRows.filter((inv) => selectedIds.has(inv.id));
    if (targets.length === 0) return;
    if (
      !window.confirm(
        tx("要將 {0} 張「已開立」發票重設為「待開立」嗎？\n\n", [targets.length]) +
          tx("⚠️ 此功能僅用於清除「測試發票」紀錄。重設後可重新開立正式發票。\n") +
          tx("若清單中包含已開立的「正式發票」，請勿使用此功能（正式發票應改用「作廢」）。"),
      )
    ) {
      return;
    }
    setBatchBusy(true);
    let ok = 0;
    const errors: string[] = [];
    for (const inv of targets) {
      try {
        await resetOne(inv.paymentRef);
        ok += 1;
      } catch (err) {
        errors.push(
          tx("{0}：{1}", [inv.paymentRef, err instanceof Error ? txApi(err.message) : tx("連線錯誤")]),
        );
      }
    }
    setBatchBusy(false);
    await refetch();
    window.alert(
      tx("重設完成：成功 {0} 張，失敗 {1} 張。", [ok, errors.length]) +
        (errors.length
          ? tx("\n\n失敗明細：\n{0}{1}", [errors.slice(0, 10).join("\n"), errors.length > 10 ? "\n…" : ""])
          : ""),
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display">{tx("發票管理")}</h1>
          <p className="text-muted-foreground mt-1">
            {tx("檢視所有電子發票開立紀錄與發票號碼，並可手動開立、重試或作廢")}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          {canManage && resettableRows.length > 0 && (
            <button
              onClick={handleBulkReset}
              disabled={batchBusy || selectedResetCount === 0}
              title={tx("將勾選的已開立測試發票改回待開立，以便重新開立正式發票")}
              className="border border-amber-400 text-amber-700 px-4 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:bg-amber-50 transition-all disabled:opacity-50"
            >
              <RotateCcw size={16} className={batchBusy ? "animate-spin" : ""} />
              {tx("重設為待開立{0}", [selectedResetCount > 0 ? `（${selectedResetCount}）` : ""])}
            </button>
          )}
          {canManage && (
            <button
              onClick={handleBatchIssue}
              disabled={batchBusy || selectedCount === 0}
              className="bg-primary text-white px-4 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              <ReceiptText size={16} className={batchBusy ? "animate-pulse" : ""} />
              {batchBusy ? tx("開立中...") : tx("批量開立{0}", [selectedCount > 0 ? `（${selectedCount}）` : ""])}
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="border px-4 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:bg-muted transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
            {tx("重新整理")}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<CheckCircle2 size={22} />}
          tone="green"
          label={tx("已開立")}
          value={tx("{0} 張", [counts.issued])}
        />
        <SummaryCard
          icon={<Clock size={22} />}
          tone="amber"
          label={tx("待開立")}
          value={tx("{0} 張", [counts.pending])}
        />
        <SummaryCard
          icon={<FileWarning size={22} />}
          tone="red"
          label={tx("開立失敗")}
          value={tx("{0} 張", [counts.failed])}
        />
        <SummaryCard
          icon={<Ban size={22} />}
          tone="slate"
          label={tx("已作廢")}
          value={tx("{0} 張", [counts.voided])}
        />
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS().map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filter === f.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f.label}{tx("（")}{counts[f.key]}{tx("）")}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tx("搜尋發票號碼／訂單編號／買受人／統編")}
            className="pl-9 pr-4 py-2 rounded-full border w-full lg:w-80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">{tx("載入中...")}</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <ReceiptText size={40} className="mx-auto mb-3 opacity-40" />
          {tx("目前沒有符合條件的發票紀錄。")}
        </div>
      ) : (
        <div tabIndex={0} role="region" aria-label={tx("資料表（可水平捲動）")} className="bg-white rounded-3xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {canManage && (
                  <th className="px-4 py-3 font-semibold w-10">
                    <input
                      type="checkbox"
                      aria-label={tx("全選可開立／可重設發票")}
                      checked={allSelectableSelected}
                      disabled={selectableRows.length === 0 || batchBusy}
                      onChange={toggleAll}
                      className="w-4 h-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-semibold">{tx("發票號碼")}</th>
                <th className="px-4 py-3 font-semibold">{tx("訂單編號")}</th>
                <th className="px-4 py-3 font-semibold">{tx("買受人")}</th>
                <th className="px-4 py-3 font-semibold text-right">{tx("金額")}</th>
                <th className="px-4 py-3 font-semibold">{tx("類型")}</th>
                <th className="px-4 py-3 font-semibold">{tx("狀態")}</th>
                <th className="px-4 py-3 font-semibold">{tx("開立時間")}</th>
                {canManage && (
                  <th className="px-4 py-3 font-semibold text-right">{tx("操作")}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const busy = busyRef === inv.paymentRef;
                const isLatest = latestIdByRef.get(inv.paymentRef) === inv.id;
                const canIssue =
                  isLatest &&
                  inv.status !== "issued" &&
                  inv.status !== "voided" &&
                  inv.paymentStatus === "paid";
                const canReset = isLatest && inv.status === "issued";
                const canSelect = canIssue || canReset;
                return (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                    {canManage && (
                      <td className="px-4 py-3">
                        {canSelect ? (
                          <input
                            type="checkbox"
                            aria-label={tx("選擇訂單 {0}", [inv.paymentRef])}
                            checked={selectedIds.has(inv.id)}
                            disabled={batchBusy}
                            onChange={() => toggleOne(inv.id)}
                            className="w-4 h-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                          />
                        ) : (
                          <span className="block w-4" />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                      {inv.invoiceNumber ?? (
                        <span className="text-muted-foreground font-sans font-normal">
                          {tx("尚未取號")}
                        </span>
                      )}
                      {inv.randomNumber && (
                        <span className="block text-[11px] text-muted-foreground font-sans">
                          {tx("隨機碼")} {inv.randomNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {inv.paymentRef}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{inv.buyerName ?? "—"}</div>
                      {inv.buyerEmail && (
                        <div className="text-xs text-muted-foreground break-all">
                          {inv.buyerEmail}
                        </div>
                      )}
                      {inv.taxId && (
                        <div className="text-xs text-muted-foreground">
                          {tx("統編")} {inv.taxId}
                          {inv.companyTitle ? `・${inv.companyTitle}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700 whitespace-nowrap">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {TYPE_LABELS()[inv.invoiceType] ?? inv.invoiceType}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {statusBadge(inv.status)}
                      {inv.status === "failed" && inv.errorMessage && (
                        <div className="text-[11px] text-red-700 mt-1 max-w-[180px]">
                          {inv.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {inv.status === "voided"
                        ? formatDateTime(inv.voidedAt)
                        : formatDateTime(inv.issuedAt)}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {canIssue && (
                            <button
                              onClick={() => handleRetry(inv)}
                              disabled={busy || batchBusy}
                              className="inline-flex items-center gap-1 border border-primary text-primary px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-primary/10 disabled:opacity-50 whitespace-nowrap"
                            >
                              <ReceiptText size={13} />
                              {inv.status === "failed" ? tx("重試開立") : tx("開立發票")}
                            </button>
                          )}
                          {isLatest && inv.status === "issued" && (
                            <>
                              <button
                                onClick={() => handleReset(inv)}
                                disabled={busy || batchBusy}
                                title={tx("清除測試發票：改回待開立")}
                                className="inline-flex items-center gap-1 border border-amber-400 text-amber-700 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-amber-50 disabled:opacity-50 whitespace-nowrap"
                              >
                                <RotateCcw size={13} />
                                {tx("重設")}
                              </button>
                              <button
                                onClick={() => handleVoid(inv)}
                                disabled={busy || batchBusy}
                                className="inline-flex items-center gap-1 border border-red-400 text-red-700 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                              >
                                <XCircle size={13} />
                                {tx("作廢")}
                              </button>
                            </>
                          )}
                          {!isLatest ? (
                            <span className="text-xs text-muted-foreground">
                              {tx("歷史紀錄")}
                            </span>
                          ) : (
                            !canIssue &&
                            inv.status !== "issued" && (
                              <span className="text-xs text-muted-foreground">
                                {inv.paymentStatus === "paid" ? "—" : tx("訂單未付款")}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "green" | "amber" | "red" | "slate";
  label: string;
  value: string;
}) {
  useI18n();
  const toneClasses: Record<string, string> = {
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="bg-white p-5 rounded-3xl border shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${toneClasses[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <div className="text-xl font-display text-foreground truncate">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}
