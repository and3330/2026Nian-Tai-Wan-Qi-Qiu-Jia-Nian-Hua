import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2, ArrowRight, Home, Search, MessageCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPaymentStatus,
  useConfirmStripePayment,
  getGetPaymentStatusQueryKey,
} from "@workspace/api-client-react";
import { trackPurchase } from "@/lib/fbPixel";
import { LINE_URL } from "@/components/LineChatBubble";

export default function SuccessPage() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  // `ref` / `provider` are kept only for ad-conversion tracking — they are
  // intentionally NOT shown on screen.
  const ref = params.get("ref") || "";
  const provider = params.get("provider") || "";
  const queryClient = useQueryClient();
  const confirmStripe = useConfirmStripePayment();
  const [confirmed, setConfirmed] = useState(false);

  const { data } = useGetPaymentStatus(ref, {
    query: {
      queryKey: getGetPaymentStatusQueryKey(ref),
      enabled: Boolean(ref),
      refetchInterval: (query) => {
        const status = (query.state.data as { status?: string } | undefined)?.status;
        return status === "paid" ? false : 4000;
      },
    },
  });

  // When arriving from Stripe, ask the server to confirm the session right away
  // in case the webhook hasn't fired yet (best-effort).
  useEffect(() => {
    if (!ref || provider !== "stripe" || confirmed) return;
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
  }, [ref, provider, data?.status, confirmed, confirmStripe, queryClient]);

  // Fire the Meta Pixel Purchase conversion exactly once when the order is paid.
  const [purchaseTracked, setPurchaseTracked] = useState(false);
  useEffect(() => {
    if (purchaseTracked || data?.status !== "paid") return;
    setPurchaseTracked(true);
    trackPurchase({
      value: typeof data.amount === "number" ? data.amount : 0,
      orderId: data.paymentRef || ref,
      contentName: "2026 臺灣氣球嘉年華門票",
    });
  }, [data?.status, data?.amount, data?.paymentRef, ref, purchaseTracked]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12">
      <div
        className="max-w-md w-full bg-white border-2 rounded-3xl shadow-xl p-8 md:p-10 text-center"
        data-testid="success-page"
      >
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-emerald-700 mb-3">付款成功！</h1>
        <p className="text-muted-foreground leading-relaxed">
          感謝您購買 2026 臺灣氣球嘉年華門票。
        </p>
        <p className="text-muted-foreground leading-relaxed">
          我們已將「報名成功確認信」（內含入場 QR Code）寄送至您填寫的 Email，
          請一併查看「收件匣」與「垃圾郵件」資料夾。
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/lookup"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 transition-opacity"
          >
            <Search size={18} /> 查詢我的訂單
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border-2 border-border font-bold hover:bg-muted transition-colors"
          >
            <Home size={18} /> 返回首頁 <ArrowRight size={18} />
          </Link>
        </div>

        <a
          href={LINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <MessageCircle size={16} /> 有疑問？聯絡 LINE 客服
        </a>
      </div>
    </div>
  );
}
