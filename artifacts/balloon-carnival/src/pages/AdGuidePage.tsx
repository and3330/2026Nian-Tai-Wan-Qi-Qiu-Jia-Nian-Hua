import { Copy, Check, Megaphone, Settings, Route, ExternalLink, Printer } from "lucide-react";
import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors print:hidden"
      title="複製文案"
    >
      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      {copied ? "已複製" : "複製"}
    </button>
  );
}

const adCopies = [
  {
    style: "溫馨家庭風",
    color: "border-pink-300 bg-pink-50/50",
    badge: "bg-pink-100 text-pink-700",
    primaryText:
      "這個暑假，給孩子一段最難忘的回憶！\n\n🎈 2026 臺灣氣球嘉年華，7/25（六）- 7/26（日）在臺北瓶蓋工廠盛大登場！巨型氣球裝置讓孩子驚呼連連，親子 DIY 工作坊一起動手做氣球造型（NT$150/組），還有精彩的親子表演和氣球藝術服裝遊行！\n\n📍 地點：臺北瓶蓋工廠（南港捷運站 1 號出口步行 1 分鐘）\n⏰ 時間：10:00 - 18:00（7/25 延長至 19:00）\n🎟️ 單日票 NT$200 / 兩日套票 NT$300 / 6 歲以下免費\n⚡ 每日限量 500 人，手刀搶票！",
    headline: "帶孩子來一場氣球奇幻之旅！",
    description: "巨型氣球裝置 × 親子 DIY × 精彩表演｜7/25-7/26 臺北瓶蓋工廠｜6 歲以下免費入場",
    cta: "立即預訂（Learn More / 瞭解詳情）",
    imageDirection:
      "建議使用：親子一起做氣球造型的溫馨畫面、小朋友開心看氣球裝置的照片。色調溫暖明亮，以粉色、黃色、天藍色為主。可搭配文字疊圖「暑假親子必去！」",
  },
  {
    style: "限量緊迫風",
    color: "border-red-300 bg-red-50/50",
    badge: "bg-red-100 text-red-700",
    primaryText:
      "⚡ 每日只有 500 張票，去年開賣 3 天就完售！\n\n2026 臺灣氣球嘉年華即將在 7/25（六）- 7/26（日）登場！今年更盛大、更精彩 — 巨型氣球裝置、12 分鐘極速氣球賽、夢幻的氣球藝術服裝遊行（7/25 15:30 僅此一場）！\n\n🎟️ 票價超親民：\n✅ 單日票只要 NT$200\n✅ 兩日套票 NT$300（省 NT$100！）\n✅ 6 歲以下免費\n\n📍 臺北瓶蓋工廠（南港捷運站 1 號出口）\n⏰ 10:00 - 18:00（7/25 延長至 19:00）\n\n👉 別等了，手刀搶票！",
    headline: "每日限量 500 人！搶票倒數中",
    description: "單日票 NT$200 起｜兩日套票省 NT$100｜6 歲以下免費｜南港捷運站 1 號出口",
    cta: "立即搶票（Sign Up / 註冊）",
    imageDirection:
      "建議使用：色彩鮮豔的氣球裝置全景照，搭配醒目的「限量 500 人」、「即將完售」等文字標籤。使用紅色、橘色等緊迫感色調。可加入倒數計時器的設計元素。",
  },
  {
    style: "活動亮點風",
    color: "border-blue-300 bg-blue-50/50",
    badge: "bg-blue-100 text-blue-700",
    primaryText:
      "🎪 你看過氣球做的恐龍嗎？看過用氣球做的禮服走秀嗎？\n\n2026 臺灣氣球嘉年華，讓你大開眼界！\n\n🏆 活動亮點：\n🎈 巨型氣球裝置 — 超好拍的打卡聖地\n🎭 氣球藝術服裝遊行 — 7/25 15:30 全場僅此一場！\n⚡ 12 分鐘極速氣球賽 — 看職人高手過招\n🎨 親子 DIY 工作坊 — 帶走專屬氣球作品（NT$150/組）\n🎤 精彩舞臺表演 — 全家大小都適合\n\n📅 7/25（六）- 7/26（日）\n📍 臺北瓶蓋工廠（南港捷運站 1 號出口）\n🎟️ NT$200 起 / 6 歲以下免費 / 每日限量 500 人",
    headline: "今年暑假最強親子活動在這裡！",
    description: "巨型氣球裝置 × 服裝遊行 × 極速氣球賽 × DIY 工作坊｜一票玩整天",
    cta: "查看活動詳情（Learn More / 瞭解詳情）",
    imageDirection:
      "建議使用：活動亮點拼貼圖（巨型氣球裝置、服裝遊行、DIY 工作坊等畫面組合）。使用明亮活潑的配色，展現活動的豐富性與趣味性。可搭配圖示標註各個亮點。",
  },
];

