import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { tx, useI18n } from "@/lib/i18n";
import { announce } from "@/lib/a11y";

/** Unique, localized page titles for every route (WCAG 2.4.2). */
const ROUTE_TITLES: Array<[RegExp, string]> = [
  [/^\/$/, "首頁"],
  [/^\/news\/[^/]+$/, "消息內容"],
  [/^\/news$/, "最新消息"],
  [/^\/carnival$/, "嘉年華購票入場"],
  [/^\/tor$/i, "戰鬥陀螺挑戰賽報名"],
  [/^\/contestants$/, "選手介紹"],
  [/^\/sponsors$/, "贊助夥伴"],
  [/^\/ad-guide$/, "廣告素材指南"],
  [/^\/payment\/result$/, "付款結果"],
  [/^\/lookup$/, "查詢我的訂單"],
  [/^\/refund-info\/[^/]+$/, "退款資料填寫"],
  [/^\/accessibility$/, "無障礙說明"],
  [/^\/admin\/login$/, "管理員登入"],
  [/^\/admin$/, "管理後臺：報名監控總覽"],
  [/^\/admin\/orders$/, "管理後臺：訂單管理"],
  [/^\/admin\/invoices$/, "管理後臺：發票管理"],
  [/^\/admin\/tournament$/, "管理後臺：戰鬥陀螺賽"],
  [/^\/admin\/news$/, "管理後臺：最新消息管理"],
  [/^\/admin\/contestants$/, "管理後臺：選手管理"],
  [/^\/admin\/sponsors$/, "管理後臺：贊助廠商管理"],
  [/^\/admin\/social-accounts$/, "管理後臺：社群帳號"],
  [/^\/admin\/social-posts$/, "管理後臺：社群貼文"],
  [/^\/admin\/automation$/, "管理後臺：自動化設定"],
  [/^\/admin\/checkin$/, "管理後臺：現場報到"],
  [/^\/admin\/pos$/, "管理後臺：現場收費開發票"],
  [/^\/admin\/vendors$/, "管理後臺：攤位商家管理"],
  [/^\/admin\/email-templates$/, "管理後臺：Email 模板"],
  [/^\/admin\/promo-codes$/, "管理後臺：優惠碼管理"],
  [/^\/admin\/refund-requests$/, "管理後臺：退票 / 改票"],
  [/^\/admin\/users$/, "管理後臺：帳號管理"],
];

export function pageTitleFor(path: string): string {
  const hit = ROUTE_TITLES.find(([re]) => re.test(path));
  return tx(hit ? hit[1] : "找不到頁面");
}

/**
 * Keeps document.title in sync with the route + language, and on client-side
 * navigation moves focus to the main region and announces the new page so
 * screen-reader and keyboard users know the view changed.
 */
export function RouteA11y() {
  const [location] = useLocation();
  const { lang } = useI18n();
  const firstRun = useRef(true);
  const lastPath = useRef(location);

  useEffect(() => {
    const title = `${pageTitleFor(location)} | ${tx("2026 臺灣氣球嘉年華")}`;
    document.title = title;
  }, [location, lang]);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (lastPath.current === location) return;
    lastPath.current = location;
    // Hash targets (e.g. /carnival#register) manage their own scrolling.
    if (window.location.hash) return;
    const t = window.setTimeout(() => {
      const main = document.getElementById("main-content");
      main?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
      announce(pageTitleFor(location));
    }, 420); // after Layout's AnimatePresence exit (300ms) swaps content
    return () => window.clearTimeout(t);
  }, [location]);

  return null;
}
