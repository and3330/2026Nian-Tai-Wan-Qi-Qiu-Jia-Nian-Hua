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
  Trophy,
  Users,
  CheckCircle2,
  Clock,
  ScanLine,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const PARTICIPANT_TYPE = "tournament";
const COMPANION_TYPE = "tournament-companion";
const CAPACITY = 128;

const TYPE_LABELS: Record<string, string> = {
  [PARTICIPANT_TYPE]: "參賽",
  [COMPANION_TYPE]: "隨同票",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "已付款",
  pending: "處理中",
  awaiting_transfer: "待匯款",
  unpaid: "未付款",
  failed: "付款失敗",
  refunded: "已退款",
};

export default function TournamentManage() {
  const { hasRole } = useAuth();
  const canCheckin = hasRole("checkin");
  const { data, isLoading, isError, refetch, isFetching } = useAdminListRegistrations({});
  const [search, setSearch] = useState("");
  const [checkingToken, setCheckingToken] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const legs = useMemo<Registration[]>(() => {
    const rows = (data ?? []) as Registration[];
    return rows.filter(
      (r) => r.ticketType === PARTICIPANT_TYPE || r.ticketType === COMPANION_TYPE,
    );
  }, [data]);

  const stats = useMemo(() => {
    const participants = legs.filter((r) => r.ticketType === PARTICIPANT_TYPE);
    const companions = legs.filter((r) => r.ticketType === COMPANION_TYPE);
    const active = (r: Registration) => r.paymentStatus !== "refunded";
    return {
      participantTotal: participants.filter(active).length,
      participantPaid: participants.filter((r) => r.paymentStatus === "paid").length,
      participantCheckedIn: participants.filter((r) => r.checkedInAt).length,
      companionTotal: companions.filter(active).length,
      companionPaid: companions.filter((r) => r.paymentStatus === "paid").length,
    };
  }, [legs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...legs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.parentName?.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q),
    );
  }, [legs, search]);

  const handleCheckin = async (token: string | null | undefined) => {
    if (!token) return;
    setActionError(null);
    setCheckingToken(token);
    try {
      const res = await fetch(`/api/admin/checkin/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(body?.error || "報到失敗");
        return;
      }
      await refetch();
    } catch {
      setActionError("報到失敗，請稍後再試");
    } finally {
      setCheckingToken(null);
    }
  };

  const exportCsv = () => {
    const header = ["報名人", "電話", "Email", "票種", "付款狀態", "報到時間", "報名時間"];
    const rows = filtered.map((r) => [
      r.parentName ?? "",
      r.phone ?? "",
      r.email ?? "",
      TYPE_LABELS[r.ticketType ?? ""] ?? r.ticketType ?? "",
      PAYMENT_STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus,
      r.checkedInAt ? formatDate(r.checkedInAt) : "",
      formatDate(r.createdAt),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tournament-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl flex items-center gap-2">
            <Trophy className="text-indigo-600" /> 戰鬥陀螺賽管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">7/26（日）· 臺北瓶蓋工廠 M 棟 · 限額 {CAPACITY} 位參賽</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-muted"
            data-testid="button-refresh"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} /> 重新整理
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            data-testid="button-export"
          >
            <Download size={15} /> 匯出 CSV
          </button>
        </div>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold mb-2">
            <Users size={15} /> 參賽人數
          </div>
          <div className="text-2xl font-display font-bold">
            {stats.participantTotal} <span className="text-base text-muted-foreground">/ {CAPACITY}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-indigo-600"
              style={{ width: `${Math.min(100, (stats.participantTotal / CAPACITY) * 100)}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold mb-2">
            <CheckCircle2 size={15} /> 參賽已付款
          </div>
          <div className="text-2xl font-display font-bold text-green-600">{stats.participantPaid}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold mb-2">
            <ScanLine size={15} /> 已報到
          </div>
          <div className="text-2xl font-display font-bold text-indigo-600">{stats.participantCheckedIn}</div>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold mb-2">
            <Users size={15} /> 隨同票（已付款）
          </div>
          <div className="text-2xl font-display font-bold">
            {stats.companionTotal} <span className="text-base text-muted-foreground">（{stats.companionPaid}）</span>
          </div>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋姓名 / 電話 / Email"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-border focus:border-primary outline-none text-sm"
          data-testid="input-search"
        />
      </div>

      {!canCheckin && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2.5">
          您目前無現場報到權限，僅能檢視名單。請至「現場報到」頁面，或由具報到權限的帳號操作報到。
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-2.5">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : isError ? (
        <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-6 text-center">
          載入名單失敗，請重新整理。
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
          {legs.length === 0 ? "目前尚無戰鬥陀螺賽報名" : "沒有符合搜尋條件的報名"}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">報名人</th>
                <th className="px-4 py-3 font-bold">聯絡方式</th>
                <th className="px-4 py-3 font-bold">票種</th>
                <th className="px-4 py-3 font-bold">付款</th>
                <th className="px-4 py-3 font-bold">報到</th>
                <th className="px-4 py-3 font-bold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const isParticipant = r.ticketType === PARTICIPANT_TYPE;
                const rowCheckinable = r.paymentStatus === "paid" && !r.checkedInAt && !!r.qrToken;
                return (
                  <tr key={r.id} data-testid={`row-${r.id}`}>
                    <td className="px-4 py-3 font-medium">{r.parentName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{r.phone}</div>
                      {r.email && <div className="text-xs break-all">{r.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-bold " +
                          (isParticipant ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")
                        }
                      >
                        {TYPE_LABELS[r.ticketType ?? ""] ?? r.ticketType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-flex px-2 py-0.5 rounded-full text-xs font-bold " +
                          (r.paymentStatus === "paid"
                            ? "bg-green-100 text-green-700"
                            : r.paymentStatus === "refunded"
                              ? "bg-rose-100 text-rose-600"
                              : "bg-amber-100 text-amber-700")
                        }
                      >
                        {PAYMENT_STATUS_LABELS[r.paymentStatus] ?? r.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.checkedInAt ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-bold">
                          <CheckCircle2 size={14} /> {formatDate(r.checkedInAt)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                          <Clock size={14} /> 未報到
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canCheckin && rowCheckinable ? (
                        <button
                          type="button"
                          onClick={() => handleCheckin(r.qrToken)}
                          disabled={checkingToken === r.qrToken}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                          data-testid={`button-checkin-${r.id}`}
                        >
                          <ScanLine size={14} /> {checkingToken === r.qrToken ? "處理中…" : "報到"}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
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