const metaSteps = [
  {
    title: "建立 Meta 商業帳號（Business Manager）",
    steps: [
      "前往 business.facebook.com 並登入你的 Facebook 帳號",
      "點選「建立帳號」，輸入商業名稱（例如：2026臺灣氣球嘉年華）",
      "填入你的姓名和電子信箱，按下「提交」",
      "前往信箱驗證電子郵件，完成帳號建立",
    ],
  },
  {
    title: "建立廣告帳號",
    steps: [
      "進入 Business Manager 後，點選左側「商業設定」",
      "選擇「帳號」→「廣告帳號」→「新增」",
      "選擇「建立新的廣告帳號」",
      "輸入廣告帳號名稱、選擇時區（GMT+8 台北）和幣別（TWD 新台幣）",
      "點選「建立」完成設定",
    ],
  },
  {
    title: "設定付款方式",
    steps: [
      "進入廣告帳號設定頁面，點選「付款設定」",
      "點選「新增付款方式」",
      "可選擇信用卡/簽帳金融卡（建議使用），或 PayPal",
      "輸入信用卡資訊並儲存",
      "設定帳單上限（建議新手先設 NT$1,000 - NT$3,000 以控制預算）",
    ],
  },
  {
    title: "建立新廣告活動（Campaign）",
    steps: [
      "前往 Meta 廣告管理員（adsmanager.facebook.com）",
      "點選綠色的「+ 建立」按鈕",
      '選擇行銷目標：建議選擇「流量」（導引人潮到報名頁）或「轉換次數」（追蹤實際報名人數）',
      "為活動命名，例如「氣球嘉年華_7月_導流」",
      '設定廣告活動預算：建議選擇「每日預算」，新手建議從 NT$200 - NT$500/天 開始測試',
      "點選「下一步」繼續設定廣告組合",
    ],
    tips: [
      "小額測試方案：先用 NT$200/天 跑 3 天觀察成效，若點擊率 > 2% 再加碼到 NT$500/天",
      "建議活動前 2-4 週開始投放，預留足夠時間累積曝光",
      "總預算建議：NT$3,000 - NT$10,000（依需求調整）",
    ],
  },
  {
    title: "設定廣告組合（Ad Set）",
    steps: [
      "為廣告組合命名，例如「北部家長_親子興趣」",
      "設定受眾條件：",
    ],
    audienceSettings: [
      { label: "地區", value: "台灣 → 台北市、新北市、基隆市、桃園市（北部地區）" },
      { label: "年齡", value: "25 - 45 歲" },
      { label: "性別", value: "不限（或可針對女性投放，通常媽媽族群互動率更高）" },
      {
        label: "詳細目標設定（興趣）",
        value: "親子活動、家庭旅遊、兒童教育、手作DIY、親子餐廳、育兒、媽媽社團、兒童遊樂、暑假活動",
      },
    ],
    moreSteps: [
      '設定排程：建議「開始日期」設在活動前 2-4 週，「結束日期」設在 7/24（活動前一天）',
      '版位選擇：建議選「自動版位（Advantage+ 版位）」讓系統自動優化，或手動選擇 Facebook 動態消息 + Instagram 動態消息 + Instagram 限時動態',
      "點選「下一步」進入廣告設定",
    ],
  },
  {
    title: "建立廣告（Ad）",
    steps: [
      "為廣告命名，例如「溫馨家庭風_文案A」",
      "選擇你的 Facebook 粉絲專頁和 Instagram 帳號",
      '廣告格式：建議選擇「單一圖片或影片」（最簡單好操作）',
      "上傳素材：上傳你準備好的圖片或影片（建議尺寸：1080×1080 正方形 或 1080×1920 限時動態）",
      "填入廣告文案：將上方提供的文案複製貼上到對應欄位（主要文字、標題、說明）",
      "設定行動呼籲按鈕：選擇「瞭解詳情」或「註冊」",
      "設定網站網址：填入報名頁網址 https://www.balloon-carnival.tw/carnival（記得加上 UTM 參數，見區塊三）",
      '點選「預覽」確認廣告在各版位的顯示效果',
      '確認無誤後，點選「發佈」送出廣告審查（通常 24 小時內完成審查）',
    ],
  },
  {
    title: "追蹤廣告成效（基礎指標）",
    steps: [
      "發佈後回到廣告管理員首頁，即可看到廣告成效數據",
      "重要指標說明：",
    ],
    metrics: [
      { name: "曝光次數（Impressions）", desc: "廣告被顯示的總次數" },
      { name: "觸及人數（Reach）", desc: "看到廣告的不重複人數" },
      { name: "連結點擊次數（Link Clicks）", desc: "點擊廣告連結前往報名頁的次數，這是最重要的指標" },
      { name: "點擊率（CTR）", desc: "點擊次數 ÷ 曝光次數。好的 CTR 通常 > 1%，優秀的 > 2%" },
      { name: "每次點擊成本（CPC）", desc: "每一次連結點擊花費多少錢。台灣市場通常 NT$3 - NT$15" },
      { name: "花費金額（Amount Spent）", desc: "累計花費的廣告費用" },
    ],
    moreSteps: [
      "建議每天檢查一次成效，若某組廣告 CTR 低於 1%，可考慮更換素材或文案",
      "表現好的廣告可以增加預算，表現差的可以暫停",
    ],
  },
];

