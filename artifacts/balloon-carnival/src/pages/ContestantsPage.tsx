import { useListContestants } from "@workspace/api-client-react";
import { Users, Handshake, Clock, MapPin, Heart, MessageCircle, Lightbulb, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const scheduleDay1 = [
  { time: "09:00 - 09:30", event: "報到與交流茶敘", desc: "領取識別證、交流手冊，享用茶點並與同行自由交流", tag: "交流" },
  { time: "09:30 - 10:00", event: "開幕致詞 — 傳承的力量", desc: "大會主席分享氣球產業傳承理念，回顧臺灣氣球藝術發展歷程", tag: "主題" },
  { time: "10:00 - 11:30", event: "經驗分享：資深前輩座談", desc: "邀請業界資深前輩分享入行故事、技術心得與經營智慧", tag: "傳承" },
  { time: "11:30 - 12:30", event: "分組交流：技術傳承工作坊", desc: "依專長分組，由資深老師帶領新進同行實作交流", tag: "實作" },
  { time: "12:30 - 13:30", event: "午餐交流時光", desc: "自助午餐，設有產業交流桌，方便不同領域的同行互相認識", tag: "交流" },
  { time: "13:30 - 15:00", event: "主題工作坊：創新技法分享", desc: "各地同行展示獨門技法，開放觀摩與現場教學", tag: "實作" },
  { time: "15:00 - 15:30", event: "茶歇與自由交流", desc: "休息時間，設有作品展示區供同行自由參觀與討論", tag: "交流" },
  { time: "15:30 - 17:00", event: "共同創作：傳承之作", desc: "全體同行合力完成大型氣球裝置藝術，象徵技藝傳承精神", tag: "實作" },
  { time: "17:00 - 17:30", event: "首日回顧與明日預告", desc: "回顧當日精彩時刻，預告隔日活動內容", tag: "主題" },
];

const scheduleDay2 = [
  { time: "09:00 - 09:30", event: "晨間交流", desc: "茶敘與自由交流時間", tag: "交流" },
  { time: "09:30 - 11:00", event: "產業趨勢論壇", desc: "探討氣球產業未來發展、環保材料應用與市場趨勢", tag: "主題" },
  { time: "11:00 - 12:30", event: "師徒配對交流", desc: "資深同行與新進同行配對交流，一對一經驗傳授", tag: "傳承" },
  { time: "12:30 - 13:30", event: "午餐交流", desc: "邊用餐邊交流，增進同行情誼", tag: "交流" },
  { time: "13:30 - 15:30", event: "自由創作與展示時間", desc: "各同行自由創作，完成後於展示區展出供交流觀摩", tag: "實作" },
  { time: "15:30 - 16:30", event: "圓桌論壇：如何傳承", desc: "公開討論氣球技藝傳承的方法、挑戰與未來願景", tag: "傳承" },
  { time: "16:30 - 17:30", event: "閉幕典禮與合影", desc: "頒發傳承紀念證書，全體合影留念，展望明年再聚", tag: "主題" },
];

const tagStyles: Record<string, string> = {
  "交流": "bg-blue-50 text-blue-600",
  "主題": "bg-purple-50 text-purple-600",
  "傳承": "bg-amber-50 text-amber-700",
  "實作": "bg-green-50 text-green-600",
};

export default function ContestantsPage() {
  const { data: members, isLoading } = useListContestants();

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
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            這不是一場比賽，而是一個讓氣球人回家的地方。
            我們相信，技藝的價值在於傳承，經驗的意義在於分享。
            歡迎每一位氣球同行，帶著你的故事與技術，來到這裡交流、學習、成長。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/registration"
              className="px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              我要報名參加 <ArrowRight size={20} />
            </Link>
            <a
              href="#schedule"
              className="px-8 py-4 rounded-full font-bold text-lg bg-white text-foreground border-2 hover:border-primary/30 shadow-sm hover:shadow-md transition-all"
            >
              查看完整議程
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
              desc: "資深前輩分享數十年的經驗與智慧，讓寶貴的技藝不因時間而消失，一代一代地延續下去。",
              color: "text-rose-500",
              bg: "bg-rose-50",
            },
            {
              icon: MessageCircle,
              title: "同行交流",
              desc: "打破地域限制，讓來自各地的氣球人有機會面對面交流，互相學習不同的技法與觀點。",
              color: "text-blue-500",
              bg: "bg-blue-50",
            },
            {
              icon: Lightbulb,
              title: "共同成長",
              desc: "透過工作坊、座談與共同創作，不論資歷深淺，每個人都能在這裡獲得新的靈感與成長。",
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

      <section id="schedule" className="py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4">
              <Clock size={16} /> 交流會議程
            </div>
            <h2 className="font-display text-4xl mb-4">完整活動時程</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              為期兩天的密集交流，讓每一位同行都能充分參與、深度學習
            </p>
            <div className="flex items-center justify-center gap-3 mt-6 text-sm">
              {Object.entries(tagStyles).map(([label, cls]) => (
                <span key={label} className={cn("px-3 py-1 rounded-full font-medium", cls)}>{label}</span>
              ))}
            </div>
          </div>

          {[
            { label: "Day 1 — 7/25 (六) 傳承與交流", items: scheduleDay1 },
            { label: "Day 2 — 7/26 (日) 展望與共創", items: scheduleDay2 },
          ].map((day, dayIdx) => (
            <div key={dayIdx} className={cn(dayIdx > 0 && "mt-16")}>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-md">
                  {dayIdx + 1}
                </div>
                <h3 className="text-2xl font-bold">{day.label}</h3>
              </div>

              <div className="relative">
                <div className="absolute left-[88px] top-0 bottom-0 w-0.5 bg-border hidden sm:block"></div>
                <div className="space-y-4">
                  {day.items.map((item, idx) => (
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
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", tagStyles[item.tag])}>
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
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 px-4 max-w-7xl mx-auto w-full">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card border rounded-3xl h-80 animate-pulse"></div>
            ))}
          </div>
        ) : members && members.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
          <div className="text-center py-20 bg-muted/30 rounded-3xl border-2 border-dashed">
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
            傳承不只是教與學，更是一種情感的連結。
            無論你是入行數十年的前輩，還是剛踏入氣球世界的新人，
            這裡都有你的位置。讓我們一起，把這份對氣球的熱愛傳遞下去。
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
