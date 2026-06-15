import { useState } from "react";
import { CreditCard, Building2, Banknote, X, Loader2, CheckCircle2, FileText, User, Heart, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useInitiatePayment,
  type InitiatePaymentResponse,
} from "@workspace/api-client-react";

type Method = "newebpay" | "stripe" | "bank";
type InvoiceType = "personal" | "company" | "donation";
type CarrierType = "phone_barcode" | "citizen_certificate" | "ecpay_carrier" | "";

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
    key: "bank",
    title: "銀行轉帳 / ATM 匯款",
    description: "完成報名後將顯示匯款帳號，請於 3 日內完成轉帳",
    icon: Banknote,
    accent: "from-emerald-500 to-green-500",
  },
];

const invoiceTypeOptions: Array<{ key: InvoiceType; title: string; desc: string; icon: typeof User }> = [
  { key: "personal", title: "個人發票", desc: "可使用手機條碼或自然人憑證載具", icon: User },
  { key: "company", title: "公司發票", desc: "需填寫 8 碼統一編號與公司抬頭", icon: Building2 },
  { key: "donation", title: "捐贈發票", desc: "捐贈給社福團體，需填寫愛心碼", icon: Heart },
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

  // Invoice fields
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("personal");
  const [carrierType, setCarrierType] = useState<CarrierType>("phone_barcode");
  const [carrierNum, setCarrierNum] = useState("");
  const [taxId, setTaxId] = useState("");
  const [companyTitle, setCompanyTitle] = useState("");
  const [loveCode, setLoveCode] = useState("");

  const initiateMutation = useInitiatePayment();

  if (!open) return null;

  const isSubmitting = initiateMutation.isPending;

  const handleConfirm = async () => {
    setError(null);
    if (!selected) {
      setError("請選擇一種付款方式");
      return;
    }
    if (!email.trim() && !payerPhone.trim()) {
      setError("電子發票需要 Email 或手機其中一項，請填寫 Email");
      return;
    }

    const invoicePayload: Record<string, string> = { invoiceType };
    if (invoiceType === "personal") {
      invoicePayload.carrierType = carrierType || "";
      if (carrierType === "phone_barcode" || carrierType === "citizen_certificate") {
        if (!carrierNum.trim()) {
          setError(carrierType === "phone_barcode" ? "請輸入手機條碼" : "請輸入自然人憑證");
          return;
        }
        invoicePayload.carrierNum = carrierNum.trim().toUpperCase();
      }
    } else if (invoiceType === "company") {
      if (!/^\d{8}$/.test(taxId.trim())) {
        setError("請輸入 8 碼統一編號");
        return;
      }
      if (!companyTitle.trim()) {
        setError("請輸入公司抬頭");
        return;
      }
      invoicePayload.taxId = taxId.trim();
      invoicePayload.companyTitle = companyTitle.trim();
    } else {
      if (!loveCode.trim()) {
        setError("請輸入捐贈愛心碼");
        return;
      }
      invoicePayload.loveCode = loveCode.trim();
    }

    try {
      const result = (await initiateMutation.mutateAsync({
        data: {
          registrationIds,
          method: selected,
          email: email.trim() || undefined,
          invoice: invoicePayload as never,
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
                <p className="text-xs text-emerald-700 mt-2 leading-relaxed">主辦單位確認入帳後，將自動為您開立電子發票並寄送至您的 Email / 手機載具。</p>
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
                <label className="text-xs font-bold text-muted-foreground mb-1 block">電子郵件（用於付款收據與發票寄送）</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full px-4 py-3 rounded-xl bg-background border-2 border-border focus:outline-none focus:border-primary transition-colors text-sm"
                  data-testid="payment-email"
                />
              </div>

              {/* ECPay invoice section */}
              <div className="border-2 border-dashed border-border rounded-2xl p-4 mb-4 bg-muted/20">
                <div className="flex items-center gap-2 mb-3 text-sm font-bold">
                  <FileText size={16} className="text-primary" /> 電子發票（綠界）
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {invoiceTypeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const active = invoiceType === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setInvoiceType(opt.key)}
                        className={cn(
                          "rounded-xl border-2 p-3 text-center transition-all",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 bg-white",
                        )}
                        data-testid={`invoice-type-${opt.key}`}
                      >
                        <Icon size={18} className={cn("mx-auto mb-1", active ? "text-primary" : "text-muted-foreground")} />
                        <div className="text-xs font-bold">{opt.title}</div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  {invoiceTypeOptions.find((o) => o.key === invoiceType)?.desc}
                </p>

                {invoiceType === "personal" && (
                  <div className="space-y-2">
                    <select
                      value={carrierType}
                      onChange={(e) => {
                        setCarrierType(e.target.value as CarrierType);
                        setCarrierNum("");
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-white border-2 border-border focus:outline-none focus:border-primary text-sm"
                      data-testid="invoice-carrier-type"
                    >
                      <option value="phone_barcode">手機條碼載具</option>
                      <option value="citizen_certificate">自然人憑證</option>
                      <option value="ecpay_carrier">綠界會員載具</option>
                      <option value="">紙本發票</option>
                    </select>
                    {(carrierType === "phone_barcode" || carrierType === "citizen_certificate") && (
                      <div className="relative">
                        <Smartphone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={carrierNum}
                          onChange={(e) => setCarrierNum(e.target.value)}
                          placeholder={
                            carrierType === "phone_barcode"
                              ? "/ABC+123（共 8 碼）"
                              : "AB12345678901234（共 16 碼）"
                          }
                          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border-2 border-border focus:outline-none focus:border-primary text-sm font-mono uppercase"
                          data-testid="invoice-carrier-num"
                        />
                      </div>
                    )}
                  </div>
                )}

                {invoiceType === "company" && (
                  <div className="space-y-2">
                    <input
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="統一編號（8 碼）"
                      className="w-full px-3 py-2 rounded-lg bg-white border-2 border-border focus:outline-none focus:border-primary text-sm font-mono"
                      data-testid="invoice-tax-id"
                    />
                    <input
                      value={companyTitle}
                      onChange={(e) => setCompanyTitle(e.target.value)}
                      placeholder="公司抬頭"
                      className="w-full px-3 py-2 rounded-lg bg-white border-2 border-border focus:outline-none focus:border-primary text-sm"
                      data-testid="invoice-company-title"
                    />
                  </div>
                )}

                {invoiceType === "donation" && (
                  <input
                    value={loveCode}
                    onChange={(e) => setLoveCode(e.target.value.replace(/\D/g, "").slice(0, 7))}
                    placeholder="愛心碼（3-7 碼數字，例如：168001）"
                    className="w-full px-3 py-2 rounded-lg bg-white border-2 border-border focus:outline-none focus:border-primary text-sm font-mono"
                    data-testid="invoice-love-code"
                  />
                )}
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
