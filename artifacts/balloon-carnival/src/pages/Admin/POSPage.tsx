import { useState, useEffect, useRef, useCallback } from "react";
import { ReceiptText, Search, CheckCircle2, AlertTriangle, XCircle, Camera, CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PosRegistration = {
  id: number;
  parentName: string;
  phone: string;
  email: string | null;
  eventDate: string;
  ticketType: string | null;
  ticketCount: number;
  checkedInAt: string | null;
};

type PosInvoice = {
  id: number;
  amount: number;
  status: string;
  invoiceNumber: string | null;
  createdAt: string;
};

type LookupResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; reg: PosRegistration; recentInvoices: PosInvoice[]; token: string }
  | { kind: "error"; message: string };

type IssueState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "issued"; invoiceNumber: string | null; amount: number }
  | { kind: "failed"; message: string };

const SCANNER_ELEMENT_ID = "pos-qr-scanner-container";
const FILE_SCAN_ELEMENT_ID = "pos-qr-file-scan-container";

function describeCameraError(err: unknown): string {
  const name = (err as { name?: string })?.name || "";
  const msg = (err as { message?: string })?.message || String(err);
  const insecure =
    typeof window !== "undefined" &&
    !window.isSecureContext &&
    window.location.hostname !== "localhost";
  if (insecure) {
    return "瀏覽器基於安全限制，必須在 https 安全連線下才能開啟相機。請改用「拍照掃描」或確認網址為 https。";
  }
  if (name === "NotAllowedError" || /permission|denied/i.test(msg)) {
    return "相機權限被拒絕。請到瀏覽器設定允許本網站使用相機，或改用下方「拍照掃描」。";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "找不到可用的後置相機，請改用下方「拍照掃描」。";
  }
  if (name === "NotReadableError") {
    return "相機被其他程式佔用，請關閉其他相機 App 後再試，或改用下方「拍照掃描」。";
  }
  return `${msg || "無法啟動相機"}。若使用 LINE / FB / IG 內建瀏覽器，請改用 Safari 或 Chrome 開啟，或使用下方「拍照掃描」。`;
}

