import { useState } from "react";
import { useListContestants } from "@workspace/api-client-react";
import { Users, Handshake, Clock, Heart, MessageCircle, Lightbulb, BookOpen, ArrowRight, Sparkles, ChevronDown, Trophy, Palette, Zap, Shirt, Flower2, Eye, Lock } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const competitionCategories = [
  {
    id: "medium-balloon",
    icon: Palette,
    name: "中型氣球",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    summary: "參賽者在規定時間內，使用指定數量的氣球完成中型氣球造型作品。",
    rules: [
      "作品尺寸限制：長寬高各不超過 150 公分。",
      "使用氣球數量：50～150 顆（含圓球、長條球、造型球等）。",
      "製作時間：3 小時。",
      "不可使用非氣球材料作為主體結構（支架、底座除外）。",
      "允許使用手動打氣筒或電動打氣機。",
      "作品須具備完整性與主題性，評審將依據創意、技術、美感、完成度四大面向評分。",
      "作品完成後將展示於展覽區，供週五至週日遊客參觀。",
    ],
  },
  {
    id: "balloon-figure",
    icon: Users,
    name: "氣球人偶",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    summary: "以氣球製作等比例或大型人偶造型，展現角色塑造與結構技巧。",
    rules: [
      "人偶高度需達 100 公分以上。",
      "主題不限，可為卡通角色、真人形象、原創設計等。",
      "製作時間：3 小時。",
      "需包含臉部表情、身體比例、服裝或配件等細節。",
      "允許使用不同尺寸與顏色的氣球搭配。",
      "人偶需可獨立站立或有適當支撐（支架不列入評分）。",
      "評分標準：造型相似度/創意 30%、技術難度 25%、細節處理 25%、整體美感 20%。",
      "完成作品將展示於人偶展區，供遊客拍照互動。",
    ],
  },
  {
    id: "speed-balloon",
    icon: Zap,
    name: "氣球快手",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    summary: "舞臺競速表演！參賽者在限定時間內快速完成指定造型，同時也是面向觀眾的精彩舞臺演出。",
    rules: [
      "本項目為舞臺競賽，同時面向一般參觀者開放觀看。",
      "每位參賽者上臺時間為 10 分鐘。",
      "每輪比賽由主辦方公布指定造型主題，參賽者需在時間內完成。",
      "僅可使用長條氣球（260、360 規格），不可使用圓球。",
      "需全程徒手操作，不可使用打氣機以外的工具。",
      "完成速度佔總分 40%，作品完成度與美觀佔 60%。",
      "分為初賽與決賽兩輪，初賽取前 8 名進入決賽。",
      "觀眾可於舞臺區觀看比賽實況，感受氣球快手的速度與技巧。",
    ],
    isStageEvent: true,
  },
  {
    id: "balloon-costume",
    icon: Shirt,
    name: "氣球服裝",
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    summary: "以氣球製作可穿戴的服裝作品，結合時尚設計與氣球技藝。",
    rules: [
      "服裝需可由真人實際穿戴並走秀展示。",
      "製作時間：3 小時（不含走秀時間）。",
      "服裝主體須以氣球為主要材料（佔整體面積 80% 以上）。",
      "允許使用底衣、安全別針、膠帶等輔助固定。",
      "需包含上半身與下半身的完整造型設計。",
      "走秀環節每組 3 分鐘，需展示服裝的正面、側面與背面。",
      "評分標準：設計創意 30%、製作技術 25%、穿戴效果 25%、走秀表現 20%。",
      "走秀環節對遊客開放觀看。",
    ],
  },
  {
    id: "balloon-bouquet",
    icon: Flower2,
    name: "氣球花束（含氣球雕塑）",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    summary: "以氣球製作精美花束或雕塑作品，考驗細膩的氣球塑形與配色能力。",
    rules: [
      "作品類型可選擇：花束或雕塑（報名時需選定類別）。",
      "花束類：需包含至少 5 種不同花卉造型，整體高度不超過 80 公分。",
      "雕塑類：主題不限，作品尺寸長寬高各不超過 100 公分。",
      "製作時間：2 小時。",
      "花束類需具備可手持或花瓶展示的實用性。",
      "雕塑類需有明確的主題與故事性。",
      "可使用各種規格的氣球，包含迷你球、心形球等異形球。",
      "評分標準：造型精緻度 30%、配色美感 25%、技術難度 25%、創意表現 20%。",
      "所有作品完成後將展示於花藝展區。",
    ],
  },
];

