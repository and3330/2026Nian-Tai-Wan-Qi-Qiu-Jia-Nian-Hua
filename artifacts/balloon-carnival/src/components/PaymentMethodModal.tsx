import { useState } from "react";
import { CreditCard, Building2, Banknote, X, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useInitiatePayment,
  type InitiatePaymentResponse,
} from "@workspace/api-client-react";

type Method = "newebpay" | "stripe" | "bank";

interface PaymentMethodModalProps {
  open: boolean;
  registrationIds: number[];
  amount: number;
  itemLabel: string;
  payerName: string;
  payerPhone: string;
  defaultEmail?: string;
  onClose: () => void;
  onCompleted: () => void;
}

interface BankInfoState {
  paymentRef: string;
  amount: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  memo: string;
}

const methodOptions: Array<{
  key: Method;
  title: string;
  description: string;
  icon: typeof CreditCard;
  accent: string;
}> = [
  {
    key: "newebpay",
    title: "藍新金流",
    description: "信用卡 / ATM 虛擬帳號（離開網站至藍新付款頁）",
    icon: CreditCard,
    accent: "from-blue-500 to-indigo-500",
  },
  {
    key: "stripe",
    title: "Stripe 信用卡",
    description: "支援海外信用卡，使用 Stripe Checkout 結帳",
    icon: Building2,
    accent: "from-purple-500 to-fuchsia-500",
  },
  {
    key: "bank",
    title: "銀行轉帳 / ATM 匯款",
    description: "完成報名後將顯示匯款帳號，請於 3 日內完成轉帳",
    icon: Banknote,
    accent: "from-emerald-500 to-green-500",
  },
];

function submitFormRedirect(apiUrl: string, params: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = apiUrl;
  for (const [key, value] of Object.entries(params)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function PaymentMethodModal({
  open,
  registrationIds,
  amount,
  itemLabel,
  payerName,
  payerPhone,
  defaultEmail,
  onClose,
  onCompleted,
}: PaymentMethodModalProps) {
  const [selected, setSelected] = useState<Method | null>(null);
  const [email, setEmail] = useState(defaultEmail || "");
  const [error, setError] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfoState | null>(null);
  const initiateMutation = useInitiatePayment();

  if (!open) return null;

  const isSubmitting = initiateMutation.isPending;

  const handleConfirm = async () => {
    setError(null);
    if (!selected) {
      setError("請選擇一種付款方式");
      return;
    }
    try {
      const result = (await initiateMutation.mutateAsync({
        data: {
          registrationIds,
          method: selected,
          email: email.trim() || undefined,
        },
      })) as InitiatePaymentResponse;

      if (result.type === "form_redirect" && result.apiUrl && result.params) {
        submitFormRedirect(result.apiUrl, result.params as Record<string, string>);
        return;
      }
      if (result.type === "redirect" && result.url) {
        window.location.assign(result.url);
        return;
      }
      if (result.type === "bank_info" && result.bankInfo) {
        setBankInfo({
          paymentRef: result.paymentRef,
          amount: result.amount,
          bankName: result.bankInfo.bankName || "",
          accountName: result.bankInfo.accountName || "",
          accountNumber: result.bankInfo.accountNumber || "",
          memo: result.bankInfo.memo || "",
        });
        return;
      }
      setError("未收到有效的付款資訊，請稍後再試。");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "付款初始化失敗，請稍後再試";
      setError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" data-testid="payment-modal">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full my-8 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-xl font-bold">付款方式</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{itemLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBankInfo(null);
              onClose();
            }}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted"
            aria-label="關閉"
            data-testid="payment-modal-close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="bg-muted/40 rounded-2xl p-4 mb-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">應付金額</div>
              <div className="text-3xl font-bold text-primary" data-testid="payment-amount">NT$ {amount.toLocaleString()}</div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>{payerName}</div>
              <div>{payerPhone}</div>
            </div>
          </div>

          {bankInfo ? (
            <div data-testid="payment-bank-info">
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold mb-3">
                  <CheckCircle2 size={20} /> 報名已建立 — 請完成匯款
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">銀行</dt>
                    <dd className="font-bold">{bankInfo.bankName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">戶名</dt>
                    <dd className="font-bold">{bankInfo.accountName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">帳號</dt>
                    <dd className="font-mono font-bold text-emerald-700 text-base" data-testid="bank-account-number">
                      {bankInfo.accountNumber}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">應匯金額</dt>
                    <dd className="font-bold">NT$ {bankInfo.amount.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">訂單編號</dt>
                    <dd className="font-mono font-bold" data-testid="bank-order-ref">{bankInfo.paymentRef}</dd>
                  </div>
                </dl>
                <p className="text-xs text-emerald-700 mt-4 leading-relaxed">{bankInfo.memo}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBankInfo(null);
                  onCompleted();
                }}
                className="w-full py-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                data-testid="bank-info-confirm"
              >
                我已記下匯款資訊
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-5">
                {methodOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = selected === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setSelected(opt.key)}
                      className={cn(
                        "w-full text-left rounded-2xl border-2 p-4 flex items-center gap-4 transition-all",
                        active
                          ? "border-primary bg-primary/5 shadow-md"
                          : "border-border hover:border-primary/40 hover:shadow-sm",
                      )}
                      data-testid={`payment-method-${opt.key}`}
                    >
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br",
                          opt.accent,
                        )}
                      >
                        <Icon size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base">{opt.title}</div>
                        <div className="text-sm text-muted-foreground">{opt.description}</div>
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 shrink-0",
                          active ? "border-primary bg-primary" : "border-muted-foreground/30",
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mb-4">
                <label className="text-xs font-bold text-muted-foreground mb-1 block">電子郵件（選填，用於付款收據）</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary transition-colors text-sm"
                  data-testid="payment-email"
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl p-3 mb-4" data-testid="payment-error">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || !selected}
                className="w-full py-4 rounded-xl font-bold text-white bg-primary disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                data-testid="payment-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> 處理中…
                  </>
                ) : (
                  "確認付款"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
