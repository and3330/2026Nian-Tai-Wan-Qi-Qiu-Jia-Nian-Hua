import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2, ArrowRight, Home, Search, MessageCircle } from "lucide-react";
import { LINE_URL } from "@/components/LineChatBubble";

export default function SuccessPage() {
  const search = useSearch();
  const ref = useMemo(() => new URLSearchParams(search).get("ref") || "", [search]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
      <div
        className="max-w-md w-full bg-white border-2 rounded-3xl shadow-xl p-8 md:p-10 text-center"
        data-testid="success-page"
      >
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-emerald-700 mb-3">付款成功！</h1>
        <p className="text-muted-foreground leading-relaxed">
          感謝您購買 2026 臺灣氣球嘉年華門票。
        </p>
        <p className="text-muted-foreground leading-relaxed mb-2">
          我們已將「報名成功確認信」（內含入場 QR Code）寄送至您填寫的 Email，
          請一併查看「收件匣」與「垃圾郵件」資料夾。
        </p>

        {ref && (
          <div className="mt-5 rounded-2xl bg-muted/40 px-4 py-3 text-sm">
            <span className="text-muted-foreground">訂單編號　</span>
            <span className="font-mono font-bold">{ref}</span>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/lookup"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 transition-opacity"
          >
            <Search size={18} /> 查詢我的訂單
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border-2 border-border font-bold hover:bg-muted transition-colors"
          >
            <Home size={18} /> 返回首頁 <ArrowRight size={18} />
          </Link>
        </div>

        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <MessageCircle size={16} /> 有疑問？聯絡 LINE 客服
        </a>
      </div>
    </div>
  );
}
