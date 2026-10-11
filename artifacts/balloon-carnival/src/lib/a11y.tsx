import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Pause, Play } from "lucide-react";
import { tx } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Auto-update preference (WCAG 2.2.2 Pause, Stop, Hide)               */
/* Non-essential, periodically refreshed information (countdowns,     */
/* remaining-seat counters, vote counts, staff stats) honours this.   */
/* ------------------------------------------------------------------ */
const AU_KEY = "tbc-auto-updates-paused";
const auListeners = new Set<() => void>();
let auPaused = (() => {
  try { return localStorage.getItem(AU_KEY) === "1"; } catch { return false; }
})();

export function setAutoUpdatesPaused(v: boolean) {
  auPaused = v;
  try { localStorage.setItem(AU_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  auListeners.forEach((l) => l());
}

export function useAutoUpdatesPaused(): boolean {
  return useSyncExternalStore(
    (cb) => { auListeners.add(cb); return () => { auListeners.delete(cb); }; },
    () => auPaused,
    () => false,
  );
}

/** Polling interval helper: returns false while the user has paused auto updates. */
export function usePollInterval(ms: number): number | false {
  return useAutoUpdatesPaused() ? false : ms;
}

export function AutoUpdateToggle({ className }: { className?: string }) {
  const paused = useAutoUpdatesPaused();
  return (
    <button
      type="button"
      onClick={() => setAutoUpdatesPaused(!paused)}
      aria-pressed={paused}
      className={cn(
        "inline-flex items-center gap-1.5 min-h-6 px-2.5 py-1 rounded-full border border-current/30 text-xs font-bold hover:bg-black/5",
        className,
      )}
      data-testid="button-toggle-auto-updates"
    >
      {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
      {paused ? tx("恢復自動更新") : tx("暫停自動更新")}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Reduced motion                                                      */
/* ------------------------------------------------------------------ */
const RM_QUERY = "(prefers-reduced-motion: reduce)";
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia(RM_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => (typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(RM_QUERY).matches),
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Polite live-region announcer (status messages, route changes)       */
/* ------------------------------------------------------------------ */
export function announce(message: string, politeness: "polite" | "assertive" = "polite") {
  if (typeof document === "undefined") return;
  const el = document.getElementById(politeness === "assertive" ? "a11y-announcer-assertive" : "a11y-announcer");
  if (!el) return;
  el.textContent = "";
  window.setTimeout(() => { el.textContent = message; }, 60);
}

export function LiveAnnouncer() {
  return (
    <>
      <div id="a11y-announcer" className="sr-only" role="status" aria-live="polite" aria-atomic="true" />
      <div id="a11y-announcer-assertive" className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Accessible modal shell built on Radix Dialog                        */
/* Provides role=dialog, aria-modal, accessible name, focus trap,      */
/* Escape to close, focus restore, and hides the background from AT.   */
/* The content node itself is the full-screen backdrop so existing     */
/* layouts are preserved; clicking the bare backdrop closes it.        */
/* ------------------------------------------------------------------ */
interface ModalShellProps {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
  /** When false, Escape/backdrop do nothing (e.g. while a request is in flight). */
  dismissible?: boolean;
  description?: string;
  "data-testid"?: string;
}

export function ModalShell({ label, onClose, className, children, dismissible = true, description, ...rest }: ModalShellProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const descId = useId();
  // No Dialog.Trigger is used (always-open controlled modal), so capture the
  // element that had focus before the dialog rendered and restore it on close.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  if (returnFocusRef.current === null && typeof document !== "undefined") {
    returnFocusRef.current = (document.activeElement as HTMLElement | null) ?? document.body;
  }
  useEffect(() => {
    const target = returnFocusRef.current;
    return () => {
      // Runs on unmount (parent stops rendering the modal). Defer so Radix
      // finishes tearing down its focus scope first.
      window.setTimeout(() => {
        if (target && target !== document.body && target.isConnected) {
          target.focus({ preventScroll: true });
        } else {
          document.getElementById("main-content")?.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, []);
  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o && dismissible) onCloseRef.current(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-modal="true"
          aria-describedby={description ? descId : undefined}
          className={cn("overflow-y-auto", className)}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && dismissible) onCloseRef.current();
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => { if (!dismissible) e.preventDefault(); }}
          data-testid={rest["data-testid"]}
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {description && <DialogPrimitive.Description id={descId} className="sr-only">{description}</DialogPrimitive.Description>}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Focus the first invalid field of a form after failed validation.    */
/* ------------------------------------------------------------------ */
export function focusFirstInvalid(root: HTMLElement | null | undefined) {
  if (!root) return;
  const el = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  el?.focus();
}

/** Run `fn` once when `dep` becomes truthy. */
export function useOnTruthy(dep: unknown, fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => { if (dep) fnRef.current(); }, [dep]);
}
