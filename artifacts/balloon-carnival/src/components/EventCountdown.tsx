import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const TARGET = new Date("2026-07-23T10:00:00+08:00").getTime();

interface Parts { d: number; h: number; m: number; s: number; over: boolean }

function compute(): Parts {
  const diff = TARGET - Date.now();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, over: true };
  const s = Math.floor(diff / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60, over: false };
}

export function EventCountdown({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [t, setT] = useState<Parts>(() => compute());
  useEffect(() => {
    const id = setInterval(() => setT(compute()), 1000);
    return () => clearInterval(id);
  }, []);

  if (t.over) {
    return (
      <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-700 font-bold text-sm", className)}>
        <Timer size={16} /> 活動進行中
      </div>
    );
  }

  const cells = [
    { v: t.d, label: "天" },
    { v: t.h, label: "時" },
    { v: t.m, label: "分" },
    { v: t.s, label: "秒" },
  ];

  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 text-sm font-bold tracking-wide", className)} data-testid="countdown-compact">
        <Timer size={14} className="opacity-70" />
        <span>距離開幕 {t.d}天 {String(t.h).padStart(2, "0")}:{String(t.m).padStart(2, "0")}:{String(t.s).padStart(2, "0")}</span>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)} data-testid="countdown">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-foreground/60">
        <Timer size={12} /> 距離開幕還有
      </div>
      <div className="flex items-stretch gap-2">
        {cells.map((c, i) => (
          <div key={c.label} className="flex flex-col items-center gap-1">
            <div
              key={`${c.label}-${c.v}`}
              className="min-w-[3.5rem] md:min-w-[4.5rem] px-2 py-3 rounded-xl bg-white/95 shadow-md border border-primary/10 font-display text-3xl md:text-4xl text-primary tabular-nums leading-none animate-[countdown-pop_300ms_ease-out]"
            >
              {String(c.v).padStart(i === 0 ? 1 : 2, "0")}
            </div>
            <div className="text-[10px] md:text-xs font-bold text-foreground/60">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnimatedNumber({ value, duration = 600, className }: { value: number; duration?: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const start = display;
    const delta = value - start;
    if (delta === 0) return;
    setFlash(true);
    const flashTimer = setTimeout(() => setFlash(false), 700);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + delta * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); clearTimeout(flashTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span
      className={cn("tabular-nums inline-block transition-colors", flash && "text-amber-300", className)}
      data-testid="animated-number"
    >
      {display.toLocaleString()}
    </span>
  );
}
