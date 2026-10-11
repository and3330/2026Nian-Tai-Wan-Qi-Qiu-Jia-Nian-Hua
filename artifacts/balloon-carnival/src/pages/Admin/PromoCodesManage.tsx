import { tx, useI18n, getLang, txApi } from "@/lib/i18n";
import { useState, useEffect, useCallback } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Pencil, X, Check } from "lucide-react";

interface PromoCodeRow {
  id: number;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  appliesTo: string | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  createdAt: string;
}

const TICKET_TYPES = () => ([
  { value: "", label: tx("全部票種") },
  { value: "single", label: tx("單日票 (NT$200)") },
  { value: "combo", label: tx("兩日套票 (NT$300)") },
  { value: "four-day-pass", label: tx("四日通票 (NT$12000)") },
  { value: "workshop", label: tx("工作坊 (NT$8000)") },
  { value: "competition", label: tx("比賽 (NT$5000)") },
]);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(txApi(data?.error) || `HTTP ${res.status}`);
  return data as T;
}

interface FormState {
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  appliesTo: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "10",
  appliesTo: "",
  maxUses: "",
  validFrom: "",
  validUntil: "",
  active: true,
};

function rowToForm(r: PromoCodeRow): FormState {
  return {
    code: r.code,
    description: r.description ?? "",
    discountType: r.discountType,
    discountValue: String(r.discountValue),
    appliesTo: r.appliesTo ?? "",
    maxUses: r.maxUses == null ? "" : String(r.maxUses),
    validFrom: r.validFrom ?? "",
    validUntil: r.validUntil ?? "",
    active: r.active,
  };
}

function formToBody(f: FormState) {
  return {
    code: f.code.trim().toUpperCase(),
    description: f.description.trim() || null,
    discountType: f.discountType,
    discountValue: Number(f.discountValue),
    appliesTo: f.appliesTo || null,
    maxUses: f.maxUses ? Number(f.maxUses) : null,
    validFrom: f.validFrom || null,
    validUntil: f.validUntil || null,
    active: f.active,
  };
}

