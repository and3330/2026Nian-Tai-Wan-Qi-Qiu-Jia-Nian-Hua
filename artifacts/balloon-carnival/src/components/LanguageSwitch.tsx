import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitchProps {
  className?: string;
  compact?: boolean;
  testId?: string;
}

/** Accessible two-option language switch (繁體中文 / English). */
export function LanguageSwitch({ className, compact, testId = "switch-language" }: LanguageSwitchProps) {
  const { lang, setLang } = useI18n();
  const options = [
    { value: "zh-TW" as const, short: "中", label: "繁體中文" },
    { value: "en" as const, short: "EN", label: "English" },
  ];
  return (
    <div
      role="group"
      aria-label={lang === "en" ? "Language" : "語言"}
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-border bg-white/70 p-0.5 text-xs font-bold", className)}
      data-testid={testId}
    >
      {!compact && <Languages size={14} className="mx-1.5 text-muted-foreground" aria-hidden="true" />}
      {options.map((o) => {
        const active = lang === o.value;
        return (
          <button
            key={o.value}
            type="button"
            lang={o.value}
            aria-pressed={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => setLang(o.value)}
            data-testid={`${testId}-${o.value}`}
            className={cn(
              "min-w-[2.25rem] rounded-full px-2.5 py-1.5 transition-colors",
              active ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-black/5"
            )}
          >
            {o.short}
          </button>
        );
      })}
    </div>
  );
}
