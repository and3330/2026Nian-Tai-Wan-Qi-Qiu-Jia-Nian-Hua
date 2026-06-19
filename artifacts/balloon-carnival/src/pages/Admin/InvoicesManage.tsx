import { useMemo, useState } from "react";
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
} from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-TW");
}

const STATUS_LABELS: Record<string, string> = {
  pending: "待開立",
  issued: "已開立",
  failed: "開立失敗",
  voided: "已作廢",
};

const TYPE_LABELS: Record<string, string> = {
  personal: "個人",
  company: "公司（統編）",
  donation: "捐贈",
};

type FilterKey = "all" | "issued" | "pending" | "failed" | "voided";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "issued", label: "已開立" },
  { key: "pending", label: "待開立" },
  { key: "failed", label: "開立失敗" },
  { key: "voided", label: "已作廢" },
];

function statusBadge(status: string) {
  const label = STATUS_LABELS[status] ?? status;
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
  const { hasRole } = useAuth();
  const canManage = hasRole("editor");
  const { data, isLoading, refetch, isRefetching } = useAdminListInvoices();
  const invoices = useMemo<AdminInvoice[]>(() => data ?? [], [data]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [busyRef, setBusyRef] = useState<string | null>(null);

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

  const handleRetry = async (inv: AdminInvoice) => {
    if (
      !window.confirm(
        `要為訂單「${inv.paymentRef}」${inv.status === "failed" ? "重新" : ""}開立電子發票嗎？\n系統會向綠界送出開立要求並回填發票號碼。`,
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
      if (!res.ok) throw new Error(result?.error || "開立失敗");
      await refetch();
      if (result.status === "issued") {
        window.alert(`開立成功，發票號碼：${result.invoiceNumber ?? "—"}`);
      } else {
        window.alert(
          `尚未開立成功（狀態：${result.status ? (STATUS_LABELS[result.status] ?? result.status) : "未知"}）。\n${result.errorMessage ?? "請確認此訂單已付款且已填寫發票資訊。"}`,
        );
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "開立失敗，請稍後再試");
    } finally {
      setBusyRef(null);
    }
  };

  const handleVoid = async (inv: AdminInvoice) => {
    const reason = window.prompt(
      `要作廢發票「${inv.invoiceNumber}」嗎？請輸入作廢原因：`,
      "訂單取消",
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
      if (!res.ok) throw new Error(result?.error || "作廢失敗");
      await refetch();
      if (result.success) {
        window.alert("發票已作廢。");
      } else {
        window.alert(`作廢未成功：${result.message ?? "請稍後再試"}`);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "作廢失敗，請稍後再試");
    } finally {
      setBusyRef(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display">發票管理</h1>
          <p className="text-muted-foreground mt-1">
            檢視所有電子發票開立紀錄與發票號碼，並可手動開立、重試或作廢
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="border px-4 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:bg-muted transition-all disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
          重新整理
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<CheckCircle2 size={22} />}
          tone="green"
          label="已開立"
          value={`${counts.issued} 張`}
        />
        <SummaryCard
          icon={<Clock size={22} />}
          tone="amber"
          label="待開立"
          value={`${counts.pending} 張`}
        />
        <SummaryCard
          icon={<FileWarning size={22} />}
          tone="red"
          label="開立失敗"
          value={`${counts.failed} 張`}
        />
        <SummaryCard
          icon={<Ban size={22} />}
          tone="slate"
          label="已作廢"
          value={`${counts.voided} 張`}
        />
      </div>

      {/* Filters + search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                filter === f.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f.label}（{counts[f.key]}）
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
            placeholder="搜尋發票號碼／訂單編號／買受人／統編"
            className="pl-9 pr-4 py-2 rounded-full border w-full lg:w-80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <ReceiptText size={40} className="mx-auto mb-3 opacity-40" />
          目前沒有符合條件的發票紀錄。
        </div>
      ) : (
        <div className="bg-white rounded-3xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-semibold">發票號碼</th>
                <th className="px-4 py-3 font-semibold">訂單編號</th>
                <th className="px-4 py-3 font-semibold">買受人</th>
                <th className="px-4 py-3 font-semibold text-right">金額</th>
                <th className="px-4 py-3 font-semibold">類型</th>
                <th className="px-4 py-3 font-semibold">狀態</th>
                <th className="px-4 py-3 font-semibold">開立時間</th>
                {canManage && (
                  <th className="px-4 py-3 font-semibold text-right">操作</th>
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
                return (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">
                      {inv.invoiceNumber ?? (
                        <span className="text-muted-foreground font-sans font-normal">
                          尚未取號
                        </span>
                      )}
                      {inv.randomNumber && (
                        <span className="block text-[11px] text-muted-foreground font-sans">
                          隨機碼 {inv.randomNumber}
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
                          統編 {inv.taxId}
                          {inv.companyTitle ? `・${inv.companyTitle}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600 whitespace-nowrap">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {TYPE_LABELS[inv.invoiceType] ?? inv.invoiceType}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {statusBadge(inv.status)}
                      {inv.status === "failed" && inv.errorMessage && (
                        <div className="text-[11px] text-red-500 mt-1 max-w-[180px]">
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
                              disabled={busy}
                              className="inline-flex items-center gap-1 border border-primary text-primary px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-primary/10 disabled:opacity-50 whitespace-nowrap"
                            >
                              <ReceiptText size={13} />
                              {inv.status === "failed" ? "重試開立" : "開立發票"}
                            </button>
                          )}
                          {isLatest && inv.status === "issued" && (
                            <button
                              onClick={() => handleVoid(inv)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 border border-red-400 text-red-600 px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                            >
                              <XCircle size={13} />
                              作廢
                            </button>
                          )}
                          {!isLatest ? (
                            <span className="text-xs text-muted-foreground">
                              歷史紀錄
                            </span>
                          ) : (
                            !canIssue &&
                            inv.status !== "issued" && (
                              <span className="text-xs text-muted-foreground">
                                {inv.paymentStatus === "paid" ? "—" : "訂單未付款"}
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
  const toneClasses: Record<string, string> = {
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
    red: "bg-red-100 text-red-600",
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