export default function AdminPromoCodesManage() {
  useI18n();
  const { hasRole, isLoading } = useAuth();
  const { toast } = useToast();

  const [rows, setRows] = useState<PromoCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<PromoCodeRow[]>("/admin/promo-codes");
      setRows(data);
    } catch (e) {
      toast({ variant: "destructive", title: tx("載入失敗"), description: txApi((e as Error).message) });
    } finally {
      setLoading(false);
    }
  }, [toast, getLang()]);

  useEffect(() => { refresh(); }, [refresh]);

  if (isLoading) return null;
  if (!hasRole("editor")) return <Redirect to="/admin" />;

  const startNew = () => { setEditingId("new"); setForm(EMPTY_FORM); };
  const startEdit = (r: PromoCodeRow) => { setEditingId(r.id); setForm(rowToForm(r)); };
  const cancel = () => { setEditingId(null); setForm(EMPTY_FORM); };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body = formToBody(form);
      if (editingId === "new") {
        await api("/admin/promo-codes", { method: "POST", body: JSON.stringify(body) });
        toast({ title: tx("已建立優惠碼") });
      } else if (typeof editingId === "number") {
        await api(`/admin/promo-codes/${editingId}`, { method: "PUT", body: JSON.stringify(body) });
        toast({ title: tx("已更新優惠碼") });
      }
      cancel();
      refresh();
    } catch (err) {
      toast({ variant: "destructive", title: tx("儲存失敗"), description: txApi((err as Error).message) });
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (r: PromoCodeRow) => {
    if (!window.confirm(tx("確定刪除優惠碼「{0}」？已使用 {1} 次。", [r.code, r.usedCount]))) return;
    try {
      await api(`/admin/promo-codes/${r.id}`, { method: "DELETE" });
      toast({ title: tx("已刪除") });
      refresh();
    } catch (err) {
      toast({ variant: "destructive", title: tx("刪除失敗"), description: txApi((err as Error).message) });
    }
  };

  const fmtDiscount = (r: PromoCodeRow) =>
    r.discountType === "percent" ? `${r.discountValue}%` : `NT$ ${r.discountValue}`;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl mb-2">{tx("優惠碼管理")}</h1>
          <p className="text-sm text-muted-foreground">{tx("建立折扣碼供購票時使用，可設定百分比或固定金額、適用票種、使用次數上限與有效期間。")}</p>
        </div>
        {editingId === null && (
          <button
            onClick={startNew}
            data-testid="button-new-promo"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            <Plus size={16} /> {tx("新增優惠碼")}
          </button>
        )}
      </header>

      {editingId !== null && (
        <section className="bg-white rounded-2xl p-6 border shadow-sm">
          <h2 className="font-medium text-lg mb-4">{editingId === "new" ? tx("新增優惠碼") : tx("編輯優惠碼 #{0}", [editingId])}</h2>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="block mb-1 font-medium">{tx("優惠碼 * (英數 2-32 字)")}</span>
              <input
                required minLength={2} maxLength={32}
                pattern="[A-Za-z0-9_\-]+"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                disabled={editingId !== "new"}
                data-testid="input-promo-code"
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary uppercase disabled:bg-muted"
                placeholder={tx("例如：EARLYBIRD")}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">{tx("說明（內部備註）")}</span>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={tx("例如：早鳥 9 折優惠")}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">{tx("折扣類型 *")}</span>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as "percent" | "fixed" })}
                className="w-full px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="percent">{tx("百分比 (%)")}</option>
                <option value="fixed">{tx("固定金額 (NT$)")}</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">
                {tx("折扣值 *")} {form.discountType === "percent" ? "(1-100)" : "(NT$)"}
              </span>
              <input
                required type="number" min={1}
                max={form.discountType === "percent" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                data-testid="input-promo-value"
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">{tx("適用票種")}</span>
              <select
                value={form.appliesTo}
                onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {TICKET_TYPES().map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">{tx("使用次數上限（留空＝無上限）")}</span>
              <input
                type="number" min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={tx("例如：100")}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">{tx("生效日")}</span>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">{tx("截止日")}</span>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="text-sm flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="font-medium">{tx("啟用")}</span>
            </label>
            <div className="md:col-span-2 flex items-center gap-3 pt-2">
              <button
                type="submit" disabled={submitting}
                data-testid="button-save-promo"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
              >
                <Check size={16} /> {submitting ? tx("儲存中...") : tx("儲存")}
              </button>
              <button
                type="button" onClick={cancel}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium hover:bg-muted"
              >
                <X size={16} /> {tx("取消")}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="bg-white rounded-2xl p-6 border">
        <h2 className="font-medium text-lg mb-4">{tx("現有優惠碼 (")}{rows.length})</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">{tx("載入中…")}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tx("尚未建立任何優惠碼。")}</p>
        ) : (
          <div tabIndex={0} role="region" aria-label={tx("資料表（可水平捲動）")} className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="px-3 py-2">{tx("優惠碼")}</th>
                  <th className="px-3 py-2">{tx("折扣")}</th>
                  <th className="px-3 py-2">{tx("適用")}</th>
                  <th className="px-3 py-2">{tx("使用 / 上限")}</th>
                  <th className="px-3 py-2">{tx("有效期間")}</th>
                  <th className="px-3 py-2">{tx("狀態")}</th>
                  <th className="px-3 py-2">{tx("操作")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0" data-testid={`promo-row-${r.code}`}>
                    <td className="px-3 py-3">
                      <div className="font-mono font-bold">{r.code}</div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </td>
                    <td className="px-3 py-3 font-medium">{fmtDiscount(r)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{r.appliesTo || tx("全部票種")}</td>
                    <td className="px-3 py-3">{r.usedCount} / {r.maxUses ?? "∞"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {r.validFrom || "—"} ~ {r.validUntil || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                        {r.active ? tx("啟用") : tx("停用")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button aria-label={tx("編輯")}
                          type="button" onClick={() => startEdit(r)}
                          data-testid={`button-edit-${r.code}`}
                          className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title={tx("編輯")}
                        >
                          <Pencil size={16} />
                        </button>
                        <button aria-label={tx("刪除")}
                          type="button" onClick={() => onDelete(r)}
                          data-testid={`button-delete-${r.code}`}
                          className="p-2 rounded hover:bg-destructive/10 text-destructive"
                          title={tx("刪除")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
