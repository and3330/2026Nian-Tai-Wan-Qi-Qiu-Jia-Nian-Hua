import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

const EN_META = {
  title: "2026 Taiwan Balloon Carnival ・ Jul 25–26 Online Tickets",
  description:
    "2026 Taiwan Balloon Carnival, a two-day festival on July 25–26 with AI interactive balloons, hands-on balloon artistry and family workshops. Save NT$100 with the two-day pass; limited to 500 visitors per day. Book online and get your entry QR code.",
  og: "Two-day festival with AI interactive balloons and family workshops. Save NT$100 with the two-day pass, limited to 500 per day. Buy tickets online now.",
};

const selectors = {
  description: 'meta[name="description"]',
  og: 'meta[property="og:description"]',
  twitter: 'meta[name="twitter:description"]',
  ogTitle: 'meta[property="og:title"]',
  twitterTitle: 'meta[name="twitter:title"]',
} as const;

let originals: Record<string, string> | null = null;

/** Keeps <title> and description meta tags in sync with the active language. */
export function DocumentMeta() {
  const { lang } = useI18n();
  useEffect(() => {
    if (!originals) {
      originals = { title: document.title };
      for (const [k, sel] of Object.entries(selectors)) {
        originals[k] = document.querySelector(sel)?.getAttribute("content") ?? "";
      }
    }
    const en = lang === "en";
    const set = (k: keyof typeof selectors, v: string) => {
      const el = document.querySelector(selectors[k]);
      if (el && v) el.setAttribute("content", v);
    };
    // document.title is owned per-route by RouteA11y.
    set("description", en ? EN_META.description : originals.description);
    set("og", en ? EN_META.og : originals.og);
    set("twitter", en ? EN_META.og : originals.twitter);
    set("ogTitle", en ? EN_META.title : originals.ogTitle);
    set("twitterTitle", en ? EN_META.title : originals.twitterTitle);
  }, [lang]);
  return null;
}
