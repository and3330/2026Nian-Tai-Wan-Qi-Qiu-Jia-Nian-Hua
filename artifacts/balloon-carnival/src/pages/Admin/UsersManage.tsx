import { useState, useEffect, useCallback } from "react";
import { Redirect } from "wouter";
import { useAuth, type AdminRole } from "@workspace/replit-auth-web";
import { useToast } from "@/hooks/use-toast";
import { Trash2, UserPlus, KeyRound } from "lucide-react";

interface AdminUserRow {
  id: string;
  username: string;
  role: AdminRole;
  displayName: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const ROLE_LABEL: Record<AdminRole, string> = {
  owner: "擁有者",
  editor: "編輯",
  checkin: "現場報到",
  viewer: "檢視",
};

const ROLE_DESC: Record<AdminRole, string> = {
  owner: "完整權限，可管理帳號",
  editor: "可編輯內容、Email、社群、自動化",
  checkin: "僅可使用現場報到工具",
  viewer: "僅可檢視報名統計",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export default function AdminUsersManage() {
  const { role, isLoading } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("editor");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { users } = await api<{ users: AdminUserRow[] }>("/admin/users");
      setUsers(users);
    } catch (e) {
      toast({ variant: "destructive", title: "載入失敗", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (role === "owner") refresh();
  }, [role, refresh]);

  if (isLoading) return null;
  if (role !== "owner") return <Redirect to="/admin" />;

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password, displayName: displayName.trim() || null, role: newRole }),
      });
      toast({ title: "已建立帳號" });
      setUsername(""); setPassword(""); setDisplayName(""); setNewRole("editor");
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "建立失敗", description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const onChangeRole = async (id: string, role: AdminRole) => {
    try {
      await api(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ role }) });
      toast({ title: "角色已更新" });
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "更新失敗", description: (e as Error).message });
    }
  };

  const onResetPwd = async (id: string, username: string) => {
    const pwd = window.prompt(`為 ${username} 設定新密碼（至少 6 字元）`);
    if (!pwd) return;
    try {
      await api(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ password: pwd }) });
      toast({ title: "密碼已更新" });
    } catch (e) {
      toast({ variant: "destructive", title: "更新失敗", description: (e as Error).message });
    }
  };

  const onDelete = async (id: string, username: string) => {
    if (!window.confirm(`確定要刪除帳號「${username}」嗎？此動作無法復原。`)) return;
    try {
      await api(`/admin/users/${id}`, { method: "DELETE" });
      toast({ title: "已刪除" });
      refresh();
    } catch (e) {
      toast({ variant: "destructive", title: "刪除失敗", description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl mb-2">帳號管理</h1>
        <p className="text-sm text-muted-foreground">管理後台子帳號，分派不同角色權限。系統超級管理員（環境變數）始終擁有擁有者權限。</p>
      </header>

      <section className="bg-white rounded-2xl p-6 border">
        <h2 className="font-medium text-lg mb-4 flex items-center gap-2"><UserPlus size={20} /> 新增帳號</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block mb-1 font-medium">帳號 *</span>
            <input
              data-testid="input-new-username"
              required minLength={2}
              value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium">密碼 *（至少 6 字元）</span>
            <input
              data-testid="input-new-password" type="password"
              required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium">顯示名稱（選填）</span>
            <input
              data-testid="input-new-display-name"
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 font-medium">角色 *</span>
            <select
              data-testid="select-new-role"
              value={newRole} onChange={(e) => setNewRole(e.target.value as AdminRole)}
              className="w-full px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(ROLE_LABEL) as AdminRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]} — {ROLE_DESC[r]}</option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button
              type="submit" disabled={submitting}
              data-testid="button-create-user"
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "建立中..." : "建立帳號"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl p-6 border">
        <h2 className="font-medium text-lg mb-4">現有子帳號 ({users.length})</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">載入中…</p>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-sm">尚未建立任何子帳號。</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="px-3 py-2">帳號</th>
                  <th className="px-3 py-2">顯示名稱</th>
                  <th className="px-3 py-2">角色</th>
                  <th className="px-3 py-2">建立者</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0" data-testid={`user-row-${u.username}`}>
                    <td className="px-3 py-3 font-medium">{u.username}</td>
                    <td className="px-3 py-3 text-muted-foreground">{u.displayName || "—"}</td>
                    <td className="px-3 py-3">
                      <select
                        data-testid={`select-role-${u.username}`}
                        value={u.role}
                        onChange={(e) => onChangeRole(u.id, e.target.value as AdminRole)}
                        className="px-2 py-1 rounded border bg-white text-sm"
                      >
                        {(Object.keys(ROLE_LABEL) as AdminRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{u.createdBy || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onResetPwd(u.id, u.username)}
                          data-testid={`button-reset-${u.username}`}
                          className="p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="重設密碼"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(u.id, u.username)}
                          data-testid={`button-delete-${u.username}`}
                          className="p-2 rounded hover:bg-destructive/10 text-destructive"
                          title="刪除"
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
