import { ReactNode } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { LayoutDashboard, Newspaper, Users, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">載入中...</div>;

  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
  }

  const navs = [
    { href: "/admin", label: "報名監控總覽", icon: LayoutDashboard, exact: true },
    { href: "/admin/news", label: "最新消息管理", icon: Newspaper, exact: false },
    { href: "/admin/contestants", label: "參賽者管理", icon: Users, exact: false },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)] bg-muted/20">
      <aside className="w-full md:w-64 border-r bg-white p-6 shrink-0">
        <div className="mb-8">
          <h2 className="font-display text-xl">管理後臺</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Admin Dashboard</p>
        </div>
        
        <nav className="space-y-2">
          {navs.map(nav => {
            const isActive = nav.exact ? location === nav.href : location.startsWith(nav.href);
            return (
              <Link 
                key={nav.href} 
                href={nav.href}
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
        
        <div className="mt-12 pt-6 border-t">
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
