import { useState, useRef } from "react";
import { useListNews, useAdminCreateNews, useAdminUpdateNews, useAdminDeleteNews } from "@workspace/api-client-react";
import { Plus, Edit2, Trash2, X, Upload, Image as ImageIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListNewsQueryKey } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { formatDate } from "@/lib/utils";

export default function AdminNewsManage() {
  const { data: news, isLoading } = useListNews();
  const queryClient = useQueryClient();

  const createMutation = useAdminCreateNews();
  const updateMutation = useAdminUpdateNews();
  const deleteMutation = useAdminDeleteNews();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ title: "", summary: "", content: "", imageUrl: "" });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress, error: uploadError } = useUpload({
    basePath: "/api/storage",
    credentials: "include",
    onSuccess: (response) => {
      setFormData((prev) => ({ ...prev, imageUrl: `/api/storage${response.objectPath}` }));
    },
  });

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("請選擇圖片檔案");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("圖片大小不可超過 10MB");
      return;
    }
    await uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({ title: "", summary: "", content: "", imageUrl: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (article: any) => {
    setEditingId(article.id);
    setFormData({ title: article.title, summary: article.summary || "", content: article.content, imageUrl: article.imageUrl || "" });
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
    const data = { ...formData, imageUrl: formData.imageUrl || null };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getListNewsQueryKey() });
        }
      });
    } else {
      createMutation.mutate({ data }, {
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
              <th className="p-4 font-semibold text-muted-foreground w-20">圖片</th>
              <th className="p-4 font-semibold text-muted-foreground w-32">發布日期</th>
              <th className="p-4 font-semibold text-muted-foreground">標題</th>
              <th className="p-4 font-semibold text-muted-foreground w-32 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center">載入中...</td></tr>
            ) : news?.map((article) => (
              <tr key={article.id} className="hover:bg-muted/20 transition-colors">
                <td className="p-4">
                  {article.imageUrl ? (
                    <img src={article.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground/40">
                      <ImageIcon size={18} />
                    </div>
                  )}
                </td>
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
                  <label className="block text-sm font-bold mb-2">封面圖片 (選填)</label>
                  {formData.imageUrl ? (
                    <div className="relative inline-block">
                      <img src={formData.imageUrl} alt="preview" className="w-full max-h-56 object-cover rounded-xl border" onError={e => (e.currentTarget.style.display = "none")} />
                      <button type="button" onClick={() => setFormData({...formData, imageUrl: ""})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-md">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"} ${isUploading ? "pointer-events-none opacity-70" : ""}`}
                    >
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
                      {isUploading ? (
                        <div className="space-y-2">
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-sm text-muted-foreground">上傳中... {progress}%</p>
                          <div className="w-full bg-muted rounded-full h-1.5 max-w-[200px] mx-auto">
                            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-sm text-muted-foreground">拖放圖片或點擊選擇</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">支援 JPG、PNG、WebP，最大 10MB</p>
                        </>
                      )}
                      {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError.message}</p>}
                    </div>
                  )}
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
                  <button type="submit" disabled={createMutation.isPending || updateMutation.isPending || isUploading} className="px-8 py-2.5 rounded-full font-bold bg-primary text-white hover:bg-primary/90">
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
