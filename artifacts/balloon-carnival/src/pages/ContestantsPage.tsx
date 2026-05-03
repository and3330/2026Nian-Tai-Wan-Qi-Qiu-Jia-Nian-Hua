import { useState } from "react";
import { useListContestants, useCreateRegistration } from "@workspace/api-client-react";
import { PaymentMethodModal } from "@/components/PaymentMethodModal";
import { ContestantVoteButton, useContestantVoteData } from "@/components/ContestantVoteButton";
import { Users, Handshake, Clock, Heart, MessageCircle, Lightbulb, BookOpen, ArrowRight, Sparkles, ChevronDown, Trophy, Palette, Zap, Shirt, Flower2, Eye, Lock, Ticket, GraduationCap, Phone, Mail, CheckCircle2, QrCode } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRegistrationAvailabilityQueryKey } from "@workspace/api-client-react";

const competitionCategories = [
  {
    id: "medium-balloon",
    icon: Palette,
    name: "中型氣球雕塑",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    summary: "參賽者在規定時間內，現場製作中型氣球造型作品，展現精湛技術與豐富創意。",
    rules: [
      "主題：生活的小幸福。",
      "組數：4～6 組，每組 4 人。",
      "創作時間：8 小時（現場製作）。",
      "作品尺寸：寬 300 × 深 200 × 高 250（公分）。",
      "使用品牌：不限制。",
      "非氣球素材使用量不得超過總作品 10%。",
      "交流排名以觀眾投票為主。",
      "完成作品將展示於展覽區，供遊客參觀。",
    ],
  },
  {
    id: "balloon-figure",
    icon: Users,
    name: "氣球人偶",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    summary: "以氣球製作大型人偶造型，展現角色塑造與結構技巧。",
    rules: [
      "主題：調皮的小時候。",
      "組數：6 組，每組 1～2 人。",
      "創作時間：4 小時（現場製作）。",
      "作品尺寸：寬 100 × 深 100 × 高 180（公分）。",
      "使用品牌：不限制。",
      "非人偶造型的組件配置不得超過 20%。",
      "交流排名以觀眾投票為主。",
      "完成作品將展示於人偶展區，供遊客參觀拍照。",
    ],
  },
  {
    id: "art-costume",
    icon: Shirt,
    name: "藝術服裝",
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    summary: "以氣球製作可穿戴的藝術服裝作品，結合時尚設計與氣球技藝，並於 7/25 進行走秀遊行。",
    rules: [
      "主題：花語。",
      "組數：4～8 組。",
      "創作時間：不限，可於指定時間內帶到現場或現場完成皆可。",
      "作品尺寸：以模特兒能方便活動為主。",
      "使用品牌：不限制。",
      "模特兒資料將於日後公佈。",
      "交流排名以觀眾投票為主。",
      "7/25（六）15:30 進行全場唯一一場走秀遊行，對遊客開放觀看。",
    ],
  },
  {
    id: "balloon-bouquet",
    icon: Flower2,
    name: "外送花束",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    summary: "以氣球製作精美花束作品，考驗細膩的氣球塑形與配色能力。",
    rules: [
      "主題：不限制。",
      "組數：6～10 組。",
      "創作時間：2 小時。",
      "作品尺寸：高度不超過 100 公分。",
      "使用品牌：不限制。",
      "交流排名以觀眾投票為主。",
      "所有作品完成後將於展覽區展出。",
    ],
  },
  {
    id: "speed-balloon",
    icon: Zap,
    name: "12 分鐘快手",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    summary: "舞臺公開競速賽！參賽者在 12 分鐘內快速完成作品，現場觀眾可觀看精彩對決。",
    rules: [
      "主題：不限制。",
      "組數：6～12 組。",
      "創作時間：12 分鐘。",
      "作品尺寸：不限制。",
      "使用品牌：不限制。",
      "本項目為舞臺競賽，面向一般參觀者開放觀看。",
      "交流排名以觀眾投票為主。",
    ],
    isStageEvent: true,
  },
];