export default function POSPage() {
  const [tokenInput, setTokenInput] = useState("");
  const [result, setResult] = useState<LookupResult>({ kind: "idle" });
  const [amountInput, setAmountInput] = useState("");
  const [issueState, setIssueState] = useState<IssueState>({ kind: "idle" });
  const [carrierChoice, setCarrierChoice] = useState<"ecpay_carrier" | "phone_barcode">("ecpay_carrier");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [decodingFile, setDecodingFile] = useState(false);
  const scannerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  // What the shared camera is currently scanning for: the ticket QR, or the
  // customer's phone-barcode carrier (財政部手機條碼, Code39 "/XXXXXXX").
  const scanTargetRef = useRef<"ticket" | "carrier">("ticket");

  const performLookup = useCallback(async (token: string) => {
    if (!token) return;
    setResult({ kind: "loading" });
    setIssueState({ kind: "idle" });
    setAmountInput("");
    setCarrierChoice("ecpay_carrier");
    setBarcodeInput("");
    try {
      const res = await fetch(`/api/admin/pos/lookup/${encodeURIComponent(token)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setResult({ kind: "error", message: err.error || `查詢失敗 (${res.status})` });
        return;
      }
      const data = await res.json();
      setResult({
        kind: "found",
        reg: data.registration,
        recentInvoices: data.recentInvoices || [],
        token,
      });
    } catch (err) {
      setResult({ kind: "error", message: (err as Error).message });
    }
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(tokenInput.trim());
  };

  const handleIssue = async () => {
    if (result.kind !== "found") return;
    const amt = Number(amountInput);
    if (!Number.isInteger(amt) || amt <= 0) {
      setIssueState({ kind: "failed", message: "請輸入正確的整數金額" });
      return;
    }
    const barcode = barcodeInput.trim().toUpperCase();
    if (carrierChoice === "phone_barcode" && !/^\/[0-9A-Z.+-]{7}$/.test(barcode)) {
      setIssueState({ kind: "failed", message: "手機條碼格式錯誤：應為「/」開頭共 8 碼" });
      return;
    }
    const carrierLabel = carrierChoice === "phone_barcode" ? `手機條碼 ${barcode}` : "綠界會員載具（Email）";
    if (!window.confirm(`確認向「${result.reg.parentName}」開立 NT$${amt.toLocaleString()} 電子發票？\n載具：${carrierLabel}`)) {
      return;
    }
    setIssueState({ kind: "submitting" });
    try {
      const res = await fetch(`/api/admin/pos/invoice`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken: result.token,
          amount: amt,
          carrierType: carrierChoice,
          ...(carrierChoice === "phone_barcode" ? { carrierNum: barcode } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setIssueState({ kind: "failed", message: data.error || `發票開立失敗 (${res.status})` });
        return;
      }
      setIssueState({
        kind: "issued",
        invoiceNumber: data.invoice?.invoiceNumber ?? null,
        amount: amt,
      });
    } catch (err) {
      setIssueState({ kind: "failed", message: (err as Error).message });
    }
  };

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      try {
        await scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
    // A cancelled carrier scan must not leave the camera hijacking the next
    // ticket scan.
    scanTargetRef.current = "ticket";
  }, []);

  const onDecoded = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      if (decodedText === lastScannedRef.current && now - lastScanTimeRef.current < 3000) {
        return;
      }
      lastScannedRef.current = decodedText;
      lastScanTimeRef.current = now;
      if (scanTargetRef.current === "carrier") {
        // Phone-barcode carrier scan: normalise and drop it into the barcode
        // field instead of triggering a ticket lookup.
        setBarcodeInput(decodedText.trim().toUpperCase());
        scanTargetRef.current = "ticket";
        stopScanner();
        return;
      }
      setTokenInput(decodedText);
      performLookup(decodedText);
    },
    [performLookup, stopScanner],
  );

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      const config = { fps: 10, qrbox: { width: 240, height: 240 } };
      try {
        await scanner.start({ facingMode: "environment" }, config, onDecoded, () => {});
      } catch (primaryErr) {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) throw primaryErr;
        const rear =
          cameras.find((c) => /back|rear|environment|後/i.test(c.label)) ||
          cameras[cameras.length - 1];
        await scanner.start(rear.id, config, onDecoded, () => {});
      }
    } catch (err) {
      try {
        await scannerRef.current?.clear();
      } catch {}
      scannerRef.current = null;
      setCameraError(describeCameraError(err));
      setScanning(false);
      // Failed carrier-scan startup must not leave the next scan in carrier
      // mode.
      scanTargetRef.current = "ticket";
    }
  }, [onDecoded]);

  const handleFileScan = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setCameraError(null);
      setDecodingFile(true);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const fileScanner = new Html5Qrcode(FILE_SCAN_ELEMENT_ID);
        try {
          const decodedText = await fileScanner.scanFile(file, false);
          onDecoded(decodedText);
        } finally {
          try {
            await fileScanner.clear();
          } catch {}
        }
      } catch {
        setResult({
          kind: "error",
          message: "照片中找不到 QR Code，請對準票券重新拍攝，或改用手動輸入 token。",
        });
      } finally {
        setDecodingFile(false);
      }
    },
    [onDecoded],
  );

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const resetAll = () => {
    setResult({ kind: "idle" });
    setIssueState({ kind: "idle" });
    setTokenInput("");
    setAmountInput("");
    setCarrierChoice("ecpay_carrier");
    setBarcodeInput("");
    scanTargetRef.current = "ticket";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display flex items-center gap-3">
          <ReceiptText className="text-primary" /> 現場收費開發票
        </h1>
        <p className="text-muted-foreground mt-1">
          掃描客人門票 QR Code，輸入現金消費金額，立即開立電子發票（品名固定為「商品」）
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera scanner */}
        <div className="bg-white rounded-3xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Camera size={20} /> 相機掃描
            </h2>
            <button
              onClick={() => {
                if (scanning) {
                  stopScanner();
                } else {
                  scanTargetRef.current = "ticket";
                  startScanner();
                }
              }}
              className={cn(
                "px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
                scanning ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-primary text-white hover:bg-primary/90",
              )}
              data-testid="button-pos-toggle-scanner"
            >
              {scanning ? <><CameraOff size={16} /> 停止</> : <><Camera size={16} /> 開始掃描</>}
            </button>
          </div>
          <div
            className={cn(
              "w-full bg-muted/30 rounded-2xl overflow-hidden",
              scanning ? "min-h-[280px]" : "min-h-[160px]",
            )}
          >
            {/* Scanner target: kept FREE of React children (html5-qrcode owns it). */}
            <div id={SCANNER_ELEMENT_ID} className={cn("w-full", scanning ? "" : "hidden")} />
            {!scanning && !cameraError && (
              <div className="min-h-[160px] flex items-center justify-center text-muted-foreground text-sm">
                點擊「開始掃描」以啟動相機
              </div>
            )}
            {cameraError && (
              <div className="min-h-[160px] flex flex-col items-center justify-center text-red-500 text-sm p-4 text-center">
                <AlertTriangle className="mx-auto mb-2" /> 相機錯誤：{cameraError}
              </div>
            )}
          </div>

          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileScan}
              className="hidden"
              data-testid="input-pos-file-scan"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={decodingFile || scanning}
              className="w-full py-2.5 rounded-xl border-2 border-primary/30 text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/5 transition-all disabled:opacity-50"
              data-testid="button-pos-file-scan"
            >
              <Camera size={16} />
              {decodingFile ? "辨識中..." : "無法開啟相機？改用「拍照掃描」"}
            </button>
          </div>
          <div id={FILE_SCAN_ELEMENT_ID} className="hidden" />
        </div>

        {/* Manual entry */}
        <div className="bg-white rounded-3xl border shadow-sm p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Search size={20} /> 手動輸入 QR Token
          </h2>
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="貼上或輸入 QR token"
              className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-primary text-sm font-mono"
              data-testid="input-pos-token"
            />
            <button
              type="submit"
              disabled={!tokenInput.trim() || result.kind === "loading"}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              data-testid="button-pos-lookup"
            >
              {result.kind === "loading" ? "查詢中..." : "查詢票券"}
            </button>
          </form>
        </div>
      </div>

      {/* Result panel */}
      {result.kind !== "idle" && result.kind !== "loading" && (
        <div
          className={cn(
            "rounded-3xl border-2 shadow-sm p-8",
            result.kind === "error"
              ? "bg-red-50 border-red-200"
              : issueState.kind === "issued"
                ? "bg-green-50 border-green-300"
                : "bg-white border-primary/20",
          )}
          data-testid="pos-result-panel"
        >
          {result.kind === "error" && (
            <div className="text-red-700 flex items-start gap-4">
              <XCircle size={32} className="shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-1">無法找到票券</h3>
                <p className="text-sm">{result.message}</p>
              </div>
            </div>
          )}

          {result.kind === "found" && (
            <>
              <div className="flex items-start gap-4 mb-4">
                {issueState.kind === "issued" ? (
                  <CheckCircle2 size={40} className="text-green-600 shrink-0" />
                ) : (
                  <ReceiptText size={40} className="text-primary shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-1">
                    {issueState.kind === "issued" ? "發票開立成功 ✓" : "客人資料"}
                  </h3>
                  {issueState.kind === "issued" && (
                    <p className="text-sm text-green-700">
                      金額 NT${issueState.amount.toLocaleString()}
                      {issueState.invoiceNumber && <>・發票號碼 <span className="font-mono font-bold">{issueState.invoiceNumber}</span></>}
                      {carrierChoice === "phone_barcode"
                        ? "，發票已歸戶至客人的手機條碼載具。"
                        : "，發票已存入綠界電子發票平台並寄送 Email 通知客人。"}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white/60 rounded-2xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">姓名：</div>
                <div className="font-bold">{result.reg.parentName}</div>
                <div className="text-muted-foreground">電話：</div>
                <div className="font-bold">{result.reg.phone}</div>
                {result.reg.email && (<>
                  <div className="text-muted-foreground">Email：</div>
                  <div className="font-bold break-all">{result.reg.email}</div>
                </>)}
                <div className="text-muted-foreground">入場日期：</div>
                <div className="font-bold text-primary">{result.reg.eventDate}</div>
              </div>

              {result.recentInvoices.length > 0 && (
                <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm">
                  <p className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} /> 此票券近期已開立的現場發票
                  </p>
                  <ul className="space-y-1 text-amber-800">
                    {result.recentInvoices.map((inv) => (
                      <li key={inv.id} className="flex justify-between gap-3">
                        <span>{new Date(inv.createdAt).toLocaleString("zh-TW")}</span>
                        <span className="font-mono">{inv.invoiceNumber || "—"}</span>
                        <span className="font-bold">NT${inv.amount.toLocaleString()}</span>
                        <span>{inv.status === "issued" ? "已開立" : inv.status === "failed" ? "失敗" : inv.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {issueState.kind !== "issued" && (
                <div className="mt-6 space-y-3">
                  <label className="block font-bold text-sm">發票載具</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCarrierChoice("ecpay_carrier")}
                      className={cn(
                        "px-4 py-3 rounded-xl border-2 text-sm font-bold text-left transition-all",
                        carrierChoice === "ecpay_carrier"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-muted text-muted-foreground hover:border-primary/40",
                      )}
                      data-testid="button-carrier-ecpay"
                    >
                      綠界電子發票（Email 通知）
                      <span className="block text-xs font-normal mt-0.5">
                        {result.reg.email ? `寄到 ${result.reg.email}` : "此票券沒有 Email，請改用手機條碼"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCarrierChoice("phone_barcode")}
                      className={cn(
                        "px-4 py-3 rounded-xl border-2 text-sm font-bold text-left transition-all",
                        carrierChoice === "phone_barcode"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-muted text-muted-foreground hover:border-primary/40",
                      )}
                      data-testid="button-carrier-phone"
                    >
                      手機條碼載具
                      <span className="block text-xs font-normal mt-0.5">掃描客人的「/」開頭條碼</span>
                    </button>
                  </div>

                  {carrierChoice === "phone_barcode" && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
                        placeholder="/AB12345"
                        maxLength={8}
                        className="flex-1 px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-primary font-mono text-lg"
                        data-testid="input-pos-barcode"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          scanTargetRef.current = "carrier";
                          startScanner();
                        }}
                        disabled={scanning}
                        className="px-4 py-3 rounded-xl border-2 border-primary/30 text-primary font-bold text-sm hover:bg-primary/5 transition-all disabled:opacity-50 flex items-center gap-2"
                        data-testid="button-scan-barcode"
                      >
                        <Camera size={16} /> 掃描條碼
                      </button>
                    </div>
                  )}
                  {carrierChoice === "phone_barcode" && scanning && (
                    <p className="text-xs text-primary text-center">
                      相機已開啟（上方掃描區），請對準客人手機上的條碼
                    </p>
                  )}

                  <label className="block font-bold text-sm">消費金額（現金，NT$）</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="輸入金額，例如 500"
                    className="w-full px-4 py-4 border-2 rounded-xl focus:outline-none focus:border-primary text-2xl font-bold text-center"
                    data-testid="input-pos-amount"
                  />
                  {issueState.kind === "failed" && (
                    <p className="text-sm text-red-600 flex items-center gap-2">
                      <XCircle size={16} /> {issueState.message}
                    </p>
                  )}
                  <button
                    onClick={handleIssue}
                    disabled={issueState.kind === "submitting" || !amountInput.trim()}
                    className="w-full py-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    data-testid="button-pos-issue"
                  >
                    <ReceiptText size={20} />
                    {issueState.kind === "submitting" ? "開立中，請稍候..." : "開立電子發票"}
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    品名固定為「商品」・買受人資料自動帶入客人購票時的姓名 / Email / 電話
                  </p>
                </div>
              )}

              <button
                onClick={resetAll}
                className="mt-4 w-full py-2 text-sm text-muted-foreground hover:text-foreground"
                data-testid="button-pos-clear"
              >
                清除並服務下一位客人
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