const utmExamples = [
  {
    label: "Facebook 廣告 - 溫馨家庭風",
    url: "https://www.balloon-carnival.tw/carnival?utm_source=facebook&utm_medium=paid&utm_campaign=balloon_carnival_2026&utm_content=family_warm",
  },
  {
    label: "Facebook 廣告 - 限量緊迫風",
    url: "https://www.balloon-carnival.tw/carnival?utm_source=facebook&utm_medium=paid&utm_campaign=balloon_carnival_2026&utm_content=scarcity_urgent",
  },
  {
    label: "Instagram 廣告 - 活動亮點風",
    url: "https://www.balloon-carnival.tw/carnival?utm_source=instagram&utm_medium=paid&utm_campaign=balloon_carnival_2026&utm_content=highlights_fun",
  },
];

const userJourney = [
  {
    step: 1,
    title: "看到廣告",
    desc: "使用者在 Facebook 或 Instagram 動態中看到氣球嘉年華廣告",
  },
  {
    step: 2,
    title: "點擊廣告",
    desc: "被文案與圖片吸引，點擊「瞭解詳情」或「立即搶票」按鈕",
  },
  {
    step: 3,
    title: "進入報名頁",
    desc: "跳轉到 balloon-carnival.tw/carnival 的購票區域",
  },
  {
    step: 4,
    title: "選擇票種",
    desc: "選擇單日票（NT$200）或兩日套票（NT$300），查看各日剩餘名額",
  },
  {
    step: 5,
    title: "填寫資料",
    desc: "填入姓名、聯絡電話、購票張數等基本資訊",
  },
  {
    step: 6,
    title: "確認購票",
    desc: "送出表單，系統即時扣減名額並顯示購票成功畫面",
  },
];

