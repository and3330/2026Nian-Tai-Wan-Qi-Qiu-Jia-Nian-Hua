import { tx, getLocale, useI18n, txApi } from "@/lib/i18n";
import {
  useAdminGetSalesOverview,
  useAdminListRegistrations,
} from "@workspace/api-client-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Download,
  Users,
  Ticket,
  DollarSign,
  TrendingUp,
  CalendarCheck,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";

const PIE_COLORS = ["#F97316", "#FACC15", "#22C55E", "#3B82F6"];

interface PieDatum {
  name: string;
  value: number;
  percentage: number;
  revenue: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(getLocale()).format(value);
}

function formatTrendLabel(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(getLocale(), { month: "numeric", day: "numeric" });
}

export default function AdminDashboard() {
  useI18n();
  const { data: overview, isLoading: overviewLoading } =
    useAdminGetSalesOverview();
  const { data: registrations, isLoading: regLoading, refetch: refetchRegistrations } =
    useAdminListRegistrations({});

  const [isExporting, setIsExporting] = useState(false);
  const [confirmingRef, setConfirmingRef] = useState<string | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<{
    methods: { key: string; label: string; orders: number; revenue: number }[];
    totalRevenue: number;
  } | null>(null);

  const [refundStats, setRefundStats] = useState<{
    byStatus: Record<string, { count: number; amount: number; tickets: number }>;
    trend: { date: string; count: number; amount: number }[];
    byTicketType: { ticketType: string; count: number; amount: number; tickets: number }[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/payment-methods", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setPaymentMethods(data);
      })
      .catch(() => {});
    fetch("/api/admin/refund-stats", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setRefundStats(data);
      })
      .catch(() => {});
  }, []);

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
      await refetchRegistrations();
    } catch (err) {
      window.alert(err instanceof Error ? txApi(err.message) : tx("確認失敗，請稍後再試"));
    } finally {
      setConfirmingRef(null);
    }
  };

  const awaitingTransfers = (() => {
    const seen = new Set<string>();
    const list: NonNullable<typeof registrations> = [];
    for (const reg of registrations ?? []) {
      if (reg.paymentStatus !== "awaiting_transfer" || !reg.paymentRef) continue;
      if (seen.has(reg.paymentRef)) continue;
      seen.add(reg.paymentRef);
      list.push(reg);
    }
    return list;
  })();

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
        `registrations_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert(tx("匯出失敗"));
    } finally {
      setIsExporting(false);
    }
  };

  const trendData =
    overview?.dailySalesTrend.map((p) => ({
      name: formatTrendLabel(p.date),
      ticketsSold: p.ticketsSold,
      revenue: p.revenue,
    })) || [];

  const pieData =
    overview?.ticketTypeBreakdown.map((t) => ({
      name: t.label,
      value: t.ticketsSold,
      percentage: t.percentage,
      revenue: t.revenue,
    })) || [];
  const hasTicketTypeData = pieData.some((p) => p.value > 0);

  const sessionData =
    overview?.sessionAvailability.map((s) => ({
      name: s.label,
      registered: s.registered,
      paid: s.paid,
      reservedUnpaid: Math.max(s.registered - s.paid, 0),
      remaining: s.remaining,
      fillPercentage: s.fillPercentage,
    })) || [];

  const remainingCapacity =
    overview?.sessionAvailability.reduce((sum, s) => sum + s.remaining, 0) ?? 0;

  const totalPaidSeats =
    overview?.sessionAvailability.reduce((sum, s) => sum + s.paid, 0) ?? 0;

  const PAYMENT_STATUS_LABELS: Record<string, string> = {
    paid: tx("已付款"),
    pending: tx("處理中"),
    awaiting_transfer: tx("待匯款"),
    unpaid: tx("未付款"),
    failed: tx("付款失敗"),
    refunded: tx("已退款"),
  };
  const TICKET_TYPE_LABELS: Record<string, string> = {
    single: tx("單日票"),
    combo: tx("兩日套票"),
    "four-day-pass": tx("四日通行證"),
    workshop: tx("大師工作坊"),
    competition: tx("交流大賽"),
  };
  const paymentStatusBadge = (status: string | null | undefined) => {
    const key = status ?? "unpaid";
    const label = PAYMENT_STATUS_LABELS[key] ?? key;
    const tone =
      key === "paid"
        ? "bg-green-100 text-green-700"
        : key === "pending" || key === "awaiting_transfer"
          ? "bg-amber-100 text-amber-700"
          : key === "failed"
            ? "bg-red-100 text-red-700"
            : "bg-muted text-muted-foreground";
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
        {label}
      </span>
    );
  };
  const ticketTypeText = (t: string | null | undefined) => {
    if (!t) return tx("未指定");
    return TICKET_TYPE_LABELS[t] ?? t;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display">{tx("票務營運總覽")}</h1>
          <p className="text-muted-foreground mt-1">
            {tx("售票收入、每日入場人數與票種分布一目了然")}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-primary text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 self-start md:self-auto"
        >
          <Download size={18} />
          {isExporting ? tx("匯出中...") : tx("匯出 CSV 報表")}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          loading={overviewLoading}
          icon={<CalendarCheck size={28} />}
          tone="blue"
          label={tx("今日售票數")}
          value={overview ? tx("{0} 張", [formatNumber(overview.todayTicketsSold)]) : "—"}
          sub={
            overview
              ? tx("今日營收 {0}", [formatCurrency(overview.todayRevenue)])
              : undefined
          }
        />
        <KpiCard
          loading={overviewLoading}
          icon={<DollarSign size={28} />}
          tone="green"
          label={tx("累計收入")}
          value={overview ? formatCurrency(overview.totalRevenue) : "—"}
          sub={
            overview
              ? tx("{0} 張已付款", [formatNumber(overview.totalTicketsSold)])
              : undefined
          }
        />
        <KpiCard
          loading={overviewLoading}
          icon={<Ticket size={28} />}
          tone="orange"
          label={tx("已付款座位")}
          value={overview ? tx("{0} 席", [formatNumber(totalPaidSeats)]) : "—"}
          sub={
            overview
              ? tx("含未付款預訂共 {0} 席 · 佔用率 {1}%", [formatNumber(overview.totalCapacity - remainingCapacity), overview.overallFillPercentage])
              : undefined
          }
        />
        <KpiCard
          loading={overviewLoading}
          icon={<Users size={28} />}
          tone="purple"
          label={tx("剩餘名額")}
          value={overview ? tx("{0} 席", [formatNumber(remainingCapacity)]) : "—"}
          sub={
            overview
              ? tx("分布於 {0} 場次", [overview.sessionAvailability.length])
              : undefined
          }
        />
      </div>

      {/* Category split: 購買票券 vs 報名陀螺 — cumulative revenue + paying people */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CategorySalesCard
          loading={overviewLoading}
          icon={<Ticket size={22} />}
          tone="orange"
          title={tx("購買票券")}
          revenue={overview ? overview.carnivalSales.revenue : 0}
          payerCount={overview ? overview.carnivalSales.payerCount : 0}
          ready={!!overview}
        />
        <CategorySalesCard
          loading={overviewLoading}
          icon={<Users size={22} />}
          tone="purple"
          title={tx("報名陀螺")}
          revenue={overview ? overview.tournamentSales.revenue : 0}
          payerCount={overview ? overview.tournamentSales.payerCount : 0}
          ready={!!overview}
        />
      </div>

      {/* 各付款方式收款金額 */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm">
        <h2 className="text-xl font-bold mb-1">{tx("各付款方式收款")}</h2>
        <p className="text-sm text-muted-foreground mb-5">
          {tx("已付款訂單（不含退款）依超商繳費、ATM 轉帳、信用卡等方式的金額與筆數")}
        </p>
        {!paymentMethods ? (
          <div className="h-24 bg-muted/50 animate-pulse rounded-xl" />
        ) : paymentMethods.methods.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {tx("尚無收款資料")}
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.methods.map((m, idx) => {
              const pct = paymentMethods.totalRevenue
                ? Math.round((m.revenue / paymentMethods.totalRevenue) * 1000) /
                  10
                : 0;
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="font-bold">{m.label}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(m.revenue)} · {formatNumber(m.orders)} {tx("筆 ·")}{" "}
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          PIE_COLORS[idx % PIE_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 mt-2 border-t flex items-center justify-between text-sm font-bold">
              <span>{tx("合計")}</span>
              <span className="text-green-600">
                {formatCurrency(paymentMethods.totalRevenue)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 退票分析 */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm">
        <h2 className="text-xl font-bold mb-1">{tx("退票分析")}</h2>
        <p className="text-sm text-muted-foreground mb-5">
          {tx("依退票申請統計：核准退款金額、待處理狀況與近 14 天趨勢")}
        </p>
        {!refundStats ? (
          <div className="h-24 bg-muted/50 animate-pulse rounded-xl" />
        ) : (
          (() => {
            const approved = refundStats.byStatus["approved"] ?? { count: 0, amount: 0, tickets: 0 };
            const pending = refundStats.byStatus["pending"] ?? { count: 0, amount: 0, tickets: 0 };
            const rejected = refundStats.byStatus["rejected"] ?? { count: 0, amount: 0, tickets: 0 };
            const rescheduled = refundStats.byStatus["rescheduled"] ?? { count: 0, amount: 0, tickets: 0 };
            const totalRequests =
              approved.count + pending.count + rejected.count + rescheduled.count;
            const grossRevenue = (overview?.totalRevenue ?? 0) + approved.amount;
            const refundRate = grossRevenue
              ? Math.round((approved.amount / grossRevenue) * 1000) / 10
              : 0;
            const TYPE_LABELS: Record<string, string> = {
              single: tx("單日票"),
              combo: tx("兩日套票"),
              tournament: tx("陀螺賽"),
              "tournament-companion": tx("陀螺賽陪同"),
              unknown: tx("其他"),
            };
            if (totalRequests === 0) {
              return (
                <div className="py-8 text-center text-muted-foreground">
                  {tx("目前沒有任何退票申請")}
                </div>
              );
            }
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
                    <p className="text-sm text-muted-foreground">{tx("已退款金額")}</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(approved.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatNumber(approved.count)} {tx("筆 ·")} {formatNumber(approved.tickets)} {tx("張")}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                    <p className="text-sm text-muted-foreground">{tx("待處理申請")}</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {formatNumber(pending.count)} {tx("筆")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tx("預估金額")} {formatCurrency(pending.amount)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 border">
                    <p className="text-sm text-muted-foreground">{tx("退款佔總銷售")}</p>
                    <p className="text-2xl font-bold">{refundRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tx("總銷售（含已退款）")}{formatCurrency(grossRevenue)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 border">
                    <p className="text-sm text-muted-foreground">{tx("其他處理結果")}</p>
                    <p className="text-2xl font-bold">
                      {formatNumber(rejected.count + rescheduled.count)} {tx("筆")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tx("拒絕")} {formatNumber(rejected.count)} {tx("· 改期")} {formatNumber(rescheduled.count)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h3 className="font-bold mb-3 text-sm">
                      {tx("近 14 天核准退款趨勢")}
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={refundStats.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatTrendLabel}
                          fontSize={12}
                        />
                        <YAxis fontSize={12} allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(v) => formatTrendLabel(String(v))}
                          formatter={(value: number, name: string) =>
                            name === tx("退款金額")
                              ? [formatCurrency(value), name]
                              : [formatNumber(value), name]
                          }
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          name={tx("退款金額")}
                          stroke="#EF4444"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name={tx("退款筆數")}
                          stroke="#F59E0B"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h3 className="font-bold mb-3 text-sm">{tx("各票種退款分佈")}</h3>
                    {refundStats.byTicketType.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        {tx("尚無核准的退票")}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {refundStats.byTicketType.map((t, idx) => {
                          const pct = approved.amount
                            ? Math.round((t.amount / approved.amount) * 1000) / 10
                            : 0;
                          return (
                            <div key={t.ticketType}>
                              <div className="flex items-center justify-between mb-1.5 text-sm">
                                <span className="font-bold">
                                  {TYPE_LABELS[t.ticketType] ?? t.ticketType}
                                </span>
                                <span className="text-muted-foreground">
                                  {formatCurrency(t.amount)} · {formatNumber(t.tickets)} {tx("張 ·")} {pct}%
                                </span>
                              </div>
                              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Daily sales trend (line chart) + ticket type distribution (pie) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="text-primary" size={20} />
                {tx("每日售票趨勢")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {tx("依購票時間統計（過去 14 天）")}
              </p>
            </div>
          </div>
          {overviewLoading ? (
            <div className="h-72 bg-muted/50 animate-pulse rounded-xl" />
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E7EB"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6B7280", fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number, name) =>
                      name === "revenue"
                        ? [formatCurrency(value), tx("營收")]
                        : [tx("{0} 張", [value]), tx("售票數")]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="ticketsSold"
                    name="ticketsSold"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-3xl border shadow-sm">
          <h2 className="text-xl font-bold mb-1">{tx("各票種佔比")}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {tx("依已付款訂單的票種分布")}
          </p>
          {overviewLoading ? (
            <div className="h-72 bg-muted/50 animate-pulse rounded-xl" />
          ) : !hasTicketTypeData ? (
            <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
              <Ticket size={32} className="mb-2 opacity-40" />
              {tx("尚無售票資料")}
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {pieData.map((_, idx) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(
                      value: number,
                      _name: string,
                      item: { payload?: PieDatum },
                    ) => [
                      tx("{0} 張（{1}%）", [value, item.payload?.percentage ?? 0]),
                      item.payload?.name ?? "",
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Per-session capacity */}
      <div className="bg-white p-6 rounded-3xl border shadow-sm">
        <h2 className="text-xl font-bold mb-1">{tx("各日售票狀況")}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {tx("每場次容量")} {overview?.sessionAvailability[0]?.totalCapacity ?? 500} {tx("名 · 區分已付款與未付款預訂")}
        </p>
        {overviewLoading ? (
          <div className="h-72 bg-muted/50 animate-pulse rounded-xl" />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sessionData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E5E7EB"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "#F3F4F6" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: number, name) => {
                    const labels: Record<string, string> = {
                      paid: tx("已付款"),
                      reservedUnpaid: tx("未付款預訂"),
                      remaining: tx("剩餘"),
                    };
                    return [tx("{0} 張", [value]), labels[name as string] ?? name];
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(v) =>
                    v === "paid"
                      ? tx("已付款")
                      : v === "reservedUnpaid"
                        ? tx("未付款預訂")
                        : tx("剩餘名額")
                  }
                />
                <Bar
                  dataKey="paid"
                  name="paid"
                  stackId="cap"
                  fill="hsl(var(--primary))"
                  radius={[0, 0, 6, 6]}
                  maxBarSize={60}
                />
                <Bar
                  dataKey="reservedUnpaid"
                  name="reservedUnpaid"
                  stackId="cap"
                  fill="hsl(var(--primary) / 0.4)"
                  maxBarSize={60}
                />
                <Bar
                  dataKey="remaining"
                  name="remaining"
                  stackId="cap"
                  fill="#E5E7EB"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Registrations Table */}
      {awaitingTransfers.length > 0 && (
        <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b bg-amber-50/60">
            <h2 className="text-xl font-bold text-amber-800">
              {tx("待確認匯款（")}{awaitingTransfers.length} {tx("筆）")}
            </h2>
            <p className="text-sm text-amber-700/80 mt-1">
              {tx("銀行轉帳訂單，收到款項後請按「確認收款」，系統會開立發票、寄送確認信並通知 Slack。")}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/30">
                <tr>
                  <th className="p-4 font-semibold text-muted-foreground">{tx("訂單編號")}</th>
                  <th className="p-4 font-semibold text-muted-foreground">{tx("家長姓名")}</th>
                  <th className="p-4 font-semibold text-muted-foreground">{tx("聯絡電話")}</th>
                  <th className="p-4 font-semibold text-muted-foreground">{tx("入場日期")}</th>
                  <th className="p-4 font-semibold text-muted-foreground text-right">{tx("訂單金額")}</th>
                  <th className="p-4 font-semibold text-muted-foreground text-right">{tx("操作")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {awaitingTransfers.map((reg) => (
                  <tr key={reg.paymentRef} className="hover:bg-muted/20">
                    <td className="p-4 font-mono text-sm">{reg.paymentRef}</td>
                    <td className="p-4 font-medium">{reg.parentName}</td>
                    <td className="p-4">{reg.phone}</td>
                    <td className="p-4 text-primary font-medium">
                      {formatDate(reg.eventDate)}
                    </td>
                    <td className="p-4 text-right font-bold text-green-600">
                      {reg.amount != null ? formatCurrency(reg.amount) : "—"}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleConfirmBank(reg.paymentRef!)}
                        disabled={confirmingRef === reg.paymentRef}
                        className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                      >
                        {confirmingRef === reg.paymentRef ? tx("處理中...") : tx("確認收款")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{tx("最新報名名單")}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {tx("最近 10 筆報名紀錄")}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/30">
              <tr>
                <th className="p-4 font-semibold text-muted-foreground">{tx("報名時間")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("家長姓名")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("聯絡電話")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("票種")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("入場日期")}</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">{tx("票數")}</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">{tx("訂單金額")}</th>
                <th className="p-4 font-semibold text-muted-foreground">{tx("付款狀態")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {regLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {tx("載入中...")}
                  </td>
                </tr>
              ) : (
                registrations?.slice(0, 10).map((reg) => (
                  <tr key={reg.id} className="hover:bg-muted/20">
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(reg.createdAt).toLocaleString(getLocale())}
                    </td>
                    <td className="p-4 font-medium">{reg.parentName}</td>
                    <td className="p-4">{reg.phone}</td>
                    <td className="p-4">{ticketTypeText(reg.ticketType)}</td>
                    <td className="p-4 text-primary font-medium">
                      {formatDate(reg.eventDate)}
                    </td>
                    <td className="p-4 text-right font-bold">{reg.ticketCount}</td>
                    <td className="p-4 text-right font-bold text-green-600">
                      {reg.amount != null ? formatCurrency(reg.amount) : "—"}
                    </td>
                    <td className="p-4">{paymentStatusBadge(reg.paymentStatus)}</td>
                  </tr>
                ))
              )}
              {!regLoading && !registrations?.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {tx("尚無報名資料")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  loading,
  icon,
  tone,
  label,
  value,
  sub,
}: {
  loading: boolean;
  icon: React.ReactNode;
  tone: "blue" | "green" | "orange" | "purple";
  label: string;
  value: string;
  sub?: string;
}) {
  useI18n();
  const toneClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600",
  };
  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm">
      <div className="flex items-start gap-4">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${toneClasses[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground font-medium text-sm">{label}</p>
          {loading ? (
            <div className="h-8 mt-2 bg-muted/50 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-display text-foreground mt-1 truncate">
              {value}
            </div>
          )}
          {sub && !loading && (
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CategorySalesCard({
  loading,
  ready,
  icon,
  tone,
  title,
  revenue,
  payerCount,
}: {
  loading: boolean;
  ready: boolean;
  icon: React.ReactNode;
  tone: "orange" | "purple";
  title: string;
  revenue: number;
  payerCount: number;
}) {
  useI18n();
  const toneClasses: Record<string, string> = {
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600",
  };
  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${toneClasses[tone]}`}
        >
          {icon}
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-muted-foreground font-medium text-sm">
            {tx("累積售票額")}
          </p>
          {loading || !ready ? (
            <div className="h-8 mt-2 bg-muted/50 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-display text-foreground mt-1 truncate">
              {formatCurrency(revenue)}
            </div>
          )}
        </div>
        <div>
          <p className="text-muted-foreground font-medium text-sm">
            {tx("實際付款人數")}
          </p>
          {loading || !ready ? (
            <div className="h-8 mt-2 bg-muted/50 animate-pulse rounded" />
          ) : (
            <div className="text-2xl font-display text-foreground mt-1 truncate">
              {formatNumber(payerCount)} {tx("人")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
