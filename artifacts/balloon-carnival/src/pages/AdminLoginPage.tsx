import { tx, useI18n, txApi } from "@/lib/i18n";
import { useState } from "react";
import { useLocation, Redirect } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { Shield, Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (isAuthenticated) return <Redirect to="/admin" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const result = await login(username, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate("/admin");
    } else {
      setError(txApi(result.error) || tx("登入失敗"));
      window.setTimeout(() => document.getElementById("f-adminloginpage-1")?.focus(), 0);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="font-display text-3xl mb-2">{tx("管理員登入")}</h1>
          <p className="text-muted-foreground">{tx("請輸入管理員帳號密碼以存取後台")}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate={false} className="bg-white rounded-3xl border shadow-sm p-8 space-y-6">
          {error && (
            <div id="login-error" role="alert" className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border border-red-100" data-testid="text-login-error">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="f-adminloginpage-1" className="block text-sm font-semibold text-foreground mb-2">{tx("帳號")}</label>
            <input id="f-adminloginpage-1"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              placeholder={tx("請輸入帳號")}
              autoComplete="username"
              name="username"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              data-testid="input-username"
              required
            />
          </div>

          <div>
            <label htmlFor="f-adminloginpage-2" className="block text-sm font-semibold text-foreground mb-2">{tx("密碼")}</label>
            <div className="relative">
              <input id="f-adminloginpage-2"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-12"
                placeholder={tx("請輸入密碼")}
                autoComplete="current-password"
                name="password"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                data-testid="input-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? tx("隱藏密碼") : tx("顯示密碼")}
                aria-controls="f-adminloginpage-2"
                data-testid="button-toggle-password"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground w-10 h-10 flex items-center justify-center rounded-lg"
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            data-testid="button-login"
            className="w-full py-3.5 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
          >
            {isSubmitting ? tx("登入中...") : tx("登入")}
          </button>
        </form>
      </div>
    </div>
  );
}
