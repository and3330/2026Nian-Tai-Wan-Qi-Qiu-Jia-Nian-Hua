import { useState, useEffect, useCallback } from "react";
import { Facebook, Instagram, MessageCircle, Send, Clock, Edit2, Trash2, Plus, ChevronLeft, ChevronRight, CalendarDays, List, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface SocialPost {
  id: string;
  content: string;
  platforms: string[];
  hashtags?: string;
  imageUrls?: string[];
  scheduledAt?: string;
  publishedAt?: string;
  status: string;
  platformResults?: Record<string, any>;
  errorMessage?: string;
  createdAt: string;
}

const PLATFORM_ICONS: Record<string, { icon: typeof Facebook; color: string; label: string }> = {
  facebook: { icon: Facebook, color: "text-blue-600", label: "Facebook" },
  instagram: { icon: Instagram, color: "text-pink-600", label: "Instagram" },
  threads: { icon: MessageCircle, color: "text-gray-800", label: "Threads" },
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "草稿", color: "text-gray-600", bg: "bg-gray-100" },
  scheduled: { label: "已排程", color: "text-blue-600", bg: "bg-blue-50" },
  published: { label: "已發布", color: "text-green-600", bg: "bg-green-50" },
  failed: { label: "發布失敗", color: "text-red-600", bg: "bg-red-50" },
};

