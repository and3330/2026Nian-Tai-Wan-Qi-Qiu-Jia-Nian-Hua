import { useState } from "react";
import { Link } from "wouter";
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Banknote,
  Ticket,
  Mail,
  Phone,
  Calendar,
  Receipt,
  Home,
  ScanLine,
} from "lucide-react";
import { useLookupOrder } from "@workspace/api-client-react";
import type { OrderLookupResult, OrderLookupRegistration } from "@workspace/api-client-react";

const QR_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/qr`;

export default function OrderLookupPage() {
  const [ref, setRef] = useState("");
  const [contact, setContact] = useState("");
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);
  const lookup = useLookupOrder();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = ref.trim();
    const c = contact.trim();
    if (!r || !c) return;
    setSubmittedKey(`${r}::${c}`);
    lookup.mutate({ data: { ref: r, contact: c } });
  };

  const data = lookup.data as OrderLookupResult | undefined;
  const errorMessage =
    lookup.error && (lookup.error as { data?: { error?: string } }).data?.error;

  return (
    <div className="min-h-[70vh] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-bold mb-4">
            <Search size={16} /> 訂單查詢
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">查詢我的訂單</h1>
          <p className="text-muted-foreground">
            輸入訂單編號與當初購票的 Email 或手機號碼，即可查看付款狀態、QR Code 與發票資訊
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white border-2 rounded-3xl shadow-lg p-6 md:p-8 mb-6"
          data-testid="order-lookup-form"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2" htmlFor="lookup-ref">
                訂單編號
              </label>
              <input
                id="lookup-ref"
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value.toUpperCase())}
                placeholder="例如：BCAB12CDXY34"
                className="w-full px-4 py-3 border-2 rounded-xl font-mono focus:border-primary focus:outline-none"
                required
                data-testid="input-lookup-ref"
              />
              <p className="text-xs text-muted-foreground mt-1">
                付款完成後會收到的 BC 開頭代碼，也會顯示在確認信件中。
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2" htmlFor="lookup-contact">
                Email 或手機號碼
              </label>
              <input
                id="lookup-contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="購票時填寫的 Email 或手機"
                className="w-full px-4 py-3 border-2 rounded-xl focus:border-primary focus:outline-none"
                required
                data-testid="input-lookup-contact"
              />
              <p className="text-xs text-muted-foreground mt-1">
                為了保護您的個資，需要同時提供訂單編號與聯絡方式才能查詢。
              </p>
            </div>

            <button
              type="submit"
              disabled={lookup.isPending || !ref.trim() || !contact.trim()}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
              data-testid="button-lookup-submit"
            >
              {lookup.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> 查詢中…
                </>
              ) : (
                <>
                  <Search size={18} /> 查詢訂單
                </>
              )}
            </button>
          </div>
        </form>

        {lookup.isError && submittedKey && (
          <div className="bg-destructive/5 border-2 border-destructive/20 rounded-2xl p-6 text-center" data-testid="lookup-error">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-bold">{errorMessage || "查詢失敗，請稍後再試"}</p>
          </div>
        )}

        {data && submittedKey && <OrderResultCard data={data} />}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary text-sm"
          >
            <Home size={14} /> 返回首頁
          </Link>
        </div>
      </div>
    </div>
  );
}

function OrderResultCard({ data }: { data: OrderLookupResult }) {
  const isPaid = data.status === "paid";
  const isAwaitingTransfer = data.status === "awaiting_transfer";

  return (
    <div className="bg-white border-2 rounded-3xl shadow-xl overflow-hidden" data-testid="lookup-result">
      <div
        className={`px-6 py-5 ${
          isPaid
            ? "bg-emerald-50 border-b-2 border-emerald-200"
            : isAwaitingTransfer
              ? "bg-amber-50 border-b-2 border-amber-200"
              : "bg-slate-50 border-b-2 border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {isPaid ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            ) : isAwaitingTransfer ? (
              <Banknote className="w-8 h-8 text-amber-600" />
            ) : (
              <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
            )}
            <div>
              <h2 className="text-xl font-bold">
                {isPaid ? "已付款" : isAwaitingTransfer ? "等待匯款" : statusLabel(data.status)}
              </h2>
              <p className="text-sm text-muted-foreground font-mono">{data.paymentRef}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">NT$ {data.amount.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{providerLabel(data.provider)}</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isAwaitingTransfer && data.bankInfo && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 space-y-2">
            <h3 className="font-bold flex items-center gap-2">
              <Banknote size={18} /> 匯款資訊
            </h3>
            <div className="text-sm space-y-1">
              <Row label="銀行" value={data.bankInfo.bankName ?? "-"} />
              <Row label="戶名" value={data.bankInfo.accountName ?? "-"} />
              <Row label="帳號" value={data.bankInfo.accountNumber ?? "-"} mono />
              <Row label="金額" value={`NT$ ${data.amount.toLocaleString()}`} />
            </div>
            <p className="text-xs text-amber-800 mt-2">
              匯款後請保留收據，工作人員確認入帳後會自動寄發票券確認信。
            </p>
          </div>
        )}

        <div>
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Ticket size={18} /> 票券（{data.registrations.length} 張票）
          </h3>
          <div className="space-y-3">
            {data.registrations.map((r) => (
              <RegistrationItem key={r.id} reg={r} />
            ))}
          </div>
        </div>

        {data.invoice && (
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Receipt size={18} /> 電子發票
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
              <Row label="狀態" value={invoiceStatusLabel(data.invoice.status)} />
              {data.invoice.invoiceNumber && (
                <Row label="發票號碼" value={data.invoice.invoiceNumber} mono />
              )}
              {data.invoice.invoiceDate && (
                <Row label="開立日期" value={data.invoice.invoiceDate.split("+")[0] ?? data.invoice.invoiceDate} />
              )}
              {data.invoice.randomNumber && (
                <Row label="隨機碼" value={data.invoice.randomNumber} mono />
              )}
              {data.invoice.status === "failed" && data.invoice.errorMessage && (
                <p className="text-xs text-destructive mt-2">{data.invoice.errorMessage}</p>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground bg-slate-50 rounded-xl p-3 leading-relaxed">
          <strong>個資保護提醒：</strong>
          為保護您的個人資料，Email 與手機號碼僅顯示部分字元。如需完整資訊或修改訂單，請來電 02-2720-8889 或寄信至 contact@balloon-carnival.tw。
        </div>
      </div>
    </div>
  );
}

function RegistrationItem({ reg }: { reg: OrderLookupRegistration }) {
  const isPaid = reg.paymentStatus === "paid";
  const checkedIn = !!reg.checkedInAt;
  return (
    <div className="border-2 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="font-bold">{reg.parentName}</div>
          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
            {reg.email && (
              <div className="flex items-center gap-1">
                <Mail size={12} /> {reg.email}
              </div>
            )}
            {reg.phone && (
              <div className="flex items-center gap-1">
                <Phone size={12} /> {reg.phone}
              </div>
            )}
          </div>
        </div>
        <div className="text-right text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar size={12} /> {reg.eventDate}
          </div>
          <div className="mt-1">
            {ticketTypeLabel(reg.ticketType)} × {reg.ticketCount}
          </div>
          {reg.amount != null && reg.amount > 0 && (
            <div className="text-primary font-bold">NT$ {reg.amount.toLocaleString()}</div>
          )}
        </div>
      </div>

      {checkedIn && (
        <div className="bg-emerald-50 text-emerald-700 text-xs px-3 py-2 rounded-lg flex items-center gap-2 mb-3">
          <ScanLine size={14} /> 已於 {new Date(reg.checkedInAt!).toLocaleString("zh-TW")} 完成入場
        </div>
      )}

      {isPaid && reg.qrToken ? (
        <div className="flex flex-col items-center bg-slate-50 rounded-xl p-4">
          <img
            src={`${QR_BASE}/${reg.qrToken}`}
            alt="入場 QR Code"
            className="w-44 h-44 bg-white rounded-lg border"
            data-testid={`qr-${reg.id}`}
          />
          <p className="text-xs text-muted-foreground mt-2">活動當天請出示此 QR Code 給工作人員掃描</p>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground bg-slate-50 rounded-lg px-3 py-2 text-center">
          {paymentStatusMessage(reg.paymentStatus)}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono font-bold" : "font-bold"}>{value}</span>
    </div>
  );
}

function providerLabel(p: string) {
  if (p === "newebpay") return "藍新金流";
  if (p === "stripe") return "Stripe 信用卡";
  if (p === "bank") return "銀行轉帳";
  return p;
}

function statusLabel(s: string) {
  if (s === "paid") return "已付款";
  if (s === "pending") return "處理中";
  if (s === "awaiting_transfer") return "等待匯款";
  if (s === "failed") return "失敗";
  return s;
}

function ticketTypeLabel(t: string | null | undefined) {
  if (t === "single") return "單日票";
  if (t === "combo") return "兩日套票";
  if (t === "conference") return "研討會票";
  return t || "票券";
}

function invoiceStatusLabel(s?: string | null) {
  if (s === "issued") return "已開立";
  if (s === "pending") return "等待開立";
  if (s === "failed") return "開立失敗";
  if (s === "voided") return "已作廢";
  return s || "—";
}

function paymentStatusMessage(s: string) {
  if (s === "awaiting_transfer") return "完成匯款後票券會在這裡顯示";
  if (s === "pending") return "付款處理中，請稍候";
  if (s === "failed") return "付款失敗，請重新購買或聯絡客服";
  return "票券將在付款完成後顯示";
}
