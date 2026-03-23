import { useState } from "react";
import { useListNews, useAdminCreateNews, useAdminUpdateNews, useAdminDeleteNews } from "@workspace/api-client-react";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListNewsQueryKey } from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";

export default function AdminNewsManage() {
  const { data: news, isLoading } = useListNews();
  const queryClient = useQueryClient();
  
  const createMutation = useAdminCreateNews();
  const updateMutation = useAdminUpdateNews();
  const deleteMutation = useAdminDeleteNews();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ title: "", summary: "", content: "" });

  const openCreate = () => {
    setEditingId(null);
    setFormData({ title: "", summary: "", content: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (article: any) => {
    setEditingId(article.id);
    setFormData({ title: article.title, summary: article.summary || "", content: article.content });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要刪除這篇最新消息嗎？")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNewsQueryKey() })
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getListNewsQueryKey() });
        }
      });
    } else {
      createMutation.mutate({ data: formData }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getListNewsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display">最新消息管理</h1>
          <p className="text-muted-foreground mt-1">發布大會公告與活動亮點</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-primary text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md"
        >
          <Plus size={18} /> 新增消息
        </button>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-muted/30">
            <tr>
              <th className="p-4 font-semibold text-muted-foreground w-32">發布日期</th>
              <th className="p-4 font-semibold text-muted-foreground">標題</th>
              <th className="p-4 font-semibold text-muted-foreground w-32 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={3} className="p-8 text-center">載入中...</td></tr>
            ) : news?.map((article) => (
              <tr key={article.id} className="hover:bg-muted/20 transition-colors">
                <td className="p-4 text-sm text-muted-foreground">{formatDate(article.createdAt)}</td>
                <td className="p-4 font-medium">{article.title}</td>
                <td className="p-4 flex items-center justify-end gap-2">
                  <button onClick={() => openEdit(article)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(article.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button 
              onClick={() => setIsDialogOpen(false)}
              className="absolute top-6 right-6 p-2 bg-muted hover:bg-black/10 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-6">{editingId ? "編輯消息" : "新增消息"}</h2>
              
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold mb-2">標題</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">摘要 (選填，顯示於列表)</label>
                  <textarea
                    value={formData.summary}
                    onChange={e => setFormData({...formData, summary: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">詳細內容</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none h-64 resize-none"
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
