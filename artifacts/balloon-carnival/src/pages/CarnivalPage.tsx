import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Cpu, Baby, Sparkles, Eye, Calendar, Clock, MapPin, Ticket, Star, Users, Phone, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetRegistrationAvailability, useCreateRegistration, type Registration } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRegistrationAvailabilityQueryKey } from "@workspace/api-client-react";
import { PaymentMethodModal } from "@/components/PaymentMethodModal";

type VisitorTicketType = "single" | "combo" | "";

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
  const queryClient = useQueryClient();
  const { data: availability, isLoading: isAvailabilityLoading } = useGetRegistrationAvailability();
  const createMutation = useCreateRegistration();

  const [visitorTicketType, setVisitorTicketType] = useState<VisitorTicketType>("");
  const [formData, setFormData] = useState({
    parentName: "",
    phone: "",
    ticketCount: 1,
    eventDate: ""
  });
  const [success, setSuccess] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{
    registrationIds: number[];
    amount: number;
    itemLabel: string;
  } | null>(null);

  const publicDates = availability?.filter(a => {
    const d = new Date(a.date);
    return d.getDate() >= 25;
  });

  const selectedDateInfo = publicDates?.find(a => a.date === formData.eventDate);
  const isSelectedDateFull = selectedDateInfo ? selectedDateInfo.remaining <= 0 : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorTicketType) { alert("請選擇票種"); return; }
    if (visitorTicketType === "single" && !formData.eventDate) { alert("請選擇入場日期"); return; }

    const submitOne = (eventDate: string, ticketType: string | null, amount: number | null) =>
      new Promise<Registration>((resolve, reject) => {
        createMutation.mutate(
          { data: { ...formData, eventDate, ticketType, amount } },
          {
            onSuccess: (data) => resolve(data),
            onError: (err: unknown) => reject(err),
          },
        );
      });

    try {
      const created: Registration[] = [];
      let totalAmount = 0;
      let itemLabel = "";
      if (visitorTicketType === "combo") {
        const comboTotal = 300 * formData.ticketCount;
        const r1 = await submitOne("2026-07-25", "combo", comboTotal);
        const r2 = await submitOne("2026-07-26", null, null);
        created.push(r1, r2);
        totalAmount = comboTotal;
        itemLabel = `兩日套票 × ${formData.ticketCount}（7/25 + 7/26）`;
      } else {
        const singleTotal = 200 * formData.ticketCount;
        const r = await submitOne(formData.eventDate, "single", singleTotal);
        created.push(r);
        totalAmount = singleTotal;
        itemLabel = `單日票 × ${formData.ticketCount}（${formData.eventDate}）`;
      }
      queryClient.invalidateQueries({ queryKey: getGetRegistrationAvailabilityQueryKey() });
      setPendingPayment({
        registrationIds: created.map((r) => r.id),
        amount: totalAmount,
        itemLabel,
      });
    } catch {
      alert("報名失敗，請重試或聯絡客服");
    }
  };

  return (
    <div className="flex flex-col">
      {pendingPayment && (
        <PaymentMethodModal
          open
          registrationIds={pendingPayment.registrationIds}
          amount={pendingPayment.amount}
          itemLabel={pendingPayment.itemLabel}
          payerName={formData.parentName}
          payerPhone={formData.phone}
          onClose={() => setPendingPayment(null)}
          onCompleted={() => {
            setPendingPayment(null);
            setSuccess(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
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
          <a
            href="#register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            立即購票 <ArrowRight size={20} />
          </a>
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

      <section id="schedule" className="py-20 bg-muted/30 scroll-mt-24">
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

      <section id="register" className="py-20 px-4 max-w-4xl mx-auto w-full scroll-mt-24">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 text-green-600 font-bold text-sm mb-4">
            <Ticket size={16} /> 立即購票
          </div>
          <h2 className="font-display text-4xl mb-4">一般觀眾購票</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            7/25（六）、7/26（日）公開活動日入場，每日限量 500 名
          </p>
        </div>

        <div className="flex justify-center gap-6 mb-10">
          <button
            type="button"
            onClick={() => { setVisitorTicketType("single"); setFormData({...formData, eventDate: ""}); }}
            className={cn(
              "glass-card rounded-2xl p-6 text-center hover-lift transition-all border-2",
              visitorTicketType === "single" ? "border-primary shadow-md" : "border-transparent"
            )}
          >
            <h3 className="text-lg font-bold mb-1">單日票</h3>
            <div className="mb-2">
              <span className="text-3xl font-bold text-green-600">200</span>
              <span className="text-muted-foreground ml-1">元</span>
            </div>
            <p className="text-xs text-muted-foreground">7/25 或 7/26 擇一日</p>
          </button>
          <button
            type="button"
            onClick={() => { setVisitorTicketType("combo"); setFormData({...formData, eventDate: ""}); }}
            className={cn(
              "glass-card rounded-2xl p-6 text-center hover-lift relative transition-all border-2",
              visitorTicketType === "combo" ? "border-primary shadow-md" : "border-green-200"
            )}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              省 100 元
            </div>
            <h3 className="text-lg font-bold mb-1">兩日套票</h3>
            <div className="mb-2">
              <span className="text-3xl font-bold text-green-600">300</span>
              <span className="text-muted-foreground ml-1">元</span>
            </div>
            <p className="text-xs text-muted-foreground">7/25 + 7/26 兩日</p>
          </button>
        </div>

        {success ? (
          <div className="max-w-2xl mx-auto bg-green-50 border-2 border-green-200 rounded-3xl p-12 text-center shadow-lg">
            <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-green-800 mb-4">購票成功！</h2>
            <p className="text-green-700 text-lg mb-8">
              感謝您購票 2026 臺灣氣球嘉年華。
              {visitorTicketType === "combo" ? " 兩日套票已登記 7/25 + 7/26！" : ` 我們期待在 ${formData.eventDate} 與您相見！`}
            </p>
            <div className="bg-white rounded-2xl p-6 text-left max-w-sm mx-auto shadow-sm border border-green-100">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-muted-foreground">姓名：</div>
                <div className="font-bold text-right">{formData.parentName}</div>
                <div className="text-muted-foreground">聯絡電話：</div>
                <div className="font-bold text-right">{formData.phone}</div>
                <div className="text-muted-foreground">票種：</div>
                <div className="font-bold text-right text-primary">{visitorTicketType === "combo" ? "兩日套票 300 元" : "單日票 200 元"}</div>
                <div className="text-muted-foreground">票數：</div>
                <div className="font-bold text-right">{formData.ticketCount} 張</div>
                <div className="text-muted-foreground">入場日期：</div>
                <div className="font-bold text-right text-primary">{visitorTicketType === "combo" ? "7/25 + 7/26" : formData.eventDate}</div>
              </div>
            </div>
            <button
              onClick={() => { setSuccess(false); setVisitorTicketType(""); setFormData({ parentName: "", phone: "", ticketCount: 1, eventDate: "" }); }}
              className="mt-10 text-green-600 font-bold hover:underline"
            >
              繼續購票
            </button>
          </div>
        ) : !visitorTicketType ? (
          <div className="text-center text-muted-foreground py-6">
            <p className="text-lg">請先選擇上方的票種（單日票或兩日套票）以繼續購票</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 max-w-5xl mx-auto">
            {visitorTicketType === "single" && (
            <div className="lg:col-span-2 space-y-6">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <Calendar className="text-primary" /> 選擇入場日期
              </h3>
              {isAvailabilityLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <div key={i} className="h-24 bg-card border rounded-2xl animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {publicDates?.map((day) => {
                    const isFull = day.remaining <= 0;
                    const isLow = day.remaining > 0 && day.remaining < 50;
                    const isSelected = formData.eventDate === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={isFull}
                        onClick={() => setFormData({...formData, eventDate: day.date})}
                        className={cn(
                          "w-full text-left p-5 rounded-2xl border-2 transition-all flex flex-col gap-2 relative overflow-hidden",
                          isFull ? "bg-muted border-border opacity-60 cursor-not-allowed" :
                          isSelected ? "bg-primary/5 border-primary shadow-md" : "bg-card border-border hover:border-primary/50 hover:shadow-sm",
                        )}
                      >
                        {isSelected && <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -z-10"></div>}
                        <div className="flex justify-between items-center w-full">
                          <span className={cn("font-bold text-lg", isSelected ? "text-primary" : "text-foreground")}>
                            {new Date(day.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                          </span>
                          {isFull ? (
                            <span className="px-3 py-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">已額滿</span>
                          ) : isLow ? (
                            <span className="px-3 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-full">即將額滿</span>
                          ) : (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">熱賣中</span>
                          )}
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-1000", isFull ? "bg-destructive" : isLow ? "bg-accent" : "bg-primary")}
                            style={{ width: `${(day.registered / day.totalCapacity) * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right mt-1">剩餘 {day.remaining} / {day.totalCapacity}</div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm flex gap-3 border border-blue-100">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p>系統會即時扣減庫存，若選定日期額滿將無法送出。每筆最多限購 10 張。</p>
              </div>
            </div>
            )}

            <div className={visitorTicketType === "single" ? "lg:col-span-3" : "lg:col-span-5 max-w-2xl mx-auto w-full"}>
              <div className="glass-card rounded-3xl p-8 md:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-bl-full -z-10"></div>
                <h2 className="text-2xl font-bold mb-8 border-b pb-4">
                  填寫購票資料
                  {visitorTicketType === "combo" && <span className="text-sm font-normal text-muted-foreground ml-2">（兩日套票 7/25 + 7/26）</span>}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Users size={16} className="text-primary" /> 姓名 <span className="text-destructive">*</span>
                    </label>
                    <input
                      required type="text" value={formData.parentName}
                      onChange={e => setFormData({...formData, parentName: e.target.value})}
                      placeholder="例如：王小明"
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Phone size={16} className="text-primary" /> 聯絡電話 <span className="text-destructive">*</span>
                    </label>
                    <input
                      required type="tel" value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="例如：0912345678"
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Ticket size={16} className="text-primary" /> 預購票數 <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.ticketCount}
                      onChange={e => setFormData({...formData, ticketCount: parseInt(e.target.value)})}
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg appearance-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>{num} 張</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={createMutation.isPending || (visitorTicketType === "single" && (isSelectedDateFull || !formData.eventDate))}
                      className="w-full py-5 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-primary to-primary/90 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all flex items-center justify-center gap-2"
                    >
                      {createMutation.isPending ? "處理中..." :
                       visitorTicketType === "single" && !formData.eventDate ? "請選擇入場日期" :
                       visitorTicketType === "single" && isSelectedDateFull ? "選定日期已額滿" :
                       "確認送出購票"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-700 max-w-xl mx-auto mt-10">
          <p className="font-bold mb-1">入場須知</p>
          <ul className="space-y-1 text-blue-600">
            <li>・每日限量 500 名，建議提前線上購票</li>
            <li>・6 歲以下兒童可免票隨大人入場</li>
            <li>・如有疑問請洽服務專線 02-2720-8889</li>
          </ul>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-amber-50/50 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-display text-3xl mb-4">你是氣球業界同行嗎？</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-8">
            如果你是氣球業界人士，想參加研習會、交流活動或比賽，請前往傳奇工匠研討會頁面瞭解詳情與報名。
          </p>
          <Link
            href="/conference"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            前往傳奇工匠研討會 <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}
