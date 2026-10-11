import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EN } from "@/lib/i18n-en";
import { EN_A11Y } from "@/lib/i18n-en-a11y";
import { EN_CONTENT } from "@/lib/i18n-content";
import { translateApiMessage } from "@/lib/i18n-api";

export type Lang = "zh-TW" | "en";
const STORAGE_KEY = "tbc-lang";

function readInitialLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "zh-TW") return v;
  } catch {
    /* ignore */
  }
  return "zh-TW";
}

// Module-level mirror of the active language so that plain helper functions
// (tx) can be called anywhere during render. The provider owns the source of
// truth and re-renders the whole tree when it changes.
let currentLang: Lang = readInitialLang();

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
let normalizedContent: Map<string, string> | null = null;

function lookup(zh: string): string | undefined {
  const hit = EN[zh] ?? EN_A11Y[zh] ?? EN_CONTENT[zh];
  if (hit !== undefined) return hit;
  return undefined;
}

function fill(s: string, args?: ReadonlyArray<unknown>): string {
  if (!args) return s;
  return s.replace(/\{(\d+)\}/g, (m, i) => {
    const v = args[Number(i)];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Translate a static Traditional Chinese source string into the active language. */
export function tx(zh: string, args?: ReadonlyArray<unknown>): string {
  if (currentLang === "en") {
    const en = lookup(zh);
    if (en !== undefined) return fill(en, args);
  }
  return fill(zh, args);
}

/**
 * Translate server-provided editorial content (news, contestants) by exact
 * source text. Edited/unknown text is returned unchanged, so stale mappings
 * can never show the wrong content.
 */
export function txContent(zh: string | null | undefined): string {
  if (zh == null) return "";
  if (currentLang !== "en") return zh;
  const exact = EN_CONTENT[zh];
  if (exact !== undefined) return exact;
  if (!normalizedContent) {
    normalizedContent = new Map(Object.entries(EN_CONTENT).map(([k, v]) => [normalize(k), v]));
  }
  return normalizedContent.get(normalize(zh)) ?? zh;
}

/** Translate a server-provided error/success message for display only. */
export function txApi(msg: string): string;
export function txApi(msg: string | null | undefined): string | undefined;
export function txApi(msg: string | null | undefined): string | undefined {
  if (msg == null || typeof msg !== "string") return msg ?? undefined;
  if (currentLang !== "en") return msg;
  return translateApiMessage(msg);
}

export function getLang(): Lang {
  return currentLang;
}

/** Locale string for Intl/date formatting. */
export function getLocale(): string {
  return currentLang === "en" ? "en-US" : "zh-TW";
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: typeof tx;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: (lang: Lang) => ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);
  currentLang = lang;

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    currentLang = l;
    setLangState(l);
  }, []);
  const toggle = useCallback(() => setLang(currentLang === "en" ? "zh-TW" : "en"), [setLang]);

  const value = useMemo<I18nValue>(() => ({ lang, setLang, toggle, t: tx }), [lang, setLang, toggle]);
  return <I18nContext.Provider value={value}>{children(lang)}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
