import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, X, ExternalLink } from "lucide-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { getListSponsorsQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Sponsor {
  id: number;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  tier: string;
}

const tierLabels: Record<string, string> = {
  platinum: "白金級",
  gold: "金級",
  silver: "銀級",
  bronze: "銅級",
};

const tierColors: Record<string, string> = {
  platinum: "bg-slate-100 text-slate-700 border-slate-300",
  gold: "bg-amber-50 text-amber-700 border-amber-300",
  silver: "bg-gray-50 text-gray-600 border-gray-300",
  bronze: "bg-orange-50 text-orange-700 border-orange-300",
};

async function fetchAdminSponsors(): Promise<Sponsor[]> {
  const res = await fetch(`${BASE}/api/admin/sponsors`, { credentials: "include" });
  if (!res.ok) throw new Error("載入失敗");
  return res.json();
}

async function createSponsor(data: Omit<Sponsor, "id">): Promise<Sponsor> {
  const res = await fetch(`${BASE}/api/admin/sponsors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("新增失敗");
  return res.json();
}

async function updateSponsor(id: number, data: Partial<Sponsor>): Promise<Sponsor> {
  const res = await fetch(`${BASE}/api/admin/sponsors/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("更新失敗");
  return res.json();
}

async function deleteSponsorApi(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/sponsors/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("刪除失敗");
}

export default function AdminSponsorsManage() {
  const queryClient = useQueryClient();
  const queryKey = ["admin-sponsors"];

  const { data: sponsors, isLoading } = useQuery({
    queryKey,
    queryFn: fetchAdminSponsors,
  });

  const createMut = useMutation({
    mutationFn: (data: Omit<Sponsor, "id">) => createSponsor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: getListSponsorsQueryKey() });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Sponsor> }) => updateSponsor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: getListSponsorsQueryKey() });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteSponsorApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: getListSponsorsQueryKey() });
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", logoUrl: "", websiteUrl: "", tier: "gold" });

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: "", logoUrl: "", websiteUrl: "", tier: "gold" });
    setIsDialogOpen(true);
  };

  const openEdit = (s: Sponsor) => {
    setEditingId(s.id);
    setFormData({ name: s.name, logoUrl: s.logoUrl, websiteUrl: s.websiteUrl, tier: s.tier });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要刪除這個贊助廠商嗎？")) {
      deleteMut.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMut.mutate({ id: editingId, data: formData }, {
        onSuccess: () => setIsDialogOpen(false),
      });
    } else {
      createMut.mutate(formData, {
        onSuccess: () => setIsDialogOpen(false),
      });
    }
  };

  const grouped = (sponsors || []).reduce<Record<string, Sponsor[]>>((acc, s) => {
    if (!acc[s.tier]) acc[s.tier] = [];
    acc[s.tier].push(s);
    return acc;
  }, {});

  const tierOrder = ["platinum", "gold", "silver", "bronze"];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display">贊助廠商管理</h1>
          <p className="text-muted-foreground mt-1">管理贊助廠商資訊，前台贊助廠商頁面將自動更新</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent text-accent-foreground px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-accent/90 transition-all shadow-md"
        >
          <Plus size={18} /> 新增廠商
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-10">載入中...</div>
      ) : !sponsors?.length ? (
        <div className="text-center py-16 bg-white rounded-3xl border">
          <p className="text-muted-foreground text-lg">尚無贊助廠商</p>
          <p className="text-muted-foreground text-sm mt-1">點擊「新增廠商」開始新增</p>
        </div>
      ) : (
        tierOrder.map(tier => {
          const items = grouped[tier];
          if (!items?.length) return null;
          return (
            <div key={tier}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-bold border ${tierColors[tier]}`}>
                  {tierLabels[tier]}
                </span>
                <span className="text-muted-foreground text-sm">{items.length} 家</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(s => (
                  <div key={s.id} className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                        {s.logoUrl ? (
                          <img src={s.logoUrl} alt={s.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="text-muted-foreground text-xs">LOGO</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{s.name}</h3>
                        {s.websiteUrl && (
                          <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline flex items-center gap-1 truncate">
                            <ExternalLink size={12} /> {s.websiteUrl}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 border-t pt-3 mt-auto">
                      <button onClick={() => openEdit(s)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1">
                        <Edit2 size={16} /> 編輯
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="px-4 py-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors flex items-center justify-center">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl relative">
            <button
              onClick={() => setIsDialogOpen(false)}
              className="absolute top-6 right-6 p-2 bg-muted hover:bg-black/10 rounded-full transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">{editingId ? "編輯廠商" : "新增廠商"}</h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold mb-2">廠商名稱</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="例：台灣氣球股份有限公司"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">贊助等級</label>
                  <select
                    value={formData.tier}
                    onChange={e => setFormData({ ...formData, tier: e.target.value })}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                  >
                    {tierOrder.map(t => (
                      <option key={t} value={t}>{tierLabels[t]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Logo 圖片 URL</label>
                  <input
                    required
                    type="url"
                    value={formData.logoUrl}
                    onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">官方網站 URL</label>
                  <input
                    required
                    type="url"
                    value={formData.websiteUrl}
                    onChange={e => setFormData({ ...formData, websiteUrl: e.target.value })}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t">
                  <button type="button" onClick={() => setIsDialogOpen(false)} className="px-6 py-2.5 rounded-full font-bold bg-muted hover:bg-muted/80">取消</button>
                  <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-8 py-2.5 rounded-full font-bold bg-primary text-white hover:bg-primary/90">
                    {createMut.isPending || updateMut.isPending ? "儲存中..." : "儲存"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
