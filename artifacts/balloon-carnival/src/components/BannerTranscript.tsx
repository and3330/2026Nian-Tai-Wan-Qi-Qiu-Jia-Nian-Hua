import { tx } from "@/lib/i18n";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Text equivalents for the banner images, which contain text baked into the
 * artwork (WCAG 1.1.1 / 1.4.5). The images themselves are kept unchanged by
 * request; this disclosure exposes the same information as real text that can
 * be read, translated, resized and spoken.
 */
type Row = string | [string, string];
interface Block { heading?: string; rows: Row[] }

const NOTE = "圖片中的票價為設計稿文字；現行票價、場次與名額以本頁購票區及大會公告為準。";

const HERO = (): Block[] => [
  { heading: tx("2026 臺灣氣球嘉年華"), rows: [tx("夢想升空・氣球無限"), tx("氣球狂歡・精彩一整天！"), tx("地點：南港瓶蓋工廠"), tx("入場票價 NT$300"), tx("3M³ 氣球展覽，夢幻打卡必拍！")] },
  { heading: tx("7/25（六）"), rows: [["11:00", tx("12 分鐘氣球快手表演")], ["13:00", tx("嘉年華親子表演（魔術氣球派對）")], ["15:00", tx("藝術服裝遊行")], ["16:00", tx("嘉年華親子表與氣球比賽頒獎")], ["18:00", tx("波波繪本親子劇場（另需報名）")]] },
  { heading: tx("7/26（日）戰鬥陀螺百人大賽"), rows: [["10:00", tx("入場")], ["11:00 – 11:30", tx("毛毛哥哥互動表演")], ["13:00", tx("戰鬥陀螺比賽")], ["16:00", tx("海洋家族唱跳秀")]] },
  { heading: tx("活動亮點"), rows: [tx("氣球展覽：繽紛氣球、夢幻打卡"), tx("手作體驗：手工藝 DIY、樂趣滿滿"), tx("科技遊戲：互動遊戲、趣味挑戰"), tx("拍照打卡：特色場景、美照拍不停"), tx("親子同樂：全家大小共享歡樂時光"), tx("精彩表演：魔術氣球派對、親子劇場")] },
];

const TICKETS = (): Block[] => [
  { heading: tx("2026 臺灣氣球嘉年華"), rows: [tx("氣球狂歡・精彩一整天！"), tx("豐富活動 × 精彩表演 × 歡樂體驗"), tx("入場 NT$200")] },
  { heading: tx("7/25（六）"), rows: [["11:00", tx("12 分鐘氣球快手表演")], ["13:00", tx("嘉年華親子表演（魔術氣球派對）")], ["15:00", tx("藝術服裝遊行")], ["16:00", tx("嘉年華親子表與氣球比賽頒獎")], ["18:00", tx("波波繪本親子劇場（另需報名）")]] },
  { heading: tx("7/26（日）"), rows: [["11:00", tx("嘉年華親子表演（魔術氣球派對）")], ["13:00", tx("兒童組戰鬥陀螺比賽（32 人）")], ["15:00", tx("成人組戰鬥陀螺比賽（64 人）")]] },
  { rows: [tx("還有精彩手作體驗區、科技遊戲攤位可以隨到隨時參與！"), tx("手作體驗區、科技遊戲攤位、新奇遊戲攤位、創意手作區")] },
];

const CARNIVAL = (): Block[] => [
  ...TICKETS().slice(0, 2),
  { heading: tx("7/26（日）"), rows: [["11:00", tx("嘉年華親子表演（魔術氣球派對）")], ["11:00 – 12:30", tx("選手報到")], ["12:30 – 13:00", tx("候補登記")], ["13:00 – 16:00", tx("分區競賽")], ["16:00 – 17:00", tx("四強賽")], ["17:00", tx("頒獎")]] },
  { rows: [tx("還有精彩手作體驗區、科技遊戲攤位可以隨到隨時參與！"), tx("精彩表演・親子同樂・拍照打卡・美食市集・氣球體驗")] },
];

