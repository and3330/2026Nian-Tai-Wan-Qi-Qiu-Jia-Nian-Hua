import { useState, useEffect, useCallback } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, RefreshCw, Calendar, Filter } from "lucide-react";

interface RefundRow {
  id: number;
  paymentRef: string;
  buyerName: string;
  buyerContact: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "rescheduled";
  refundAmount: number | null;
  adminNote: string | null;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface DetailReg {
  id: number;
  parentName: string;
  ticketType: string | null;
  ticketCount: number;
  eventDate: string;
  amount: number | null;
  paymentStatus: string;
  checkedInAt: string | null;
}
interface DetailResponse {
  request: RefundRow;
  transaction: { paymentRef: string; provider: string; amount: number; status: string; itemName: string | null; paidAt: string | null } | null;
  registrations: DetailReg[];
}

const EVENT_DATES = ["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"];

const STATUS_LABEL: Record<string, string> = {
  pending: "待處理",
  approved: "已退票",
  rejected: "已拒絕",
  rescheduled: "已改期",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-gray-100 text-gray-700",
  rescheduled: "bg-sky-100 text-sky-800",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && (data as { error?: string }).error) || `HTTP ${res.status}`);
  return data as T;
}

export default function AdminRefundRequestsManage() {
  const { hasRole, isLoading } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const data = await api<RefundRow[]>(`/admin/refund-requests${q}`);
      setRows(data);
    } catch (e) {
      toast({ variant: "destructive", title: "載入失敗", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const openDetail = useCallback(async (id: number) => {
    setOpenId(id);
    setDetail(null);
    setAdminNote("");
    try {
      const d = await api<DetailResponse>(`/admin/refund-requests/${id}/detail`);
      setDetail(d);
    } catch (e) {
      toast({ variant: "destructive", title: "載入訂單詳情失敗", description: (e as Error).message });
    }
  }, [toast]);

  if (isLoading) return null;
  // Viewer/checkin can read but only editor can act; gate the page at editor+ for clarity.
  if (!hasRole("editor", "viewer", "checkin")) return <Redirect to="/admin" />;
  const canAct = hasRole("editor");

  const approve = async () => {
    if (!detail) return;
    if (!window.confirm(`確定核准退票？將釋放 ${detail.registrations.reduce((s, r) => s + r.ticketCount, 0)} 個名額。`)) return;
    setBusy(true);
    try {
      await api(`/admin/refund-requests/${detail.request.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ adminNote: adminNote.trim() || undefined }),
      });
      toast({ title: "已核准退票", description: "票券已標記為退款，名額已釋放。" });
      setOpenId(null);
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "處理失敗", description: (e as Error).message });
    } finally { setBusy(false); }
  };

  const reject = async () => {
    if (!detail) return;
    if (adminNote.trim().length < 3) {
      toast({ variant: "destructive", title: "請填寫拒絕原因", description: "至少 3 字" });
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/refund-requests/${detail.request.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ adminNote: adminNote.trim() }),
      });
      toast({ title: "已拒絕退票" });
      setOpenId(null);
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "處理失敗", description: (e as Error).message });
    } finally { setBusy(false); }
  };

  const reschedule = async (regId: number, newDate: string) => {
    if (!detail) return;
    if (!window.confirm(`確定將票券改期至 ${newDate}？並結案此退票申請？`)) return;
    setBusy(true);
    try {
      await api(`/admin/registrations/${regId}/event-date`, {
        method: "PUT",
        body: JSON.stringify({ eventDate: newDate, refundRequestId: detail.request.id }),
      });
      toast({ title: "已改期", description: `票券日期已更新為 ${newDate}` });
      setOpenId(null);
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "改期失敗", description: (e as Error).message });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl mb-2">退票 / 改票管理</h1>
          <p className="text-sm text-muted-foreground">
            處理買家提出的退票申請。核准退票會釋放名額；如雙方同意改期，可直接點選新日期改票，本筆申請會自動結案。
          </p>
        </div>
        <button
          onClick={refresh}
          data-testid="button-refresh-refunds"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted text-sm"
        >
          <RefreshCw size={14} /> 重新整理
        </button>
      </header>

      <div className="flex items-center gap-2 text-sm">
        <Filter size={14} className="text-muted-foreground" />
        <span className="text-muted-foreground">狀態：</span>
        {[
          { v: "pending", label: "待處理" },
          { v: "approved", label: "已退票" },
          { v: "rejected", label: "已拒絕" },
          { v: "rescheduled", label: "已改期" },
          { v: "", label: "全部" },
        ].map((f) => (
          <button
            key={f.v}
            onClick={() => setStatusFilter(f.v)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              statusFilter === f.v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
            data-testid={`filter-${f.v || "all"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="bg-white rounded-2xl border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin inline mr-2" /> 載入中…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">目前沒有{STATUS_LABEL[statusFilter] ?? ""}的退票申請。</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b bg-muted/30">
              <tr>
                <th className="px-4 py-3">訂單編號</th>
                <th className="px-4 py-3">買家</th>
                <th className="px-4 py-3">原因</th>
                <th className="px-4 py-3">金額</th>
                <th className="px-4 py-3">狀態</th>
                <th className="px-4 py-3">申請時間</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`refund-row-${r.id}`}>
                  <td className="px-4 py-3 font-mono">{r.paymentRef}</td>
                  <td className="px-4 py-3">
                    <div>{r.buyerName}</div>
                    <div className="text-xs text-muted-foreground">{r.buyerContact}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                  <td className="px-4 py-3">NT$ {(r.refundAmount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[r.status]}`}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString("zh-TW")}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetail(r.id)}
                      data-testid={`button-detail-${r.id}`}
                      className="px-3 py-1.5 rounded-lg border text-xs hover:bg-muted"
                    >
                      查看詳情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {openId !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && setOpenId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {!detail ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl mb-1">退票申請 #{detail.request.id}</h2>
                    <div className="text-xs text-muted-foreground font-mono">{detail.request.paymentRef}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLOR[detail.request.status]}`}>
                    {STATUS_LABEL[detail.request.status]}
                  </span>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 text-sm space-y-2">
                  <div><span className="text-muted-foreground">買家：</span><strong>{detail.request.buyerName}</strong></div>
                  <div><span className="text-muted-foreground">聯絡：</span>{detail.request.buyerContact}</div>
                  <div><span className="text-muted-foreground">原因：</span>{detail.request.reason}</div>
                  <div><span className="text-muted-foreground">建議退款金額：</span>
                    <strong className="text-primary">NT$ {(detail.request.refundAmount ?? 0).toLocaleString()}</strong>
                  </div>
                  {detail.request.adminNote && (
                    <div><span className="text-muted-foreground">處理備註：</span>{detail.request.adminNote}</div>
                  )}
                </div>

                <div>
                  <h3 className="font-medium mb-2">訂單票券</h3>
                  <div className="space-y-2">
                    {detail.registrations.map((reg) => (
                      <div key={reg.id} className="border rounded-lg p-3 text-sm" data-testid={`detail-reg-${reg.id}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{reg.parentName} · {reg.ticketType ?? "—"} × {reg.ticketCount}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Calendar size={12} /> {reg.eventDate}
                              {reg.checkedInAt && <span className="ml-2 text-emerald-600">已入場</span>}
                              {reg.paymentStatus === "refunded" && <span className="ml-2 text-gray-500">已退款</span>}
                            </div>
                          </div>
                          {canAct && detail.request.status === "pending" && !reg.checkedInAt && reg.paymentStatus !== "refunded" && (
                            <select
                              defaultValue=""
                              disabled={busy}
                              onChange={(e) => { const v = e.target.value; if (v) { reschedule(reg.id, v); e.currentTarget.value = ""; } }}
                              className="text-xs px-2 py-1 rounded border"
                              data-testid={`select-reschedule-${reg.id}`}
                            >
                              <option value="">改期至…</option>
                              {EVENT_DATES.filter((d) => d !== reg.eventDate).map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {canAct && detail.request.status === "pending" && (
                  <div className="space-y-3 border-t pt-4">
                    <label className="text-sm block">
                      <span className="block mb-1 font-medium">處理備註（拒絕時必填）</span>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="例如：已退款至原帳戶 / 因活動 7 天前不予退票…"
                        data-testid="input-admin-note"
                      />
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={approve}
                        disabled={busy}
                        data-testid="button-approve-refund"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} /> 核准退票
                      </button>
                      <button
                        onClick={reject}
                        disabled={busy}
                        data-testid="button-reject-refund"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive font-medium hover:bg-destructive/5 disabled:opacity-50"
                      >
                        <XCircle size={16} /> 拒絕退票
                      </button>
                      <button
                        onClick={() => setOpenId(null)}
                        disabled={busy}
                        className="ml-auto px-4 py-2 rounded-lg border hover:bg-muted text-sm"
                      >
                        關閉
                      </button>
                    </div>
                  </div>
                )}
                {(!canAct || detail.request.status !== "pending") && (
                  <div className="border-t pt-4">
                    <button onClick={() => setOpenId(null)} className="px-4 py-2 rounded-lg border hover:bg-muted text-sm">關閉</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
