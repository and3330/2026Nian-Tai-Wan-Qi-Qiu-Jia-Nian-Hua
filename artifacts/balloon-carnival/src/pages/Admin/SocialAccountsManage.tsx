import { useState, useEffect, useCallback } from "react";
import { Facebook, Instagram, MessageCircle, Trash2, ToggleLeft, ToggleRight, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SocialAccount {
  id: string;
  platform: string;
  platformAccountId: string;
  accountName: string;
  accountType: string;
  profileImageUrl?: string;
  isActive: boolean;
  tokenExpiresAt?: string;
  createdAt: string;
}

const PLATFORM_INFO: Record<string, { label: string; icon: typeof Facebook; color: string; bgColor: string }> = {
  facebook: { label: "Facebook", icon: Facebook, color: "text-blue-600", bgColor: "bg-blue-50" },
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-600", bgColor: "bg-pink-50" },
  threads: { label: "Threads", icon: MessageCircle, color: "text-gray-800", bgColor: "bg-gray-50" },
};

export default function SocialAccountsManage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/social-accounts", { credentials: "include" });
      if (res.ok) setAccounts(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === "oauth-success") {
        fetchAccounts();
        setConnecting(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [fetchAccounts]);

  const connectPlatform = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await fetch(`/api/admin/social-accounts/oauth-url/${platform}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to get OAuth URL");
      const { url } = await res.json();
      window.open(url, "oauth", "width=600,height=700,scrollbars=yes");
    } catch (err) {
      alert(`連結失敗：${(err as Error).message}`);
      setConnecting(null);
    }
  };

  const toggleAccount = async (id: string) => {
    const res = await fetch(`/api/admin/social-accounts/${id}/toggle`, {
      method: "PATCH", credentials: "include",
    });
    if (res.ok) fetchAccounts();
  };

  const deleteAccount = async (id: string) => {
    if (!confirm("確定要刪除此帳號？")) return;
    const res = await fetch(`/api/admin/social-accounts/${id}`, {
      method: "DELETE", credentials: "include",
    });
    if (res.ok) fetchAccounts();
  };

  const getTokenStatus = (expiresAt?: string) => {
    if (!expiresAt) return { label: "永久", color: "text-green-600" };
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff < 0) return { label: "已過期", color: "text-red-600" };
    if (diff < 7 * 86400000) return { label: `${Math.ceil(diff / 86400000)} 天後過期`, color: "text-amber-600" };
    return { label: `${Math.ceil(diff / 86400000)} 天有效`, color: "text-green-600" };
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">載入中...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display">社群帳號管理</h1>
          <p className="text-muted-foreground mt-1">連結 Facebook、Instagram、Threads 帳號</p>
        </div>
        <button onClick={() => fetchAccounts()} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(["facebook", "threads"] as const).map(platform => {
          const info = PLATFORM_INFO[platform];
          const Icon = info.icon;
          const linked = accounts.filter(a => a.platform === platform || (platform === "facebook" && a.platform === "instagram"));
          const isConnecting = connecting === platform;

          return (
            <div key={platform} className={cn("rounded-2xl border p-6", info.bgColor, "border-transparent")}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm")}>
                  <Icon size={22} className={info.color} />
                </div>
                <div>
                  <h3 className="font-bold">{info.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {platform === "facebook" ? "含 Instagram 商業帳號" : "獨立授權"}
                  </p>
                </div>
              </div>

              {linked.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {linked.map(account => {
                    const tokenStatus = getTokenStatus(account.tokenExpiresAt);
                    const pInfo = PLATFORM_INFO[account.platform] || info;
                    return (
                      <div key={account.id} className="bg-white rounded-xl p-3 flex items-center gap-3">
                        {account.profileImageUrl ? (
                          <img src={account.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <pInfo.icon size={14} className={pInfo.color} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{account.accountName}</p>
                          <p className={cn("text-xs", tokenStatus.color)}>{tokenStatus.label}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleAccount(account.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={account.isActive ? "停用" : "啟用"}>
                            {account.isActive ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
                          </button>
                          <button onClick={() => deleteAccount(account.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-red-500" title="刪除">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-4">尚未連結</p>
              )}

              <button
                onClick={() => connectPlatform(platform)}
                disabled={isConnecting}
                className={cn(
                  "w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                  "bg-white shadow-sm hover:shadow-md",
                  isConnecting && "opacity-50 cursor-wait"
                )}
              >
                <ExternalLink size={16} />
                {isConnecting ? "連結中..." : linked.length > 0 ? "重新授權" : "連結帳號"}
              </button>
            </div>
          );
        })}

        <div className="rounded-2xl border border-dashed border-muted-foreground/30 p-6 flex flex-col items-center justify-center text-center">
          <MessageCircle size={32} className="text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">更多平台</p>
          <p className="text-xs text-muted-foreground/60 mt-1">X (Twitter) 等平台即將支援</p>
        </div>
      </div>

      {accounts.length > 0 && (
        <div className="rounded-2xl border bg-white p-6">
          <h3 className="font-bold mb-4">已連結帳號總覽</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="pb-3 font-medium">平台</th>
                  <th className="pb-3 font-medium">帳號名稱</th>
                  <th className="pb-3 font-medium">類型</th>
                  <th className="pb-3 font-medium">狀態</th>
                  <th className="pb-3 font-medium">Token 狀態</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => {
                  const pInfo = PLATFORM_INFO[account.platform];
                  const tokenStatus = getTokenStatus(account.tokenExpiresAt);
                  return (
                    <tr key={account.id} className="border-b last:border-0">
                      <td className="py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", pInfo?.color)}>
                          {pInfo && <pInfo.icon size={14} />}
                          {pInfo?.label || account.platform}
                        </span>
                      </td>
                      <td className="py-3 font-medium">{account.accountName}</td>
                      <td className="py-3 text-muted-foreground">{account.accountType}</td>
                      <td className="py-3">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", account.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500")}>
                          {account.isActive ? "啟用" : "停用"}
                        </span>
                      </td>
                      <td className={cn("py-3 text-xs", tokenStatus.color)}>{tokenStatus.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
