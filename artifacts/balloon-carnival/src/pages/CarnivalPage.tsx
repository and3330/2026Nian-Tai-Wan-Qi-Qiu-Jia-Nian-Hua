import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Cpu, Baby, Sparkles, Eye, Calendar, Clock, MapPin, Ticket, Star, Users, Phone, Mail, AlertCircle, CheckCircle2, QrCode, Tag, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGetRegistrationAvailability,
  useCreateRegistration,
  useCreateComboRegistration,
  type Registration,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRegistrationAvailabilityQueryKey } from "@workspace/api-client-react";
import { PaymentMethodModal } from "@/components/PaymentMethodModal";
import { AnimatedNumber } from "@/components/EventCountdown";

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
    desc: "氣球藝術家現場創作的精美作品 — 中型氣球雕塑、氣球人偶、花束造型等，全部公開展覽，供遊客近距離欣賞與拍照。",
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
  const { data: availability, isLoading: isAvailabilityLoading } = useGetRegistrationAvailability({
    query: {
      queryKey: ["getRegistrationAvailability"],
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    },
  });
  const createMutation = useCreateRegistration();
  const createComboMutation = useCreateComboRegistration();

  const [visitorTicketType, setVisitorTicketType] = useState<VisitorTicketType>("");
  const [formData, setFormData] = useState({
    parentName: "",
    phone: "",
    email: "",
    ticketCount: 1,
    eventDate: ""
  });
  const [success, setSuccess] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{
    registrationIds: number[];
    amount: number;
    itemLabel: string;
  } | null>(null);
  const [confirmedTokens, setConfirmedTokens] = useState<string[]>([]);

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
    finalAmount: number;
    baseAmount: number;
    label: string;
  } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const baseTotal =
    visitorTicketType === "combo"
      ? 300 * formData.ticketCount
      : visitorTicketType === "single"
        ? 200 * formData.ticketCount
        : 0;
  const finalTotal = appliedPromo ? appliedPromo.finalAmount : baseTotal;

  const applyPromo = async () => {
    setPromoError(null);
    const code = promoInput.trim().toUpperCase();
    if (!code) { setPromoError("請輸入優惠碼"); return; }
    if (!visitorTicketType) { setPromoError("請先選擇票種"); return; }
    setPromoChecking(true);
    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          ticketType: visitorTicketType,
          ticketCount: formData.ticketCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data?.error || "優惠碼無效");
        setAppliedPromo(null);
        return;
      }
      setAppliedPromo({
        code: data.code,
        discountAmount: data.discountAmount,
        finalAmount: data.finalAmount,
        baseAmount: data.baseAmount,
        label: data.label,
      });
    } catch {
      setPromoError("套用失敗，請稍後再試");
    } finally {
      setPromoChecking(false);
    }
  };
  const clearPromo = () => { setAppliedPromo(null); setPromoInput(""); setPromoError(null); };

  const publicDates = availability?.filter(a => {
    const d = new Date(a.date);
    return d.getDate() >= 25;
  });

  const selectedDateInfo = publicDates?.find(a => a.date === formData.eventDate);
  const isSelectedDateFull = selectedDateInfo ? selectedDateInfo.remaining <= 0 : false;
  const isSelectedDateInsufficient = selectedDateInfo
    ? selectedDateInfo.remaining < formData.ticketCount
    : false;

  // For combo tickets, both 7/25 and 7/26 must each have enough remaining seats.
  const day25 = publicDates?.find(a => a.date === "2026-07-25");
  const day26 = publicDates?.find(a => a.date === "2026-07-26");
  const comboInsufficientDate =
    visitorTicketType === "combo"
      ? day25 && day25.remaining < formData.ticketCount
        ? day25
        : day26 && day26.remaining < formData.ticketCount
          ? day26
          : null
      : null;
  const comboBlocked = !!comboInsufficientDate;

  const extractApiError = (err: unknown): { message: string; code?: string } => {
    const e = err as { data?: { error?: string; code?: string }; status?: number };
    if (e?.data?.code === "SOLD_OUT") {
      return { message: e.data.error || "票券已售完", code: "SOLD_OUT" };
    }
    if (e?.data?.error) return { message: e.data.error };
    return { message: "報名失敗，請重試或聯絡客服" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorTicketType) { alert("請選擇票種"); return; }
    if (visitorTicketType === "single" && !formData.eventDate) { alert("請選擇入場日期"); return; }

    try {
      const created: Registration[] = [];
      const tokens: string[] = [];
      let totalAmount = 0;
      let itemLabel = "";

      if (visitorTicketType === "combo") {
        const comboTotal = 300 * formData.ticketCount;
        const result = await createComboMutation.mutateAsync({
          data: {
            parentName: formData.parentName,
            phone: formData.phone,
            email: formData.email || undefined,
            ticketCount: formData.ticketCount,
            eventDates: ["2026-07-25", "2026-07-26"],
            ticketType: "combo",
            amount: comboTotal,
            ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
          } as any,
        });
        for (const r of result.registrations) {
          created.push(r);
          if (r.qrToken) tokens.push(r.qrToken);
        }
        totalAmount = appliedPromo ? appliedPromo.finalAmount : comboTotal;
        itemLabel = `兩日套票 × ${formData.ticketCount}（7/25 + 7/26）${appliedPromo ? ` · 折扣碼 ${appliedPromo.code}` : ""}`;
      } else {
        const singleTotal = 200 * formData.ticketCount;
        const r = await createMutation.mutateAsync({
          data: {
            parentName: formData.parentName,
            phone: formData.phone,
            email: formData.email || undefined,
            ticketCount: formData.ticketCount,
            eventDate: formData.eventDate,
            ticketType: "single",
            amount: singleTotal,
            ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
          } as any,
        });
        created.push(r);
        if (r.qrToken) tokens.push(r.qrToken);
        totalAmount = appliedPromo ? appliedPromo.finalAmount : singleTotal;
        itemLabel = `單日票 × ${formData.ticketCount}（${formData.eventDate}）${appliedPromo ? ` · 折扣碼 ${appliedPromo.code}` : ""}`;
      }

      setConfirmedTokens(tokens);
      queryClient.invalidateQueries({ queryKey: getGetRegistrationAvailabilityQueryKey() });
      setPendingPayment({
        registrationIds: created.map((r) => r.id),
        amount: totalAmount,
        itemLabel,
      });
    } catch (err) {
      // Always refetch availability — user may have been racing other buyers.
      queryClient.invalidateQueries({ queryKey: getGetRegistrationAvailabilityQueryKey() });
      const { message } = extractApiError(err);
      alert(message);
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
      {/* HERO — 活動主視覺 */}
      <section className="relative w-full bg-gradient-to-b from-sky-50 via-rose-50/40 to-background overflow-hidden">
        <div className="max-w-6xl mx-auto px-0 md:px-4 pt-0 md:pt-12 pb-6 md:pb-12">
          <div className="relative md:rounded-3xl overflow-hidden md:shadow-xl md:shadow-primary/10 md:border md:border-white/60 bg-white">
            <img
              src={`${import.meta.env.BASE_URL}images/hero-bg-v2.png`}
              alt="2026 臺灣氣球嘉年華"
              className="w-full h-auto block"
            />
            <div className="absolute inset-x-0 bottom-0 pointer-events-none bg-gradient-to-t from-black/55 via-black/15 to-transparent pt-16 pb-5 md:pb-8 px-4">
              <div className="pointer-events-auto flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="#register"
                  className="px-6 md:px-8 py-3 md:py-4 rounded-full font-bold text-base md:text-lg bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-black/30 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                  data-testid="carnival-hero-cta-buy"
                >
                  <Ticket size={20} /> 立即購票入場
                </a>
                <a
                  href="#schedule"
                  className="px-5 md:px-6 py-2.5 md:py-3.5 rounded-full font-medium text-sm md:text-base text-foreground bg-white/95 backdrop-blur border border-white hover:bg-white transition-all flex items-center gap-2"
                >
                  查看節目時間表 <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 活動資訊條 */}
      <section className="border-y bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 md:py-5 grid grid-cols-2 md:grid-cols-4 gap-x-3 md:gap-x-6 gap-y-4 items-stretch">
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <Users className="text-rose-500 w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">每日名額</div>
              <div className="font-bold text-foreground text-sm">限量 500 名</div>
            </div>
          </div>
        </div>
      </section>

      <section id="register" className="py-16 md:py-20 px-4 max-w-4xl mx-auto w-full scroll-mt-24 border-t">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-50 text-green-600 font-bold text-sm mb-4">
            <Ticket size={16} /> 立即購票
          </div>
          <h2 className="font-display text-4xl mb-4">一般觀眾購票</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            7/25（六）、7/26（日）公開活動日入場，每日限量 500 名
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-center gap-4 sm:gap-6 mb-10 max-w-md sm:max-w-none mx-auto">
          <button
            type="button"
            onClick={() => { setVisitorTicketType("single"); setFormData({...formData, eventDate: ""}); clearPromo(); }}
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
            onClick={() => { setVisitorTicketType("combo"); setFormData({...formData, eventDate: ""}); clearPromo(); }}
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
                {formData.email && (<>
                  <div className="text-muted-foreground">Email：</div>
                  <div className="font-bold text-right break-all">{formData.email}</div>
                </>)}
                <div className="text-muted-foreground">票種：</div>
                <div className="font-bold text-right text-primary">{visitorTicketType === "combo" ? "兩日套票 300 元" : "單日票 200 元"}</div>
                <div className="text-muted-foreground">票數：</div>
                <div className="font-bold text-right">{formData.ticketCount} 張</div>
                <div className="text-muted-foreground">入場日期：</div>
                <div className="font-bold text-right text-primary">{visitorTicketType === "combo" ? "7/25 + 7/26" : formData.eventDate}</div>
              </div>
            </div>

            {confirmedTokens.length > 0 && (
              <div className="mt-8 bg-white rounded-2xl p-6 max-w-md mx-auto shadow-sm border border-green-100">
                <h3 className="font-bold mb-2 flex items-center justify-center gap-2 text-green-700">
                  <QrCode size={20} /> 您的入場 QR Code
                </h3>
                <p className="text-xs text-muted-foreground text-center mb-4">入場時請出示此 QR Code 進行報到。已寄送至您的 Email。</p>
                <div className="grid gap-4" style={{ gridTemplateColumns: confirmedTokens.length > 1 ? "1fr 1fr" : "1fr" }}>
                  {confirmedTokens.map((token, idx) => (
                    <div key={token} className="text-center">
                      <img
                        src={`/api/qr/${encodeURIComponent(token)}`}
                        alt={`報到 QR ${idx + 1}`}
                        className="w-full max-w-[220px] mx-auto border rounded-lg p-2 bg-white"
                      />
                      {confirmedTokens.length > 1 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          {idx === 0 ? "7/25" : "7/26"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => { setSuccess(false); setVisitorTicketType(""); setConfirmedTokens([]); setFormData({ parentName: "", phone: "", email: "", ticketCount: 1, eventDate: "" }); }}
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
                    const isInsufficient = !isFull && day.remaining < formData.ticketCount;
                    const isLow = day.remaining > 0 && day.remaining < 50;
                    const isSelected = formData.eventDate === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        disabled={isFull || isInsufficient}
                        onClick={() => setFormData({...formData, eventDate: day.date})}
                        className={cn(
                          "w-full text-left p-5 rounded-2xl border-2 transition-all flex flex-col gap-2 relative overflow-hidden",
                          isFull ? "bg-muted border-border opacity-60 cursor-not-allowed" :
                          isInsufficient ? "bg-amber-50 border-amber-200 opacity-70 cursor-not-allowed" :
                          isSelected ? "bg-primary/5 border-primary shadow-md" : "bg-card border-border hover:border-primary/50 hover:shadow-sm",
                        )}
                        data-testid={`date-${day.date}`}
                      >
                        {isSelected && <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -z-10"></div>}
                        <div className="flex justify-between items-center w-full">
                          <span className={cn("font-bold text-lg", isSelected ? "text-primary" : "text-foreground")}>
                            {new Date(day.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                          </span>
                          {isFull ? (
                            <span className="px-3 py-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full">已額滿</span>
                          ) : isInsufficient ? (
                            <span className="px-3 py-1 bg-amber-200 text-amber-900 text-xs font-bold rounded-full">剩餘不足</span>
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
                        <div className="text-xs text-muted-foreground text-right mt-1">剩餘 <AnimatedNumber value={day.remaining} className="font-bold text-foreground" /> / {day.totalCapacity}</div>
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
                      <Mail size={16} className="text-primary" /> Email
                      <span className="text-xs text-muted-foreground font-normal">(填寫後將寄送購票確認信與 QR Code)</span>
                    </label>
                    <input
                      type="email" value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="例如：name@example.com"
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Ticket size={16} className="text-primary" /> 預購票數 <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={formData.ticketCount}
                      onChange={e => { setFormData({...formData, ticketCount: parseInt(e.target.value)}); clearPromo(); }}
                      className="w-full px-5 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg appearance-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>{num} 張</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Tag size={16} className="text-primary" /> 優惠碼（選填）
                    </label>
                    {appliedPromo ? (
                      <div
                        data-testid="promo-applied"
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-green-50 border-2 border-green-200"
                      >
                        <div className="text-sm">
                          <div className="font-bold text-green-800">已套用 {appliedPromo.code}</div>
                          <div className="text-green-700 text-xs">{appliedPromo.label} · 折抵 NT$ {appliedPromo.discountAmount.toLocaleString()}</div>
                        </div>
                        <button
                          type="button"
                          onClick={clearPromo}
                          data-testid="button-clear-promo"
                          className="p-2 rounded-lg hover:bg-green-100 text-green-700"
                          aria-label="移除優惠碼"
                        >
                          <XIcon size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                          placeholder="例如：EARLYBIRD"
                          maxLength={32}
                          data-testid="input-promo-code"
                          className="flex-1 px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all uppercase"
                        />
                        <button
                          type="button"
                          onClick={applyPromo}
                          disabled={promoChecking || !promoInput.trim()}
                          data-testid="button-apply-promo"
                          className="px-5 py-3 rounded-xl font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          {promoChecking ? "驗證中..." : "套用"}
                        </button>
                      </div>
                    )}
                    {promoError && (
                      <p data-testid="promo-error" className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle size={14} /> {promoError}
                      </p>
                    )}
                  </div>

                  {visitorTicketType && (
                    <div className="rounded-xl bg-primary/5 border-2 border-primary/20 p-4 space-y-1 text-sm" data-testid="price-summary">
                      <div className="flex justify-between text-muted-foreground">
                        <span>原價小計</span>
                        <span>NT$ {baseTotal.toLocaleString()}</span>
                      </div>
                      {appliedPromo && (
                        <div className="flex justify-between text-green-700 font-medium">
                          <span>優惠折抵</span>
                          <span>− NT$ {appliedPromo.discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold text-primary border-t border-primary/20 pt-2 mt-1">
                        <span>應付總額</span>
                        <span data-testid="text-final-total">NT$ {finalTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {comboBlocked && comboInsufficientDate && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex gap-3">
                      <AlertCircle className="shrink-0 mt-0.5" size={18} />
                      <p data-testid="combo-blocked-warning">
                        {comboInsufficientDate.date} 僅剩 {comboInsufficientDate.remaining} 張，
                        無法滿足兩日套票 × {formData.ticketCount} 的數量。請改選單日票或減少張數。
                      </p>
                    </div>
                  )}
                  {visitorTicketType === "single" && isSelectedDateInsufficient && !isSelectedDateFull && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex gap-3">
                      <AlertCircle className="shrink-0 mt-0.5" size={18} />
                      <p>該日僅剩 {selectedDateInfo?.remaining} 張，請減少張數。</p>
                    </div>
                  )}
                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={
                        createMutation.isPending ||
                        createComboMutation.isPending ||
                        (visitorTicketType === "single" && (isSelectedDateFull || isSelectedDateInsufficient || !formData.eventDate)) ||
                        (visitorTicketType === "combo" && comboBlocked)
                      }
                      className="w-full py-5 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-primary to-primary/90 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all flex items-center justify-center gap-2"
                      data-testid="button-submit-purchase"
                    >
                      {(createMutation.isPending || createComboMutation.isPending) ? "處理中..." :
                       visitorTicketType === "single" && !formData.eventDate ? "請選擇入場日期" :
                       visitorTicketType === "single" && isSelectedDateFull ? "選定日期已額滿" :
                       visitorTicketType === "single" && isSelectedDateInsufficient ? `該日僅剩 ${selectedDateInfo?.remaining} 張` :
                       visitorTicketType === "combo" && comboBlocked ? "兩日套票剩餘不足" :
                       "確認送出購票"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </section>

      {/* 完整入場須知 */}
      <section className="py-14 md:py-20 px-4 bg-muted/30 border-t">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 md:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 font-bold text-sm mb-4">
              <AlertCircle size={16} /> 重要資訊
            </div>
            <h2 className="font-display text-3xl md:text-5xl mb-3">入場須知</h2>
            <p className="text-muted-foreground text-base md:text-lg">為確保活動順利進行，請參加民眾配合下列規定</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {[
              {
                icon: Ticket,
                title: "購票與入場",
                color: "text-primary",
                bg: "bg-primary/10",
                items: [
                  "每日限量 500 名，建議提前線上購票以確保入場",
                  "入場請出示購票確認 QR Code（電子或紙本皆可）",
                  "6 歲（含）以下兒童可免票隨大人入場",
                  "兩日套票須完成兩次報到（7/25 + 7/26 各一次）",
                ],
              },
              {
                icon: MapPin,
                title: "場地與交通",
                color: "text-secondary",
                bg: "bg-secondary/10",
                items: [
                  "活動地點：臺北瓶蓋工廠（台北市南港區南港路二段 13 號）",
                  "搭乘捷運至板南線「南港站」1 號出口，步行約 5 分鐘",
                  "現場停車位有限，建議搭乘大眾運輸前往",
                  "活動期間提供免費接駁車，往返捷運南港站",
                ],
              },
              {
                icon: Clock,
                title: "開放時間",
                color: "text-amber-600",
                bg: "bg-amber-50",
                items: [
                  "7/25（六）10:00 – 19:00",
                  "7/26（日）10:00 – 17:00",
                  "建議下午 13:00 前入場，可完整觀賞主舞臺表演",
                  "入場後可自由進出，重新入場請保留手環識別",
                ],
              },
              {
                icon: CheckCircle2,
                title: "現場注意事項",
                color: "text-green-600",
                bg: "bg-green-50",
                items: [
                  "親子手作坊另需現場購票 150 元/組（依小朋友人數計算）",
                  "禁止攜帶外食、寵物、危險物品及自備氣球進入會場",
                  "歡迎拍照留念，請勿使用閃光燈與腳架避免影響他人",
                  "活動如遇天候異常，將於官網與粉絲頁公告調整資訊",
                ],
              },
            ].map((g) => (
              <div key={g.title} className="bg-white rounded-2xl p-6 md:p-7 border border-border shadow-sm hover-lift transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", g.bg)}>
                    <g.icon className={cn("w-5 h-5", g.color)} />
                  </div>
                  <h3 className="font-display text-xl md:text-2xl">{g.title}</h3>
                </div>
                <ul className="space-y-2.5 text-sm md:text-base text-muted-foreground">
                  {g.items.map((it, i) => (
                    <li key={i} className="flex gap-2 leading-relaxed">
                      <span className={cn("shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full", g.bg.replace("/10", "/40").replace("bg-amber-50", "bg-amber-400").replace("bg-green-50", "bg-green-500"))} />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 聯絡資訊 */}
          <div className="mt-8 md:mt-10 bg-gradient-to-r from-primary/5 to-secondary/5 border-2 border-primary/15 rounded-2xl p-6 md:p-7">
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 justify-between">
              <div>
                <h3 className="font-display text-xl md:text-2xl mb-1">還有其他問題？</h3>
                <p className="text-sm md:text-base text-muted-foreground">主辦單位將盡快為您回覆，感謝您的耐心</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <a href="tel:02-2720-8889" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border border-border font-bold text-foreground hover:border-primary/40 hover:shadow-sm transition-all">
                  <Phone size={18} className="text-primary" /> 02-2720-8889
                </a>
                <a href="mailto:contact@balloon-carnival.tw" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white border border-border font-bold text-foreground hover:border-primary/40 hover:shadow-sm transition-all">
                  <Mail size={18} className="text-secondary" /> 來信洽詢
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
