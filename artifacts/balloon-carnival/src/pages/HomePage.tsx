import { useListNews, useGetRegistrationAvailability } from "@workspace/api-client-react";
import { Calendar, MapPin, Clock, ArrowRight, Ticket, Sparkles, ChevronRight, PartyPopper, Baby, Eye, Cpu, ShieldCheck, Star, ZoomIn, X } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/EventCountdown";

export default function HomePage() {
  const { data: news } = useListNews();
  const { data: availability } = useGetRegistrationAvailability({
    query: { queryKey: ["getRegistrationAvailability"], refetchInterval: 30000 },
  });
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!zoomedImage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomedImage(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomedImage]);

  const latestNews = news?.slice(0, 3);

  const publicAvailability = availability?.filter(d => {
    const day = new Date(d.date).getDate();
    return day >= 25;
  });

  const highlights = [
    {
      icon: Eye,
      title: "巨型氣球展覽",
      desc: "近距離欣賞中型氣球雕塑、氣球人偶、外送花束等業界精品作品。",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Sparkles,
      title: "舞臺氣球秀",
      desc: "專業表演團隊帶來的精彩氣球藝術表演，全家共賞氣球的無限可能。",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      icon: Baby,
      title: "親子手作坊",
      desc: "專業老師帶領親子一起做氣球造型，每組 150 元，老少咸宜。",
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      icon: Cpu,
      title: "AI 教育科技",
      desc: "結合 AI 與氣球藝術的互動裝置，為傳統技藝注入科技新生命。",
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
  ];

  const dayPrograms = [
    {
      date: "7/25",
      weekday: "六",
      label: "嘉年華表演日",
      accent: "from-amber-400 to-orange-500",
      tint: "bg-amber-50/70 border-amber-200",
      chip: "bg-amber-100 text-amber-700",
      items: [
        { time: "11:00", title: "12 分鐘氣球快手表演", hl: true },
        { time: "13:00", title: "嘉年華親子表演（魔術・個人技）" },
        { time: "15:00", title: "藝術服裝遊行", hl: true },
        { time: "16:00", title: "親子表演與頒獎" },
        { time: "18:00", title: "波波繪本親子劇場", note: "另需報名" },
      ],
    },
    {
      date: "7/26",
      weekday: "日",
      label: "全國氣球比賽日",
      accent: "from-rose-400 to-pink-500",
      tint: "bg-rose-50/70 border-rose-200",
      chip: "bg-rose-100 text-rose-700",
      items: [
        { time: "11:00", title: "嘉年華親子劇場" },
        { time: "13:00", title: "兒童組比賽（32 人）", hl: true },
        { time: "15:00", title: "成人組比賽（64 人）", hl: true },
      ],
    },
  ];

  return (
    <div className="flex flex-col">
      {/* HERO — 純粹聚焦氣球嘉年華售票 */}
      <section className="relative w-full bg-gradient-to-b from-sky-50 via-rose-50/40 to-background overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 pt-8 md:pt-12 pb-10 md:pb-14">
          <div className="relative rounded-3xl overflow-hidden shadow-xl shadow-primary/10 border border-white/60 bg-white">
            <img
              src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
              alt="2026 臺灣氣球嘉年華 ・ 夢想升空・氣球無限"
              className="w-full h-auto block"
            />
            <div className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-black/45 via-black/15 to-transparent pt-16 pb-5 md:pb-8 px-4">
              <div className="pointer-events-auto flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/carnival#register"
                  className="px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-base md:text-lg bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-black/30 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                  data-testid="hero-cta-buy"
                >
                  <Ticket size={20} /> 立即購票入場
                </Link>
                <Link
                  href="/carnival"
                  className="px-5 md:px-6 py-2.5 md:py-3.5 rounded-full font-medium text-sm md:text-base text-foreground bg-white/95 backdrop-blur border border-white hover:bg-white transition-all flex items-center gap-2"
                >
                  查看活動詳情 <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 活動資訊 + 即時剩餘票數 — 統一資訊條 */}
      <section className="border-y bg-white">
        <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4 items-stretch">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="text-primary w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">公開場次</div>
              <div className="font-bold text-foreground text-sm">7/25 (六) – 7/26 (日)</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <MapPin className="text-secondary w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">活動地點</div>
              <div className="font-bold text-foreground text-sm">臺北瓶蓋工廠 (南港)</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/30 flex items-center justify-center shrink-0">
              <Clock className="text-accent-foreground w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">開放時間</div>
              <div className="font-bold text-foreground text-sm">10:00 – 18:00</div>
            </div>
          </div>
          <div className="flex items-center gap-3 md:border-l md:pl-6">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <PartyPopper className="text-rose-500 w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">即時剩餘名額</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                {publicAvailability?.map(day => (
                  <span key={day.date} className="text-sm" data-testid={`home-remaining-${day.date}`}>
                    <span className="text-muted-foreground mr-1">{new Date(day.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>
                    <span className={cn(
                      "font-bold",
                      day.remaining <= 0 ? "text-destructive" : day.remaining < 50 ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {day.remaining <= 0 ? "已額滿" : <>剩 <AnimatedNumber value={day.remaining} /></>}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 嘉年華精彩內容 — 純圖片展示 */}
      <section className="py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4">
              <Sparkles size={16} /> 活動亮點
            </div>
            <h2 className="font-display text-3xl md:text-5xl">嘉年華精彩內容</h2>
          </div>

          <div className="rounded-3xl overflow-hidden shadow-xl shadow-primary/10 border border-white/60 bg-white">
            <img
              src={`${import.meta.env.BASE_URL}images/highlights.png`}
              alt="2026 臺灣氣球嘉年華精彩內容"
              className="w-full h-auto block"
            />
          </div>
        </div>
      </section>

      {/* 票價方案 — 主要購票轉換區 */}
      <section className="py-16 md:py-20 px-4 max-w-5xl mx-auto w-full border-t">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 text-green-600 font-bold text-sm mb-4">
            <Ticket size={16} /> 票價方案
          </div>
          <h2 className="font-display text-4xl mb-4">選擇你的票種</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            選擇最適合的票種，提前線上預約以確保入場名額
          </p>
        </div>

        <button
          type="button"
          onClick={() => setZoomedImage(`${import.meta.env.BASE_URL}images/tickets-banner.png`)}
          className="group block w-full max-w-5xl mx-auto mb-10 rounded-3xl overflow-hidden shadow-2xl shadow-primary/15 border border-white/60 bg-white relative cursor-zoom-in focus:outline-none focus:ring-4 focus:ring-primary/30"
          aria-label="放大查看購票圖片"
        >
          <img
            src={`${import.meta.env.BASE_URL}images/tickets-banner.png`}
            alt="2026 臺灣氣球嘉年華購票"
            className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 text-white text-xs font-bold backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn size={14} /> 點擊放大
          </span>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto pt-4">
          <Link href="/carnival#register" className="group glass-card rounded-3xl p-8 hover-lift border-2 border-transparent hover:border-primary/40 transition-all relative block">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Ticket size={28} className="text-primary" />
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">彈性選擇</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">單日票</h3>
            <p className="text-sm text-muted-foreground mb-5">7/25（六）或 7/26（日）擇一日入場</p>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-5xl font-bold text-primary">200</span>
              <span className="text-lg text-muted-foreground">元 / 人</span>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground mb-6">
              <p className="flex items-center gap-2"><ShieldCheck size={14} className="text-green-500" /> 全展區 ・ 舞臺表演 ・ 比賽展件</p>
              <p className="flex items-center gap-2"><ShieldCheck size={14} className="text-green-500" /> 6 歲以下兒童免票隨行</p>
            </div>
            <span className="inline-flex items-center gap-2 text-primary font-bold text-sm group-hover:gap-3 transition-all">
              選擇單日票 <ArrowRight size={16} />
            </span>
          </Link>

          <Link href="/carnival#register" className="group glass-card rounded-3xl p-8 pt-10 hover-lift border-2 border-primary shadow-xl shadow-primary/10 transition-all relative block">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
              最划算 ・ 省 100 元
            </div>
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                <Star size={28} className="text-secondary" />
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-secondary/15 text-secondary whitespace-nowrap">人氣推薦</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">兩日套票</h3>
            <p className="text-sm text-muted-foreground mb-5">7/25 + 7/26 兩日完整體驗</p>
            <div className="flex items-baseline gap-1 mb-6 flex-wrap">
              <span className="text-5xl font-bold text-secondary">300</span>
              <span className="text-lg text-muted-foreground">元 / 人</span>
              <span className="text-sm text-muted-foreground line-through ml-2">原價 400</span>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground mb-6">
              <p className="flex items-center gap-2"><ShieldCheck size={14} className="text-green-500" /> 兩日無限暢遊・所有節目通通看</p>
              <p className="flex items-center gap-2"><ShieldCheck size={14} className="text-green-500" /> 含全國氣球比賽完整觀賽</p>
            </div>
            <span className="inline-flex items-center gap-2 text-secondary font-bold text-sm group-hover:gap-3 transition-all">
              選擇兩日套票 <ArrowRight size={16} />
            </span>
          </Link>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            親子手作坊另需現場購票 <span className="font-bold text-foreground">150 元/組</span>　・　6 歲以下兒童免票隨大人入場
          </p>
        </div>
      </section>

      {/* 最新消息 */}
      {latestNews && latestNews.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 font-bold text-sm mb-4">
                  <Sparkles size={16} /> 最新動態
                </div>
                <h2 className="font-display text-4xl mb-2">最新消息</h2>
                <p className="text-muted-foreground text-lg">掌握嘉年華的最新公告與活動資訊</p>
              </div>
              <Link href="/news" className="flex items-center gap-2 text-primary font-bold hover:underline">
                查看全部消息 <ChevronRight size={18} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestNews.map(article => (
                <Link key={article.id} href={`/news/${article.id}`} className="glass-card rounded-2xl p-6 hover-lift group block">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Calendar size={12} />
                    {article.createdAt ? formatDate(String(article.createdAt)) : '最新'}
                  </div>
                  <h3 className="text-lg font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
                    {article.summary || article.content?.substring(0, 100)}
                  </p>
                  <span className="text-primary text-sm font-medium flex items-center gap-1">
                    閱讀全文 <ArrowRight size={14} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 主辦・協辦單位 */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">Organizers</h3>
            <h2 className="font-display text-4xl">主辦・協辦單位</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[
              { role: "主辦單位", name: "摸氣球的毛", logo: "images/sponsors/organizer.png", url: "https://www.facebook.com/Momoballoon/", accent: "from-primary/15 to-primary/5", badge: "bg-primary/15 text-primary" },
              { role: "協辦單位", name: "ICTA 社團法人國際兒童才藝協會", logo: "images/sponsors/coorganizer.png", url: "http://www.ictaorg.org/", accent: "from-secondary/15 to-secondary/5", badge: "bg-secondary/15 text-secondary" },
              { role: "協辦單位", name: "育邦文化教育科技股份有限公司", logo: "images/sponsors/coorganizer2.png", url: "https://cmsedu-life.com/", accent: "from-secondary/15 to-secondary/5", badge: "bg-secondary/15 text-secondary" },
              { role: "協辦單位", name: "波波繪本屋", logo: "images/sponsors/coorganizer3.jpg", url: "https://www.instagram.com/bobo.storyhouse/", accent: "from-secondary/15 to-secondary/5", badge: "bg-secondary/15 text-secondary" },
            ].map(o => (
              <a
                key={o.name}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${o.role}：${o.name}（開新分頁）`}
                className="relative glass-card rounded-3xl overflow-hidden hover-lift transition-all block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none", o.accent)} />
                <div className="relative z-10 p-8 md:p-10 flex flex-col items-center text-center">
                  <span className={cn("inline-block px-3 py-1 rounded-full text-xs font-bold mb-6 tracking-wider", o.badge)}>
                    {o.role}
                  </span>
                  <div className="w-full h-56 md:h-64 rounded-2xl bg-white shadow-sm border border-white/80 flex items-center justify-center p-6 md:p-8 mb-6">
                    <img
                      src={`${import.meta.env.BASE_URL}${o.logo}`}
                      alt={o.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <h4 className="font-display text-2xl md:text-3xl leading-tight">{o.name}</h4>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 贊助廠商 */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">感謝贊助</h3>
            <h2 className="font-display text-3xl">合作夥伴</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 max-w-6xl mx-auto">
            {[
              { name: "台北氣球派對", logo: "images/sponsors/taipei-balloon.jpg" },
              { name: "曄達氣球", logo: "images/sponsors/yeda.jpg" },
              { name: "彩飛屋", logo: "images/sponsors/caifeiwu.svg" },
              { name: "藝人有限公司", logo: null },
              { name: "氣球屋", logo: "images/sponsors/balloon-house.png" },
            ].map(s => (
              <div
                key={s.name}
                className="glass-card rounded-2xl p-5 md:p-6 flex flex-col items-center justify-center gap-3 aspect-square hover-lift transition-all"
              >
                {s.logo ? (
                  <div className="flex-1 w-full flex items-center justify-center min-h-0">
                    <img
                      src={`${import.meta.env.BASE_URL}${s.logo}`}
                      alt={s.name}
                      className="max-h-20 md:max-h-24 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex-1 w-full flex items-center justify-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/15 flex items-center justify-center">
                      <Sparkles size={28} className="text-primary/70" />
                    </div>
                  </div>
                )}
                <p className="text-sm md:text-base font-bold text-center text-foreground/85 leading-tight">{s.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 常見問題 */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl mb-4">常見問題</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: "需要購買門票嗎？", a: "活動日（7/25、7/26）單日票 200 元、兩日套票 300 元，請提前在官網預約購票。每日限量 500 名，建議儘早預約。" },
              { q: "活動地點在哪裡？怎麼去？", a: "活動地點為臺北瓶蓋工廠（台北市南港區南港路二段13號）。可搭乘捷運至南港站1號出口，步行約5分鐘即可到達。" },
              { q: "小朋友適合參加嗎？", a: "非常適合！嘉年華特別設有親子區、DIY 工作坊和兒童遊戲區。6 歲以下兒童可免預約隨大人入場。" },
              { q: "可以現場報名嗎？", a: "建議提前線上預約，確保有入場名額。若當日尚有餘額，也可現場排隊候補入場。" },
              { q: "活動有提供停車場嗎？", a: "臺北瓶蓋工廠設有地下停車場，也可利用南港車站周邊停車場。建議搭乘大眾交通工具前往。" },
            ].map((item, idx) => (
              <details key={idx} className="glass-card rounded-2xl group">
                <summary className="p-5 font-bold cursor-pointer flex items-center justify-between hover:text-primary transition-colors list-none">
                  {item.q}
                  <ChevronRight size={18} className="text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-5 pb-5 text-muted-foreground leading-relaxed border-t pt-4 mx-5">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 最終 CTA — 純粹售票 */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto glass-card rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/5 rounded-br-full"></div>
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-secondary/5 rounded-tl-full"></div>
          <div className="relative z-10">
            <h2 className="font-display text-3xl md:text-4xl mb-4">準備好了嗎？</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              7/25-26 兩日限定的氣球奇幻旅程，現在就預約你的入場名額，和家人朋友一起創造美好回憶！
            </p>
            <Link
              href="/carnival#register"
              className="inline-flex items-center gap-2 px-10 py-5 rounded-full font-bold text-xl bg-gradient-to-r from-primary to-secondary text-white shadow-xl shadow-primary/40 hover:shadow-2xl hover:-translate-y-1 transition-all"
            >
              <Ticket size={22} /> 立即購票入場
            </Link>
            <p className="text-sm text-muted-foreground mt-4">每日限量 500 名・額滿為止</p>
          </div>
        </div>
      </section>

      {/* 圖片放大檢視 Lightbox */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="放大檢視圖片"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
            className="absolute top-4 right-4 md:top-6 md:right-6 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white flex items-center justify-center transition-colors"
            aria-label="關閉"
          >
            <X size={22} />
          </button>
          <img
            src={zoomedImage}
            alt="放大檢視"
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
