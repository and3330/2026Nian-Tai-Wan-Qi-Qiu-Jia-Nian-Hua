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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentMethodModal } from "@/components/PaymentMethodModal";

const PARTICIPANT_PRICE = 600;
const COMPANION_PRICE = 200;

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
  { icon: Clock, label: "報到時間", value: "11:00 – 12:30" },
  { icon: MapPin, label: "報到地點", value: "臺北瓶蓋工廠 M 棟" },
  { icon: Swords, label: "開賽時間", value: "13:00 開賽" },
];

export default function TORPage() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(true);

  const [form, setForm] = useState({ parentName: "", phone: "", email: "" });
  const [participantCount, setParticipantCount] = useState(1);
  const [companionCount, setCompanionCount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
      // soft-fail: form still usable, server enforces the cap
    } finally {
      setLoadingAvail(false);
    }
  };

  useEffect(() => {
    loadAvailability();
    const t = setInterval(loadAvailability, 30000);
    return () => clearInterval(t);
  }, []);

  const total = participantCount * PARTICIPANT_PRICE + companionCount * COMPANION_PRICE;
  const soldOut = availability?.soldOut ?? false;
  const remaining = availability?.remaining ?? null;
  const insufficient = remaining != null && participantCount > remaining;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.parentName.trim()) { setError("請填寫報名人姓名"); return; }
    if (!form.phone.trim()) { setError("請填寫聯絡電話"); return; }
    if (participantCount < 1) { setError("參賽人數至少 1 位"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/registrations/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: form.parentName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          participantCount,
          companionCount,
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
      const labelParts = [`參賽 × ${participantCount}`];
      if (companionCount > 0) labelParts.push(`隨同 × ${companionCount}`);
      setPendingPayment({
        registrationIds: created.map((r) => r.id),
        amount: total,
        itemLabel: `戰鬥陀螺賽（${labelParts.join("、")}）`,
      });
      loadAvailability();
    } catch {
      setError("報名失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
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
            <Trophy size={16} /> 2026 臺灣氣球嘉年華 · 特別賽事
          </div>
          <h1 className="font-display text-4xl md:text-6xl mb-4 text-indigo-900">戰鬥陀螺賽</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            7/26（日）於臺北瓶蓋工廠 M 棟登場，限額 {availability?.capacity ?? 128} 位參賽者，捉對廝殺、爭奪冠軍寶座！
          </p>
        </div>
      </section>

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

      <section className="py-14 md:py-20 px-4 max-w-3xl mx-auto w-full">
        {success ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-10 md:p-12 text-center shadow-lg">
            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-green-800 mb-3">報名成功！</h2>
            <p className="text-green-700 text-lg mb-8">
              感謝您報名戰鬥陀螺賽，7/26 我們瓶蓋工廠 M 棟見！
            </p>
            <div className="bg-white rounded-2xl p-6 text-left max-w-sm mx-auto shadow-sm border border-green-100">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">報名人：</div>
                <div className="font-bold text-right">{form.parentName}</div>
                <div className="text-muted-foreground">聯絡電話：</div>
                <div className="font-bold text-right">{form.phone}</div>
                <div className="text-muted-foreground">參賽人數：</div>
                <div className="font-bold text-right text-indigo-700">{participantCount} 位</div>
                {companionCount > 0 && (<>
                  <div className="text-muted-foreground">隨同票：</div>
                  <div className="font-bold text-right">{companionCount} 張</div>
                </>)}
              </div>
            </div>

            {confirmedTokens.length > 0 && (
              <div className="mt-8 bg-white rounded-2xl p-6 max-w-md mx-auto shadow-sm border border-green-100">
                <h3 className="font-bold mb-2 flex items-center justify-center gap-2 text-green-700">
                  <QrCode size={20} /> 您的入場 / 報到 QR Code
                </h3>
                <p className="text-xs text-muted-foreground text-center mb-4">報到時請出示此 QR Code。已寄送至您的 Email。</p>
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

            <button
              onClick={() => {
                setSuccess(false);
                setConfirmedTokens([]);
                setForm({ parentName: "", phone: "", email: "" });
                setParticipantCount(1);
                setCompanionCount(0);
              }}
              className="mt-10 text-green-600 font-bold hover:underline"
            >
              繼續報名
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl md:text-4xl mb-3">線上報名</h2>
              <p className="text-muted-foreground">
                參賽費 NT${PARTICIPANT_PRICE}／位（含本人 7/26 入場），隨同親友可加購一般入場票 NT${COMPANION_PRICE}／張
              </p>
            </div>

            {/* 名額狀態 */}
            <div className="mb-8 rounded-2xl border bg-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Users className="text-indigo-600 w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-bold">參賽名額</div>
                  {loadingAvail ? (
                    <div className="h-5 w-24 bg-muted rounded animate-pulse mt-1" />
                  ) : availability ? (
                    <div className="font-bold">
                      {soldOut ? (
                        <span className="text-rose-600">已額滿</span>
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

            {soldOut ? (
              <div className="rounded-3xl border-2 border-rose-200 bg-rose-50 p-10 text-center">
                <AlertCircle className="w-14 h-14 text-rose-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-rose-800 mb-2">參賽名額已額滿</h3>
                <p className="text-rose-700">感謝您的支持！歡迎購買一般門票於 7/26 到場觀賽。</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid gap-5">
                  <div>
                    <label className="block text-sm font-bold mb-2 flex items-center gap-1.5">
                      <User size={15} /> 報名人姓名 <span className="text-rose-500">*</span>
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
                      <Mail size={15} /> Email（接收 QR Code 與確認信）
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-primary outline-none"
                      placeholder="you@example.com"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5">
                    <div className="font-bold mb-1">參賽人數</div>
                    <div className="text-xs text-muted-foreground mb-4">NT${PARTICIPANT_PRICE}／位 · 含本人 7/26 入場</div>
                    <Stepper value={participantCount} onChange={setParticipantCount} min={1} max={10} testId="participant" />
                  </div>
                  <div className="rounded-2xl border-2 border-border bg-white p-5">
                    <div className="font-bold mb-1">隨同入場票</div>
                    <div className="text-xs text-muted-foreground mb-4">NT${COMPANION_PRICE}／張 · 7/26 一般入場</div>
                    <Stepper value={companionCount} onChange={setCompanionCount} min={0} max={20} testId="companion" />
                  </div>
                </div>

                {insufficient && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 flex items-center gap-2">
                    <AlertCircle size={16} /> 參賽名額僅剩 {remaining} 位，請調整參賽人數。
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
                    disabled={submitting || insufficient}
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
            )}
          </>
        )}
      </section>
    </div>
  );
}
