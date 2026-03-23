import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Shield, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (isAuthenticated) {
    navigate("/admin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(username, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate("/admin");
    } else {
      setError(result.error || "登入失敗");
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="font-display text-3xl mb-2">管理員登入</h1>
          <p className="text-muted-foreground">請輸入管理員帳號密碼以存取後台</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border shadow-sm p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">帳號</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              placeholder="請輸入帳號"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">密碼</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-12"
                placeholder="請輸入密碼"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !username || !password}
            className="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
          >
            {isSubmitting ? "登入中..." : "登入"}
          </button>
        </form>
      </div>
    </div>
  );
}
