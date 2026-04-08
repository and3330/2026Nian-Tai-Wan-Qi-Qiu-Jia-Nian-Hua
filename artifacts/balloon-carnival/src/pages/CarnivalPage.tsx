import { Link } from "wouter";
import { ArrowRight, Cpu, Baby, Sparkles, Eye, Calendar, Clock, MapPin, Ticket, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const carnivalActivities = [
  {
    icon: Cpu,
    title: "AI 教育科技",
    desc: "結合人工智慧與氣球藝術的創新體驗，探索科技如何為傳統技藝注入新生命。互動裝置讓大小朋友都能感受 AI 的魅力。",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    icon: Baby,
    title: "親子手作坊",
    desc: "由專業氣球老師帶領，親子一同動手做氣球造型！適合所有年齡層，每組 150 元（依小朋友人數計算）。",
    color: "text-green-600",
    bg: "bg-green-50",
    price: "150 元/組",
  },
  {
    icon: Sparkles,
    title: "氣球表演",
    desc: "精彩的舞臺氣球秀！專業表演者帶來令人驚嘆的氣球藝術表演，展現氣球造型的無限可能，適合全家觀賞。",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    icon: Eye,
    title: "比賽展件參觀",
    desc: "業內同行在前兩日完成的精美作品 — 中型氣球雕塑、氣球人偶、外送花束等，全部公開展覽，供遊客近距離欣賞與拍照。",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
];

const publicSchedule = [
  {
    date: "7/25（六）",
    hours: "10:00 - 19:00",
    items: [
      { time: "10:00", event: "開放入場", desc: "展覽區全面開放" },
      { time: "13:00", event: "12 分鐘快手比賽（舞臺區）", desc: "觀看選手精彩競速對決" },
      { time: "13:30", event: "親子氣球表演", desc: "適合全家觀賞的趣味表演" },
      { time: "14:00", event: "親子手作坊", desc: "親子 DIY 體驗（150元/組）" },
      { time: "14:30", event: "氣球表演", desc: "精彩的氣球藝術表演" },
      { time: "15:30", event: "藝術服裝走秀遊行（唯一場）", desc: "全場僅此一場，不可錯過！" },
    ],
  },
  {
    date: "7/26（日）",
    hours: "10:00 - 17:00",
    items: [
      { time: "10:00", event: "開放入場", desc: "展覽區全面開放" },
      { time: "13:30", event: "親子氣球表演", desc: "適合全家觀賞的趣味表演" },
      { time: "14:00", event: "親子手作坊", desc: "親子 DIY 體驗（150元/組）" },
      { time: "14:30", event: "氣球表演", desc: "精彩的氣球藝術表演" },
    ],
  },
];

export default function CarnivalPage() {
  return (
    <div className="flex flex-col">
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/10 via-background to-background"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/20 text-secondary font-bold text-sm mb-6">
            <Star size={16} /> 7/25（六）& 7/26（日）對外開放
          </div>
          <h1 className="font-display text-4xl md:text-6xl mb-6 text-foreground">
            氣球<span className="text-carnival">嘉年華</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-4">
            歡迎一般民眾入場！精彩的氣球展覽、舞臺表演、親子手作坊、AI 教育科技體驗，全家大小都能盡情同樂。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white shadow-sm">
              <Calendar className="text-primary w-5 h-5" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground font-bold">活動日期</div>
                <div className="font-bold text-foreground text-sm">7/25（六）& 7/26（日）</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white shadow-sm">
              <MapPin className="text-secondary w-5 h-5" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground font-bold">活動地點</div>
                <div className="font-bold text-foreground text-sm">臺北瓶蓋工廠（南港）</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-5 py-3 rounded-2xl border border-white shadow-sm">
              <Clock className="text-accent-foreground w-5 h-5" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground font-bold">開放時間</div>
                <div className="font-bold text-foreground text-sm">10:00 起</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/registration"
              className="px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              立即購票 <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4">
            <Sparkles size={16} /> 四大亮點
          </div>
          <h2 className="font-display text-4xl mb-4">嘉年華精彩活動</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            適合全家大小一起來體驗，感受氣球藝術的歡樂與魅力
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {carnivalActivities.map((item, idx) => (
            <div key={idx} className="glass-card rounded-2xl p-8 hover-lift group relative overflow-hidden">
              {item.price && (
                <div className="absolute top-4 right-4">
                  <span className={cn("text-xs font-bold px-3 py-1 rounded-full", item.bg, item.color)}>
                    {item.price}
                  </span>
                </div>
              )}
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center mb-5", item.bg)}>
                <item.icon size={32} className={item.color} />
              </div>
              <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors">{item.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/20 text-accent-foreground font-bold text-sm mb-4">
              <Clock size={16} /> 活動時程
            </div>
            <h2 className="font-display text-4xl mb-4">公開日程表</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              7/25（六）與 7/26（日）兩天的公開活動時程
            </p>
          </div>

          <div className="space-y-10">
            {publicSchedule.map((day, dayIdx) => (
              <div key={dayIdx}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-4 py-2 rounded-full bg-primary text-white font-bold text-sm">
                    {day.date}
                  </div>
                  <span className="text-muted-foreground font-medium">{day.hours}</span>
                </div>
                <div className="space-y-3">
                  {day.items.map((item, idx) => (
                    <div key={idx} className="glass-card rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
                      <div className="w-16 text-right shrink-0">
                        <span className="text-sm font-bold text-primary">{item.time}</span>
                      </div>
                      <div className="w-px h-8 bg-border"></div>
                      <div>
                        <h4 className="font-bold">{item.event}</h4>
                        <p className="text-muted-foreground text-sm">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 text-green-600 font-bold text-sm mb-4">
            <Ticket size={16} /> 票價資訊
          </div>
          <h2 className="font-display text-4xl mb-4">一般觀眾票價</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto mb-8">
          <div className="glass-card rounded-2xl p-8 text-center hover-lift">
            <h3 className="text-lg font-bold mb-2">單日票</h3>
            <div className="mb-2">
              <span className="text-5xl font-bold text-green-600">200</span>
              <span className="text-muted-foreground ml-1 text-lg">元</span>
            </div>
            <p className="text-sm text-muted-foreground">7/25 或 7/26 擇一日入場</p>
          </div>
          <div className="glass-card rounded-2xl p-8 text-center hover-lift relative border-2 border-green-200">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full">
              省 100 元
            </div>
            <h3 className="text-lg font-bold mb-2">兩日套票</h3>
            <div className="mb-2">
              <span className="text-5xl font-bold text-green-600">300</span>
              <span className="text-muted-foreground ml-1 text-lg">元</span>
            </div>
            <p className="text-sm text-muted-foreground">7/25 + 7/26 兩日皆可入場</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-700 max-w-xl mx-auto mb-8">
          <p className="font-bold mb-1">入場須知</p>
          <ul className="space-y-1 text-blue-600">
            <li>・每日限量 500 名，建議提前線上購票</li>
            <li>・6 歲以下兒童可免票隨大人入場</li>
            <li>・7/23（四）、7/24（五）為業內封閉活動，不對外開放</li>
          </ul>
        </div>

        <div className="text-center">
          <Link
            href="/registration"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            立即購票 <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-amber-50/50 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl mb-4">你是氣球業界同行嗎？</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            如果你是氣球業界人士，想參加研習會、交流活動或比賽，請前往同行交流會頁面瞭解詳情。
          </p>
          <Link
            href="/contestants"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            前往同行交流會 <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}