export default function AdGuidePage() {
  return (
    <div className="flex flex-col">
      <section className="relative py-16 lg:py-24 overflow-hidden print:py-8">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-background to-background print:hidden"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 font-bold text-sm mb-6 print:hidden">
            <Megaphone size={16} /> 廣告投放指南
          </div>
          <h1 className="font-display text-3xl md:text-5xl mb-4 text-foreground">
            Meta 廣告文案<span className="text-carnival">與投放教學</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
            2026 臺灣氣球嘉年華的 Facebook / Instagram 廣告投放完整指南。
            <br className="hidden md:block" />
            從文案撰寫到後台操作，一步步帶你上手。
          </p>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm bg-foreground text-white hover:bg-foreground/90 transition-colors print:hidden"
          >
            <Printer size={16} /> 列印 / 儲存為 PDF
          </button>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 w-full pb-20 space-y-20 print:space-y-10">
        <section id="ad-copy">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
              <Megaphone size={20} className="text-pink-600" />
            </div>
            <div>
              <h2 className="font-display text-2xl md:text-3xl">區塊一：廣告文案</h2>
              <p className="text-sm text-muted-foreground">提供 3 組不同風格，可直接複製使用</p>
            </div>
          </div>

          <div className="space-y-8">
            {adCopies.map((ad, idx) => (
              <div key={idx} className={`rounded-2xl border-2 p-6 md:p-8 ${ad.color} print:break-inside-avoid`}>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${ad.badge}`}>
                    風格 {idx + 1}：{ad.style}
                  </span>
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">主要文字 (Primary Text)</label>
                      <CopyButton text={ad.primaryText} />
                    </div>
                    <div className="bg-white rounded-xl p-4 text-sm leading-relaxed whitespace-pre-line border">{ad.primaryText}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">標題 (Headline)</label>
                        <CopyButton text={ad.headline} />
                      </div>
                      <div className="bg-white rounded-xl p-4 text-sm font-bold border">{ad.headline}</div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">說明 (Description)</label>
                        <CopyButton text={ad.description} />
                      </div>
                      <div className="bg-white rounded-xl p-4 text-sm border">{ad.description}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">行動呼籲按鈕 (CTA)</label>
                      <div className="bg-white rounded-xl p-4 text-sm font-bold text-primary border">{ad.cta}</div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">建議搭配圖片/影片方向</label>
                      <div className="bg-white rounded-xl p-4 text-sm text-muted-foreground border">{ad.imageDirection}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="meta-setup">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Settings size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-display text-2xl md:text-3xl">區塊二：Meta 廣告後台設定教學</h2>
              <p className="text-sm text-muted-foreground">從零開始的保姆級步驟，新手也能輕鬆上手</p>
            </div>
          </div>

          <div className="space-y-8">
            {metaSteps.map((section, sIdx) => (
              <div key={sIdx} className="glass-card rounded-2xl p-6 md:p-8 print:break-inside-avoid">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {sIdx + 1}
                  </span>
                  {section.title}
                </h3>

                <ol className="space-y-3 ml-11">
                  {section.steps.map((step, i) => (
                    <li key={i} className="text-sm leading-relaxed flex gap-2">
                      <span className="text-muted-foreground font-mono shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                {section.audienceSettings && (
                  <div className="ml-11 mt-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <p className="text-xs font-bold text-blue-700 mb-3 uppercase tracking-wider">受眾設定建議</p>
                    <div className="space-y-2">
                      {section.audienceSettings.map((setting, i) => (
                        <div key={i} className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-sm">
                          <span className="font-bold text-blue-800 shrink-0 sm:w-40">{setting.label}：</span>
                          <span className="text-blue-700">{setting.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section.moreSteps && (
                  <ol className="space-y-3 ml-11 mt-4" start={section.steps.length + (section.audienceSettings ? 1 : 0) + 1}>
                    {section.moreSteps.map((step, i) => (
                      <li key={i} className="text-sm leading-relaxed flex gap-2">
                        <span className="text-muted-foreground font-mono shrink-0">{section.steps.length + (section.audienceSettings ? 1 : 0) + i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {section.tips && (
                  <div className="ml-11 mt-4 bg-amber-50 rounded-xl p-4 border border-amber-100">
                    <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider">預算建議</p>
                    <ul className="space-y-1">
                      {section.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-amber-800 flex gap-2">
                          <span>💡</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {section.metrics && (
                  <div className="ml-11 mt-4 space-y-2">
                    {section.metrics.map((m, i) => (
                      <div key={i} className="bg-muted/50 rounded-xl p-3 border">
                        <span className="text-sm font-bold">{m.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">— {m.desc}</span>
                      </div>
                    ))}
                    {section.moreSteps && (
                      <div className="mt-3 space-y-2">
                        {section.moreSteps.map((step, i) => (
                          <p key={i} className="text-sm text-muted-foreground flex gap-2">
                            <span>📊</span>
                            <span>{step}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="user-journey">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Route size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-display text-2xl md:text-3xl">區塊三：報名流程引導</h2>
              <p className="text-sm text-muted-foreground">從廣告點擊到完成報名的完整使用者旅程</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 md:p-8 mb-8 print:break-inside-avoid">
            <h3 className="text-lg font-bold mb-6">使用者旅程圖</h3>
            <div className="space-y-0">
              {userJourney.map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {item.step}
                    </div>
                    {idx < userJourney.length - 1 && (
                      <div className="w-0.5 h-12 bg-primary/20 my-1"></div>
                    )}
                  </div>
                  <div className="pb-6">
                    <h4 className="font-bold text-base">{item.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 md:p-8 mb-8 print:break-inside-avoid">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ExternalLink size={18} className="text-primary" />
              UTM 參數設定建議
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              UTM 參數可以幫你追蹤每則廣告帶來多少流量。在 Meta 廣告後台的「網站網址」欄位填入以下完整網址：
            </p>

            <div className="bg-muted/50 rounded-xl p-4 border mb-6">
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">UTM 參數說明</p>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <code className="bg-white px-2 py-0.5 rounded text-primary font-mono text-xs shrink-0">utm_source</code>
                  <span className="text-muted-foreground">流量來源（facebook 或 instagram）</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-white px-2 py-0.5 rounded text-primary font-mono text-xs shrink-0">utm_medium</code>
                  <span className="text-muted-foreground">媒介類型（paid = 付費廣告）</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-white px-2 py-0.5 rounded text-primary font-mono text-xs shrink-0">utm_campaign</code>
                  <span className="text-muted-foreground">活動名稱（用於辨識這次的投放活動）</span>
                </div>
                <div className="flex gap-2">
                  <code className="bg-white px-2 py-0.5 rounded text-primary font-mono text-xs shrink-0">utm_content</code>
                  <span className="text-muted-foreground">廣告內容（用於區分不同風格的文案）</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {utmExamples.map((example, idx) => (
                <div key={idx} className="border rounded-xl p-4 print:break-inside-avoid">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{example.label}</span>
                    <CopyButton text={example.url} />
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono break-all text-muted-foreground">
                    {example.url}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 md:p-8 print:break-inside-avoid">
            <h3 className="text-lg font-bold mb-4">報名頁面網址格式說明</h3>
            <div className="space-y-4 text-sm">
              <div className="bg-muted/50 rounded-xl p-4 border">
                <p className="font-bold mb-1">基本報名頁網址</p>
                <code className="text-xs font-mono text-primary break-all">https://www.balloon-carnival.tw/carnival</code>
                <p className="text-muted-foreground mt-2">此頁面包含活動介紹、票價資訊、日程表與線上購票表單。</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 border">
                <p className="font-bold mb-1">帶有 UTM 參數的完整網址</p>
                <code className="text-xs font-mono text-primary break-all">
                  https://www.balloon-carnival.tw/carnival?utm_source=facebook&utm_medium=paid&utm_campaign=balloon_carnival_2026&utm_content=your_ad_variant
                </code>
                <p className="text-muted-foreground mt-2">在 Meta 廣告後台的「目的地網址」欄位貼上此網址。將 <code className="bg-white px-1 rounded">your_ad_variant</code> 替換為你的廣告風格名稱。</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <p className="font-bold text-green-800 mb-1">小提醒</p>
                <ul className="text-green-700 space-y-1">
                  <li>・點擊廣告後，使用者會直接看到購票區域，無需額外跳轉</li>
                  <li>・報名頁會即時顯示各日剩餘名額，營造緊迫感促進轉換</li>
                  <li>・6 歲以下免費入場的資訊也會顯示在頁面上，對家長族群是一大吸引力</li>
                  <li>・可在 Google Analytics 中透過 UTM 參數查看各則廣告的流量與轉換表現</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
