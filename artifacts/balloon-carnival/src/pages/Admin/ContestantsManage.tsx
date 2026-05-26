import { useState } from "react";
import { useListContestants, useAdminCreateContestant, useAdminUpdateContestant, useAdminDeleteContestant } from "@workspace/api-client-react";
import { Plus, Edit2, Trash2, X, Image as ImageIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListContestantsQueryKey } from "@workspace/api-client-react";

export default function AdminContestantsManage() {
  const { data: members, isLoading } = useListContestants();
  const queryClient = useQueryClient();
  
  const createMutation = useAdminCreateContestant();
  const updateMutation = useAdminUpdateContestant();
  const deleteMutation = useAdminDeleteContestant();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", imageUrl: "" });

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: "", description: "", imageUrl: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({ name: c.name, description: c.description, imageUrl: c.imageUrl || "" });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要移除這位選手嗎？")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListContestantsQueryKey() })
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getListContestantsQueryKey() });
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getListContestantsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display">選手管理</h1>
          <p className="text-muted-foreground mt-1">管理本屆參展氣球藝術家資訊（首頁人氣投票來源）</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent text-accent-foreground px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-accent/90 transition-all shadow-md"
        >
          <Plus size={18} /> 新增選手
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center py-10">載入中...</div>
        ) : members?.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-white rounded-3xl border">
            <p className="text-muted-foreground text-lg">尚無選手資料</p>
            <p className="text-muted-foreground text-sm mt-1">點擊「新增選手」開始新增</p>
          </div>
        ) : members?.map((c) => (
          <div key={c.id} className="bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
            <div className="h-48 bg-muted relative">
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon size={32} /></div>
              )}
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="font-bold text-xl mb-2">{c.name}</h3>
              <p className="text-muted-foreground text-sm line-clamp-3 mb-4 flex-1">{c.description}</p>
              <div className="flex gap-2 border-t pt-4 mt-auto">
                <button onClick={() => openEdit(c)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1">
                  <Edit2 size={16} /> 編輯
                </button>
                <button onClick={() => handleDelete(c.id)} className="px-4 py-2 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition-colors flex items-center justify-center">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
              <h2 className="text-2xl font-bold mb-6">{editingId ? "編輯選手資訊" : "新增選手"}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold mb-2">姓名 / 暱稱</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="例：王小明 / 氣球達人"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold mb-2">個人照片 URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="https://..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold mb-2">自我介紹 / 經歷</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none h-36 resize-none"
                    placeholder="介紹專長、從業經歷、想交流的方向等..."
                  />
                </div>
                
                <div className="pt-4 flex justify-end gap-3 border-t">
                  <button type="button" onClick={() => setIsDialogOpen(false)} className="px-6 py-2.5 rounded-full font-bold bg-muted hover:bg-muted/80">取消</button>
                  <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-8 py-2.5 rounded-full font-bold bg-primary text-white hover:bg-primary/90">
                    {createMutation.isPending || updateMutation.isPending ? "儲存中..." : "儲存"}
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
