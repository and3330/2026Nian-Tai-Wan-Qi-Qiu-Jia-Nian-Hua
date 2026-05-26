import { ReactNode, useState, useEffect, useRef } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth, type AdminRole } from "@workspace/replit-auth-web";
import { LayoutDashboard, Newspaper, Users, Handshake, ArrowLeft, Share2, FileText, Settings, ScanLine, Mail, ShieldCheck, LogOut, Tag, Undo2, Menu, X } from "lucide-react";
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
  { href: "/admin/contestants", label: "選手管理", icon: Users, roles: ["editor"] },
  { href: "/admin/sponsors", label: "贊助廠商管理", icon: Handshake, roles: ["editor"] },
  { href: "/admin/social-accounts", label: "社群帳號", icon: Share2, roles: ["editor"] },
  { href: "/admin/social-posts", label: "社群貼文", icon: FileText, roles: ["editor"] },
  { href: "/admin/automation", label: "自動化設定", icon: Settings, roles: ["editor"] },
  { href: "/admin/promo-codes", label: "優惠碼管理", icon: Tag, roles: ["editor"] },
  { href: "/admin/refund-requests", label: "退票 / 改票", icon: Undo2, roles: ["editor", "viewer", "checkin"] },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-close drawer on navigation
  useEffect(() => { setDrawerOpen(false); }, [location]);

  // Lock body scroll + Escape to close + focus management when drawer is open
  useEffect(() => {
    if (!drawerOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    drawerCloseBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      (prevFocus ?? menuBtnRef.current)?.focus?.();
    };
  }, [drawerOpen]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  if (!isAuthenticated) return <Redirect to="/admin/login" />;

  const navs = ALL_NAVS.filter((n) => hasRole(...n.roles));
  const currentNav = ALL_NAVS.find(n => n.exact ? location === n.href : location.startsWith(n.href));

  const sidebarContent = (
    <>
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

      <nav className="space-y-1.5">
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

      <div className="mt-8 pt-6 border-t space-y-2">
        <button
          type="button"
          onClick={() => logout()}
          data-testid="button-logout"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium px-2"
        >
          <LogOut size={16} /> 登出
        </button>
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium px-2">
          <ArrowLeft size={16} /> 返回前台網站
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)] bg-muted/20">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-white border-b px-4 py-3">
        <button
          ref={menuBtnRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="開啟選單"
          aria-expanded={drawerOpen}
          aria-controls="admin-mobile-drawer"
          data-testid="button-mobile-menu"
          className="p-2 -ml-2 rounded-lg hover:bg-muted active:bg-muted/70"
        >
          <Menu size={22} />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="font-bold text-sm truncate">{currentNav?.label ?? "管理後臺"}</div>
          {role && <div className="text-[10px] text-muted-foreground">{ROLE_LABELS[role]} ・ {user?.displayName || user?.username}</div>}
        </div>
        <button
          type="button"
          onClick={() => logout()}
          aria-label="登出"
          data-testid="button-mobile-logout"
          className="p-2 -mr-2 rounded-lg hover:bg-muted active:bg-muted/70 text-muted-foreground"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Mobile drawer + backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        id="admin-mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="管理後臺選單"
        aria-hidden={!drawerOpen}
        {...(!drawerOpen && { inert: "" as unknown as boolean })}
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white p-5 overflow-y-auto shadow-2xl transition-transform duration-200",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          ref={drawerCloseBtnRef}
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="關閉選單"
          className="absolute top-3 right-3 p-2 rounded-lg hover:bg-muted"
        >
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 border-r bg-white p-6 shrink-0">
        {sidebarContent}
      </aside>

      <main className="flex-1 p-4 md:p-10 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