export default function SocialPostsManage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["facebook"]);
  const [hashtags, setHashtags] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, any> | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/social-posts", { credentials: "include" });
      if (res.ok) setPosts(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const resetForm = () => {
    setContent("");
    setPlatforms(["facebook"]);
    setHashtags("");
    setImageUrl("");
    setScheduledAt("");
    setEditingPost(null);
    setShowPreview(false);
    setPreviewData(null);
  };

  const openCreate = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEdit = (post: SocialPost) => {
    setEditingPost(post);
    setContent(post.content);
    setPlatforms(post.platforms);
    setHashtags(post.hashtags || "");
    setImageUrl(post.imageUrls?.[0] || "");
    setScheduledAt(post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : "");
    setShowEditor(true);
  };

  const handleSubmit = async () => {
    if (!content.trim() || platforms.length === 0) return;
    setSubmitting(true);
    try {
      const body = { content, platforms, hashtags: hashtags || null, imageUrls: imageUrl ? [imageUrl] : [], scheduledAt: scheduledAt || null };
      const url = editingPost ? `/api/admin/social-posts/${editingPost.id}` : "/api/admin/social-posts";
      const method = editingPost ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        fetchPosts();
        setShowEditor(false);
        resetForm();
      } else {
        const data = await res.json();
        alert(data.error || "儲存失敗");
      }
    } catch { alert("儲存失敗"); } finally { setSubmitting(false); }
  };

  const handlePublish = async (id: string) => {
    if (!confirm("確定要立即發布此貼文？")) return;
    try {
      const res = await fetch(`/api/admin/social-posts/${id}/publish`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (data.errors?.length) alert(`部分發布失敗：${data.errors.join(", ")}`);
      fetchPosts();
    } catch { alert("發布失敗"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除此貼文？")) return;
    await fetch(`/api/admin/social-posts/${id}`, { method: "DELETE", credentials: "include" });
    fetchPosts();
  };

  const handlePreview = async () => {
    if (!content.trim() || platforms.length === 0) return;
    try {
      const res = await fetch("/api/admin/social-posts/preview", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, platforms, hashtags }),
      });
      if (res.ok) {
        setPreviewData(await res.json());
        setShowPreview(true);
      }
    } catch {}
  };

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth, year, month };
  };

  const getPostsForDate = (date: string) => {
    return posts.filter(p => {
      const d = p.scheduledAt || p.publishedAt || p.createdAt;
      return d && d.startsWith(date);
    });
  };

  const calInfo = getDaysInMonth(calMonth);
  const calDays: (number | null)[] = [];
  for (let i = 0; i < calInfo.firstDay; i++) calDays.push(null);
  for (let i = 1; i <= calInfo.daysInMonth; i++) calDays.push(i);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">載入中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display">社群貼文管理</h1>
          <p className="text-muted-foreground mt-1">建立、排程與發布社群貼文</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted rounded-xl p-1">
            <button onClick={() => setView("list")} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all", view === "list" ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <List size={16} className="inline mr-1" /> 列表
            </button>
            <button onClick={() => setView("calendar")} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all", view === "calendar" ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <CalendarDays size={16} className="inline mr-1" /> 日曆
            </button>
          </div>
          <button onClick={openCreate} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-md">
            <Plus size={18} /> 新增貼文
          </button>
        </div>
      </div>

      {view === "calendar" && (
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setCalMonth(new Date(calInfo.year, calInfo.month - 1))} className="p-2 hover:bg-muted rounded-lg">
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-lg font-bold">
              {calMonth.toLocaleDateString("zh-TW", { year: "numeric", month: "long" })}
            </h3>
            <button onClick={() => setCalMonth(new Date(calInfo.year, calInfo.month + 1))} className="p-2 hover:bg-muted rounded-lg">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-muted rounded-xl overflow-hidden">
            {["日", "一", "二", "三", "四", "五", "六"].map(d => (
              <div key={d} className="bg-white p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {calDays.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className="bg-white p-2 min-h-[80px]" />;
              const dateStr = `${calInfo.year}-${String(calInfo.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayPosts = getPostsForDate(dateStr);
              const isToday = dateStr === new Date().toISOString().slice(0, 10);
              return (
                <div key={day} className={cn("bg-white p-2 min-h-[80px]", isToday && "ring-2 ring-primary/30 ring-inset")}>
                  <span className={cn("text-xs font-medium", isToday ? "text-primary font-bold" : "text-muted-foreground")}>{day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayPosts.slice(0, 3).map(p => {
                      const st = STATUS_LABELS[p.status] || STATUS_LABELS.draft;
                      return (
                        <div key={p.id} onClick={() => openEdit(p)} className={cn("text-[10px] px-1 py-0.5 rounded truncate cursor-pointer", st.bg, st.color)}>
                          {p.content.slice(0, 15)}...
                        </div>
                      );
                    })}
                    {dayPosts.length > 3 && <p className="text-[10px] text-muted-foreground">+{dayPosts.length - 3} 更多</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border">
              <CalendarDays size={48} className="mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">尚無貼文，點擊「新增貼文」開始建立</p>
            </div>
          ) : posts.map(post => {
            const st = STATUS_LABELS[post.status] || STATUS_LABELS.draft;
            return (
              <div key={post.id} className="bg-white rounded-2xl border p-5 hover:shadow-sm transition-all">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", st.bg, st.color)}>{st.label}</span>
                      {post.platforms.map(p => {
                        const info = PLATFORM_ICONS[p];
                        if (!info) return null;
                        return <info.icon key={p} size={14} className={info.color} />;
                      })}
                      {post.scheduledAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock size={12} /> {new Date(post.scheduledAt).toLocaleString("zh-TW")}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap line-clamp-3">{post.content}</p>
                    {post.hashtags && <p className="text-xs text-primary mt-1">{post.hashtags}</p>}
                    {post.errorMessage && <p className="text-xs text-red-500 mt-2">{post.errorMessage}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(post.status === "draft" || post.status === "scheduled") && (
                      <button onClick={() => handlePublish(post.id)} className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="立即發布">
                        <Send size={16} />
                      </button>
                    )}
                    {post.status !== "published" && (
                      <button onClick={() => openEdit(post)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="編輯">
                        <Edit2 size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(post.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="刪除">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowEditor(false); resetForm(); }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">{editingPost ? "編輯貼文" : "新增貼文"}</h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">發布平台</label>
                <div className="flex gap-2">
                  {Object.entries(PLATFORM_ICONS).map(([key, info]) => (
                    <button key={key} onClick={() => togglePlatform(key)} className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
                      platforms.includes(key) ? "border-primary bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:border-foreground/20"
                    )}>
                      <info.icon size={16} /> {info.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">貼文內容</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={6}
                  className="w-full border rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="輸入貼文內容..."
                />
                <p className="text-xs text-muted-foreground mt-1">{content.length} 字</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Hashtags（逗號分隔）</label>
                <input
                  value={hashtags}
                  onChange={e => setHashtags(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="氣球嘉年華, 台灣氣球, 親子活動"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  圖片網址
                  {platforms.includes("instagram") && <span className="text-red-500 ml-1">（Instagram 必填）</span>}
                </label>
                <input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="https://example.com/image.jpg"
                />
                {imageUrl && (
                  <div className="mt-2">
                    <img src={imageUrl} alt="preview" className="w-32 h-32 object-cover rounded-lg border" onError={e => (e.currentTarget.style.display = "none")} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">排程時間（留空為草稿）</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              {showPreview && previewData && (
                <div className="border rounded-xl p-4 space-y-3">
                  <h4 className="font-medium text-sm">各平台預覽</h4>
                  {Object.entries(previewData).map(([platform, data]: [string, any]) => {
                    const info = PLATFORM_ICONS[platform];
                    return (
                      <div key={platform} className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          {info && <info.icon size={14} className={info.color} />}
                          <span className="text-xs font-medium">{info?.label || platform}</span>
                          <span className="text-xs text-muted-foreground">{data.charCount}/{data.limit} 字</span>
                        </div>
                        <p className="text-xs whitespace-pre-wrap">{data.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex items-center justify-between">
              <button onClick={handlePreview} className="px-4 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-all flex items-center gap-2">
                <Eye size={16} /> 預覽
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowEditor(false); resetForm(); }} className="px-5 py-2.5 rounded-xl border text-sm font-medium hover:bg-muted transition-all">
                  取消
                </button>
                <button onClick={handleSubmit} disabled={submitting || !content.trim() || platforms.length === 0} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all disabled:opacity-50">
                  {submitting ? "儲存中..." : scheduledAt ? "排程發布" : "儲存草稿"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
