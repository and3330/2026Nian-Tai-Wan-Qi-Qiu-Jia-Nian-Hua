import { tx, getLocale, useI18n, txApi } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2, CheckCircle2, XCircle, Landmark } from "lucide-react";

interface RefundInfo {
  id: number;
  paymentRef: string;
  buyerName: string;
  status: string;
  refundAmount: number | null;
  bankInfoSubmittedAt: string | null;
  createdAt: string;
}

const FIELDS = () => ([
  { key: "purchaseInfo", label: tx("購買的時間、日期"), placeholder: tx("例如：2026/06/12 下午購買，入場日 7/25"), max: 200 },
  { key: "name", label: tx("姓名"), placeholder: tx("退款聯絡人姓名"), max: 100 },
  { key: "phone", label: tx("電話／手機"), placeholder: tx("例如：0912-345-678"), max: 50 },
  { key: "bankName", label: tx("銀行名稱"), placeholder: tx("例如：國泰世華銀行"), max: 100 },
  { key: "bankBranch", label: tx("分行"), placeholder: tx("例如：南港分行"), max: 100 },
  { key: "bankAccountName", label: tx("戶名"), placeholder: tx("帳戶戶名"), max: 100 },
  { key: "bankAccountNumber", label: tx("帳號"), placeholder: tx("請輸入數字帳號"), max: 30 },
] as const);

type FieldKey = ReturnType<typeof FIELDS>[number]["key"];

export default function RefundInfoPage() {
  useI18n();
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<RefundInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    purchaseInfo: "",
    name: "",
    phone: "",
    bankName: "",
    bankBranch: "",
    bankAccountName: "",
    bankAccountNumber: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/refund-info/${encodeURIComponent(token || "")}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(txApi(data.error) || tx("連結無效或已失效"));
          return;
        }
        setInfo(data);
      } catch {
        if (!cancelled) setLoadError(tx("載入失敗，請稍後再試"));
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async () => {
    setSubmitError(null);
    for (const f of FIELDS()) {
      if (!values[f.key].trim()) {
        setSubmitError(tx("請填寫「{0}」", [f.label]));
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/refund-info/${encodeURIComponent(token || "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setSubmitError(txApi(data.error) || tx("提交失敗 ({0})", [res.status]));
        return;
      }
      setDoneMessage(txApi(data.message) || tx("已收到您的退款帳戶資料。退款需要 7 到 14 個工作天，敬請耐心等候。"));
    } catch (err) {
      setSubmitError(txApi((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-3xl border shadow-sm p-8">
          <h1 className="font-display text-2xl mb-2 flex items-center gap-2">
            <Landmark className="text-primary" /> {tx("退款資料表單")}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {tx("請填寫以下資訊，我們將統一進行退款作業。退款需要 7 到 14 個工作天。")}
          </p>

          {loadError ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-center gap-2">
              <XCircle size={18} /> {loadError}
            </div>
          ) : !info ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin inline mr-2" /> {tx("載入中…")}
            </div>
          ) : doneMessage ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-emerald-800">
              <p className="font-bold flex items-center gap-2 mb-1">
                <CheckCircle2 size={20} /> {tx("提交成功")}
              </p>
              <p className="text-sm">{doneMessage}</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-muted/40 p-4 text-sm mb-6 space-y-1">
                <div><span className="text-muted-foreground">{tx("訂單編號：")}</span><span className="font-mono font-bold">{info.paymentRef}</span></div>
                <div><span className="text-muted-foreground">{tx("申請人：")}</span>{info.buyerName}</div>
                {info.refundAmount != null && (
                  <div><span className="text-muted-foreground">{tx("預計退款金額：")}</span><strong className="text-primary">NT$ {info.refundAmount.toLocaleString()}</strong></div>
                )}
                {info.bankInfoSubmittedAt && (
                  <div className="text-amber-700 pt-1">
                    {tx("您已於 {0} 提交過資料，再次送出將覆蓋先前的內容。", [new Date(info.bankInfoSubmittedAt).toLocaleString(getLocale())])}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {FIELDS().map((f) => (
                  <label key={f.key} className="block text-sm">
                    <span className="block mb-1 font-medium">{f.label} <span className="text-red-700">*</span></span>
                    <input
                      type="text"
                      value={values[f.key]}
                      maxLength={f.max}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-primary"
                      inputMode={f.key === "bankAccountNumber" ? "numeric" : undefined}
                      data-testid={`input-refund-${f.key}`}
                    />
                  </label>
                ))}

                {submitError && (
                  <p className="text-sm text-red-700 flex items-center gap-2">
                    <XCircle size={16} /> {submitError}
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="button-refund-submit"
                >
                  {submitting ? <><Loader2 size={18} className="animate-spin" /> {tx("提交中…")}</> : tx("提交退款資料")}
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  {tx("提交後我們將統一進行退款作業，退款需要 7 到 14 個工作天。")}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
