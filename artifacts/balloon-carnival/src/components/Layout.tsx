import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Tent, MapPin, Info, Users, Crown, LogOut, LayoutDashboard, Menu, X, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isAuthenticated, logout, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navItems = [
    { href: "/", label: "首頁 / 展區", icon: Tent },
    { href: "/registration", label: "報名訂票", icon: Ticket },
    { href: "/news", label: "最新消息", icon: Info },
    { href: "/contestants", label: "參賽者展示", icon: Users },
    { href: "/sponsors", label: "贊助廠商", icon: Crown },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="h-2 w-full carnival-gradient absolute top-0 left-0 z-50"></div>

      <header className="sticky top-0 z-40 w-full glass-card border-b border-white/50 px-4 sm:px-6 lg:px-8 mt-2">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform rotate-3">
              <Tent size={24} />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl text-foreground group-hover:text-primary transition-colors">
                2026 臺灣氣球嘉年華
              </h1>
              <p className="text-xs text-muted-foreground font-medium tracking-wider uppercase hidden sm:block">
                Taiwan Balloon Carnival
              </p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 transition-all",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                  )}
                >
                  <item.icon size={16} className={cn(isActive && "fill-primary/20")} />
                  {item.label}
                </Link>
              );
            })}

            {isAuthenticated && (
              <>
                <div className="w-px h-8 bg-border mx-2"></div>
                <Link
                  href="/admin"
                  className={cn(
                    "px-4 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 transition-all",
                    location.startsWith("/admin")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-black/5 hover:text-foreground"
                  )}
                >
                  <LayoutDashboard size={16} />
                  管理後臺
                </Link>
                <button
                  onClick={() => logout()}
                  className="p-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors ml-1"
                  title="登出"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}

            {!isLoading && !isAuthenticated && (
              <>
                <div className="w-px h-8 bg-border mx-2"></div>
                <Link
                  href="/admin/login"
                  className="ml-1 px-4 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-black/5 rounded-full transition-all flex items-center gap-1.5 font-medium"
                >
                  <Shield size={14} />
                  管理員登入
                </Link>
              </>
            )}
          </nav>

          <button 
            className="lg:hidden p-2 text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden glass-card border-b z-30"
          >
            <div className="px-4 py-6 flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "p-4 rounded-xl font-medium flex items-center gap-3 text-lg",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-black/5"
                    )}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
              
              {isAuthenticated && (
                <Link
                  href="/admin"
                  className={cn(
                    "p-4 rounded-xl font-medium flex items-center gap-3 text-lg",
                    location.startsWith("/admin") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-black/5"
                  )}
                >
                  <LayoutDashboard size={20} />
                  管理後臺
                </Link>
              )}
              
              <div className="h-px bg-border my-2"></div>
              
              {!isLoading && (
                isAuthenticated ? (
                  <button
                    onClick={() => logout()}
                    className="p-4 rounded-xl font-medium flex items-center justify-center gap-3 text-lg text-destructive bg-destructive/5"
                  >
                    <LogOut size={20} />
                    管理員登出
                  </button>
                ) : (
                  <Link
                    href="/admin/login"
                    className="p-4 rounded-xl font-medium flex items-center justify-center gap-3 text-sm text-muted-foreground hover:bg-black/5"
                  >
                    <Shield size={16} />
                    管理員登入
                  </Link>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-foreground text-white/70 py-12 mt-20 relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none" 
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/carnival-pattern.png)`, backgroundSize: '200px' }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          <div>
            <h2 className="font-display text-2xl text-white mb-4">2026 臺灣氣球嘉年華</h2>
            <p className="mb-2 flex items-center gap-2"><Ticket size={16} className="text-primary" /> 2026 年 7 月 23 日 - 7 月 26 日</p>
            <p className="flex items-center gap-2"><MapPin size={16} className="text-secondary" /> 臺北瓶蓋工廠 (台北市南港區)</p>
          </div>
          <div>
            <h3 className="font-bold text-white mb-4">快速連結</h3>
            <ul className="space-y-2">
              <li><Link href="/registration" className="hover:text-primary transition-colors">報名與訂票</Link></li>
              <li><Link href="/news" className="hover:text-primary transition-colors">大會公告</Link></li>
              <li><Link href="/contestants" className="hover:text-primary transition-colors">氣球造型比賽</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-white mb-4">聯絡我們</h3>
            <p className="mb-2">服務專線：02-2720-8889</p>
            <p>Email：contact@balloon-carnival.tw</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-white/10 text-sm text-center">
          &copy; 2026 臺灣氣球嘉年華 Taiwan Balloon Carnival. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
