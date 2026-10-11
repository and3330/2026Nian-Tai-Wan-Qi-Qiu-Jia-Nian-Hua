import { Link } from "wouter";
import { Compass } from "lucide-react";
import { tx, useI18n } from "@/lib/i18n";

export default function NotFound() {
  useI18n();
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-3xl border shadow-sm p-8 text-center">
        <Compass className="h-10 w-10 text-primary mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-foreground mb-3">{tx("找不到頁面")}</h1>
        <p className="text-sm text-muted-foreground mb-6">{tx("這個網址不存在或已經移動。請回到首頁，或從上方選單繼續瀏覽。")}</p>
        <Link href="/" className="inline-flex items-center justify-center min-h-11 px-6 rounded-full font-bold text-white bg-gradient-to-r from-primary to-secondary" data-testid="link-home-404">
          {tx("回到首頁")}
        </Link>
      </div>
    </div>
  );
}
