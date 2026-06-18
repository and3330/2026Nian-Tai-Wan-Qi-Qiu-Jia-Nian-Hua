import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2, AlertCircle, Loader2, Banknote, ArrowRight, Home, MessageCircle } from "lucide-react";
import { useGetPaymentStatus, useConfirmStripePayment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPaymentStatusQueryKey } from "@workspace/api-client-react";
import { trackPurchase } from "@/lib/fbPixel";
import { LINE_URL } from "@/components/LineChatBubble";

export default function PaymentResultPage() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const ref = params.get("ref") || "";
  const provider = params.get("provider") || "";
  const cancelled = params.get("cancelled") === "1";
  const queryClient = useQueryClient();
  const confirmStripe = useConfirmStripePayment();
  const [confirmed, setConfirmed] = useState(false);

  const statusQueryKey = getGetPaymentStatusQueryKey(ref);
  const { data, isLoading, error, refetch } = useGetPaymentStatus(ref, {
    query: {
      queryKey: statusQueryKey,
      enabled: Boolean(ref),
      refetchInterval: (query) => {
        const status = (query.state.data as { status?: string } | undefined)?.status;
        return status === "paid" ? false : 4000;
      },
    },
  });

  // Best-effort: when arriving from Stripe success URL, ask the server to
  // confirm the session immediately (in case the webhook hasn't fired yet).
  useEffect(() => {
    if (!ref) return;
    if (provider !== "stripe") return;
    if (cancelled) return;
    if (confirmed) return;
    if (data?.status === "paid") return;
    setConfirmed(true);
    confirmStripe
      .mutateAsync({ data: { paymentRef: ref } })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getGetPaymentStatusQueryKey(ref) });
      })
      .catch(() => {
        /* status polling will continue */
      });
  }, [ref, provider, cancelled, data?.status, confirmed, confirmStripe, queryClient]);

  // Fire the Meta Pixel Purchase conversion exactly once when the order is paid.
  const [purchaseTracked, setPurchaseTracked] = useState(false);
  useEffect(() => {
    if (purchaseTracked) return;
    if (data?.status !== "paid") return;
    setPurchaseTracked(true);
    trackPurchase({
      value: typeof data.amount === "number" ? data.amount : 0,
      orderId: data.paymentRef || ref,
      contentName: "2026 臺灣氣球嘉年華門票",
    });
  }, [data?.status, data?.amount, data?.paymentRef, ref, purchaseTracked]);

  if (!ref) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">付款可能已完成</h1>
        <p className="text-muted-foreground mb-2 max-w-md">
          這個畫面沒有帶到付款編號（在 LINE 等內建瀏覽器付款後常會發生）。
        </p>
        <p className="text-muted-foreground mb-6 max-w-md">
          如果您剛剛已完成刷卡，款項通常已成功收到，系統會將含入場 QR Code 的確認信寄到您填寫的 Email。您也可以用手機或 Email 查詢訂單狀態。
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link href="/lookup" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 transition-opacity">
            <ArrowRight size={18} /> 查詢我的訂單
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-border font-bold hover:bg-muted transition-colors">
            <Home size={18} /> 返回首頁
          </Link>
        </div>
        <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <MessageCircle size={16} /> 有疑問？聯絡 LINE 客服
        </a>
      </div>
    );
  }

  const status = data?.status;
  const isPaid = status === "paid";
  const isAwaitingTransfer = status === "awaiting_transfer";
  const isPending = !isPaid && !isAwaitingTransfer;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full bg-white border-2 rounded-3xl shadow-xl p-8 md:p-10 text-center" data-testid="payment-result">
        {error ? (
          <>
            <AlertCircle className="w-20 h-20 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-destructive mb-2">查詢付款狀態失敗</h1>
            <p className="text-muted-foreground mb-6">編號 {ref}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-6 py-3 rounded-full bg-primary text-white font-bold"
            >
              重試
            </button>
          </>
        ) : isLoading || !data ? (
          <>
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">查詢付款狀態中…</h1>
            <p className="text-muted-foreground">編號 {ref}</p>
          </>
        ) : isPaid ? (
          <>
            <CheckCircle2 className="w-24 h-24 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-emerald-700 mb-2" data-testid="payment-result-paid">付款成功！</h1>
            <p className="text-muted-foreground mb-6">感謝您購買 2026 臺灣氣球嘉年華門票</p>
            <ResultDetails data={data} />
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-left text-sm space-y-3" data-testid="payment-result-email-notice">
              <p className="text-emerald-800 leading-relaxed">
                我們已將「報名成功確認信」（內含入場 QR Code）寄送至您填寫的電子信箱，
                請一併查看「收件匣」與「垃圾郵件」資料夾。非常感謝您的支持！
              </p>
              <p className="text-emerald-700/90 leading-relaxed">
                若未收到信件，歡迎加入官方 LINE，我們將協助您處理。
              </p>
              <a
                href={LINE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#06C755] text-white font-bold hover:opacity-90 transition-opacity"
                data-testid="payment-result-line-link"
              >
                <MessageCircle size={18} fill="white" stroke="#06C755" /> 加入官方 LINE
              </a>
            </div>
            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 transition-opacity"
            >
              返回首頁 <ArrowRight size={18} />
            </Link>
          </>
        ) : isAwaitingTransfer ? (
          <>
            <Banknote className="w-20 h-20 text-emerald-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">等待匯款中</h1>
            <p className="text-muted-foreground mb-4">請於 3 日內依下列資訊完成匯款，主辦單位將會在收到款項後與您聯繫。</p>
            <ResultDetails data={data} />
          </>
        ) : (
          <>
            {cancelled ? (
              <>
                <AlertCircle className="w-20 h-20 text-amber-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-amber-700 mb-2">您已取消付款</h1>
                <p className="text-muted-foreground mb-6">如要重新付款，請回到報名頁面再試一次。</p>
              </>
            ) : (
              <>
                <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
                <h1 className="text-2xl font-bold mb-2">確認付款結果中…</h1>
                <p className="text-muted-foreground">系統正在等待{provider === "stripe" ? " Stripe" : provider === "newebpay" ? "藍新金流" : "金流"}通知，這通常需要幾秒鐘。</p>
              </>
            )}
            <ResultDetails data={data} />
            {isPending && !cancelled && (
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-6 px-6 py-3 rounded-full border-2 border-primary text-primary font-bold hover:bg-primary/5"
              >
                立即重新查詢
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResultDetails({
  data,
}: {
  data: {
    paymentRef: string;
    provider: string;
    amount: number;
    status: string;
    itemName: string;
    paidAt?: Date | string | null;
    bankInfo?: { bankName?: string; accountName?: string; accountNumber?: string } | null;
    invoice?: {
      status?: string;
      invoiceType?: string;
      invoiceNumber?: string | null;
      invoiceDate?: string | null;
      randomNumber?: string | null;
      errorMessage?: string | null;
    } | null;
  };
}) {
  const bank = data.bankInfo;
  const invoice = data.invoice;
  return (
    <div className="bg-muted/40 rounded-2xl p-5 text-left text-sm space-y-2 mt-2">
      <Row label="訂單編號" value={data.paymentRef} mono />
      <Row label="付款方式" value={providerLabel(data.provider)} />
      <Row label="金額" value={`NT$ ${data.amount.toLocaleString()}`} />
      <Row label="商品" value={data.itemName} />
      <Row label="狀態" value={statusLabel(data.status)} />
      {bank && (
        <>
          <div className="border-t border-border pt-2 mt-2 text-muted-foreground text-xs font-bold">匯款資訊</div>
          {bank.bankName && <Row label="銀行" value={bank.bankName} />}
          {bank.accountName && <Row label="戶名" value={bank.accountName} />}
          {bank.accountNumber && <Row label="帳號" value={bank.accountNumber} mono />}
        </>
      )}
      {invoice && (
        <>
          <div className="border-t border-border pt-2 mt-2 text-muted-foreground text-xs font-bold">電子發票（綠界）</div>
          <Row label="發票類型" value={invoiceTypeLabel(invoice.invoiceType)} />
          <Row label="發票狀態" value={invoiceStatusLabel(invoice.status)} />
          {invoice.invoiceNumber && <Row label="發票號碼" value={invoice.invoiceNumber} mono />}
          {invoice.invoiceDate && <Row label="開立日期" value={invoice.invoiceDate} />}
          {invoice.randomNumber && <Row label="隨機碼" value={invoice.randomNumber} mono />}
          {invoice.status === "failed" && invoice.errorMessage && (
            <div className="text-xs text-destructive">{invoice.errorMessage}</div>
          )}
          {invoice.status === "pending" && (
            <div className="text-xs text-muted-foreground">付款完成後將自動開立發票，請稍候。</div>
          )}
        </>
      )}
    </div>
  );
}

function invoiceTypeLabel(t?: string) {
  if (t === "personal") return "個人發票";
  if (t === "company") return "公司發票";
  if (t === "donation") return "捐贈發票";
  return t || "—";
}

function invoiceStatusLabel(s?: string) {
  if (s === "issued") return "已開立";
  if (s === "pending") return "等待開立";
  if (s === "failed") return "開立失敗";
  if (s === "voided") return "已作廢";
  return s || "—";
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
