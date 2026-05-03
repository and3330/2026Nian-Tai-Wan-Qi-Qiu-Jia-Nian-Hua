import { ReactNode } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth, type AdminRole } from "@workspace/replit-auth-web";
import { LayoutDashboard, Newspaper, Users, Handshake, ArrowLeft, Share2, FileText, Settings, ScanLine, Mail, ShieldCheck, LogOut, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  roles: AdminRole[]; // owner is always allowed (handled by hasRole)
};

const ALL_NAVS: NavItem[] = [
  { href: "/admin", label: "報名監控總覽", icon: LayoutDashboard, exact: true, roles: ["viewer", "editor", "checkin"] },
  { href: "/admin/checkin", label: "現場報到", icon: ScanLine, roles: ["checkin"] },
  { href: "/admin/email-templates", label: "Email 模板", icon: Mail, roles: ["editor"] },
  { href: "/admin/news", label: "最新消息管理", icon: Newspaper, roles: ["editor"] },
  { href: "/admin/contestants", label: "研討會管理", icon: Users, roles: ["editor"] },
  { href: "/admin/sponsors", label: "贊助廠商管理", icon: Handshake, roles: ["editor"] },
  { href: "/admin/social-accounts", label: "社群帳號", icon: Share2, roles: ["editor"] },
  { href: "/admin/social-posts", label: "社群貼文", icon: FileText, roles: ["editor"] },
  { href: "/admin/automation", label: "自動化設定", icon: Settings, roles: ["editor"] },
  { href: "/admin/promo-codes", label: "優惠碼管理", icon: Tag, roles: ["editor"] },
  { href: "/admin/users", label: "帳號管理", icon: ShieldCheck, roles: [] }, // owner-only
];

const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "擁有者",
  editor: "編輯",
  checkin: "現場報到",
  viewer: "檢視",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated, isLoading, user, role, hasRole, logout } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  if (!isAuthenticated) return <Redirect to="/admin/login" />;

  const navs = ALL_NAVS.filter((n) => hasRole(...n.roles));

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)] bg-muted/20">
      <aside className="w-full md:w-64 border-r bg-white p-6 shrink-0">
        <div className="mb-6">
          <h2 className="font-display text-xl">管理後臺</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Admin Dashboard</p>
        </div>

        {user && (
          <div className="mb-6 p-3 rounded-lg bg-muted/40 text-sm" data-testid="admin-user-info">
            <div className="font-medium truncate">{user.displayName || user.username}</div>
            <div className="text-xs text-muted-foreground mt-1">
              角色：<span className="font-medium text-foreground">{role ? ROLE_LABELS[role] : "—"}</span>
            </div>
          </div>
        )}

        <nav className="space-y-2">
          {navs.map(nav => {
            const isActive = nav.exact ? location === nav.href : location.startsWith(nav.href);
            return (
              <Link
                key={nav.href}
                href={nav.href}
                data-testid={`nav-${nav.href.replace(/\//g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <nav.icon size={20} />
                {nav.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-12 pt-6 border-t space-y-2">
          <button
            type="button"
            onClick={() => logout()}
            data-testid="button-logout"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium"
          >
            <LogOut size={16} /> 登出
          </button>
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium">
            <ArrowLeft size={16} /> 返回前台網站
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
