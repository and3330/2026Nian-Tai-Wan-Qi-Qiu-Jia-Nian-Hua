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
import { useState } from "react";

const PIE_COLORS = ["#F97316", "#FACC15", "#22C55E", "#3B82F6"];

interface PieDatum {
  name: string;
  value: number;
  percentage: number;
  revenue: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-TW").format(value);
}

function formatTrendLabel(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
}

export default function AdminDashboard() {
  const { data: overview, isLoading: overviewLoading } =
    useAdminGetSalesOverview();
  const { data: registrations, isLoading: regLoading, refetch: refetchRegistrations } =
    useAdminListRegistrations({});

  const [isExporting, setIsExporting] = useState(false);
  const [confirmingRef, setConfirmingRef] = useState<string | null>(null);

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
      await refetchRegistrations();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "確認失敗，請稍後再試");
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
      alert("匯出失敗");
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
    paid: "已付款",
    pending: "處理中",
    awaiting_transfer: "待匯款",
    unpaid: "未付款",
    failed: "付款失敗",
    refunded: "已退款",
  };
  const TICKET_TYPE_LABELS: Record<string, string> = {
    single: "單日票",
    combo: "兩日套票",
    "four-day-pass": "四日通行證",
    workshop: "大師工作坊",
    competition: "交流大賽",
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
    if (!t) return "未指定";
    return TICKET_TYPE_LABELS[t] ?? t;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display">票務營運總覽</h1>
          <p className="text-muted-foreground mt-1">
            售票收入、每日入場人數與票種分布一目了然
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-primary text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 self-start md:self-auto"
        >
          <Download size={18} />
          {isExporting ? "匯出中..." : "匯出 CSV 報表"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          loading={overviewLoading}
          icon={<CalendarCheck size={28} />}
          tone="blue"
          label="今日售票數"
          value={overview ? `${formatNumber(overview.todayTicketsSold)} 張` : "—"}
          sub={
            overview
              ? `今日營收 ${formatCurrency(overview.todayRevenue)}`
              : undefined
          }
        />
        <KpiCard
          loading={overviewLoading}
          icon={<DollarSign size={28} />}
          tone="green"
          label="累計收入"
          value={overview ? formatCurrency(overview.totalRevenue) : "—"}
          sub={
            overview
              ? `${formatNumber(overview.totalTicketsSold)} 張已付款`
              : undefined
          }
        />
        <KpiCard
          loading={overviewLoading}
          icon={<Ticket size={28} />}
          tone="orange"
          label="已付款座位"
          value={overview ? `${formatNumber(totalPaidSeats)} 席` : "—"}
          sub={
            overview
              ? `含未付款預訂共 ${formatNumber(overview.totalCapacity - remainingCapacity)} 席 · 佔用率 ${overview.overallFillPercentage}%`
              : undefined
          }
        />
        <KpiCard
          loading={overviewLoading}
          icon={<Users size={28} />}
          tone="purple"
          label="剩餘名額"
          value={overview ? `${formatNumber(remainingCapacity)} 席` : "—"}
          sub={
            overview
              ? `分布於 ${overview.sessionAvailability.length} 場次`
              : undefined
          }
        />
      </div>

      {/* Daily sales trend (line chart) + ticket type distribution (pie) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="text-primary" size={20} />
                每日售票趨勢
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                依購票時間統計（過去 14 天）
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
                        ? [formatCurrency(value), "營收"]
                        : [`${value} 張`, "售票數"]
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
          <h2 className="text-xl font-bold mb-1">各票種佔比</h2>
          <p className="text-sm text-muted-foreground mb-4">
            依已付款訂單的票種分布
          </p>
          {overviewLoading ? (
            <div className="h-72 bg-muted/50 animate-pulse rounded-xl" />
          ) : !hasTicketTypeData ? (
            <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
              <Ticket size={32} className="mb-2 opacity-40" />
              尚無售票資料
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
                      `${value} 張（${item.payload?.percentage ?? 0}%）`,
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
        <h2 className="text-xl font-bold mb-1">各日售票狀況</h2>
        <p className="text-sm text-muted-foreground mb-6">
          每場次容量 {overview?.sessionAvailability[0]?.totalCapacity ?? 500} 名 · 區分已付款與未付款預訂
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
                      paid: "已付款",
                      reservedUnpaid: "未付款預訂",
                      remaining: "剩餘",
                    };
                    return [`${value} 張`, labels[name as string] ?? name];
                  }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(v) =>
                    v === "paid"
                      ? "已付款"
                      : v === "reservedUnpaid"
                        ? "未付款預訂"
                        : "剩餘名額"
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
              待確認匯款（{awaitingTransfers.length} 筆）
            </h2>
            <p className="text-sm text-amber-700/80 mt-1">
              銀行轉帳訂單，收到款項後請按「確認收款」，系統會開立發票、寄送確認信並通知 Slack。
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/30">
                <tr>
                  <th className="p-4 font-semibold text-muted-foreground">訂單編號</th>
                  <th className="p-4 font-semibold text-muted-foreground">家長姓名</th>
                  <th className="p-4 font-semibold text-muted-foreground">聯絡電話</th>
                  <th className="p-4 font-semibold text-muted-foreground">入場日期</th>
                  <th className="p-4 font-semibold text-muted-foreground text-right">訂單金額</th>
                  <th className="p-4 font-semibold text-muted-foreground text-right">操作</th>
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
                        {confirmingRef === reg.paymentRef ? "處理中..." : "確認收款"}
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
            <h2 className="text-xl font-bold">最新報名名單</h2>
            <p className="text-sm text-muted-foreground mt-1">
              最近 10 筆報名紀錄
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/30">
              <tr>
                <th className="p-4 font-semibold text-muted-foreground">報名時間</th>
                <th className="p-4 font-semibold text-muted-foreground">家長姓名</th>
                <th className="p-4 font-semibold text-muted-foreground">聯絡電話</th>
                <th className="p-4 font-semibold text-muted-foreground">票種</th>
                <th className="p-4 font-semibold text-muted-foreground">入場日期</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">票數</th>
                <th className="p-4 font-semibold text-muted-foreground text-right">訂單金額</th>
                <th className="p-4 font-semibold text-muted-foreground">付款狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {regLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    載入中...
                  </td>
                </tr>
              ) : (
                registrations?.slice(0, 10).map((reg) => (
                  <tr key={reg.id} className="hover:bg-muted/20">
                    <td className="p-4 text-sm text-muted-foreground">
                      {new Date(reg.createdAt).toLocaleString("zh-TW")}
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
                    尚無報名資料
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
