import { useState, useEffect, useCallback } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useToast } from "@/hooks/use-toast";
import { Store, Plus, Pencil, ReceiptText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface VendorRow {
  id: number;
  name: string;
  boothNumber: string | null;
  contact: string | null;
  active: boolean;
  createdAt: string;
  accounts: string[];
  issuedCount: number;
  issuedTotal: number;
}

interface VendorInvoiceRow {
  id: number;
  amount: number;
  status: string;
  invoiceNumber: string | null;
  buyerName: string | null;
  createdAt: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`);
  return data as T;
}

export default function AdminVendorsManage() {
  const { role, hasRole, isLoading } = useAuth();
  const { toast } = useToast();

  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [boothNumber, setBoothNumber] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editBooth, setEditBooth] = useState("");
  const [editContact, setEditContact] = useState("");

  const [detailVendor, setDetailVendor] = useState<VendorRow | null>(null);
  const [detailRows, setDetailRows] = useState<VendorInvoiceRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const canManage = hasRole("editor");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setVendors(await api<VendorRow[]>("/admin/vendors"));
    } catch (e) {
      toast({ variant: "destructive", title: "載入失敗", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (canManage) refresh();
  }, [canManage, refresh]);

  if (isLoading) return null;
  if (!canManage) return <Redirect to="/admin" />;

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/admin/vendors", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), boothNumber: boothNumber.trim() || null, contact: contact.trim() || null }),
      });
      toast({ title: "已新增商家" });
      setName(""); setBoothNumber(""); setContact("");
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "新增失敗", description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (v: VendorRow) => {
    setEditing(v);
    setEditName(v.name);
    setEditBooth(v.boothNumber || "");
    setEditContact(v.contact || "");
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    try {
      await api(`/admin/vendors/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), boothNumber: editBooth.trim() || null, contact: editContact.trim() || null }),
      });
      toast({ title: "已更新商家" });
      setEditing(null);
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "更新失敗", description: (e as Error).message });
    }
  };

  const onToggleActive = async (v: VendorRow) => {
    const verb = v.active ? "停用" : "啟用";
    if (!window.confirm(`確定要${verb}「${v.name}」嗎？${v.active ? "停用後該商家帳號將無法收款開發票。" : ""}`)) return;
    try {
      await api(`/admin/vendors/${v.id}`, { method: "PUT", body: JSON.stringify({ active: !v.active }) });
      toast({ title: `已${verb}` });
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "操作失敗", description: (e as Error).message });
    }
  };

  const openDetail = async (v: VendorRow) => {
    setDetailVendor(v);
    setDetailLoading(true);
    setDetailRows([]);
    try {
      setDetailRows(await api<VendorInvoiceRow[]>(`/admin/vendors/${v.id}/invoices`));
    } catch (e) {
      toast({ variant: "destructive", title: "載入明細失敗", description: (e as Error).message });
    } finally {
      setDetailLoading(false);
    }
  };

  const totalAll = vendors.reduce((s, v) => s + v.issuedTotal, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl mb-2 flex items-center gap-3"><Store className="text-primary" /> 攤位商家管理</h1>
        <p className="text-sm text-muted-foreground">
          管理現場攤位商家與各商家的 POS 收款統計。商家帳號請到「帳號管理」建立（角色選「攤位商家」並綁定商家）。
        </p>
      </header>

      <section className="bg-white rounded-2xl p-6 border">
        <h2 className="font-medium text-lg mb-4 flex items-center gap-2"><Plus size={20} /> 新增商家</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium">商家名稱 *</span>
            <input
              data-testid="input-vendor-name"
              required minLength={2}
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium">攤位編號（選填）</span>
            <input
              data-testid="input-vendor-booth"
              value={boothNumber} onChange={(e) => setBoothNumber(e.target.value)}
              placeholder="例如 A12"
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium">聯絡方式（選填）</span>
            <input
              data-testid="input-vendor-contact"
              value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder="電話或 Email"
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <div className="md:col-span-3">
            <button
              type="submit" disabled={submitting}
              data-testid="button-create-vendor"
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "新增中..." : "新增商家"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl p-6 border">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="font-medium text-lg">商家列表與收款統計（{vendors.length}）</h2>
          <div className="text-sm text-muted-foreground">
            全部商家已開立總額：<span className="font-bold text-foreground">NT${totalAll.toLocaleString()}</span>
          </div>
        </div>
        {loading ? (
          <p className="text-muted-foreground text-sm">載入中…</p>
        ) : vendors.length === 0 ? (
          <p className="text-muted-foreground text-sm">尚未建立任何商家。</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="px-3 py-2">商家</th>
                  <th className="px-3 py-2">攤位</th>
                  <th className="px-3 py-2">帳號</th>
                  <th className="px-3 py-2 text-right">開立筆數</th>
                  <th className="px-3 py-2 text-right">收款總額</th>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b last:border-0" data-testid={`vendor-row-${v.id}`}>
                    <td className="px-3 py-3">
                      <div className="font-medium">{v.name}</div>
                      {v.contact && <div className="text-xs text-muted-foreground">{v.contact}</div>}
                    </td>
                    <td className="px-3 py-3">{v.boothNumber || "—"}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {v.accounts.length > 0 ? v.accounts.join(", ") : "尚未綁定"}
                    </td>
                    <td className="px-3 py-3 text-right">{v.issuedCount}</td>
                    <td className="px-3 py-3 text-right font-bold">NT${v.issuedTotal.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", v.active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground")}>
                        {v.active ? "啟用中" : "已停用"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openDetail(v)}
                          data-testid={`button-vendor-detail-${v.id}`}
                          className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="收款明細"
                        >
                          <ReceiptText size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          data-testid={`button-vendor-edit-${v.id}`}
                          className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="編輯"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleActive(v)}
                          data-testid={`button-vendor-toggle-${v.id}`}
                          className={cn("px-2 py-1 rounded text-xs font-medium", v.active ? "text-destructive hover:bg-destructive/10" : "text-green-700 hover:bg-green-50")}
                        >
                          {v.active ? "停用" : "啟用"}
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

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">編輯商家</h3>
              <button type="button" onClick={() => setEditing(null)} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
            </div>
            <label className="text-sm block">
              <span className="block mb-1 font-medium">商家名稱 *</span>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg border" data-testid="input-edit-vendor-name" />
            </label>
            <label className="text-sm block">
              <span className="block mb-1 font-medium">攤位編號</span>
              <input value={editBooth} onChange={(e) => setEditBooth(e.target.value)} className="w-full px-3 py-2 rounded-lg border" data-testid="input-edit-vendor-booth" />
            </label>
            <label className="text-sm block">
              <span className="block mb-1 font-medium">聯絡方式</span>
              <input value={editContact} onChange={(e) => setEditContact(e.target.value)} className="w-full px-3 py-2 rounded-lg border" data-testid="input-edit-vendor-contact" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border font-medium">取消</button>
              <button type="button" onClick={onSaveEdit} disabled={editName.trim().length < 2} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50" data-testid="button-save-vendor">
                儲存
              </button>
            </div>
          </div>
        </div>
      )}

      {detailVendor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailVendor(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{detailVendor.name} — 收款明細</h3>
              <button type="button" onClick={() => setDetailVendor(null)} className="p-1 rounded hover:bg-muted"><X size={18} /></button>
            </div>
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">載入中…</p>
            ) : detailRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">此商家尚無收款紀錄。</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="px-2 py-2">時間</th>
                    <th className="px-2 py-2">發票號碼</th>
                    <th className="px-2 py-2">買受人</th>
                    <th className="px-2 py-2 text-right">金額</th>
                    <th className="px-2 py-2">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("zh-TW")}</td>
                      <td className="px-2 py-2 font-mono">{r.invoiceNumber || "—"}</td>
                      <td className="px-2 py-2">{r.buyerName || "—"}</td>
                      <td className="px-2 py-2 text-right font-bold">NT${r.amount.toLocaleString()}</td>
                      <td className="px-2 py-2">{r.status === "issued" ? "已開立" : r.status === "failed" ? "失敗" : r.status === "voided" ? "已作廢" : r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
