import { useMemo, useState } from "react";
import {
  useAdminListRegistrations,
  type Registration,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  Search,
  Download,
  RefreshCw,
  Package,
  CheckCircle2,
  Clock,
  Banknote,
  XCircle,
  Undo2,
  Trash2,
  Send,
  Crown,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "已付款",
  pending: "處理中",
  awaiting_transfer: "待匯款",
  unpaid: "未付款",
  failed: "付款失敗",
  refunded: "已退款",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  newebpay: "藍新金流",
  stripe: "Stripe 信用卡",
  bank: "銀行轉帳 / ATM",
};

const TICKET_TYPE_LABELS: Record<string, string> = {
  single: "單日票",
  combo: "兩日套票",
  tournament: "戰鬥陀螺賽參賽",
  "tournament-companion": "戰鬥陀螺賽隨同票",
};

type OrderStatus =
  | "paid"
  | "awaiting_transfer"
  | "unpaid"
  | "failed"
  | "refunded";

interface Order {
  ref: string;
  isRealRef: boolean;
  legs: Registration[];
  buyerName: string;
  phone: string;
  email: string | null;
  ticketType: string | null;
  ticketCount: number;
  eventDates: string[];
  amount: number;
  paymentMethod: string | null;
  paymentStatus: string;
  createdAt: string;
  checkedInCount: number;
  isVip: boolean;
}

function normalizeStatus(s: string | null | undefined): OrderStatus {
  const key = s ?? "unpaid";
  if (key === "paid") return "paid";
  if (key === "awaiting_transfer") return "awaiting_transfer";
  if (key === "failed") return "failed";
  if (key === "refunded") return "refunded";
  return "unpaid"; // unpaid + pending grouped as 未付款/處理中
}

function buildOrders(registrations: Registration[]): Order[] {
  const groups = new Map<string, Registration[]>();
  for (const reg of registrations) {
    const key = reg.paymentRef ?? `single-${reg.id}`;
    const arr = groups.get(key);
    if (arr) arr.push(reg);
    else groups.set(key, [reg]);
  }

  const orders: Order[] = [];
  for (const [key, legs] of groups) {
    // head leg = the one carrying the amount (combo non-head legs are null)
    const head = legs.find((l) => l.amount != null) ?? legs[0];
    const amount = legs.reduce((sum, l) => sum + (l.amount ?? 0), 0);
    const eventDates = Array.from(new Set(legs.map((l) => l.eventDate))).sort();
    orders.push({
      ref: legs[0].paymentRef ?? key,
      isRealRef: Boolean(legs[0].paymentRef),
      legs,
      buyerName: head.parentName,
      phone: head.phone,
      email: head.email ?? null,
      ticketType: head.ticketType ?? null,
      ticketCount: head.ticketCount,
      eventDates,
      amount,
      paymentMethod: head.paymentMethod ?? null,
      paymentStatus: head.paymentStatus,
      createdAt: head.createdAt as unknown as string,
      checkedInCount: legs.filter((l) => l.checkedInAt).length,
      isVip: legs.some((l) => l.isVip),
    });
  }

  orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return orders;
}

type FilterKey = "all" | OrderStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "paid", label: "已付款" },
  { key: "awaiting_transfer", label: "待匯款" },
  { key: "unpaid", label: "未付款 / 處理中" },
  { key: "failed", label: "付款失敗" },
  { key: "refunded", label: "已退款" },
];

function statusBadge(status: string) {
  const key = normalizeStatus(status);
  const realKey = status ?? "unpaid";
  const label = PAYMENT_STATUS_LABELS[realKey] ?? realKey;
  const tone =
    key === "paid"
      ? "bg-green-100 text-green-700"
      : key === "awaiting_transfer"
        ? "bg-amber-100 text-amber-700"
        : key === "failed"
          ? "bg-red-100 text-red-700"
          : key === "refunded"
            ? "bg-slate-200 text-slate-600"
            : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}