const scheduleDays = [
  {
    date: "7/23 (四)",
    label: "研討會 Day 1 — 大師工作坊",
    subtitle: "封閉活動，僅限報名同行參加",
    isPrivate: true,
    items: [
      { time: "08:30 - 09:00", event: "報到", desc: "領取識別證、研討會資料與大會手冊", tag: "行政" },
      { time: "09:00 - 09:30", event: "開幕致詞", desc: "大會主席致詞，介紹本屆活動主題「傳承」", tag: "主題" },
      { time: "09:30 - 12:00", event: "大師工作坊（上午場）", desc: "特邀中國氣球大師親自授課，教授進階氣球技法與造型設計", tag: "教學" },
      { time: "12:00 - 13:30", event: "午餐與同行交流", desc: "自助午餐，同行自由交流、互相認識", tag: "交流" },
      { time: "13:30 - 16:00", event: "大師工作坊（下午場）", desc: "大師帶領實作練習，一對一指導修正，學員完成個人作品", tag: "教學" },
      { time: "16:00 - 16:30", event: "學員作品分享", desc: "各學員展示當日學習成果，大師給予回饋與建議", tag: "交流" },
      { time: "16:30 - 17:00", event: "晚間活動說明 & 自由交流", desc: "說明後續幾日的活動安排與比賽須知", tag: "行政" },
    ],
  },
  {
    date: "7/24 (五)",
    label: "研討會 Day 2 — 交流與備賽",
    subtitle: "研討會 + 部分展區開放遊客參觀",
    isPrivate: false,
    items: [
      { time: "09:00 - 09:30", event: "晨間茶敘", desc: "同行自由交流，交換名片與經驗", tag: "交流" },
      { time: "09:30 - 11:00", event: "產業趨勢座談", desc: "探討氣球產業發展、環保材料、國際市場趨勢", tag: "主題" },
      { time: "11:00 - 12:00", event: "經驗傳承座談", desc: "資深前輩分享從業心得，與新進同行互動問答", tag: "傳承" },
      { time: "12:00 - 13:30", event: "午餐交流", desc: "同行午餐，遊客可開始入場參觀展區", tag: "交流" },
      { time: "13:30 - 15:00", event: "比賽規則說明會", desc: "五項比賽的詳細規則說明、場地走位與注意事項", tag: "行政" },
      { time: "15:00 - 17:00", event: "賽前準備 & 自由練習", desc: "參賽者準備材料與練習，遊客可於展區自由參觀", tag: "實作" },
    ],
  },
  {
    date: "7/25 (六)",
    label: "比賽日 — 創作與競技",
    subtitle: "全面開放遊客參觀，比賽同步進行",
    isPrivate: false,
    items: [
      { time: "09:00 - 09:30", event: "入場開放", desc: "遊客入場，展覽區開放參觀", tag: "開放" },
      { time: "09:30 - 12:30", event: "中型氣球比賽", desc: "參賽者現場製作中型氣球作品（限時 3 小時）", tag: "比賽" },
      { time: "09:30 - 12:30", event: "氣球人偶比賽", desc: "參賽者現場製作等比例氣球人偶（限時 3 小時）", tag: "比賽" },
      { time: "12:30 - 13:30", event: "午休 & 作品展示", desc: "上午比賽作品移至展區展示，遊客自由參觀拍照", tag: "開放" },
      { time: "13:30 - 15:30", event: "氣球花束/雕塑比賽", desc: "參賽者現場製作花束或雕塑作品（限時 2 小時）", tag: "比賽" },
      { time: "15:30 - 17:00", event: "氣球快手初賽（舞臺）", desc: "舞臺公開競速比賽，遊客可現場觀看精彩對決", tag: "舞臺" },
      { time: "17:00 - 18:00", event: "全日作品展覽", desc: "所有比賽作品集中展示，遊客自由參觀", tag: "開放" },
    ],
  },
  {
    date: "7/26 (日)",
    label: "決賽日 — 展覽與頒獎",
    subtitle: "全面開放遊客參觀，決賽與頒獎典禮",
    isPrivate: false,
    items: [
      { time: "09:00 - 09:30", event: "入場開放", desc: "遊客入場，展覽區開放參觀", tag: "開放" },
      { time: "09:30 - 12:30", event: "氣球服裝比賽", desc: "參賽者製作可穿戴氣球服裝（限時 3 小時）", tag: "比賽" },
      { time: "12:30 - 13:30", event: "午休 & 展覽", desc: "全部作品開放展覽，遊客自由拍照互動", tag: "開放" },
      { time: "13:30 - 14:30", event: "氣球服裝走秀（舞臺）", desc: "參賽者穿戴作品走秀展示，遊客可觀看", tag: "舞臺" },
      { time: "14:30 - 16:00", event: "氣球快手決賽（舞臺）", desc: "前 8 強選手舞臺對決，觀眾現場見證冠軍誕生", tag: "舞臺" },
      { time: "16:00 - 17:00", event: "頒獎典禮", desc: "五項比賽獎項頒發、優秀作品表揚", tag: "主題" },
      { time: "17:00 - 18:00", event: "閉幕交流 & 合影", desc: "閉幕致詞、全體合影、自由交流，期待明年再聚", tag: "交流" },
    ],
  },
];

