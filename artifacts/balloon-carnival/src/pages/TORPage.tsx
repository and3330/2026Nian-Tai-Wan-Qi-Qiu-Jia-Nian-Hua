import { useEffect, useState } from "react";
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Users,
  Phone,
  Mail,
  User,
  CheckCircle2,
  QrCode,
  Plus,
  Minus,
  AlertCircle,
  Swords,
  X,
  Medal,
  ScrollText,
  Sparkles,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentMethodModal } from "@/components/PaymentMethodModal";

const PARTICIPANT_PRICE = 600;
const COMPANION_PRICE = 200;

type Mode = "participant" | "spectator";

type Availability = {
  capacity: number;
  registered: number;
  remaining: number;
  soldOut: boolean;
};

type CreatedRegistration = {
  id: number;
  qrToken: string | null;
  ticketType: string | null;
};

const scheduleItems = [
  { icon: Calendar, label: "比賽日期", value: "7/26（日）" },
  { icon: Clock, label: "選手報到", value: "11:00 – 12:30" },
  { icon: MapPin, label: "報到地點", value: "臺北瓶蓋工廠 M 棟" },
  { icon: Swords, label: "開賽時間", value: "13:00 開賽" },
];

const ruleItems = [
  "採國際通用積分制，每場先達指定分數者獲勝。",
  "擊飛對手（Over Finish）或對手停止運轉（Survivor Finish）得 1 分；陀螺爆裂（Burst Finish）得 2 分。",
  "請自備市售合法戰鬥陀螺，不得使用改造或非法零件。",
  "依報到分組進行循環賽與淘汰賽，賽程以現場公告為準。",
];

const prizeItems = [
  "冠軍、亞軍、季軍頒發獎盃與精選獎品。",
  "完成報到的選手皆可獲得限定參賽禮。",
  "現場另設多項互動挑戰與抽獎好禮。",
];

const timelineItems = [
  { time: "11:00", label: "選手報到開始" },
  { time: "12:30", label: "報到截止 · 賽前說明" },
  { time: "13:00", label: "正式開賽" },
  { time: "賽後", label: "頒獎典禮 · 敗者加碼挑戰" },
];

