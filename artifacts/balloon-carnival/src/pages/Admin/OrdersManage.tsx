import { tx, getLocale, useI18n, txApi } from "@/lib/i18n";
import { useMemo, useState } from "react";
import {
  useAdminListRegistrations,
  useAdminListInvoices,
  type Registration,
  type AdminInvoice,
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
  Eye,
  X,
  ReceiptText,
  Mail,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

const PAYMENT_STATUS_LABELS = (): Record<string, string> => ({
  paid: tx("已付款"),
  pending: tx("處理中"),
  awaiting_transfer: tx("待匯款"),
  unpaid: tx("未付款"),
  failed: tx("付款失敗"),
  refunded: tx("已退款"),
});

const PAYMENT_METHOD_LABELS = (): Record<string, string> => ({
  newebpay: tx("藍新金流"),
  stripe: tx("Stripe 信用卡"),
  bank: tx("銀行轉帳 / ATM"),
  onsite: tx("現場售票"),
});

const TICKET_TYPE_LABELS = (): Record<string, string> => ({
  single: tx("單日票"),
  combo: tx("兩日套票"),
  tournament: tx("戰鬥陀螺賽參賽"),
  "tournament-companion": tx("戰鬥陀螺賽隨同票"),
});

// Carnival event days, used for the order date filter.
const EVENT_DATES = ["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"];

const EVENT_DATE_WEEKDAY = (): Record<string, string> => ({
  "2026-07-23": tx("四"),
  "2026-07-24": tx("五"),
  "2026-07-25": tx("六"),
  "2026-07-26": tx("日"),
});

function eventDateLabel(d: string) {
  const [, m, day] = d.split("-");
  const wd = EVENT_DATE_WEEKDAY()[d];
  return `${Number(m)}/${Number(day)}${wd ? tx("（{0}）", [wd]) : ""}`;
}

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
      checkedInCount: legs.reduce((sum, l) => sum + (l.checkedInCount ?? 0), 0),
      isVip: legs.some((l) => l.isVip),
    });
  }

  orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return orders;
}

type FilterKey = "all" | OrderStatus;

const FILTERS = (): { key: FilterKey; label: string }[] => ([
  { key: "all", label: tx("全部") },
  { key: "paid", label: tx("已付款") },
  { key: "awaiting_transfer", label: tx("待匯款") },
  { key: "unpaid", label: tx("未付款 / 處理中") },
  { key: "failed", label: tx("付款失敗") },
  { key: "refunded", label: tx("已退款") },
]);