const scheduleDays = [
  {
    date: "7/23 (四)",
    label: "研習會 — 開幕 / 報到",
    subtitle: "業內封閉活動，僅限報名同行參加，一般民眾無法入場",
    isPrivate: true,
    items: [
      { time: "08:00 - 17:00", event: "研習會（開幕 / 報到）", desc: "全日研習課程，特邀中國氣球大師授課教學，同行報到、交流與實作", tag: "教學" },
    ],
  },
  {
    date: "7/24 (五)",
    label: "業內比賽日",
    subtitle: "業內封閉活動，僅限報名同行參加，一般民眾無法入場",
    isPrivate: true,
    items: [
      { time: "08:00 - 17:00", event: "中型氣球比賽", desc: "參賽者現場製作中型氣球造型作品（全日賽程）", tag: "比賽" },
      { time: "13:00 - 17:00", event: "氣球人偶比賽", desc: "參賽者現場製作等比例氣球人偶作品", tag: "比賽" },
      { time: "18:30 - 20:30", event: "室內同行交流", desc: "晚間同行交流活動，促進業內人士互相認識與經驗分享", tag: "交流" },
    ],
  },
  {
    date: "7/25 (六)",
    label: "公開活動日 — 比賽 + 展覽",
    subtitle: "對外開放！歡迎一般民眾入場參觀（10:00 - 19:00）",
    isPrivate: false,
    items: [
      { time: "10:00", event: "開放入場", desc: "展覽區全面開放，可參觀中型氣球、人偶、花束等作品展示", tag: "開放" },
      { time: "13:00", event: "12 分鐘快手比賽（舞臺區）", desc: "舞臺競速比賽正式開始，現場觀看選手精彩對決", tag: "舞臺" },
      { time: "13:30", event: "親子氣球表演（舞臺區）", desc: "適合全家觀賞的趣味氣球表演", tag: "表演" },
      { time: "14:00", event: "氣球工作坊（教學區）", desc: "親子 DIY 體驗，每組 150 元（依小朋友人數計算）", tag: "體驗" },
      { time: "14:30", event: "氣球表演（舞臺區）", desc: "精彩的氣球藝術表演，展現氣球造型的無限可能", tag: "表演" },
      { time: "15:30", event: "藝術服裝走秀遊行（唯一場）", desc: "參賽者穿戴氣球藝術服裝進行走秀遊行，全場僅此一場，不可錯過！", tag: "舞臺" },
      { time: "19:00", event: "閉館", desc: "當日活動結束", tag: "行政" },
    ],
  },
  {
    date: "7/26 (日)",
    label: "公開活動日 — 展覽 + 表演",
    subtitle: "對外開放！歡迎一般民眾入場參觀（10:00 - 17:00）",
    isPrivate: false,
    items: [
      { time: "10:00", event: "開放入場", desc: "展覽區全面開放，可參觀各項比賽作品與氣球藝術展示", tag: "開放" },
      { time: "13:30", event: "親子氣球表演（舞臺區）", desc: "適合全家觀賞的趣味氣球表演", tag: "表演" },
      { time: "14:00", event: "氣球工作坊（教學區）", desc: "親子 DIY 體驗，每組 150 元（依小朋友人數計算）", tag: "體驗" },
      { time: "14:30", event: "氣球表演（舞臺區）", desc: "精彩的氣球藝術表演，歡迎闔家觀賞", tag: "表演" },
      { time: "17:00", event: "閉館", desc: "活動圓滿落幕", tag: "行政" },
    ],
  },
];