export default function TORPage() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(true);

  const [imageZoomed, setImageZoomed] = useState(false);
  const [mode, setMode] = useState<Mode>("participant");
  const [form, setForm] = useState({ parentName: "", phone: "", email: "" });
  const [companionCount, setCompanionCount] = useState(0);
  const [spectatorCount, setSpectatorCount] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ mode: Mode; companions: number; spectators: number } | null>(null);
  const [confirmedTokens, setConfirmedTokens] = useState<string[]>([]);
  const [pendingPayment, setPendingPayment] = useState<{
    registrationIds: number[];
    amount: number;
    itemLabel: string;
  } | null>(null);

  const loadAvailability = async () => {
    try {
      const res = await fetch("/api/registrations/tournament/availability");
      const data = await res.json();
      if (res.ok) setAvailability(data);
    } catch {
      // soft-fail: spectator path still usable, server enforces the cap
    } finally {
      setLoadingAvail(false);
    }
  };

  useEffect(() => {
    loadAvailability();
    const t = setInterval(loadAvailability, 30000);
    return () => clearInterval(t);
  }, []);

  const soldOut = availability?.soldOut ?? false;

  // Participant sign-up closes when the 128 cap is reached, but spectator /
  // companion-only ticket purchase stays open regardless.
  useEffect(() => {
    if (soldOut && mode === "participant") setMode("spectator");
  }, [soldOut, mode]);

  const total =
    mode === "participant"
      ? PARTICIPANT_PRICE + companionCount * COMPANION_PRICE
      : spectatorCount * COMPANION_PRICE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.parentName.trim()) { setError("請填寫姓名"); return; }
    if (!form.phone.trim()) { setError("請填寫聯絡電話"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError("請填寫正確的 Email"); return; }

    const companions = mode === "participant" ? companionCount : spectatorCount;

    setSubmitting(true);
    try {
      const res = await fetch("/api/registrations/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          parentName: form.parentName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          companionCount: companions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "報名失敗，請稍後再試");
        loadAvailability();
        return;
      }
      const created: CreatedRegistration[] = data.registrations ?? [];
      setConfirmedTokens(created.map((r) => r.qrToken).filter((t): t is string => !!t));
      const labelParts =
        mode === "participant"
          ? [`參賽 × 1`, ...(companionCount > 0 ? [`隨同 × ${companionCount}`] : [])]
          : [`入場票 × ${spectatorCount}`];
      setPendingPayment({
        registrationIds: created.map((r) => r.id),
        amount: total,
        itemLabel: `戰鬥陀螺賽（${labelParts.join("、")}）`,
      });
      setSuccessInfo({ mode, companions: companionCount, spectators: spectatorCount });
      loadAvailability();
    } catch {
      setError("報名失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setSuccessInfo(null);
    setConfirmedTokens([]);
    setForm({ parentName: "", phone: "", email: "" });
    setCompanionCount(0);
    setSpectatorCount(1);
  };

  const Stepper = ({
    value,
    onChange,
    min,
    max,
    testId,
  }: {
    value: number;
    onChange: (n: number) => void;
    min: number;
    max: number;
    testId: string;
  }) => (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-xl border-2 border-border flex items-center justify-center hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
        data-testid={`${testId}-dec`}
      >
        <Minus size={18} />
      </button>
      <span className="w-12 text-center text-2xl font-display font-bold" data-testid={`${testId}-value`}>
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 rounded-xl border-2 border-border flex items-center justify-center hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
        data-testid={`${testId}-inc`}
      >
        <Plus size={18} />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col">
      {pendingPayment && (
        <PaymentMethodModal
          open
          registrationIds={pendingPayment.registrationIds}
          amount={pendingPayment.amount}
          itemLabel={pendingPayment.itemLabel}
          payerName={form.parentName}
          payerPhone={form.phone}
          defaultEmail={form.email}
          onClose={() => setPendingPayment(null)}
          onCompleted={() => {
            setPendingPayment(null);
            setSuccess(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* HERO */}
      <section className="relative w-full bg-gradient-to-b from-indigo-50 via-sky-50/40 to-background overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 py-14 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm mb-5">
            <Trophy size={16} /> 第四屆重擊盃 ✕ 臺灣氣球嘉年華
          </div>
          <h1 className="font-display text-4xl md:text-6xl mb-4 text-indigo-900">戰鬥陀螺挑戰賽</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            7/26（日）於臺北瓶蓋工廠 M 棟登場，線上限額 {availability?.capacity ?? 128} 位參賽者，捉對廝殺、爭奪冠軍寶座！
          </p>
        </div>
      </section>

      {/* 主視覺圖 */}
      <section className="bg-white">
        <div className="max-w-4xl mx-auto px-4 pt-8">
          <button
            type="button"
            onClick={() => setImageZoomed(true)}
            className="block w-full group cursor-zoom-in"
            aria-label="放大查看主視覺圖"
            data-testid="button-zoom-image"
          >
            <img
              src="https://cmsedu.b-cdn.net/S__74825753.jpg"
              alt="第四屆重擊盃 戰鬥陀螺挑戰賽"
              className="w-full rounded-3xl shadow-sm transition-transform group-hover:scale-[1.01]"
              loading="lazy"
            />
          </button>
        </div>
      </section>

      {/* 主視覺圖放大 */}
      {imageZoomed && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setImageZoomed(false)}
          data-testid="image-lightbox"
        >
          <button
            type="button"
            onClick={() => setImageZoomed(false)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
            aria-label="關閉"
          >
            <X size={24} />
          </button>
          <img
            src="https://cmsedu.b-cdn.net/S__74825753.jpg"
            alt="第四屆重擊盃 戰鬥陀螺挑戰賽"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 賽事資訊 */}
      <section className="border-y bg-white">
        <div className="max-w-4xl mx-auto px-4 py-5 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
          {scheduleItems.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <s.icon className="text-indigo-600 w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">{s.label}</div>
                <div className="font-bold text-foreground text-sm">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 賽事介紹 */}
      <section className="py-14 md:py-16 px-4 max-w-4xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl md:text-4xl mb-3">賽事介紹</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            由「第四屆重擊盃」與「2026 臺灣氣球嘉年華」共同呈獻的戰鬥陀螺挑戰賽，
            集結各路高手同場較勁，無論你是熱血選手還是熱情觀眾，都能在現場感受最激烈的對戰張力。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 賽制規則 */}
          <div className="rounded-3xl border bg-white p-6 md:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ScrollText className="text-indigo-600 w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg">賽制規則</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {ruleItems.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 獎項 */}
          <div className="rounded-3xl border bg-white p-6 md:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Medal className="text-amber-600 w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg">獎項</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {prizeItems.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 活動時程 */}
          <div className="rounded-3xl border bg-white p-6 md:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
                <Clock className="text-sky-600 w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg">活動時程</h3>
            </div>
            <ul className="space-y-3">
              {timelineItems.map((t) => (
                <li key={t.time} className="flex items-center gap-3 text-sm">
                  <span className="w-16 shrink-0 font-bold text-sky-700">{t.time}</span>
                  <span className="text-muted-foreground">{t.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 敗者加碼 */}
          <div className="rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50 p-6 md:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
                <Sparkles className="text-indigo-600 w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg">敗者加碼</h3>
            </div>
            <p className="text-sm text-indigo-900/80 leading-relaxed">
              即使在初賽不敵對手也別氣餒！現場將舉辦「敗部復活挑戰」，
              讓淘汰選手有機會重返賽場、爭取晉級名額，並有額外限定好禮等你來拿。
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          ＊詳細賽制、分組與獎項以現場公告及主辦單位最終說明為準。
        </p>
      </section>

      {/* 線上報名 */}
      <section id="tor-register" className="scroll-mt-24 pb-16 md:pb-20 px-4 max-w-3xl mx-auto w-full">
        {success ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-10 md:p-12 text-center shadow-lg">
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-green-800 mb-3">報名成功！</h2>
            <p className="text-green-700 text-lg mb-8">
              {successInfo?.mode === "participant"
                ? "感謝您報名戰鬥陀螺賽，7/26 我們瓶蓋工廠 M 棟見！"
                : "感謝您的購票，7/26 歡迎到場一同觀賽！"}
            </p>
            <div className="bg-white rounded-2xl p-6 text-left max-w-sm mx-auto shadow-sm border border-green-100">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">姓名：</div>
                <div className="font-bold text-right">{form.parentName}</div>
                <div className="text-muted-foreground">聯絡電話：</div>
                <div className="font-bold text-right">{form.phone}</div>
                {successInfo?.mode === "participant" ? (
                  <>
                    <div className="text-muted-foreground">參賽：</div>
                    <div className="font-bold text-right text-indigo-700">本人 1 位</div>
                    {successInfo.companions > 0 && (<>
                      <div className="text-muted-foreground">隨同票：</div>
                      <div className="font-bold text-right">{successInfo.companions} 張</div>
                    </>)}
                  </>
                ) : (
                  <>
                    <div className="text-muted-foreground">入場票：</div>
                    <div className="font-bold text-right text-indigo-700">{successInfo?.spectators} 張</div>
                  </>
                )}
              </div>
            </div>

            {confirmedTokens.length > 0 && (
              <div className="mt-8 bg-white rounded-2xl p-6 max-w-md mx-auto shadow-sm border border-green-100">
                <h3 className="font-bold mb-2 flex items-center justify-center gap-2 text-green-700">
                  <QrCode size={20} /> 您的入場 / 報到 QR Code
                </h3>
                <p className="text-xs text-muted-foreground text-center mb-4">報到時請出示此 QR Code，已寄送至您的 Email。隨同入場票一張 QR 即可供多人入場。</p>
                <div className="grid gap-4" style={{ gridTemplateColumns: confirmedTokens.length > 1 ? "1fr 1fr" : "1fr" }}>
                  {confirmedTokens.map((token, idx) => (
                    <img
                      key={token}
                      src={`/api/qr/${encodeURIComponent(token)}`}
                      alt={`報到 QR ${idx + 1}`}
                      className="w-full max-w-[220px] mx-auto border rounded-lg p-2 bg-white"
                    />
                  ))}
                </div>
              </div>
            )}

            <button onClick={resetForm} className="mt-10 text-green-600 font-bold hover:underline">
              繼續報名
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl md:text-4xl mb-3">線上報名 / 購票</h2>
              <p className="text-muted-foreground">
                參賽費 NT${PARTICIPANT_PRICE}／位（含本人 7/26 入場）；隨同／觀眾一般入場票 NT${COMPANION_PRICE}／張
              </p>
            </div>

            {/* 名額狀態 */}
            <div className="mb-6 rounded-2xl border bg-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Users className="text-indigo-600 w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-bold">線上參賽名額</div>
                  {loadingAvail ? (
                    <div className="h-5 w-24 bg-muted rounded animate-pulse mt-1" />
                  ) : availability ? (
                    <div className="font-bold">
                      {soldOut ? (
                        <span className="text-rose-600">線上報名已額滿</span>
                      ) : (
                        <span>
                          剩餘 <span className="text-indigo-700">{availability.remaining}</span> / {availability.capacity} 位
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="font-bold text-muted-foreground">名額查詢中</div>
                  )}
                </div>
              </div>
            </div>

            {/* 路徑切換 */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <button
                type="button"
                onClick={() => !soldOut && setMode("participant")}
                disabled={soldOut}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-all",
                  mode === "participant" ? "border-indigo-500 bg-indigo-50" : "border-border bg-white hover:border-indigo-300",
                  soldOut && "opacity-50 cursor-not-allowed hover:border-border",
                )}
                data-testid="tab-participant"
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Swords size={16} className="text-indigo-600" /> 我要報名參賽
                </div>
                <div className="text-xs text-muted-foreground">含本人入場，可加購隨同票</div>
              </button>
              <button
                type="button"
                onClick={() => setMode("spectator")}
                className={cn(
                  "rounded-2xl border-2 p-4 text-left transition-all",
                  mode === "spectator" ? "border-indigo-500 bg-indigo-50" : "border-border bg-white hover:border-indigo-300",
                )}
                data-testid="tab-spectator"
              >
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Ticket size={16} className="text-indigo-600" /> 我只購買入場門票
                </div>
                <div className="text-xs text-muted-foreground">隨同／觀眾一般入場</div>
              </button>
            </div>

            {soldOut && mode === "spectator" && (
              <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 flex items-center gap-2">
                <AlertCircle size={16} /> 線上參賽名額已額滿，請現場候補；仍可於此購買一般入場門票到場觀賽。
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center gap-1.5">
                    <User size={15} /> {mode === "participant" ? "選手姓名" : "購票人姓名"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.parentName}
                    onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary outline-none"
                    placeholder="請輸入姓名"
                    data-testid="input-name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center gap-1.5">
                    <Phone size={15} /> 聯絡電話 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary outline-none"
                    placeholder="0912345678"
                    data-testid="input-phone"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 flex items-center gap-1.5">
                    <Mail size={15} /> Email（接收 QR Code 與確認信） <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary outline-none"
                    placeholder="you@example.com"
                    data-testid="input-email"
                    required
                  />
                </div>
              </div>

              {mode === "participant" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5">
                    <div className="font-bold mb-1">參賽（本人）</div>
                    <div className="text-xs text-muted-foreground mb-4">NT${PARTICIPANT_PRICE} · 含本人 7/26 入場</div>
                    <div className="text-2xl font-display font-bold text-indigo-700">1 位</div>
                  </div>
                  <div className="rounded-2xl border-2 border-border bg-white p-5">
                    <div className="font-bold mb-1">加購隨同入場票</div>
                    <div className="text-xs text-muted-foreground mb-4">NT${COMPANION_PRICE}／張 · 7/26 一般入場</div>
                    <Stepper value={companionCount} onChange={setCompanionCount} min={0} max={20} testId="companion" />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5">
                  <div className="font-bold mb-1">一般入場門票</div>
                  <div className="text-xs text-muted-foreground mb-4">NT${COMPANION_PRICE}／張 · 7/26 入場 · 一張 QR 可供多人入場</div>
                  <Stepper value={spectatorCount} onChange={setSpectatorCount} min={1} max={20} testId="spectator" />
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 flex items-center gap-2" data-testid="form-error">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 text-white p-6 flex items-center justify-between">
                <div>
                  <div className="text-sm opacity-80">應付總金額</div>
                  <div className="text-3xl font-display font-bold" data-testid="total-amount">NT${total.toLocaleString()}</div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    "px-8 py-3.5 rounded-xl bg-white text-indigo-700 font-bold text-lg shadow-lg transition-all",
                    "hover:scale-[1.03] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                  )}
                  data-testid="button-submit"
                >
                  {submitting ? "處理中…" : "前往付款"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