const HIGHLIGHTS = (): Block[] => [
  { heading: tx("氣球歡樂盛典：四大精彩主題活動"), rows: [tx("一起進入繽紛氣球的奇幻世界！")] },
  { rows: [
    tx("01 氣球快手表演：國際級氣球達人現場快手技藝秀，驚呼連連、目不轉睛！"),
    tx("02 親子劇場（魔術、氣球互動 SHOW）：結合魔術與氣球互動的親子舞台，歡笑不間斷，創造美好回憶！"),
    tx("03 氣球服裝遊行：創意氣球服裝大遊行，一起走進夢幻國度！"),
    tx("04 聯名戰鬥陀螺比賽：熱血對戰 × 限定聯名，爭奪最強陀螺王！"),
    tx("精彩表演・親子同樂・拍照打卡・美食市集・氣球體驗"),
  ] },
];

const TOR = (): Block[] => [
  { heading: tx("第四屆重擊盃 X 台灣氣球嘉年華 共同舉辦陀螺挑戰賽"), rows: [tx("SPIN HARD! NO LIMITS!"), tx("7/26（日）台北瓶蓋工廠 M 棟；報到 11:00，比賽 13:00")] },
  { heading: tx("規則說明"), rows: [tx("陀螺台灣有代理的版本全開，禁美版，跟台灣無販售陀螺"), tx("規則採用官方規則第 12 版"), tx("判決疑慮一律採用輔助判決"), tx("當天分為四區進行比賽，分區冠軍進行四強循環賽，分區亞軍獲得亞軍獎品")] },
  { heading: tx("獎品"), rows: [tx("第一名：八岐大蛇"), tx("第二名：澀谷爆刃"), tx("第三名：紅空力天馬"), tx("第四名：黑勇氣"), tx("分區亞軍獎品：神秘獎品"), tx("神秘抽獎活動")] },
  { heading: tx("報名"), rows: [tx("報名費用 600 元，需先匯款"), tx("填寫表單報名，以抽籤決定名額；於 7/20 抽出正選名單"), tx("報名專屬好禮：現在只要報名，就送 500 元的居家清潔折扣券！"), tx("海報中的 QR Code 為報名連結；請改用本頁下方的報名表單。")] },
  { heading: tx("主辦與協辦"), rows: [tx("主辦單位：國際兒童才藝協會"), tx("協辦單位：摸氣球股份有限公司、Knock down 重擊戰隊、洗洋洋居家清潔"), tx("主辦方保留修正、暫停、終止活動之最終決定權")] },
];

const SETS = { hero: HERO, tickets: TICKETS, carnival: CARNIVAL, highlights: HIGHLIGHTS, tor: TOR } as const;

export function BannerTranscript({ which, className, showPriceNote = true }: { which: keyof typeof SETS; className?: string; showPriceNote?: boolean }) {
  const blocks = SETS[which]();
  return (
    <details className={cn("group rounded-2xl border bg-white/90 text-sm text-foreground", className)} data-testid={`transcript-${which}`}>
      <summary className="cursor-pointer select-none list-none flex items-center gap-2 px-4 py-3 min-h-11 font-bold text-foreground">
        <FileText size={16} aria-hidden="true" className="text-primary shrink-0" />
        <span>{tx("圖片文字內容（純文字版）")}</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground group-open:hidden">{tx("展開")}</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground hidden group-open:inline">{tx("收合")}</span>
      </summary>
      <div className="px-4 pb-4 space-y-4 text-left">
        {blocks.map((b, i) => (
          <div key={i}>
            {b.heading && <h3 className="font-bold text-base mb-1.5">{b.heading}</h3>}
            <ul className="space-y-1">
              {b.rows.map((r, j) => (
                <li key={j} className={Array.isArray(r) ? "flex gap-3" : undefined}>
                  {Array.isArray(r) ? (<><span className="font-bold tabular-nums shrink-0 min-w-[6.5rem]">{r[0]}</span><span>{r[1]}</span></>) : r}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {showPriceNote && <p className="text-xs text-muted-foreground border-t pt-3">{tx(NOTE)}</p>}
      </div>
    </details>
  );
}