const tagStyles: Record<string, string> = {
  "交流": "bg-blue-50 text-blue-600",
  "主題": "bg-purple-50 text-purple-600",
  "教學": "bg-indigo-50 text-indigo-600",
  "行政": "bg-gray-100 text-gray-600",
  "比賽": "bg-red-50 text-red-600",
  "舞臺": "bg-orange-50 text-orange-600",
  "開放": "bg-teal-50 text-teal-600",
  "表演": "bg-pink-50 text-pink-600",
  "體驗": "bg-cyan-50 text-cyan-600",
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
  const queryClient = useQueryClient();
  const { data: members, isLoading } = useListContestants();
  const voteData = useContestantVoteData();
  const createMutation = useCreateRegistration();
  const [activeDay, setActiveDay] = useState(0);

  const [proTicketType, setProTicketType] = useState("");
  const [proFormData, setProFormData] = useState({ parentName: "", phone: "", email: "" });
  const [proSuccess, setProSuccess] = useState(false);
  const [proPendingPayment, setProPendingPayment] = useState<{
    registrationIds: number[];
    amount: number;
    itemLabel: string;
  } | null>(null);
  const [proConfirmedToken, setProConfirmedToken] = useState<string | null>(null);

  const ticketCatalog: Record<string, { eventDate: string; price: number; ticketType: string; label: string }> = {
    "四天通行票": { eventDate: "2026-07-23", price: 12000, ticketType: "four-day-pass", label: "四天通行票" },
    "研習會通行票": { eventDate: "2026-07-23", price: 8000, ticketType: "workshop", label: "研習會通行票" },
    "交流比賽通行票": { eventDate: "2026-07-24", price: 5000, ticketType: "competition", label: "交流比賽通行票" },
  };

  const handleProSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proTicketType) { alert("請選擇票種"); return; }
    const ticket = ticketCatalog[proTicketType] || ticketCatalog["四天通行票"];
    createMutation.mutate({
      data: {
        parentName: proFormData.parentName,
        phone: proFormData.phone,
        email: proFormData.email || undefined,
        ticketCount: 1,
        eventDate: ticket.eventDate,
        ticketType: ticket.ticketType,
        amount: ticket.price,
      }
    }, {
      onSuccess: (data: any) => {
        if (data?.qrToken) setProConfirmedToken(data.qrToken);
        queryClient.invalidateQueries({ queryKey: getGetRegistrationAvailabilityQueryKey() });
        setProPendingPayment({
          registrationIds: [data.id],
          amount: ticket.price,
          itemLabel: ticket.label,
        });
      },
      onError: () => {
        alert("報名失敗，請重試或聯絡客服");
      }
    });
  };

  return (
    <div className="flex flex-col">
      {proPendingPayment && (
        <PaymentMethodModal
          open
          registrationIds={proPendingPayment.registrationIds}
          amount={proPendingPayment.amount}
          itemLabel={proPendingPayment.itemLabel}
          payerName={proFormData.parentName}
          payerPhone={proFormData.phone}
          onClose={() => setProPendingPayment(null)}
          onCompleted={() => {
            setProPendingPayment(null);
            setProSuccess(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/80 via-background to-background"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 font-bold text-sm mb-6">
            <Handshake size={16} /> 以傳承為名，以交流為本
          </div>
          <h1 className="font-display text-4xl md:text-6xl mb-6 text-foreground">
            傳奇工匠<span className="text-carnival">研討會</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4">
            四天的專業盛會 — 研討會、大師工作坊、五大交流賽、作品展覽。
            讓我們在交流中傳承，在切磋中成長。
          </p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-8">
            7/23（四）研習會 ・ 7/24（五）業內比賽 ・ 7/25（六）7/26（日）公開活動 + 展覽
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#register"
              className="px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              我要報名參加 <ArrowRight size={20} />
            </a>
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

      <section id="workshops" className="py-20 bg-gradient-to-b from-indigo-50/50 to-background">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm mb-4">
              <GraduationCap size={16} /> 研習課程
            </div>
            <h2 className="font-display text-4xl mb-4">大師工作坊</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              7/23（四）研習會當日，特邀業界大師親授兩大核心技法
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card rounded-2xl p-8 hover-lift border-2 border-indigo-100">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5">
                <Users size={28} className="text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-indigo-700">人偶拉線技法</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                深入學習氣球人偶的骨架結構設計與拉線定型技巧。大師將現場示範如何透過精準的拉線手法，讓人偶造型更加立體、穩固且生動。
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">結構設計</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">拉線定型</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">實作練習</span>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-8 hover-lift border-2 border-indigo-100">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-5">
                <Sparkles size={28} className="text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-indigo-700">W 大型裝置技法</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                學習大型氣球裝置的 W 型結構搭建方法，掌握大型作品的承重、固定與造型技巧。課程涵蓋從設計概念到實際搭建的完整流程。
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">W 型結構</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">大型裝置</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">搭建流程</span>
              </div>
            </div>
          </div>

          <div className="mt-8 p-5 bg-indigo-50 border border-indigo-200 rounded-2xl text-center">
            <p className="text-sm text-indigo-700 font-medium">
              研習課程包含於「四天通行票（12,000 元）」及「研習會通行票（8,000 元）」中，無需另外報名。
            </p>
          </div>
        </div>
      </section>

      <section id="competitions" className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 text-red-600 font-bold text-sm mb-4">
              <Trophy size={16} /> 五大交流活動
            </div>
            <h2 className="font-display text-4xl mb-4">交流活動規則</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              活動總獎金 12 萬元，交流排名以觀眾投票為主。點擊各項目展開詳細規則。
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
                7/23（四）、7/24（五）為業內封閉活動，一般民眾無法入場。
                7/25（六）、7/26（日）對外開放，遊客可參觀中型氣球雕塑、人偶、花束等展覽作品，
                並於舞臺區觀看「12 分鐘快手比賽」與「藝術服裝走秀遊行」（週六唯一場）。
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

      <section id="register" className="py-20 bg-gradient-to-b from-primary/5 to-background scroll-mt-24">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 text-amber-600 font-bold text-sm mb-4">
              <Ticket size={16} /> 立即報名
            </div>
            <h2 className="font-display text-4xl mb-4">同行報名</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              歡迎氣球業界同行！請依需求選擇適合的票種
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass-card rounded-2xl p-6 border-2 border-primary/30 relative hover-lift">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">
                最完整
              </div>
              <h3 className="text-lg font-bold text-center mb-1">四天通行票</h3>
              <div className="text-center mb-4">
                <span className="text-4xl font-bold text-primary">12,000</span>
                <span className="text-muted-foreground ml-1">元</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> 四天皆可入場</li>
                <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> 研習會參加資格</li>
                <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> 交流比賽報名資格</li>
              </ul>
            </div>
            <div className="glass-card rounded-2xl p-6 hover-lift">
              <h3 className="text-lg font-bold text-center mb-1">研習會通行票</h3>
              <div className="text-center mb-4">
                <span className="text-4xl font-bold text-amber-600">8,000</span>
                <span className="text-muted-foreground ml-1">元</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-amber-600 font-bold">✓</span> 第一天研習會入場資格</li>
              </ul>
            </div>
            <div className="glass-card rounded-2xl p-6 hover-lift">
              <h3 className="text-lg font-bold text-center mb-1">交流比賽通行票</h3>
              <div className="text-center mb-4">
                <span className="text-4xl font-bold text-purple-600">5,000</span>
                <span className="text-muted-foreground ml-1">元</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-purple-600 font-bold">✓</span> 第二天交流比賽報名資格</li>
              </ul>
            </div>
          </div>

          {proSuccess ? (
            <div className="max-w-2xl mx-auto bg-amber-50 border-2 border-amber-200 rounded-3xl p-12 text-center shadow-lg">
              <CheckCircle2 className="w-24 h-24 text-amber-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-amber-800 mb-4">報名資料已送出！</h2>
              <p className="text-amber-700 text-lg mb-4">感謝您報名傳奇工匠研討會。</p>
              <div className="bg-white rounded-2xl p-6 text-left max-w-sm mx-auto shadow-sm border border-amber-100 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-muted-foreground">姓名：</div>
                  <div className="font-bold text-right">{proFormData.parentName}</div>
                  <div className="text-muted-foreground">聯絡電話：</div>
                  <div className="font-bold text-right">{proFormData.phone}</div>
                  {proFormData.email && (<>
                    <div className="text-muted-foreground">Email：</div>
                    <div className="font-bold text-right break-all">{proFormData.email}</div>
                  </>)}
                  <div className="text-muted-foreground">票種：</div>
                  <div className="font-bold text-right text-amber-600">{proTicketType}</div>
                </div>
              </div>
              {proConfirmedToken && (
                <div className="bg-white rounded-2xl p-6 max-w-sm mx-auto shadow-sm border border-amber-100 mb-6">
                  <h3 className="font-bold mb-2 flex items-center justify-center gap-2 text-amber-700">
                    <QrCode size={20} /> 您的入場 QR Code
                  </h3>
                  <p className="text-xs text-muted-foreground text-center mb-4">入場時請出示此 QR Code 進行報到。{proFormData.email ? "已寄送至您的 Email。" : ""}</p>
                  <img
                    src={`/api/qr/${encodeURIComponent(proConfirmedToken)}`}
                    alt="報到 QR"
                    className="w-full max-w-[220px] mx-auto border rounded-lg p-2 bg-white"
                  />
                </div>
              )}
              <p className="text-amber-600 text-sm mb-6">主辦單位將於收到報名後，以電話或簡訊通知繳費方式。</p>
              <button
                onClick={() => { setProSuccess(false); setProFormData({ parentName: "", phone: "", email: "" }); setProTicketType(""); setProConfirmedToken(null); }}
                className="text-amber-600 font-bold hover:underline"
              >
                繼續報名
              </button>
            </div>
          ) : (
            <>
              <div className="glass-card rounded-3xl p-8 md:p-10 relative overflow-hidden mb-8 max-w-2xl mx-auto">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-full -z-10"></div>
                <h2 className="text-2xl font-bold mb-8 border-b pb-4">填寫同行報名資料</h2>
                <form onSubmit={handleProSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Users size={16} className="text-amber-500" /> 姓名 <span className="text-destructive">*</span>
                    </label>
                    <input
                      required type="text" value={proFormData.parentName}
                      onChange={e => setProFormData({...proFormData, parentName: e.target.value})}
                      placeholder="例如：王小明"
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Phone size={16} className="text-amber-500" /> 聯絡電話 <span className="text-destructive">*</span>
                    </label>
                    <input
                      required type="tel" value={proFormData.phone}
                      onChange={e => setProFormData({...proFormData, phone: e.target.value})}
                      placeholder="例如：0912345678"
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Mail size={16} className="text-amber-500" /> Email
                      <span className="text-xs text-muted-foreground font-normal">(填寫後將寄送報名確認信與 QR Code)</span>
                    </label>
                    <input
                      type="email" value={proFormData.email}
                      onChange={e => setProFormData({...proFormData, email: e.target.value})}
                      placeholder="例如：name@example.com"
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Ticket size={16} className="text-amber-500" /> 票種選擇 <span className="text-destructive">*</span>
                    </label>
                    <select
                      required value={proTicketType}
                      onChange={e => setProTicketType(e.target.value)}
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all text-lg appearance-none cursor-pointer"
                    >
                      <option value="">請選擇票種</option>
                      <option value="四天通行票">四天通行票 — 12,000 元</option>
                      <option value="研習會通行票">研習會通行票 — 8,000 元</option>
                      <option value="交流比賽通行票">交流比賽通行票 — 5,000 元</option>
                    </select>
                  </div>
                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={createMutation.isPending || !proTicketType}
                      className="w-full py-5 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-amber-500 to-amber-600 shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all flex items-center justify-center gap-2"
                    >
                      {createMutation.isPending ? "處理中..." : !proTicketType ? "請選擇票種" : "確認送出報名"}
                    </button>
                  </div>
                </form>
              </div>
              <div className="bg-amber-50 text-amber-800 p-5 rounded-2xl text-sm border border-amber-200 max-w-2xl mx-auto">
                <p className="font-bold mb-2">注意事項</p>
                <ul className="space-y-1 text-amber-700">
                  <li>・報名後將由主辦單位確認並通知繳費方式</li>
                  <li>・7/23（四）、7/24（五）為業內封閉活動，僅限報名同行入場</li>
                  <li>・如有疑問請洽服務專線 02-2720-8889</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </section>

      <section id="contestants" className="py-20 px-4 max-w-7xl mx-auto w-full bg-muted/30 rounded-3xl my-4 scroll-mt-24">
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
                <div className="px-6 pb-6">
                  <ContestantVoteButton
                    contestantId={member.id}
                    count={voteData.countFor(member.id)}
                    voted={voteData.didVote(member.id)}
                    token={voteData.token}
                  />
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

      <section className="py-16 bg-gradient-to-b from-green-50/50 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl mb-4">想帶家人朋友看展覽嗎？</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            7/25-26 兩天對外開放，一般民眾也可入場觀賞氣球展覽、表演和親子活動。
          </p>
          <Link
            href="/carnival"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            前往氣球嘉年華 <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}
