import { Link } from "wouter";
import { Accessibility, Mail, Phone } from "lucide-react";
import { tx, useI18n } from "@/lib/i18n";
import { AutoUpdateToggle } from "@/lib/a11y";

/**
 * Accessibility information. Deliberately makes no conformance claim: the site
 * is under ongoing assessment against WCAG 2.2 Level A/AA.
 */
export default function AccessibilityPage() {
  useI18n();
  const done = [
    "提供「跳到主要內容」連結與頁首、導覽、主要內容、頁尾地標。",
    "換頁時更新網頁標題並將焦點移到主要內容，螢幕閱讀器會朗讀新頁面名稱。",
    "表單欄位具備可程式判讀的標籤，錯誤訊息以文字顯示並與欄位關聯。",
    "對話框可用鍵盤操作：焦點會留在對話框內，按 Esc 可關閉，關閉後焦點回到原按鈕。",
    "調整主要色彩以提高文字與介面元件的對比，並提供明顯的鍵盤焦點外框。",
    "尊重系統「減少動態效果」設定；倒數與剩餘名額等自動更新資訊可暫停。",
    "含文字的活動主視覺圖片提供「圖片文字內容（純文字版）」。",
    "寬表格可在表格區域內水平捲動，不會讓整個頁面橫向溢出。",
    "現場報到除掃描 QR Code 外，也可以手動輸入票券編號。",
  ];
  const known = [
    "活動主視覺與購票圖片為含文字的圖片；我們保留原圖並另外提供純文字版本，圖片中的票價文字可能與目前票價不同，請以購票區為準。",
    "部分第三方服務（金流付款頁、LINE 客服、Facebook、地圖等）不在本網站控制範圍內，其無障礙程度由服務提供者負責。",
    "管理後臺部分舊有操作仍使用瀏覽器內建的確認視窗與提示框。",
    "評估仍在進行中，尚未完成所有螢幕閱讀器與行動裝置組合的人工測試。",
  ];
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Accessibility size={24} aria-hidden="true" />
        </span>
        <h1 className="font-display text-3xl md:text-4xl">{tx("無障礙說明")}</h1>
      </div>

      <div className="prose prose-slate max-w-none prose-headings:font-display prose-p:text-foreground prose-li:text-foreground">
        <p>{tx("我們希望每一位家長、孩子與現場工作人員，都能順利瀏覽活動資訊、購票、查詢訂單與完成報到。本網站正以 WCAG 2.2 A 與 AA 等級作為參考，持續進行評估與改善。")}</p>
        <p><strong>{tx("目前狀態：持續評估中。")}</strong> {tx("本網站尚未取得任何無障礙認證，我們也不宣稱已完全符合 WCAG 2.2。")}</p>

        <h2>{tx("我們已經做的改善")}</h2>
        <ul>{done.map((d) => <li key={d}>{tx(d)}</li>)}</ul>

        <h2>{tx("已知限制")}</h2>
        <ul>{known.map((d) => <li key={d}>{tx(d)}</li>)}</ul>

        <h2>{tx("自動更新")}</h2>
        <p>{tx("剩餘名額、倒數計時與投票數會定期自動更新。若會造成干擾，可以在此暫停；設定會保存在這台裝置上。")}</p>
      </div>
      <AutoUpdateToggle className="mt-2 text-foreground" />

      <div className="prose prose-slate max-w-none mt-8 prose-headings:font-display prose-p:text-foreground">
        <h2>{tx("遇到困難嗎？")}</h2>
        <p>{tx("如果您在使用本網站時遇到任何障礙，或需要以其他方式取得資訊或購票協助，請告訴我們您使用的頁面與遇到的問題，我們會盡快回覆。")}</p>
      </div>
      <ul className="mt-4 space-y-3">
        <li className="flex items-center gap-3">
          <Phone size={18} className="text-primary" aria-hidden="true" />
          <a href="tel:+886223680623" className="font-bold underline underline-offset-4 min-h-6 inline-block">{tx("服務專線：02-23680623 分機4")}</a>
        </li>
        <li className="flex items-center gap-3">
          <Mail size={18} className="text-primary" aria-hidden="true" />
          <a href="mailto:service@cms-edu.com" className="font-bold underline underline-offset-4 min-h-6 inline-block">service@cms-edu.com</a>
        </li>
      </ul>
      <p className="mt-10 text-sm text-muted-foreground">
        {tx("本說明最後更新：2026 年")} · <Link href="/" className="underline underline-offset-4">{tx("回到首頁")}</Link>
      </p>
    </div>
  );
}