function statusBadge(status: string) {
  const key = normalizeStatus(status);
  const realKey = status ?? "unpaid";
  const label = PAYMENT_STATUS_LABELS()[realKey] ?? realKey;
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
  useI18n();
  const { hasRole } = useAuth();
  const canConfirm = hasRole("editor");
  const {
    data: registrations,
    isLoading,
    refetch,
    isRefetching,
  } = useAdminListRegistrations({});
  const { data: invoices, refetch: refetchInvoices } = useAdminListInvoices();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [confirmingRef, setConfirmingRef] = useState<string | null>(null);
  const [markingPaidRef, setMarkingPaidRef] = useState<string | null>(null);
  const [refundingRef, setRefundingRef] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [vipBusyRef, setVipBusyRef] = useState<string | null>(null);
  const [editEmailOrder, setEditEmailOrder] = useState<Order | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);
  const [isBulkMarking, setIsBulkMarking] = useState(false);
  const [isBulkIssuing, setIsBulkIssuing] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // 現場售票：後台直接建立已付款訂單
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    parentName: "",
    phone: "",
    email: "",
    ticketCount: 1,
    amount: 300,
    eventDate: "2026-07-25",
  });

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/registrations/manual", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: createForm.parentName.trim(),
          phone: createForm.phone.trim(),
          email: createForm.email.trim() || undefined,
          ticketCount: createForm.ticketCount,
          amount: createForm.amount,
          eventDate: createForm.eventDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(txApi(data?.error) || tx("建立訂單失敗"));
        return;
      }
      window.alert(
        tx("訂單建立成功（已付款）！\n訂單編號：{0}\n", [data.paymentRef]) +
          (createForm.email.trim()
            ? data.emailSent
              ? tx("入場 QR Code 確認信已寄出。")
              : tx("確認信寄送失敗，可稍後在列表中「補寄確認信」。")
            : tx("未填 Email，不會寄送 QR Code；入場時可用姓名/電話查詢。")),
      );
      setCreateOpen(false);
      setCreateForm({ parentName: "", phone: "", email: "", ticketCount: 1, amount: 300, eventDate: createForm.eventDate });
      await refetch();
    } catch {
      window.alert(tx("建立訂單失敗，請稍後再試"));
    } finally {
      setIsCreating(false);
    }
  };

  // Only one bulk action may run at a time — concurrent batch mutations would
  // race on the same orders and produce confusing partial results.
  const anyBulkBusy =
    isBulkDeleting ||
    isBulkConfirming ||
    isBulkMarking ||
    isBulkIssuing ||
    isResending;

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
      if (dateFilter !== "all" && !o.eventDates.includes(dateFilter))
        return false;
      if (!q) return true;
      return (
        o.buyerName.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        (o.email ?? "").toLowerCase().includes(q) ||
        o.ref.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, search, dateFilter]);

  const orderByRef = useMemo(() => {
    const m = new Map<string, Order>();
    for (const o of orders) m.set(o.ref, o);
    return m;
  }, [orders]);

  // Latest invoice per payment ref (admin list is sorted newest-first by id).
  const invoiceByRef = useMemo(() => {
    const m = new Map<string, AdminInvoice>();
    for (const inv of invoices ?? []) {
      if (!m.has(inv.paymentRef)) m.set(inv.paymentRef, inv);
    }
    return m;
  }, [invoices]);

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

  // Unpaid / processing orders can be manually marked as paid (e.g. cash on
  // site or offline transfer) so the buyer receives their confirmation + QR.
  const selectedMarkable = selectedOrders.filter(
    (o) => normalizeStatus(o.paymentStatus) === "unpaid",
  );

  // Paid orders whose (latest) invoice is still pending or previously failed —
  // i.e. an official e-invoice can be issued for them. Refunded orders and ones
  // already issued/voided are excluded.
  const selectedIssuable = selectedOrders.filter((o) => {
    if (normalizeStatus(o.paymentStatus) !== "paid") return false;
    const inv = invoiceByRef.get(o.ref);
    return inv != null && (inv.status === "pending" || inv.status === "failed");
  });

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
    if (anyBulkBusy) return;
    const sel = selectedOrders;
    if (sel.length === 0) return;
    const ids = sel.flatMap((o) => o.legs.map((l) => l.id));
    const paidCount = sel.filter(
      (o) => normalizeStatus(o.paymentStatus) === "paid",
    ).length;
    const warn =
      paidCount > 0
        ? tx("\n\n⚠️ 其中有 {0} 筆「已付款」訂單，刪除後將一併移除該筆營收與報到紀錄。", [paidCount])
        : "";
    if (
      !window.confirm(
        tx("確定要刪除選取的 {0} 筆訂單嗎？此操作無法復原。{1}", [sel.length, warn]),
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
        throw new Error(txApi(data?.error) || tx("刪除失敗"));
      }
      setSelected(new Set());
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("刪除失敗，請稍後再試"));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkConfirm = async () => {
    if (anyBulkBusy) return;
    const targets = selectedAwaiting;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        tx("確認已收到這 {0} 筆銀行匯款？\n系統會逐筆開立發票、寄送購票確認信（含入場 QR）、發送 Slack 通知。", [targets.length]),
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
          tx("完成 {0} 筆，{1} 筆失敗：\n{2}", [ok, failed.length, failed.join("\n")]),
        );
      }
    } finally {
      setIsBulkConfirming(false);
    }
  };

  const handleBulkResend = async () => {
    if (anyBulkBusy) return;
    const targets = selectedResendable;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        tx("確定要重新發送這 {0} 筆訂單的購票確認信（含入場 QR Code）嗎？\n系統會寄送至每筆訂單的 Email；兩日套票會分別寄出兩天的 QR Code。", [targets.length]),
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
        throw new Error(txApi(data?.error) || tx("重新發送失敗"));
      }
      const data = (await res.json().catch(() => ({}))) as {
        sent?: number;
        skipped?: number;
        failed?: number;
      };
      setSelected(new Set());
      window.alert(
        tx("已重新發送 {0} 封確認信。", [data.sent ?? 0]) +
          (data.skipped ? tx("\n略過 {0} 封（無 QR 或無 Email）。", [data.skipped]) : "") +
          (data.failed ? tx("\n失敗 {0} 封，請稍後再試。", [data.failed]) : ""),
      );
    } catch (err) {
      window.alert(
        err instanceof Error ? txApi(err.message) : tx("重新發送失敗，請稍後再試"),
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleBulkIssueInvoice = async () => {
    if (anyBulkBusy) return;
    const targets = selectedIssuable;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        tx("要為這 {0} 筆訂單批量開立電子發票嗎？\n系統會逐筆向綠界送出開立要求，並寄送發票通知給顧客。", [targets.length]),
      )
    ) {
      return;
    }
    setIsBulkIssuing(true);
    let ok = 0;
    const errors: string[] = [];
    try {
      for (const o of targets) {
        try {
          const res = await fetch(
            `/api/payments/invoices/${encodeURIComponent(o.ref)}/retry`,
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
              tx("{0}：{1}", [o.buyerName, txApi(result.errorMessage) || txApi(result.error) || tx("未成功")]),
            );
          }
        } catch (err) {
          errors.push(
            tx("{0}：{1}", [o.buyerName, err instanceof Error ? txApi(err.message) : tx("連線錯誤")]),
          );
        }
      }
      setSelected(new Set());
      await refetch();
      await refetchInvoices();
      window.alert(
        tx("批量開立完成：成功 {0} 張，失敗 {1} 張。", [ok, errors.length]) +
          (errors.length
            ? tx("\n\n失敗明細：\n{0}{1}", [errors.slice(0, 10).join("\n"), errors.length > 10 ? "\n…" : ""])
            : ""),
      );
    } finally {
      setIsBulkIssuing(false);
    }
  };

  const handleConfirmBank = async (paymentRef: string) => {
    if (
      !window.confirm(
        tx("確認已收到這筆銀行匯款？\n確認後系統會：開立發票、寄送購票確認信（含入場 QR）、發送 Slack 通知。"),
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
        throw new Error(txApi(data?.error) || tx("確認失敗"));
      }
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("確認失敗，請稍後再試"));
    } finally {
      setConfirmingRef(null);
    }
  };

  const [checkinRef, setCheckinRef] = useState<string | null>(null);

  const handleCheckinOrder = async (o: Order) => {
    const totalSeats = o.legs.reduce((sum, l) => sum + (l.ticketCount ?? 0), 0);
    const remaining = totalSeats - o.checkedInCount;
    if (remaining <= 0) return;
    if (
      !window.confirm(
        tx("確認為此訂單報到？\n購買人：{0}\n將簽到剩餘 {1} 位（共 {2} 位）。", [o.buyerName, remaining, totalSeats]),
      )
    ) {
      return;
    }
    setCheckinRef(o.ref);
    try {
      const failed: string[] = [];
      for (const leg of o.legs) {
        const legRemaining = (leg.ticketCount ?? 0) - (leg.checkedInCount ?? 0);
        if (legRemaining <= 0) continue;
        const res = await fetch(`/api/admin/checkin/by-id/${leg.id}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          failed.push(
            tx("{0}：{1}", [eventDateLabel(leg.eventDate), txApi(data?.error) || tx("報到失敗")]),
          );
        }
      }
      await refetch();
      if (failed.length > 0) {
        window.alert(tx("部分報到失敗：\n{0}", [failed.join("\n")]));
      }
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("報到失敗，請稍後再試"));
    } finally {
      setCheckinRef(null);
    }
  };

  const handleMarkPaid = async (o: Order) => {
    if (
      !window.confirm(
        tx("確認將這筆訂單標記為「已付款」？\n適用於現場收款、手動匯款等情況。系統會寄送購票確認信（含入場 QR Code）給購買人。"),
      )
    ) {
      return;
    }
    setMarkingPaidRef(o.ref);
    try {
      const ids = o.legs.map((l) => l.id);
      const res = await fetch("/api/admin/registrations/mark-paid", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(txApi(data?.error) || tx("標記失敗"));
      }
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("標記失敗，請稍後再試"));
    } finally {
      setMarkingPaidRef(null);
    }
  };

  // 退票：改走退票申請流程 —— 輸入原因後建立退票申請（出現在退票管理），
  // 並自動寄「退款資料表單」Email 給買家。已簽到的訂單也可退。
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundCount, setRefundCount] = useState(1);

  const openRefundDialog = (o: Order) => {
    setRefundOrder(o);
    setRefundReason("");
    setRefundCount(Math.max(...o.legs.map((l) => l.ticketCount)));
  };

  const submitRefund = async () => {
    if (!refundOrder) return;
    if (refundReason.trim().length < 5) {
      window.alert(tx("請填寫退票原因（至少 5 字）"));
      return;
    }
    setRefundingRef(refundOrder.ref);
    try {
      const res = await fetch("/api/admin/refund-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentRef: refundOrder.ref,
          reason: refundReason.trim(),
          ticketCount: refundCount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(txApi(data?.error) || tx("退票申請建立失敗"));
      window.alert(
        tx("已建立退票申請（退 {0} 張、建議退款 NT$ {1}），", [data.refundTicketCount, (data.refundAmount ?? 0).toLocaleString()]) +
          tx("並寄出退款資料表單 Email 給買家。\n請到「退票管理」審核並核准後才會實際扣票。"),
      );
      setRefundOrder(null);
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("退票申請建立失敗，請稍後再試"));
    } finally {
      setRefundingRef(null);
    }
  };

  const handleBulkMarkPaid = async () => {
    if (anyBulkBusy) return;
    const targets = selectedMarkable;
    if (targets.length === 0) return;
    if (
      !window.confirm(
        tx("確認將選取的 {0} 筆訂單標記為「已付款」？\n系統會逐筆寄送購票確認信（含入場 QR Code）給購買人。", [targets.length]),
      )
    ) {
      return;
    }
    setIsBulkMarking(true);
    try {
      const ids = targets.flatMap((o) => o.legs.map((l) => l.id));
      const res = await fetch("/api/admin/registrations/mark-paid", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(txApi(data?.error) || tx("標記失敗"));
      }
      setSelected(new Set());
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("標記失敗，請稍後再試"));
    } finally {
      setIsBulkMarking(false);
    }
  };

  const handleToggleVip = async (o: Order) => {
    const next = !o.isVip;
    const ids = o.legs.map((l) => l.id);
    if (
      next &&
      !window.confirm(
        tx("將這筆訂單設為「早鳥VIP」？\n報到時會標示「VIP・可帶 6 歲以下兒童免費入場」，僅供現場放行使用，不會改變金額或票數。"),
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
        throw new Error(txApi(data?.error) || tx("設定失敗"));
      }
      await refetch();
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("設定失敗，請稍後再試"));
    } finally {
      setVipBusyRef(null);
    }
  };

  const openEditEmail = (o: Order) => {
    setEditEmailOrder(o);
    setEditEmailValue(o.email ?? "");
  };

  const handleSaveEmail = async () => {
    const o = editEmailOrder;
    if (!o) return;
    const email = editEmailValue.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      window.alert(tx("請輸入有效的 Email 地址"));
      return;
    }
    setIsSavingEmail(true);
    try {
      const ids = o.legs.map((l) => l.id);
      const res = await fetch("/api/admin/registrations/set-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(txApi(data?.error) || tx("儲存失敗"));
      }
      await refetch();
      setEditEmailOrder(null);

      // After filling in the Email, offer to send the buyer their confirmation
      // mail. Only paid orders have a QR + confirmation worth sending.
      if (
        normalizeStatus(o.paymentStatus) === "paid" &&
        window.confirm(
          tx("Email 已更新。要立即寄送購票確認信（含入場 QR Code）給這位顧客嗎？"),
        )
      ) {
        const sendRes = await fetch(
          "/api/admin/registrations/resend-confirmation",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          },
        );
        const data = (await sendRes.json().catch(() => ({}))) as {
          sent?: number;
          skipped?: number;
          failed?: number;
        };
        if (!sendRes.ok) {
          throw new Error(tx("確認信寄送失敗"));
        }
        window.alert(
          tx("已寄送 {0} 封確認信。", [data.sent ?? 0]) +
            (data.skipped ? tx("\n略過 {0} 封（無 QR 或無 Email）。", [data.skipped]) : "") +
            (data.failed ? tx("\n失敗 {0} 封，請稍後再試。", [data.failed]) : ""),
        );
      }
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("操作失敗，請稍後再試"));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleReconcile = async () => {
    if (
      !window.confirm(
        tx("向藍新金流（NewebPay）逐筆查詢「待付款」訂單的真實付款狀態？\n凡是藍新顯示「已付款」的訂單，系統會自動確認、開立發票並補寄購票確認信（含入場 QR）。未付款的訂單不會有任何變動。"),
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
        throw new Error(txApi(data?.error) || tx("對帳失敗"));
      }
      const data = (await res.json()) as {
        checked?: number;
        confirmed?: number;
        stillUnpaid?: number;
        errors?: number;
      };
      await refetch();
      window.alert(
        tx("對帳完成：\n共查詢 {0} 筆待付款訂單\n已確認並補寄確認信 {1} 筆\n仍未付款 {2} 筆", [data.checked ?? 0, data.confirmed ?? 0, data.stillUnpaid ?? 0]) +
          (data.errors ? tx("\n查詢失敗 {0} 筆，請稍後再試一次", [data.errors]) : ""),
      );
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("對帳失敗，請稍後再試"));
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
      window.alert(tx("匯出失敗"));
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
          <h1 className="text-3xl font-display">{tx("訂單管理")}</h1>
          <p className="text-muted-foreground mt-1">
            {tx("查詢所有購票訂單、確認銀行匯款、追蹤付款與報到狀態")}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="border px-4 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:bg-muted transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
            {tx("重新整理")}
          </button>
          {canConfirm && (
            <button
              onClick={handleReconcile}
              disabled={isReconciling}
              title={tx("向藍新金流查詢待付款訂單的真實狀態，已付款者自動補確認並補寄確認信")}
              className="border border-emerald-500 text-emerald-700 px-4 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:bg-emerald-50 transition-all disabled:opacity-50"
            >
              <Banknote size={16} className={isReconciling ? "animate-pulse" : ""} />
              {isReconciling ? tx("對帳中...") : tx("藍新對帳")}
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-primary text-white px-5 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
          >
            <Download size={18} />
            {isExporting ? tx("匯出中...") : tx("匯出 CSV")}
          </button>
          {canConfirm && (
            <button
              onClick={() => setCreateOpen(true)}
              className="bg-green-600 text-white px-5 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-md"
              data-testid="button-create-order"
            >
              <Package size={18} />
              {tx("新增訂單")}
            </button>
          )}
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !isCreating && setCreateOpen(false)}>
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold">{tx("新增訂單（現場售票）")}</h2>
              <button onClick={() => !isCreating && setCreateOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={22} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {tx("建立後訂單立即為「已付款」狀態；若填寫 Email 會自動寄送入場 QR Code 確認信。")}
            </p>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="text-sm font-bold block mb-1.5">{tx("姓名")} <span className="text-destructive">*</span></label>
                <input
                  required type="text" value={createForm.parentName}
                  onChange={(e) => setCreateForm({ ...createForm, parentName: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:outline-none focus:border-primary"
                  data-testid="input-create-name"
                />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1.5">{tx("電話")} <span className="text-destructive">*</span></label>
                <input
                  required type="tel" value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:outline-none focus:border-primary"
                  data-testid="input-create-phone"
                />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1.5">Email <span className="text-xs font-normal text-muted-foreground">{tx("（選填，填寫將寄送 QR Code）")}</span></label>
                <input
                  type="email" value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:outline-none focus:border-primary"
                  data-testid="input-create-email"
                />
              </div>
              <div>
                <label className="text-sm font-bold block mb-1.5">{tx("入場日期")} <span className="text-destructive">*</span></label>
                <select
                  value={createForm.eventDate}
                  onChange={(e) => setCreateForm({ ...createForm, eventDate: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-border focus:outline-none focus:border-primary bg-white"
                  data-testid="select-create-date"
                >
                  {EVENT_DATES.map((d) => (
                    <option key={d} value={d}>{eventDateLabel(d)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold block mb-1.5">{tx("張數")} <span className="text-destructive">*</span></label>
                  <input
                    required type="number" min={1} max={50} value={createForm.ticketCount}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                      setCreateForm({ ...createForm, ticketCount: n, amount: n * 300 });
                    }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border focus:outline-none focus:border-primary"
                    data-testid="input-create-count"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold block mb-1.5">{tx("總金額（NT$）")}<span className="text-destructive">*</span></label>
                  <input
                    required type="number" min={0} step={1} value={createForm.amount}
                    onChange={(e) => setCreateForm({ ...createForm, amount: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border focus:outline-none focus:border-primary"
                    data-testid="input-create-amount"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{tx("張數調整時金額會自動帶入 300/張，可再手動修改總金額。")}</p>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all"
                data-testid="button-create-submit"
              >
                {isCreating ? tx("建立中...") : tx("建立訂單（已付款）")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Package size={22} />}
          tone="blue"
          label={tx("總訂單數")}
          value={tx("{0} 筆", [counts.all])}
        />
        <SummaryCard
          icon={<CheckCircle2 size={22} />}
          tone="green"
          label={tx("已付款訂單")}
          value={tx("{0} 筆", [counts.paid])}
          sub={formatCurrency(paidRevenue)}
        />
        <SummaryCard
          icon={<Banknote size={22} />}
          tone="amber"
          label={tx("待確認匯款")}
          value={tx("{0} 筆", [counts.awaiting_transfer])}
        />
        <SummaryCard
          icon={<Clock size={22} />}
          tone="slate"
          label={tx("未付款 / 處理中")}
          value={tx("{0} 筆", [counts.unpaid])}
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
              {f.label}
              <span className="ml-1.5 opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full sm:w-40 px-3 py-2.5 rounded-full border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">{tx("全部日期")}</option>
            {EVENT_DATES.map((d) => (
              <option key={d} value={d}>
                {eventDateLabel(d)}
              </option>
            ))}
          </select>
          <div className="relative w-full lg:w-72">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tx("搜尋姓名、電話、Email、訂單編號")}
              className="w-full pl-9 pr-3 py-2.5 rounded-full border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Batch action bar */}
      {canConfirm && selected.size > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="text-sm font-semibold text-foreground">
            {tx("已選取 {0} 筆訂單", [selected.size])}
            {selectedAwaiting.length > 0 && (
              <span className="ml-2 text-amber-600 font-normal">
                {tx("（其中")} {selectedAwaiting.length} {tx("筆待匯款）")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedAwaiting.length > 0 && (
              <button
                onClick={handleBulkConfirm}
                disabled={anyBulkBusy}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Banknote size={16} />
                {isBulkConfirming
                  ? tx("確認中...")
                  : tx("批量確認收款（{0}）", [selectedAwaiting.length])}
              </button>
            )}
            {selectedMarkable.length > 0 && (
              <button
                onClick={handleBulkMarkPaid}
                disabled={anyBulkBusy}
                className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                {isBulkMarking
                  ? tx("標記中...")
                  : tx("標記已付款（{0}）", [selectedMarkable.length])}
              </button>
            )}
            {selectedIssuable.length > 0 && (
              <button
                onClick={handleBulkIssueInvoice}
                disabled={anyBulkBusy}
                title={tx("為已付款且尚未開立發票的訂單批量開立電子發票")}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <ReceiptText size={16} />
                {isBulkIssuing
                  ? tx("開立中...")
                  : tx("批量開立發票（{0}）", [selectedIssuable.length])}
              </button>
            )}
            {selectedResendable.length > 0 && (
              <button
                onClick={handleBulkResend}
                disabled={anyBulkBusy}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Send size={16} />
                {isResending
                  ? tx("發送中...")
                  : tx("批量重新發送 QR（{0}）", [selectedResendable.length])}
              </button>
            )}
            <button
              onClick={handleBulkDelete}
              disabled={anyBulkBusy}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              {isBulkDeleting ? tx("刪除中...") : tx("批量刪除（{0}）", [selected.size])}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={isBulkDeleting || isBulkConfirming}
              className="px-4 py-2 rounded-xl border text-sm font-semibold hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {tx("取消選取")}
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
                      aria-label={tx("全選")}
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      disabled={filtered.length === 0}
                      className="h-4 w-4 rounded border-muted-foreground/40 accent-primary cursor-pointer"
                    />
                  </th>
                )}
                <th className="p-4 font-semibold text-muted-foreground">{tx("訂單編號")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("購買人")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("聯絡方式")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("票種")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("入場日期")}</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">{tx("票數")}</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">{tx("金額")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("付款方式")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("狀態")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("報到")}</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">{tx("操作")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={canConfirm ? 12 : 11} className="p-10 text-center text-muted-foreground">
                    {tx("載入中...")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canConfirm ? 12 : 11} className="p-10 text-center text-muted-foreground">
                    {orders.length === 0 ? tx("尚無訂單資料") : tx("沒有符合條件的訂單")}
                  </td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const totalSeats = o.legs.reduce(
                    (sum, l) => sum + (l.ticketCount ?? 0),
                    0,
                  );
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
                            aria-label={tx("選取訂單 {0}", [o.isRealRef ? o.ref : o.buyerName])}
                            checked={isSelected}
                            onChange={() => toggleOne(o.ref)}
                            className="h-4 w-4 rounded border-muted-foreground/40 accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="p-4 font-mono text-xs">
                        {o.isRealRef ? o.ref : "—"}
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {new Date(o.createdAt).toLocaleString(getLocale())}
                        </div>
                      </td>
                      <td className="p-4 font-medium whitespace-nowrap">
                        {o.buyerName}
                        {o.isVip && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold align-middle"
                            title={tx("早鳥VIP：報到時可帶 6 歲以下兒童免費入場")}
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
                          ? (TICKET_TYPE_LABELS()[o.ticketType] ?? o.ticketType)
                          : "—"}
                      </td>
                      <td className="p-4 text-primary font-medium whitespace-nowrap">
                        {o.eventDates.map((d) => formatDate(d)).join(tx("、"))}
                      </td>
                      <td className="p-4 text-right font-bold">{o.ticketCount}</td>
                      <td className="p-4 text-right font-bold text-green-600 whitespace-nowrap">
                        {formatCurrency(o.amount)}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {o.paymentMethod
                          ? (PAYMENT_METHOD_LABELS()[o.paymentMethod] ??
                            o.paymentMethod)
                          : "—"}
                      </td>
                      <td className="p-4">{statusBadge(o.paymentStatus)}</td>
                      <td className="p-4 whitespace-nowrap text-xs">
                        <div className="flex flex-col items-start gap-1.5">
                          {o.checkedInCount > 0 ? (
                            <span className="text-green-600 font-medium">
                              {tx("已報到")} {o.checkedInCount}/{totalSeats}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {tx("未報到")}
                            </span>
                          )}
                          {canConfirm &&
                            normalizeStatus(o.paymentStatus) === "paid" &&
                            o.checkedInCount < totalSeats && (
                              <button
                                onClick={() => handleCheckinOrder(o)}
                                disabled={checkinRef === o.ref}
                                title={tx("現場簽到：將此訂單剩餘人數全部報到")}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap inline-flex items-center gap-1"
                              >
                                <CheckCircle2 size={12} />
                                {checkinRef === o.ref ? tx("處理中...") : tx("簽到")}
                              </button>
                            )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => setDetailOrder(o)}
                            title={tx("查看訂單詳情")}
                            className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-muted disabled:opacity-50 transition-colors whitespace-nowrap inline-flex items-center gap-1"
                          >
                            <Eye size={12} /> {tx("詳情")}
                          </button>
                          {o.paymentStatus === "awaiting_transfer" &&
                          o.isRealRef ? (
                            canConfirm ? (
                              <button
                                onClick={() => handleConfirmBank(o.ref)}
                                disabled={confirmingRef === o.ref}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                {confirmingRef === o.ref ? tx("處理中...") : tx("確認收款")}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {tx("待編輯確認")}
                              </span>
                            )
                          ) : normalizeStatus(o.paymentStatus) === "unpaid" ? (
                            canConfirm ? (
                              <button
                                onClick={() => handleMarkPaid(o)}
                                disabled={markingPaidRef === o.ref}
                                title={tx("現場收款 / 手動匯款：標記後寄送購票確認信（含入場 QR）")}
                                className="px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                              >
                                {markingPaidRef === o.ref
                                  ? tx("處理中...")
                                  : tx("標記已付款")}
                              </button>
                            ) : null
                          ) : normalizeStatus(o.paymentStatus) === "paid" ? (
                            canConfirm && o.isRealRef ? (
                              <button
                                onClick={() => openRefundDialog(o)}
                                disabled={refundingRef === o.ref}
                                title={tx("退票：輸入原因後建立退票申請並寄退款資料表單 Email 給買家（到退票管理核准後才會實際扣票）")}
                                data-testid={`button-refund-${o.ref}`}
                                className="px-3 py-1.5 rounded-xl border border-red-400 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors whitespace-nowrap inline-flex items-center gap-1"
                              >
                                <Undo2 size={12} />
                                {refundingRef === o.ref ? tx("處理中...") : tx("退票")}
                              </button>
                            ) : null
                          ) : o.paymentStatus === "refunded" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Undo2 size={12} /> {tx("已退款")}
                            </span>
                          ) : o.paymentStatus === "failed" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-500">
                              <XCircle size={12} /> {tx("失敗")}
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
                              title={tx("早鳥VIP：報到時可帶 6 歲以下兒童免費入場（不影響金額與票數）")}
                            >
                              <Crown size={12} />
                              {vipBusyRef === o.ref
                                ? tx("處理中...")
                                : o.isVip
                                  ? tx("取消VIP")
                                  : tx("設為VIP")}
                            </button>
                          )}
                          {canConfirm && (
                            <button
                              onClick={() => openEditEmail(o)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
                                o.email
                                  ? "border hover:bg-muted"
                                  : "border border-blue-400 text-blue-600 hover:bg-blue-50"
                              }`}
                              title={
                                o.email
                                  ? tx("修改這筆訂單的 Email")
                                  : tx("這筆訂單沒有 Email，點此補上後可寄送確認信")
                              }
                            >
                              <Mail size={12} />
                              {o.email ? tx("改 Email") : tx("補 Email")}
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
        {tx("共")} {filtered.length} {tx("筆訂單")}{filter !== "all" ? tx("（已套用篩選）") : ""}{tx("。兩日套票會合併為一筆訂單顯示。")}
      </p>

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          invoice={invoiceByRef.get(detailOrder.ref) ?? null}
          canManage={canConfirm}
          onInvoiceChanged={() => refetchInvoices()}
          onClose={() => setDetailOrder(null)}
        />
      )}

      {refundOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl" data-testid="refund-dialog">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Undo2 size={18} />
                {tx("退票申請")}
              </h3>
              <button
                onClick={() => setRefundOrder(null)}
                className="rounded-lg p-1 hover:bg-muted"
                title={tx("關閉")}
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                <div><span className="text-muted-foreground">{tx("買家：")}</span><strong>{refundOrder.buyerName}</strong></div>
                <div><span className="text-muted-foreground">{tx("訂單編號：")}</span>{refundOrder.ref}</div>
                <div><span className="text-muted-foreground">{tx("訂單金額：")}</span>NT$ {refundOrder.amount.toLocaleString()}</div>
                {refundOrder.checkedInCount > 0 && (
                  <div className="text-amber-700">{tx("此訂單已有")} {refundOrder.checkedInCount} {tx("人簽到，仍可退票（後台裁量）。")}</div>
                )}
              </div>
              {Math.max(...refundOrder.legs.map((l) => l.ticketCount)) > 1 && (
                <label className="block">
                  <span className="block mb-1 font-bold">{tx("退票張數")}</span>
                  <select
                    value={refundCount}
                    onChange={(e) => setRefundCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border-2 rounded-xl bg-white"
                    data-testid="select-admin-refund-count"
                  >
                    {Array.from(
                      { length: Math.max(...refundOrder.legs.map((l) => l.ticketCount)) },
                      (_, i) => i + 1,
                    ).map((n) => {
                      const total = Math.max(...refundOrder.legs.map((l) => l.ticketCount));
                      return (
                        <option key={n} value={n}>
                          {n === total ? tx("{0} 張（全部退票）", [n]) : tx("{0} 張", [n])}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="block mb-1 font-bold">{tx("退票原因 *")}</span>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={tx("請輸入退票原因（至少 5 字），會記錄在退票申請中")}
                  className="w-full px-3 py-2 border-2 rounded-xl focus:border-primary focus:outline-none"
                  data-testid="input-admin-refund-reason"
                />
              </label>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {tx("送出後會建立退票申請並自動寄「退款資料表單」Email 給買家；請再到「退票管理」核准，核准後才會實際扣票與計算退款。")}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setRefundOrder(null)}
                  className="px-4 py-2 rounded-xl border text-sm hover:bg-muted"
                >
                  {tx("取消")}
                </button>
                <button
                  onClick={submitRefund}
                  disabled={refundingRef === refundOrder.ref}
                  data-testid="button-admin-refund-submit"
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {refundingRef === refundOrder.ref ? tx("送出中...") : tx("建立退票申請")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editEmailOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Mail size={18} />
                {editEmailOrder.email ? tx("修改 Email") : tx("補上 Email")}
              </h3>
              <button
                onClick={() => setEditEmailOrder(null)}
                className="rounded-lg p-1 hover:bg-muted"
                title={tx("關閉")}
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              {tx("訂購人：")}
              <span className="font-medium text-foreground">
                {editEmailOrder.buyerName}
              </span>
              {tx("（")}{editEmailOrder.phone}{tx("）")}
            </p>
            <input
              type="email"
              value={editEmailValue}
              onChange={(e) => setEditEmailValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSavingEmail) handleSaveEmail();
              }}
              placeholder="customer@example.com"
              autoFocus
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {normalizeStatus(editEmailOrder.paymentStatus) === "paid"
                ? tx("儲存後可立即寄送購票確認信（含入場 QR Code）給顧客。")
                : tx("此訂單尚未付款，補上 Email 後，確認付款時會自動寄送購票確認信。")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditEmailOrder(null)}
                disabled={isSavingEmail}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                {tx("取消")}
              </button>
              <button
                onClick={handleSaveEmail}
                disabled={isSavingEmail}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {isSavingEmail ? tx("處理中...") : tx("儲存")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  useI18n();
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium break-all">{value}</span>
    </div>
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString(getLocale());
}

const INVOICE_STATUS_LABELS = (): Record<string, string> => ({
  pending: tx("待開立"),
  issued: tx("已開立"),
  failed: tx("開立失敗"),
  voided: tx("已作廢"),
});

const INVOICE_TYPE_LABELS = (): Record<string, string> => ({
  personal: tx("個人"),
  company: tx("公司（統編）"),
  donation: tx("捐贈"),
});

function invoiceStatusBadge(status: string) {
  const label = INVOICE_STATUS_LABELS()[status] ?? status;
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

function OrderDetailModal({
  order,
  invoice,
  canManage,
  onInvoiceChanged,
  onClose,
}: {
  order: Order;
  invoice: AdminInvoice | null;
  canManage: boolean;
  onInvoiceChanged: () => void;
  onClose: () => void;
}) {
  useI18n();
  const totalChildren = order.legs.reduce((s, l) => s + (l.childCount ?? 0), 0);
  const totalInfants = order.legs.reduce((s, l) => s + (l.infantCount ?? 0), 0);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const isPaid = normalizeStatus(order.paymentStatus) === "paid";

  const handleIssueInvoice = async () => {
    if (
      !window.confirm(
        tx("要為這筆訂單{0}開立電子發票嗎？\n系統會向綠界送出開立要求並回填發票號碼。", [invoice?.status === "failed" ? tx("重新") : ""]),
      )
    ) {
      return;
    }
    setInvoiceBusy(true);
    try {
      const res = await fetch(
        `/api/payments/invoices/${encodeURIComponent(order.ref)}/retry`,
        { method: "POST", credentials: "include" },
      );
      const result = (await res.json().catch(() => ({}))) as {
        status?: string;
        invoiceNumber?: string | null;
        errorMessage?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(txApi(result?.error) || tx("開立失敗"));
      onInvoiceChanged();
      if (result.status === "issued") {
        window.alert(tx("開立成功，發票號碼：{0}", [result.invoiceNumber ?? "—"]));
      } else {
        window.alert(
          tx("尚未開立成功（狀態：{0}）。\n{1}", [result.status ? (INVOICE_STATUS_LABELS()[result.status] ?? result.status) : tx("未知"), txApi(result.errorMessage) ?? tx("請確認此訂單已填寫發票資訊。")]),
        );
      }
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("開立失敗，請稍後再試"));
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handleVoidInvoice = async () => {
    const reason = window.prompt(
      tx("要作廢發票「{0}」嗎？請輸入作廢原因：", [invoice?.invoiceNumber]),
      tx("訂單取消"),
    );
    if (reason === null) return;
    setInvoiceBusy(true);
    try {
      const res = await fetch(
        `/api/payments/invoices/${encodeURIComponent(order.ref)}/void`,
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
      onInvoiceChanged();
      window.alert(
        result.success ? tx("發票已作廢。") : tx("作廢未成功：{0}", [txApi(result.message) ?? tx("請稍後再試")]),
      );
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("作廢失敗，請稍後再試"));
    } finally {
      setInvoiceBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b sticky top-0 bg-white rounded-t-3xl">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {tx("訂單詳情")}
              {order.isVip && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
                  <Crown size={11} /> VIP
                </span>
              )}
            </h2>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              {order.isRealRef ? order.ref : tx("（無訂單編號）")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={tx("關閉")}
            className="p-2 rounded-full hover:bg-muted transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Buyer */}
          <section>
            <h3 className="text-sm font-bold text-muted-foreground mb-2">
              {tx("購買人")}
            </h3>
            <div className="rounded-2xl border p-4">
              <DetailRow label={tx("姓名")} value={order.buyerName} />
              <DetailRow label={tx("電話")} value={order.phone} />
              <DetailRow label="Email" value={order.email ?? "—"} />
            </div>
          </section>

          {/* Payment */}
          <section>
            <h3 className="text-sm font-bold text-muted-foreground mb-2">
              {tx("付款資訊")}
            </h3>
            <div className="rounded-2xl border p-4">
              <DetailRow label={tx("狀態")} value={statusBadge(order.paymentStatus)} />
              <DetailRow
                label={tx("付款方式")}
                value={
                  order.paymentMethod
                    ? (PAYMENT_METHOD_LABELS()[order.paymentMethod] ??
                      order.paymentMethod)
                    : "—"
                }
              />
              <DetailRow
                label={tx("訂單金額")}
                value={
                  <span className="text-green-600">
                    {formatCurrency(order.amount)}
                  </span>
                }
              />
              <DetailRow
                label={tx("建立時間")}
                value={new Date(order.createdAt).toLocaleString(getLocale())}
              />
            </div>
          </section>

          {/* Invoice */}
          <section>
            <h3 className="text-sm font-bold text-muted-foreground mb-2">
              {tx("電子發票")}
            </h3>
            <div className="rounded-2xl border p-4">
              {invoice ? (
                <>
                  <DetailRow
                    label={tx("狀態")}
                    value={invoiceStatusBadge(invoice.status)}
                  />
                  <DetailRow
                    label={tx("發票號碼")}
                    value={
                      invoice.invoiceNumber ? (
                        <span className="font-mono">{invoice.invoiceNumber}</span>
                      ) : (
                        <span className="text-muted-foreground">{tx("尚未取號")}</span>
                      )
                    }
                  />
                  <DetailRow
                    label={tx("發票類型")}
                    value={
                      INVOICE_TYPE_LABELS()[invoice.invoiceType] ??
                      invoice.invoiceType
                    }
                  />
                  {invoice.taxId && (
                    <DetailRow
                      label={tx("統一編號")}
                      value={`${invoice.taxId}${invoice.companyTitle ? tx("（{0}）", [invoice.companyTitle]) : ""}`}
                    />
                  )}
                  {invoice.loveCode && (
                    <DetailRow label={tx("愛心碼")} value={invoice.loveCode} />
                  )}
                  {invoice.carrierNum && (
                    <DetailRow label={tx("載具")} value={invoice.carrierNum} />
                  )}
                  {invoice.invoiceDate && (
                    <DetailRow label={tx("開立日期")} value={invoice.invoiceDate} />
                  )}
                  {invoice.status === "voided" && invoice.voidedAt && (
                    <DetailRow
                      label={tx("作廢時間")}
                      value={formatDateTime(invoice.voidedAt)}
                    />
                  )}
                  {invoice.status === "failed" && invoice.errorMessage && (
                    <DetailRow
                      label={tx("失敗原因")}
                      value={
                        <span className="text-red-600">
                          {invoice.errorMessage}
                        </span>
                      }
                    />
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {tx("此訂單沒有發票資料")}{isPaid ? "" : tx("（訂單尚未付款）")}{tx("。")}
                </p>
              )}

              {canManage &&
                (invoice ? (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                    {invoice.status !== "issued" &&
                      invoice.status !== "voided" &&
                      isPaid && (
                        <button
                          onClick={handleIssueInvoice}
                          disabled={invoiceBusy}
                          className="inline-flex items-center gap-1.5 border border-primary text-primary px-4 py-2 rounded-full text-sm font-semibold hover:bg-primary/10 disabled:opacity-50"
                        >
                          <ReceiptText size={15} />
                          {invoice.status === "failed" ? tx("重試開立") : tx("開立發票")}
                        </button>
                      )}
                    {invoice.status === "issued" && (
                      <button
                        onClick={handleVoidInvoice}
                        disabled={invoiceBusy}
                        className="inline-flex items-center gap-1.5 border border-red-400 text-red-600 px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle size={15} />
                        {tx("作廢發票")}
                      </button>
                    )}
                    {!isPaid &&
                      invoice.status !== "issued" &&
                      invoice.status !== "voided" && (
                        <p className="text-xs text-muted-foreground self-center">
                          {tx("訂單付款後才能開立發票。")}
                        </p>
                      )}
                  </div>
                ) : null)}
            </div>
          </section>

          {/* Tickets */}
          <section>
            <h3 className="text-sm font-bold text-muted-foreground mb-2">
              {tx("票券明細（")}{order.legs.length} {tx("張）")}
            </h3>
            <div className="space-y-3">
              {order.legs
                .slice()
                .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
                .map((leg) => {
                  const emailSent = formatDateTime(leg.confirmationEmailSentAt);
                  const checkedIn = formatDateTime(leg.checkedInAt);
                  return (
                    <div key={leg.id} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-primary">
                          {formatDate(leg.eventDate)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {leg.ticketType
                            ? (TICKET_TYPE_LABELS()[leg.ticketType] ??
                              leg.ticketType)
                            : "—"}
                        </span>
                      </div>
                      <DetailRow label={tx("票數")} value={tx("{0} 張", [leg.ticketCount])} />
                      {(leg.childCount ?? 0) > 0 && (
                        <DetailRow
                          label={tx("兒童")}
                          value={tx("{0} 位", [leg.childCount])}
                        />
                      )}
                      {(leg.infantCount ?? 0) > 0 && (
                        <DetailRow
                          label={tx("嬰兒（免費）")}
                          value={tx("{0} 位", [leg.infantCount])}
                        />
                      )}
                      <DetailRow
                        label={tx("報到")}
                        value={
                          checkedIn ? (
                            <span className="text-green-600">{checkedIn}</span>
                          ) : (
                            <span className="text-muted-foreground">{tx("未報到")}</span>
                          )
                        }
                      />
                      <DetailRow
                        label={tx("入場 QR")}
                        value={leg.qrToken ? tx("已產生") : "—"}
                      />
                      <DetailRow
                        label={tx("確認信")}
                        value={emailSent ?? tx("未寄送")}
                      />
                    </div>
                  );
                })}
            </div>
            {(totalChildren > 0 || totalInfants > 0) && (
              <p className="text-xs text-muted-foreground mt-2">
                {tx("合計兒童")} {totalChildren} {tx("位")}
                {totalInfants > 0 ? tx("、嬰兒 {0} 位（免費）", [totalInfants]) : ""}{tx("。")}
              </p>
            )}
          </section>
        </div>
      </div>
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
  useI18n();
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
