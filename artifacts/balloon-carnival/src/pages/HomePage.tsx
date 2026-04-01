import { useListNews, useListContestants, useListSponsors, useGetRegistrationAvailability } from "@workspace/api-client-react";
import { Calendar, MapPin, Clock, ArrowRight, Tent, Ticket, Star, Users, Sparkles, Camera, Music, Heart, Crown, ChevronRight, PartyPopper, Baby, Gift, Handshake, BookOpen, Zap, Flower2, Shirt } from "lucide-react";
import { Link } from "wouter";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { data: news } = useListNews();
  const { data: contestants } = useListContestants();
  const { data: sponsors } = useListSponsors();
  const { data: availability } = useGetRegistrationAvailability();

  const latestNews = news?.slice(0, 3);
  const featuredMembers = (contestants || []).slice(0, 4);
  const totalRemaining = availability?.reduce((sum, d) => sum + d.remaining, 0) || 0;
  const totalCapacity = availability?.reduce((sum, d) => sum + d.totalCapacity, 0) || 1500;

  const highlights = [
    { icon: Tent, title: "5 大主題活動", desc: "中型氣球雕塑、人偶、12 分鐘快手、藝術服裝走秀遊行、外送花束，精彩一次體驗", color: "text-primary", bg: "bg-primary/10" },
    { icon: Handshake, title: "氣球同行交流會", desc: "集結業界前輩與新銳，透過座談、工作坊與共同創作，傳承寶貴技藝", color: "text-amber-500", bg: "bg-amber-50" },
    { icon: Camera, title: "互動體驗區", desc: "親子 DIY 氣球工作坊、巨型氣球迷宮、AR 互動拍照打卡點", color: "text-secondary", bg: "bg-secondary/10" },
    { icon: Music, title: "舞台表演", desc: "每日精彩氣球秀、魔術表演、街頭藝人演出，感受嘉年華的歡樂氛圍", color: "text-violet-500", bg: "bg-violet-50" },
    { icon: Gift, title: "限定周邊商品", desc: "嘉年華獨家設計氣球造型周邊、紀念品，現場限量發售", color: "text-rose-500", bg: "bg-rose-50" },
    { icon: Baby, title: "親子友善空間", desc: "設有哺乳室、無障礙設施、幼童遊戲區，全家大小都能盡情同樂", color: "text-green-500", bg: "bg-green-50" },
  ];

  const scheduleItems = [
    { time: "Day 1", event: "7/23（四）研習會", desc: "業內封閉 — 大師授課教學、開幕報到" },
    { time: "Day 2", event: "7/24（五）業內比賽", desc: "業內封閉 — 中型氣球、人偶比賽 & 晚間同行交流" },
    { time: "Day 3", event: "7/25（六）公開活動日", desc: "對外開放 — 12分鐘快手、藝術服裝走秀遊行、親子表演、工作坊" },
    { time: "Day 4", event: "7/26（日）公開活動日", desc: "對外開放 — 作品展覽、親子表演、氣球工作坊" },
  ];

  return (
    <div className="flex flex-col">
      <section className="relative w-full py-20 lg:py-32 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
            alt="Colorful hot air balloons"
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur border border-primary/20 text-primary font-bold text-sm tracking-widest uppercase shadow-sm">
            SUMMER 2026 EVENT
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-foreground mb-6 drop-shadow-sm">
            2026 臺灣氣球<span className="text-carnival">嘉年華</span>
          </h1>
          <p className="text-xl md:text-2xl text-foreground/80 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
            亞洲最大室內氣球藝術盛典！探索令人驚嘆的巨型氣球裝置，體驗充滿歡樂與奇幻的夏日派對。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white shadow-sm">
              <Calendar className="text-primary w-6 h-6" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground font-bold">活動日期</div>
                <div className="font-bold text-foreground">7/23 (四) - 7/26 (日)</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white shadow-sm">
              <MapPin className="text-secondary w-6 h-6" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground font-bold">活動地點</div>
                <div className="font-bold text-foreground">臺北瓶蓋工廠 (南港)</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white shadow-sm">
              <Clock className="text-accent-foreground w-6 h-6" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground font-bold">開放時間</div>
                <div className="font-bold text-foreground">10:00 - 18:00</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/registration"
              className="px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              立即報名訂票 <ArrowRight size={20} />
            </Link>
            <Link
              href="/news"
              className="px-8 py-4 rounded-full font-bold text-lg bg-white text-foreground border-2 border-transparent hover:border-border shadow-sm hover:shadow-md transition-all"
            >
              查看最新消息
            </Link>
          </div>
        </div>
      </section>

      <section className="py-6 bg-gradient-to-r from-primary via-secondary to-accent relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-white">
            <div className="flex items-center gap-3">
              <PartyPopper className="w-6 h-6" />
              <span className="font-bold text-lg">即日起開放報名！每日限量 500 名</span>
            </div>
            <div className="flex items-center gap-6">
              {availability?.map(day => (
                <div key={day.date} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{new Date(day.date).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-bold",
                    day.remaining <= 0 ? "bg-red-500/30 text-red-100" : day.remaining < 50 ? "bg-yellow-500/30 text-yellow-100" : "bg-white/20"
                  )}>
                    {day.remaining <= 0 ? "已額滿" : `剩 ${day.remaining} 名`}
                  </span>
                </div>
              ))}
              <Link href="/registration" className="px-4 py-1.5 bg-white text-primary rounded-full text-sm font-bold hover:bg-white/90 transition-colors">
                馬上報名
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4">
            <Sparkles size={16} /> 活動亮點
          </div>
          <h2 className="font-display text-4xl mb-4">精彩活動一次看</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            四天的氣球嘉年華，準備了超多精彩活動等你來體驗
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {highlights.map((item, idx) => (
            <div key={idx} className="glass-card rounded-2xl p-6 hover-lift group">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-4", item.bg)}>
                <item.icon size={28} className={item.color} />
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-4 max-w-7xl mx-auto w-full relative">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary font-bold text-sm mb-4">
            <Star size={16} /> 五大主題
          </div>
          <h2 className="font-display text-4xl mb-4">主題活動</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            五大精彩主題活動，從展覽到比賽、從走秀到手作，帶你體驗氣球藝術的無限魅力！
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Sparkles,
              title: "中型氣球雕塑",
              desc: "主題「生活的小幸福」— 4～6 組參賽者在 8 小時內現場創作大型氣球造型，完賽作品公開展覽。",
              color: "text-blue-500",
              bg: "bg-blue-50",
              badge: "展覽 + 比賽",
            },
            {
              icon: Users,
              title: "氣球人偶",
              desc: "主題「調皮的小時候」— 以氣球製作大型人偶造型，展現角色塑造與結構技巧，作品於展區公開展覽。",
              color: "text-purple-500",
              bg: "bg-purple-50",
              badge: "展覽 + 比賽",
            },
            {
              icon: Zap,
              title: "12 分鐘快手",
              desc: "舞臺公開競速賽！參賽者在 12 分鐘內快速完成作品，現場觀眾可近距離觀看精彩對決。",
              color: "text-orange-500",
              bg: "bg-orange-50",
              badge: "舞臺公開賽",
            },
            {
              icon: Shirt,
              title: "藝術服裝走秀遊行",
              desc: "主題「花語」— 以氣球製作可穿戴的藝術服裝。7/25（六）15:30 全場唯一一場走秀遊行，千萬不要錯過！",
              color: "text-pink-500",
              bg: "bg-pink-50",
              badge: "走秀遊行",
            },
            {
              icon: Flower2,
              title: "外送花束",
              desc: "主題不限 — 在 2 小時內以氣球製作精美花束作品，考驗細膩的塑形與配色能力，完成作品於展區展出。",
              color: "text-green-500",
              bg: "bg-green-50",
              badge: "展覽 + 比賽",
            },
          ].map((item, idx) => (
            <div key={idx} className="glass-card rounded-2xl p-8 hover-lift group relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className={cn("text-xs font-bold px-3 py-1 rounded-full", item.bg, item.color)}>
                  {item.badge}
                </span>
              </div>
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5", item.bg)}>
                <item.icon size={28} className={item.color} />
              </div>
              <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{item.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/20 text-accent-foreground font-bold text-sm mb-4">
              <Clock size={16} /> 每日流程
            </div>
            <h2 className="font-display text-4xl mb-4">活動日程表</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              每日精心安排的活動流程，讓你一整天都精彩不斷
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <div className="absolute left-[60px] top-0 bottom-0 w-0.5 bg-border"></div>
              <div className="space-y-6">
                {scheduleItems.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-6 group">
                    <div className="w-[60px] text-right shrink-0">
                      <span className="font-bold text-lg text-primary">{item.time}</span>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[13px] top-2 w-6 h-6 rounded-full bg-white border-2 border-primary flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-colors z-10">
                        <div className="w-2 h-2 rounded-full bg-primary group-hover:bg-white transition-colors"></div>
                      </div>
                    </div>
                    <div className="glass-card rounded-2xl p-5 flex-1 group-hover:border-primary/30 transition-colors ml-4">
                      <h4 className="font-bold text-lg mb-1">{item.event}</h4>
                      <p className="text-muted-foreground text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {featuredMembers.length > 0 && (
        <section className="py-20 px-4 max-w-7xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 text-amber-600 font-bold text-sm mb-4">
                <Handshake size={16} /> 同行交流會
              </div>
              <h2 className="font-display text-4xl mb-2">交流夥伴</h2>
              <p className="text-muted-foreground text-lg">來自各地的氣球同行，帶著故事與技藝齊聚一堂</p>
            </div>
            <Link href="/contestants" className="flex items-center gap-2 text-primary font-bold hover:underline">
              了解更多與完整議程 <ChevronRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {featuredMembers.map((c) => (
              <div key={c.id} className="glass-card rounded-2xl overflow-hidden hover-lift group">
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
                      <Users size={48} className="text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h4 className="font-bold text-lg truncate">{c.name}</h4>
                  <div className="flex items-center gap-1 mt-1">
                    <BookOpen size={14} className="text-amber-500" />
                    <span className="text-sm font-medium text-amber-600">交流夥伴</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {latestNews && latestNews.length > 0 && (
        <section className="py-20 bg-muted/30">
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

      <section className="py-20 px-4 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4">
            <Ticket size={16} /> 票務資訊
          </div>
          <h2 className="font-display text-4xl mb-4">入場須知</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="glass-card rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Ticket size={28} className="text-green-500" />
            </div>
            <h4 className="font-bold text-lg mb-2">線上購票</h4>
            <p className="text-muted-foreground text-sm">活動日單日票 200 元、兩日套票 300 元，線上預約購票更方便</p>
          </div>
          <div className="glass-card rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-blue-500" />
            </div>
            <h4 className="font-bold text-lg mb-2">每日限量 500 名</h4>
            <p className="text-muted-foreground text-sm">為維護參觀品質，每日限量入場，額滿為止</p>
          </div>
          <div className="glass-card rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <Heart size={28} className="text-violet-500" />
            </div>
            <h4 className="font-bold text-lg mb-2">老少咸宜</h4>
            <p className="text-muted-foreground text-sm">適合全家大小一同參與，6 歲以下兒童可免預約隨行</p>
          </div>
        </div>

        <div className="text-center mt-12">
          <Link
            href="/registration"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-1 transition-all"
          >
            立即預約入場 <ArrowRight size={20} />
          </Link>
          <p className="text-muted-foreground text-sm mt-4">免註冊，填寫基本資料即可完成預約購票</p>
        </div>
      </section>

      {sponsors && sponsors.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-10">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">感謝贊助</h3>
              <h2 className="font-display text-2xl">合作夥伴</h2>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {sponsors.map(s => (
                <div key={s.id} className="group">
                  {s.logoUrl ? (
                    <img
                      src={s.logoUrl}
                      alt={s.name}
                      className="h-10 md:h-12 object-contain opacity-50 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0"
                    />
                  ) : (
                    <div className="px-6 py-3 bg-white rounded-xl border text-muted-foreground font-bold text-sm opacity-60 group-hover:opacity-100 transition-opacity">
                      {s.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/sponsors" className="text-sm text-muted-foreground hover:text-primary font-medium flex items-center gap-1 justify-center">
                查看完整贊助名單 <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

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

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto glass-card rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/5 rounded-br-full"></div>
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-secondary/5 rounded-tl-full"></div>
          <div className="relative z-10">
            <h2 className="font-display text-3xl md:text-4xl mb-4">準備好了嗎？</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              四天限定的氣球奇幻旅程，現在就預約你的入場名額，和家人朋友一起創造美好回憶！
            </p>
            <Link
              href="/registration"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-bold text-lg bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              立即預約購票 <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
