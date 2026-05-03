import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

export type AdminRole = "owner" | "editor" | "checkin" | "viewer";

export interface AdminUser {
  id: string;
  username: string;
  role?: AdminRole;
  displayName?: string | null;
}

interface AuthState {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: AdminRole | null;
  hasRole: (...roles: AdminRole[]) => boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/user", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AdminUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "登入失敗" };
      }
      setUser(data.user);
      return { success: true };
    } catch {
      return { success: false, error: "網路連線失敗" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setUser(null);
  }, []);

  const role = (user?.role ?? null) as AdminRole | null;
  const hasRole = useCallback(
    (...roles: AdminRole[]) => {
      if (!role) return false;
      if (role === "owner") return true;
      return roles.includes(role);
    },
    [role],
  );

  const value: AuthState = {
    user,
    isLoading,
    isAuthenticated: !!user,
    role,
    hasRole,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