export default function OrdersManage() {
  const { hasRole } = useAuth();
  const canConfirm = hasRole("editor");
  const {
    data: registrations,
    isLoading,
    refetch,
    isRefetching,
  } = useAdminListRegistrations({});

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [confirmingRef, setConfirmingRef] = useState<string | null>(null);
  const [vipBusyRef, setVipBusyRef] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  const orders = useMemo(
    () => buildOrders(registrations ?? []),
    [registrations],
  );

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: orders.length,
      paid: 0,
      awaiting_transfer: 0,
      unpaid: 0,
      failed: 0,
      refunded: 0,
    };
    for (const o of orders) c[normalizeStatus(o.paymentStatus)] += 1;
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && normalizeStatus(o.paymentStatus) !== filter)
        return false;
      if (!q) return true;
      return (
        o.buyerName.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        (o.email ?? "").toLowerCase().includes(q) ||
        o.ref.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, search]);

  const orderByRef = useMemo(() => {
    const m = new Map<string, Order>();
    for (const o of orders) m.set(o.ref, o);
    return m;
  }, [orders]);

  const selectedOrders = useMemo(
    () =>
      Array.from(selected)
        .map((r) => orderByRef.get(r))
        .filter((o): o is Order => Boolean(o)),
    [selected, orderByRef],
  );

  const selectedAwaiting = selectedOrders.filter(
    (o) => o.paymentStatus === "awaiting_transfer" && o.isRealRef,
  );

  // Only paid orders have a QR + a confirmation email worth resending, and we
  // need an email address to send to.
  const selectedResendable = selectedOrders.filter(
    (o) => normalizeStatus(o.paymentStatus) === "paid" && Boolean(o.email),
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((o) => selected.has(o.ref));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const o of filtered) next.delete(o.ref);
      } else {
        for (const o of filtered) next.add(o.ref);
      }
      return next;
    });
  };

  const toggleOne = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const sel = selectedOrders;
    if (sel.length === 0) return;
    const ids = sel.flatMap((o) => o.legs.map((l) => l.id));
    const paidCount = sel.filter(
      (o) => normalizeStatus(o.paymentStatus) === "paid",
    ).length;
    const warn =
      paidCount > 0
        ? `\n\n⚠️ 其中有 ${paidCount} 筆「已付款」訂單，刪除後將一併移除該筆營收與報到紀錄。`
        : "";
    if (
      !window.confirm(
        `確定要刪除選取的 ${sel.length} 筆訂單嗎？此操作無法復原。${warn}`,
      )
    ) {
      return;
    }
    setIsBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/registrations/bulk-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "刪除失敗");
      }
      setSelected(new Set());
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "刪除失敗，請稍後再試");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkConfirm = async () => {
    const targets = selectedAwaiting;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        `確認已收到這 ${targets.length} 筆銀行匯款？\n系統會逐筆開立發票、寄送購票確認信（含入場 QR）、發送 Slack 通知。`,
      )
    ) {
      return;
    }
    setIsBulkConfirming(true);
    let ok = 0;
    const failed: string[] = [];
    try {
      for (const o of targets) {
        try {
          const res = await fetch(
            `/api/payments/${encodeURIComponent(o.ref)}/confirm-bank`,
            { method: "POST", credentials: "include" },
          );
          if (!res.ok) throw new Error();
          ok += 1;
        } catch {
          failed.push(o.ref);
        }
      }
      await refetch();
      setSelected(new Set());
      if (failed.length > 0) {
        window.alert(
          `完成 ${ok} 筆，${failed.length} 筆失敗：\n${failed.join("\n")}`,
        );
      }
    } finally {
      setIsBulkConfirming(false);
    }
  };

  const handleBulkResend = async () => {
    const targets = selectedResendable;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        `確定要重新發送這 ${targets.length} 筆訂單的購票確認信（含入場 QR Code）嗎？\n系統會寄送至每筆訂單的 Email；兩日套票會分別寄出兩天的 QR Code。`,
      )
    ) {
      return;
    }
    setIsResending(true);
    try {
      const ids = targets.flatMap((o) => o.legs.map((l) => l.id));
      const res = await fetch("/api/admin/registrations/resend-confirmation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "重新發送失敗");
      }
      const data = (await res.json().catch(() => ({}))) as {
        sent?: number;
        skipped?: number;
        failed?: number;
      };
      setSelected(new Set());
      window.alert(
        `已重新發送 ${data.sent ?? 0} 封確認信。` +
          (data.skipped ? `\n略過 ${data.skipped} 封（無 QR 或無 Email）。` : "") +
          (data.failed ? `\n失敗 ${data.failed} 封，請稍後再試。` : ""),
      );
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "重新發送失敗，請稍後再試",
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleConfirmBank = async (paymentRef: string) => {
    if (
      !window.confirm(
        "確認已收到這筆銀行匯款？\n確認後系統會：開立發票、寄送購票確認信（含入場 QR）、發送 Slack 通知。",
      )
    ) {
      return;
    }
    setConfirmingRef(paymentRef);
    try {
      const res = await fetch(
        `/api/payments/${encodeURIComponent(paymentRef)}/confirm-bank`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "確認失敗");
      }
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "確認失敗，請稍後再試");
    } finally {
      setConfirmingRef(null);
    }
  };

  const handleToggleVip = async (o: Order) => {
    const next = !o.isVip;
    const ids = o.legs.map((l) => l.id);
    if (
      next &&
      !window.confirm(
        "將這筆訂單設為「早鳥VIP」？\n報到時會標示「VIP・可帶 6 歲以下兒童免費入場」，僅供現場放行使用，不會改變金額或票數。",
      )
    ) {
      return;
    }
    setVipBusyRef(o.ref);
    try {
      const res = await fetch("/api/admin/registrations/set-vip", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, isVip: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "設定失敗");
      }
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "設定失敗，請稍後再試");
    } finally {
      setVipBusyRef(null);
    }
  };

  const handleReconcile = async () => {
    if (
      !window.confirm(
        "向藍新金流（NewebPay）逐筆查詢「待付款」訂單的真實付款狀態？\n凡是藍新顯示「已付款」的訂單，系統會自動確認、開立發票並補寄購票確認信（含入場 QR）。未付款的訂單不會有任何變動。",
      )
    ) {
      return;
    }
    setIsReconciling(true);
    try {
      const res = await fetch("/api/payments/newebpay/reconcile", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "對帳失敗");
      }
      const data = (await res.json()) as {
        checked?: number;
        confirmed?: number;
        stillUnpaid?: number;
        errors?: number;
      };
      await refetch();
      window.alert(
        `對帳完成：\n共查詢 ${data.checked ?? 0} 筆待付款訂單\n已確認並補寄確認信 ${data.confirmed ?? 0} 筆\n仍未付款 ${data.stillUnpaid ?? 0} 筆` +
          (data.errors ? `\n查詢失敗 ${data.errors} 筆，請稍後再試一次` : ""),
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "對帳失敗，請稍後再試");
    } finally {
      setIsReconciling(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/admin/registrations/export", {
        credentials: "include",
      });
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `orders_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      window.alert("匯出失敗");
    } finally {
      setIsExporting(false);
    }
  };

  const paidRevenue = orders
    .filter((o) => normalizeStatus(o.paymentStatus) === "paid")
    .reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display">訂單管理</h1>
          <p className="text-muted-foreground mt-1">
            查詢所有購票訂單、確認銀行匯款、追蹤付款與報到狀態
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="border px-4 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:bg-muted transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
            重新整理
          </button>
          {canConfirm && (
            <button
              onClick={handleReconcile}
              disabled={isReconciling}
              title="向藍新金流查詢待付款訂單的真實狀態，已付款者自動補確認並補寄確認信"
              className="border border-emerald-500 text-emerald-700 px-4 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:bg-emerald-50 transition-all disabled:opacity-50"
            >
              <Banknote size={16} className={isReconciling ? "animate-pulse" : ""} />
              {isReconciling ? "對帳中..." : "藍新對帳"}
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-primary text-white px-5 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
          >
            <Download size={18} />
            {isExporting ? "匯出中..." : "匯出 CSV"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Package size={22} />}
          tone="blue"
          label="總訂單數"
          value={`${counts.all} 筆`}
        />
        <SummaryCard
          icon={<CheckCircle2 size={22} />}
          tone="green"
          label="已付款訂單"
          value={`${counts.paid} 筆`}
          sub={formatCurrency(paidRevenue)}
        />
        <SummaryCard
          icon={<Banknote size={22} />}
          tone="amber"
          label="待確認匯款"
          value={`${counts.awaiting_transfer} 筆`}
        />
        <SummaryCard
          icon={<Clock size={22} />}
          tone="slate"
          label="未付款 / 處理中"
          value={`${counts.unpaid} 筆`}
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
              {f.label}
              <span className="ml-1.5 opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋姓名、電話、Email、訂單編號"
            className="w-full pl-9 pr-3 py-2.5 rounded-full border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Batch action bar */}
      {canConfirm && selected.size > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="text-sm font-semibold text-foreground">
            已選取 {selected.size} 筆訂單
            {selectedAwaiting.length > 0 && (
              <span className="ml-2 text-amber-600 font-normal">
                （其中 {selectedAwaiting.length} 筆待匯款）
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedAwaiting.length > 0 && (
              <button
                onClick={handleBulkConfirm}
                disabled={isBulkConfirming || isBulkDeleting || isResending}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Banknote size={16} />
                {isBulkConfirming
                  ? "確認中..."
                  : `批量確認收款（${selectedAwaiting.length}）`}
              </button>
            )}
            {selectedResendable.length > 0 && (
              <button
                onClick={handleBulkResend}
                disabled={isResending || isBulkDeleting || isBulkConfirming}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Send size={16} />
                {isResending
                  ? "發送中..."
                  : `批量重新發送 QR（${selectedResendable.length}）`}
              </button>
            )}
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting || isBulkConfirming || isResending}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              {isBulkDeleting ? "刪除中..." : `批量刪除（${selected.size}）`}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={isBulkDeleting || isBulkConfirming}
              className="px-4 py-2 rounded-xl border text-sm font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
            >
              取消選取
            </button>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30">
              <tr>
                {canConfirm && (
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="全選"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      disabled={filtered.length === 0}
                      className="h-4 w-4 rounded border-muted-foreground/40 accent-primary cursor-pointer"
                    />
                  </th>
                )}
                <th className="p-4 font-semibold text-muted-foreground">訂單編號</th>
                <th className="p-4 font-semibold text-muted-foreground">購買人</th>
                <th className="p-4 font-semibold text-muted-foreground">聯絡方式</th>
                <th className="p-4 font-semibold text-muted-foreground">票種</th>
                <th className="p-4 font-semibold text-muted-foreground">入場日期</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">票數</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">金額</th>
                <th className="p-4 font-semibold text-muted-foreground">付款方式</th>
                <th className="p-4 font-semibold text-muted-foreground">狀態</th>
                <th className="p-4 font-semibold text-muted-foreground">報到</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={canConfirm ? 12 : 11} className="p-10 text-center text-muted-foreground">
                    載入中...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canConfirm ? 12 : 11} className="p-10 text-center text-muted-foreground">
                    {orders.length === 0 ? "尚無訂單資料" : "沒有符合條件的訂單"}
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const totalSeats = o.legs.length;
                  const isSelected = selected.has(o.ref);
                  return (
                    <tr
                      key={o.ref}
                      className={`align-top transition-colors ${
                        isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                      }`}
                    >
                      {canConfirm && (
                        <td className="p-4">
                          <input
                            type="checkbox"
                            aria-label={`選取訂單 ${o.isRealRef ? o.ref : o.buyerName}`}
                            checked={isSelected}
                            onChange={() => toggleOne(o.ref)}
                            className="h-4 w-4 rounded border-muted-foreground/40 accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="p-4 font-mono text-xs">
                        {o.isRealRef ? o.ref : "—"}
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {new Date(o.createdAt).toLocaleString("zh-TW")}
                        </div>
                      </td>
                      <td className="p-4 font-medium whitespace-nowrap">
                        {o.buyerName}
                        {o.isVip && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold align-middle"
                            title="早鳥VIP：報到時可帶 6 歲以下兒童免費入場"
                          >
                            <Crown size={11} /> VIP
                          </span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div>{o.phone}</div>
                        {o.email && (
                          <div className="text-xs text-muted-foreground">
                            {o.email}
                          </div>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {o.ticketType
                          ? (TICKET_TYPE_LABELS[o.ticketType] ?? o.ticketType)
                          : "—"}
                      </td>
                      <td className="p-4 text-primary font-medium whitespace-nowrap">
                        {o.eventDates.map((d) => formatDate(d)).join("、")}
                      </td>
                      <td className="p-4 text-right font-bold">{o.ticketCount}</td>
                      <td className="p-4 text-right font-bold text-green-600 whitespace-nowrap">
                        {formatCurrency(o.amount)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {o.paymentMethod
                          ? (PAYMENT_METHOD_LABELS[o.paymentMethod] ??
                            o.paymentMethod)
                          : "—"}
                      </td>
                      <td className="p-4">{statusBadge(o.paymentStatus)}</td>
                      <td className="p-4 whitespace-nowrap text-xs">
                        {o.checkedInCount > 0 ? (
                          <span className="text-green-600 font-medium">
                            已報到 {o.checkedInCount}/{totalSeats}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">未報到</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          {o.paymentStatus === "awaiting_transfer" &&
                          o.isRealRef ? (
                            canConfirm ? (
                              <button
                                onClick={() => handleConfirmBank(o.ref)}
                                disabled={confirmingRef === o.ref}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                {confirmingRef === o.ref ? "處理中..." : "確認收款"}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                待編輯確認
                              </span>
                            )
                          ) : o.paymentStatus === "refunded" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Undo2 size={12} /> 已退款
                            </span>
                          ) : o.paymentStatus === "failed" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-500">
                              <XCircle size={12} /> 失敗
                            </span>
                          ) : null}
                          {canConfirm && (
                            <button
                              onClick={() => handleToggleVip(o)}
                              disabled={vipBusyRef === o.ref}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-50 ${
                                o.isVip
                                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  : "border border-amber-400 text-amber-700 hover:bg-amber-50"
                              }`}
                              title="早鳥VIP：報到時可帶 6 歲以下兒童免費入場（不影響金額與票數）"
                            >
                              <Crown size={12} />
                              {vipBusyRef === o.ref
                                ? "處理中..."
                                : o.isVip
                                  ? "取消VIP"
                                  : "設為VIP"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        共 {filtered.length} 筆訂單{filter !== "all" ? "（已套用篩選）" : ""}。兩日套票會合併為一筆訂單顯示。
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  tone: "blue" | "green" | "amber" | "slate";
  label: string;
  value: string;
  sub?: string;
}) {
  const toneClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
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
          {sub && (
            <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}
