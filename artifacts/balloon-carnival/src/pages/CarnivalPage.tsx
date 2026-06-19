import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Cpu, Baby, Sparkles, Eye, Calendar, Clock, MapPin, Ticket, Star, Users, Phone, Mail, AlertCircle, CheckCircle2, QrCode, Tag, ZoomIn, X as XIcon } from "lucide-react";
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
import { trackInitiateCheckout } from "@/lib/fbPixel";

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
    adultCount: 1,
    childCount: 0,
    infantCount: 0,
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
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // totalHeads counts every attendee for capacity (infants under 1 占名額);
  // paidHeads excludes free infants and drives the price.
  const totalHeads = formData.adultCount + formData.childCount + formData.infantCount;
  const paidHeads = formData.adultCount + formData.childCount;

  const baseTotal =
    visitorTicketType === "combo"
      ? 300 * paidHeads
      : visitorTicketType === "single"
        ? 200 * paidHeads
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
          ticketCount: totalHeads,
          baseAmount: baseTotal,
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

  // Capacity is soft: dates never sell out, so there is no full/insufficient
  // blocking on either single or combo purchases.

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
      const headLabel =
        formData.childCount > 0 || formData.infantCount > 0
          ? [
              `大人 ${formData.adultCount}`,
              ...(formData.childCount > 0 ? [`兒童 ${formData.childCount}`] : []),
              ...(formData.infantCount > 0 ? [`1 歲以下 ${formData.infantCount}（免費）`] : []),
            ].join("、")
          : `${formData.adultCount} 張`;

      if (visitorTicketType === "combo") {
        const comboTotal = 300 * paidHeads;
        const result = await createComboMutation.mutateAsync({
          data: {
            parentName: formData.parentName,
            phone: formData.phone,
            email: formData.email || undefined,
            adultCount: formData.adultCount,
            childCount: formData.childCount,
            infantCount: formData.infantCount,
            ticketCount: totalHeads,
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
        itemLabel = `兩日套票 × ${headLabel}（7/25 + 7/26）${appliedPromo ? ` · 折扣碼 ${appliedPromo.code}` : ""}`;
      } else {
        const singleTotal = 200 * paidHeads;
        const r = await createMutation.mutateAsync({
          data: {
            parentName: formData.parentName,
            phone: formData.phone,
            email: formData.email || undefined,
            adultCount: formData.adultCount,
            childCount: formData.childCount,
            infantCount: formData.infantCount,
            ticketCount: totalHeads,
            eventDate: formData.eventDate,
            ticketType: "single",
            amount: singleTotal,
            ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
          } as any,
        });
        created.push(r);
        if (r.qrToken) tokens.push(r.qrToken);
        totalAmount = appliedPromo ? appliedPromo.finalAmount : singleTotal;
        itemLabel = `單日票 × ${headLabel}（${formData.eventDate}）${appliedPromo ? ` · 折扣碼 ${appliedPromo.code}` : ""}`;
      }

      setConfirmedTokens(tokens);
      queryClient.invalidateQueries({ queryKey: getGetRegistrationAvailabilityQueryKey() });
      trackInitiateCheckout({
        value: totalAmount,
        num_items: totalHeads,
        contents: [
          {
            id: visitorTicketType === "combo" ? "combo" : "single",
            quantity: totalHeads,
          },
        ],
      });
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
          <button
            type="button"
            onClick={() => setZoomedImage(`${import.meta.env.BASE_URL}images/hero-bg-v2.png`)}
            className="group relative md:rounded-3xl overflow-hidden md:shadow-xl md:shadow-primary/10 md:border md:border-white/60 bg-white block w-full cursor-zoom-in focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            aria-label="放大查看活動主視覺"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/hero-bg-v2.png`}
              alt="2026 臺灣氣球嘉年華"
              className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.02]"
            />
            <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 text-white text-xs font-bold backdrop-blur opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              <ZoomIn size={14} /> 點擊放大
            </span>
          </button>
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
              <div className="font-bold text-foreground text-sm">名額有限</div>
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
            7/25（六）、7/26（日）公開活動日入場，名額有限，建議盡早購票
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-10 max-w-2xl mx-auto">
          <button
            type="button"
            onClick={() => { setVisitorTicketType("single"); setFormData({...formData, eventDate: ""}); clearPromo(); }}
            className={cn(
              "group relative rounded-3xl p-7 md:p-8 text-center transition-all border-[3px] overflow-hidden",
              visitorTicketType === "single"
                ? "bg-gradient-to-br from-primary/10 via-white to-primary/5 border-primary shadow-2xl shadow-primary/30 scale-[1.02]"
                : "bg-white border-border hover:border-primary/50 hover:shadow-xl hover:-translate-y-1"
            )}
            data-testid="ticket-type-single"
          >
            {visitorTicketType === "single" && (
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-bold mb-3">
              <Ticket size={12} /> 單日票
            </div>
            <div className="mb-2 flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">NT$</span>
              <span className="text-5xl md:text-6xl font-display font-bold text-green-600">200</span>
            </div>
            <p className="text-sm text-foreground/70 font-medium">7/25 或 7/26 擇一日</p>
          </button>

          <button
            type="button"
            onClick={() => { setVisitorTicketType("combo"); setFormData({...formData, eventDate: ""}); clearPromo(); }}
            className={cn(
              "group relative rounded-3xl p-7 md:p-8 text-center transition-all border-[3px] overflow-hidden",
              visitorTicketType === "combo"
                ? "bg-gradient-to-br from-secondary/10 via-white to-primary/5 border-secondary shadow-2xl shadow-secondary/30 scale-[1.02]"
                : "bg-white border-green-300 hover:border-secondary/60 hover:shadow-xl hover:-translate-y-1"
            )}
            data-testid="ticket-type-combo"
          >
            <div className="absolute -top-px left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs font-bold px-4 py-1.5 rounded-b-xl shadow-md flex items-center gap-1">
              <Sparkles size={12} /> 最划算 · 省 NT$100
            </div>
            {visitorTicketType === "combo" && (
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-bold mb-3 mt-4">
              <Ticket size={12} /> 兩日套票
            </div>
            <div className="mb-2 flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">NT$</span>
              <span className="text-5xl md:text-6xl font-display font-bold text-green-600">300</span>
              <span className="text-sm font-bold text-muted-foreground line-through ml-1">400</span>
            </div>
            <p className="text-sm text-foreground/70 font-medium">7/25 + 7/26 兩日皆可入場</p>
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
                <div className="font-bold text-right">
                  {formData.childCount > 0 || formData.infantCount > 0
                    ? `${[
                        `大人 ${formData.adultCount}`,
                        ...(formData.childCount > 0 ? [`兒童 ${formData.childCount}`] : []),
                        ...(formData.infantCount > 0 ? [`1 歲以下 ${formData.infantCount}（免費）`] : []),
                      ].join("、")}（共 ${totalHeads} 位）`
                    : `${formData.adultCount} 張`}
                </div>
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
              onClick={() => { setSuccess(false); setVisitorTicketType(""); setConfirmedTokens([]); setFormData({ parentName: "", phone: "", email: "", adultCount: 1, childCount: 0, infantCount: 0, eventDate: "" }); }}
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
                    // Capacity is soft — a listed-full date still accepts
                    // purchases, so cards are never disabled. When at/over the
                    // listed cap we show "名額有限" instead of a remaining count.
                    const isLimited = day.remaining <= 0;
                    const isLow = day.remaining > 0 && day.remaining < 50;
                    const isSelected = formData.eventDate === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setFormData({...formData, eventDate: day.date})}
                        className={cn(
                          "w-full text-left p-5 rounded-2xl border-2 transition-all flex flex-col gap-2 relative overflow-hidden",
                          isSelected ? "bg-primary/5 border-primary shadow-md" : "bg-card border-border hover:border-primary/50 hover:shadow-sm",
                        )}
                        data-testid={`date-${day.date}`}
                      >
                        {isSelected && <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -z-10"></div>}
                        <div className="flex justify-between items-center w-full">
                          <span className={cn("font-bold text-lg", isSelected ? "text-primary" : "text-foreground")}>
                            {new Date(day.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                          </span>
                          {isLimited ? (
                            <span className="px-3 py-1 bg-amber-200 text-amber-900 text-xs font-bold rounded-full">名額有限</span>
                          ) : isLow ? (
                            <span className="px-3 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-full">即將額滿</span>
                          ) : (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">熱賣中</span>
                          )}
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-1000", isLimited ? "bg-amber-400" : isLow ? "bg-accent" : "bg-primary")}
                            style={{ width: `${Math.min(100, (day.registered / day.totalCapacity) * 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right mt-1">
                          {isLimited ? <span className="font-bold text-amber-700">名額有限</span> : <>剩餘 <AnimatedNumber value={day.remaining} className="font-bold text-foreground" /> / {day.totalCapacity}</>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm flex gap-3 border border-blue-100">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p>每筆最多限購 10 張。名額有限，建議盡早線上購票以確保入場。</p>
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
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Ticket size={16} className="text-primary" /> 大人票數 <span className="text-destructive">*</span>
                        </label>
                        <select
                          value={formData.adultCount}
                          onChange={e => {
                            const adultCount = parseInt(e.target.value);
                            setFormData(f => {
                              const childCount = Math.min(f.childCount, 10 - adultCount);
                              const infantCount = Math.min(f.infantCount, 10 - adultCount - childCount);
                              return { ...f, adultCount, childCount, infantCount };
                            });
                            clearPromo();
                          }}
                          data-testid="select-adult-count"
                          className="w-full px-4 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg appearance-none cursor-pointer"
                        >
                          {Array.from({ length: 10 - formData.childCount - formData.infantCount }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num} 位</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Ticket size={16} className="text-primary" /> 兒童票數
                        </label>
                        <select
                          value={formData.childCount}
                          onChange={e => {
                            const childCount = parseInt(e.target.value);
                            setFormData(f => ({ ...f, childCount, infantCount: Math.min(f.infantCount, 10 - f.adultCount - childCount) }));
                            clearPromo();
                          }}
                          data-testid="select-child-count"
                          className="w-full px-4 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg appearance-none cursor-pointer"
                        >
                          {Array.from({ length: 11 - formData.adultCount - formData.infantCount }, (_, i) => i).map(num => (
                            <option key={num} value={num}>{num} 位</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Ticket size={16} className="text-primary" /> 1 歲以下
                        </label>
                        <select
                          value={formData.infantCount}
                          onChange={e => { setFormData(f => ({ ...f, infantCount: parseInt(e.target.value) })); clearPromo(); }}
                          data-testid="select-infant-count"
                          className="w-full px-4 py-4 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-lg appearance-none cursor-pointer"
                        >
                          {Array.from({ length: 11 - formData.adultCount - formData.childCount }, (_, i) => i).map(num => (
                            <option key={num} value={num}>{num} 位</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      兒童與大人同票價（單日每位 200 元、兩日套票每位 300 元）。1 歲以下嬰兒免費入場，但仍佔 1 個入場名額並會收到報到 QR Code。每筆訂單至少 1 位大人。
                    </p>
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

                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={
                        createMutation.isPending ||
                        createComboMutation.isPending ||
                        (visitorTicketType === "single" && !formData.eventDate)
                      }
                      className="w-full py-5 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-primary to-primary/90 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all flex items-center justify-center gap-2"
                      data-testid="button-submit-purchase"
                    >
                      {(createMutation.isPending || createComboMutation.isPending) ? "處理中..." :
                       visitorTicketType === "single" && !formData.eventDate ? "請選擇入場日期" :
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
                  "名額有限，建議提前線上購票以確保入場",
                  "入場請出示購票確認 QR Code（電子或紙本皆可）",
                  "兒童與大人同票價（單日 200 元、兩日套票 300 元），兒童亦佔 1 個入場名額；1 歲以下嬰兒免費入場，但仍佔 1 個入場名額並會收到報到 QR Code",
                  "兩日套票須完成兩次報到（7/25 + 7/26 各一次）",
                  "每張票含價值 50 元精美報到小禮物（一票兌換一組）",
                  "每張票贈價值 500 元商城優惠套裝折扣碼（購票後以 Email 寄送）",
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
                  "親子手作坊依照現場活動報名",
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
            <XIcon size={22} />
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