const tagStyles: Record<string, string> = {
  "交流": "bg-blue-50 text-blue-600",
  "主題": "bg-purple-50 text-purple-600",
  "傳承": "bg-amber-50 text-amber-700",
  "實作": "bg-green-50 text-green-600",
  "教學": "bg-indigo-50 text-indigo-600",
  "行政": "bg-gray-100 text-gray-600",
  "比賽": "bg-red-50 text-red-600",
  "舞臺": "bg-orange-50 text-orange-600",
  "開放": "bg-teal-50 text-teal-600",
};

function CompetitionCard({ cat }: { cat: typeof competitionCategories[0] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("rounded-2xl border-2 overflow-hidden transition-all", cat.border, isOpen && "shadow-lg")}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-5 sm:p-6 flex items-start gap-4 hover:bg-muted/30 transition-colors"
      >
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", cat.bg)}>
          <cat.icon size={24} className={cat.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg">{cat.name}</h3>
            {cat.isStageEvent && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-600 flex items-center gap-1">
                <Eye size={12} /> 舞臺公開賽
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">{cat.summary}</p>
        </div>
        <ChevronDown size={20} className={cn("text-muted-foreground shrink-0 mt-1 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="px-5 sm:px-6 pb-6 pt-0">
          <div className="border-t pt-5">
            <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-4">比賽規則</h4>
            <ol className="space-y-2.5">
              {cat.rules.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5", cat.bg, cat.color)}>
                    {idx + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContestantsPage() {
  const { data: members, isLoading } = useListContestants();
  const [activeDay, setActiveDay] = useState(0);

  return (
    <div className="flex flex-col">
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/80 via-background to-background"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 font-bold text-sm mb-6">
            <Handshake size={16} /> 以傳承為名，以交流為本
          </div>
          <h1 className="font-display text-4xl md:text-6xl mb-6 text-foreground">
            氣球同行<span className="text-carnival">交流會</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4">
            四天的專業盛會 — 研討會、大師工作坊、五大交流賽、作品展覽。
            讓我們在交流中傳承，在切磋中成長。
          </p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-8">
            7/23（四）封閉研討會 ・ 7/24（五）研討會 + 遊客參觀 ・ 7/25-26（六日）比賽 + 全面開放展覽
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/registration"
              className="px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              我要報名參加 <ArrowRight size={20} />
            </Link>
            <a
              href="#competitions"
              className="px-8 py-4 rounded-full font-bold text-lg bg-white text-foreground border-2 hover:border-primary/30 shadow-sm hover:shadow-md transition-all"
            >
              查看比賽規則
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Heart,
              title: "傳承精神",
              desc: "特邀大師親授技藝，資深前輩座談分享。讓寶貴的經驗與技術一代一代延續下去。",
              color: "text-rose-500",
              bg: "bg-rose-50",
            },
            {
              icon: MessageCircle,
              title: "同行交流",
              desc: "打破地域限制，讓各地氣球同行面對面交流。研討會、工作坊、自由交流，建立深厚的產業連結。",
              color: "text-blue-500",
              bg: "bg-blue-50",
            },
            {
              icon: Lightbulb,
              title: "切磋競技",
              desc: "五大交流賽讓同行們互相觀摩、良性競爭。比賽作品同步展覽，也讓遊客感受氣球藝術的魅力。",
              color: "text-amber-500",
              bg: "bg-amber-50",
            },
          ].map((item, idx) => (
            <div key={idx} className="glass-card rounded-2xl p-8 text-center hover-lift">
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5", item.bg)}>
                <item.icon size={32} className={item.color} />
              </div>
              <h3 className="text-xl font-bold mb-3">{item.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="competitions" className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 text-red-600 font-bold text-sm mb-4">
              <Trophy size={16} /> 五大交流賽
            </div>
            <h2 className="font-display text-4xl mb-4">比賽項目與規則</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              點擊各項目展開詳細規則。所有比賽作品完成後皆會公開展覽，供遊客參觀。
            </p>
          </div>

          <div className="space-y-4">
            {competitionCategories.map(cat => (
              <CompetitionCard key={cat.id} cat={cat} />
            ))}
          </div>

          <div className="mt-8 p-5 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
            <Eye size={20} className="text-orange-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-orange-700 mb-1">遊客觀看須知</h4>
              <p className="text-sm text-orange-600">
                「氣球快手」初賽（週六）與決賽（週日），以及「氣球服裝走秀」（週日）為舞臺公開賽事，
                一般遊客可於舞臺區免費觀看。其他比賽項目的製作過程與完成作品，均可於展覽區參觀。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="schedule" className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4">
              <Clock size={16} /> 四日議程
            </div>
            <h2 className="font-display text-4xl mb-4">完整活動時程</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              研討會、工作坊、比賽、展覽，四天精彩不間斷
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center mb-10">
            {scheduleDays.map((day, idx) => (
              <button
                key={idx}
                onClick={() => setActiveDay(idx)}
                className={cn(
                  "px-5 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2",
                  activeDay === idx
                    ? "bg-primary text-white shadow-md"
                    : "bg-white border hover:bg-muted/50 text-foreground"
                )}
              >
                {day.isPrivate && <Lock size={14} />}
                {day.date}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-2xl font-bold">{scheduleDays[activeDay].label}</h3>
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              {scheduleDays[activeDay].isPrivate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                  <Lock size={12} /> 封閉活動
                </span>
              )}
              {scheduleDays[activeDay].subtitle}
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-[88px] top-0 bottom-0 w-0.5 bg-border hidden sm:block"></div>
            <div className="space-y-4">
              {scheduleDays[activeDay].items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 sm:gap-6 group">
                  <div className="w-[80px] sm:w-[88px] text-right shrink-0 pt-1">
                    <span className="text-xs sm:text-sm font-bold text-primary whitespace-nowrap">{item.time.split(" - ")[0]}</span>
                  </div>
                  <div className="relative hidden sm:block">
                    <div className="absolute -left-[5px] top-3 w-3 h-3 rounded-full bg-white border-2 border-primary group-hover:bg-primary transition-colors z-10"></div>
                  </div>
                  <div className="glass-card rounded-2xl p-4 sm:p-5 flex-1 group-hover:border-primary/30 transition-colors sm:ml-2">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-base sm:text-lg">{item.event}</h4>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", tagStyles[item.tag] || "bg-gray-100 text-gray-600")}>
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8 justify-center">
            {Object.entries(tagStyles).map(([label, cls]) => (
              <span key={label} className={cn("px-3 py-1 rounded-full text-xs font-medium", cls)}>{label}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 max-w-7xl mx-auto w-full bg-muted/30 rounded-3xl my-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 font-bold text-sm mb-4">
            <Users size={16} /> 交流夥伴
          </div>
          <h2 className="font-display text-4xl mb-4">參與同行</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            每一位同行都是獨特的，帶著自己的故事與專長來到這裡
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border rounded-3xl h-64 animate-pulse"></div>
            ))}
          </div>
        ) : members && members.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {members.map((member) => (
              <div key={member.id} className="group glass-card rounded-3xl overflow-hidden hover-lift flex flex-col">
                <div className="flex items-start gap-5 p-6 pb-0">
                  <div className="w-20 h-20 rounded-2xl bg-muted overflow-hidden shrink-0 border-2 border-white shadow-sm">
                    {member.imageUrl ? (
                      <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                        <Users size={28} className="text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-bold text-xl truncate group-hover:text-primary transition-colors">{member.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <BookOpen size={14} className="text-amber-500 shrink-0" />
                      <span className="text-sm text-amber-600 font-medium">交流夥伴</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-4 flex-1">
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap line-clamp-5">
                    {member.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 max-w-md mx-auto">
            <Handshake className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-xl text-muted-foreground mb-2">同行名單即將公布</p>
            <p className="text-muted-foreground text-sm">報名截止後，參與同行的資訊將在此展示</p>
          </div>
        )}
      </section>

      <section className="py-16 bg-gradient-to-b from-amber-50/50 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-6">
            <Sparkles size={32} className="text-amber-600" />
          </div>
          <h2 className="font-display text-3xl mb-4">一起讓技藝延續下去</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            無論你是入行數十年的前輩，還是剛踏入氣球世界的新人，
            這裡都有你的位置。讓我們在比賽中切磋、在交流中成長、在傳承中找到意義。
          </p>
          <Link
            href="/registration"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            立即報名交流會 <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}
