import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";

const STORAGE_KEY = "line-bubble-dismissed";
export const LINE_URL = "https://lin.ee/OUbPwpi";

export function LineChatBubble() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const dismissed = typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "1";
    if (dismissed) return undefined;
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setVisible(false);
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-4 z-40 flex flex-col items-start gap-2"
      style={{ bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 5.5rem))" }}
      data-testid="line-chat-bubble"
    >
      {expanded && (
        <div className="relative bg-white rounded-2xl shadow-2xl shadow-black/20 border border-border px-4 py-3 pr-9 max-w-[240px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            type="button"
            onClick={close}
            aria-label="關閉客服提示"
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            data-testid="line-bubble-close"
          >
            <X size={14} />
          </button>
          <div className="text-sm font-bold text-foreground leading-tight mb-0.5">需要協助嗎？</div>
          <div className="text-xs text-muted-foreground leading-snug">點擊下方按鈕，加入 LINE 客服</div>
          <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-white border-r border-b border-border rotate-45" />
        </div>
      )}

      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setExpanded(false)}
        aria-label="LINE 客服"
        className="group relative w-14 h-14 rounded-full bg-[#06C755] shadow-lg shadow-[#06C755]/40 hover:shadow-xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
        data-testid="line-bubble-link"
      >
        <MessageCircle className="w-7 h-7 text-white" fill="white" stroke="#06C755" strokeWidth={2.2} />
        <span className="absolute -top-1 -right-1 bg-white text-[#06C755] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow border border-[#06C755]/20">
          LINE
        </span>
      </a>
    </div>
  );
}
