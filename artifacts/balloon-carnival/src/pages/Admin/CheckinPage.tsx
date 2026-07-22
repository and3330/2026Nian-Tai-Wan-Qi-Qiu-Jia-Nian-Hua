import { useState, useEffect, useRef, useCallback } from "react";
import { ScanLine, Search, CheckCircle2, AlertTriangle, XCircle, Camera, CameraOff, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

type Registration = {
  id: number;
  parentName: string;
  phone: string;
  email: string | null;
  ticketCount: number;
  childCount?: number;
  infantCount?: number;
  isVip?: boolean;
  eventDate: string;
  qrToken: string | null;
  checkedInAt: string | null;
  checkedInCount: number;
  createdAt: string;
};

type LookupResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; reg: Registration; alreadyCheckedIn: boolean; admissible: boolean }
  | { kind: "checked"; reg: Registration; alreadyCheckedIn: boolean; checkedInNow?: number }
  | { kind: "error"; message: string };

function remainingOf(reg: Registration): number {
  return Math.max(0, reg.ticketCount - (reg.checkedInCount ?? 0));
}

const SCANNER_ELEMENT_ID = "qr-scanner-container";
const FILE_SCAN_ELEMENT_ID = "qr-file-scan-container";

// Turns the raw getUserMedia / html5-qrcode error into something a non-technical
// staffer can act on. Live camera streaming fails for many mobile reasons
// (permission denied, no HTTPS, in-app browser like LINE/FB/IG), so we always
// point them at the "拍照掃描" fallback which opens the native camera app.
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
  if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
    return "系統剛更新，頁面版本過舊。請重新整理此頁後再開啟相機。";
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

export default function CheckinPage() {
  const [tokenInput, setTokenInput] = useState("");
  const [result, setResult] = useState<LookupResult>({ kind: "idle" });
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [decodingFile, setDecodingFile] = useState(false);
  const [checkinCount, setCheckinCount] = useState<number>(1);
  const scannerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

  const performLookup = useCallback(async (token: string) => {
    if (!token) return;
    setResult({ kind: "loading" });
    try {
      const res = await fetch(`/api/admin/checkin/lookup/${encodeURIComponent(token)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setResult({ kind: "error", message: err.error || `查詢失敗 (${res.status})` });
        return;
      }
      const data = await res.json();
      setCheckinCount(remainingOf(data.registration));
      setResult({
        kind: "found",
        reg: data.registration,
        alreadyCheckedIn: data.alreadyCheckedIn,
        admissible: data.admissible !== false,
      });
    } catch (err) {
      setResult({ kind: "error", message: (err as Error).message });
    }
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(tokenInput.trim());
  };

  const performCheckin = async (token: string, count: number) => {
    try {
      const res = await fetch(`/api/admin/checkin/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.registration && data.alreadyCheckedIn === true) {
        setResult({ kind: "checked", reg: data.registration, alreadyCheckedIn: true });
        return;
      }
      if (!res.ok) {
        setResult({ kind: "error", message: data.error || `報到失敗 (${res.status})` });
        return;
      }
      setResult({
        kind: "checked",
        reg: data.registration,
        alreadyCheckedIn: false,
        checkedInNow: data.checkedInNow,
      });
    } catch (err) {
      setResult({ kind: "error", message: (err as Error).message });
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
  }, []);

  const onDecoded = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      if (decodedText === lastScannedRef.current && now - lastScanTimeRef.current < 3000) {
        return;
      }
      lastScannedRef.current = decodedText;
      lastScanTimeRef.current = now;
      setTokenInput(decodedText);
      performLookup(decodedText);
    },
    [performLookup],
  );

  const startScanner = useCallback(async () => {
    setCameraError(null);
    // Make the scanner container visible BEFORE calling start(). Some mobile
    // browsers fail to initialise the camera against a hidden (display:none)
    // element because they can't measure it.
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      const config = { fps: 10, qrbox: { width: 240, height: 240 } };
      try {
        // Preferred path: ask directly for the rear camera.
        await scanner.start({ facingMode: "environment" }, config, onDecoded, () => {});
      } catch (primaryErr) {
        // Some mobile browsers reject the facingMode constraint. Fall back to
        // enumerating cameras and picking the rear one (or the last device,
        // which is usually the rear camera on phones).
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display flex items-center gap-3">
          <ScanLine className="text-primary" /> 現場報到
        </h1>
        <p className="text-muted-foreground mt-1">
          掃描入場 QR Code 或手動輸入 token 進行報到驗票
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
              onClick={() => (scanning ? stopScanner() : startScanner())}
              className={cn(
                "px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
                scanning ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-primary text-white hover:bg-primary/90",
              )}
              data-testid="button-toggle-scanner"
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
            {/* Scanner target: kept FREE of React children. html5-qrcode
                injects its own <video>/DOM nodes here; if React also manages
                children in the same node, reconciliation throws a removeChild
                error and blanks the whole page. Placeholder/error live as
                siblings instead. */}
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

          {/* Native-camera fallback: opens the phone's camera app to take a
              photo of the QR, then decodes it. Works even when live streaming
              is blocked (in-app browsers, iOS permission quirks). */}
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileScan}
              className="hidden"
              data-testid="input-file-scan"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={decodingFile || scanning}
              className="w-full py-2.5 rounded-xl border-2 border-primary/30 text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/5 transition-all disabled:opacity-50"
              data-testid="button-file-scan"
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
              data-testid="input-token"
            />
            <button
              type="submit"
              disabled={!tokenInput.trim() || result.kind === "loading"}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              data-testid="button-lookup"
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
              : result.kind === "found" && !result.admissible
                ? "bg-red-50 border-red-300"
              : result.kind === "checked" && !result.alreadyCheckedIn
                ? "bg-green-50 border-green-300"
                : result.kind === "found" && result.alreadyCheckedIn
                  ? "bg-amber-50 border-amber-300"
                  : "bg-white border-primary/20",
          )}
          data-testid="result-panel"
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

          {(result.kind === "found" || result.kind === "checked") && (
            <>
              <div className="flex items-start gap-4 mb-4">
                {result.kind === "found" && !result.admissible ? (
                  <XCircle size={40} className="text-red-600 shrink-0" />
                ) : result.kind === "checked" && !result.alreadyCheckedIn ? (
                  <CheckCircle2 size={40} className="text-green-600 shrink-0" />
                ) : result.alreadyCheckedIn ? (
                  <AlertTriangle size={40} className="text-amber-600 shrink-0" />
                ) : (
                  <ScanLine size={40} className="text-primary shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className={cn("font-bold text-xl mb-1", result.kind === "found" && !result.admissible && "text-red-700")}>
                    {result.kind === "found" && !result.admissible
                      ? "此票沒付款，不得進來"
                      : result.kind === "checked" && !result.alreadyCheckedIn
                        ? `報到成功 ✓${result.checkedInNow ? `（本次 ${result.checkedInNow} 位）` : ""}`
                        : result.alreadyCheckedIn
                          ? "已全數報到"
                          : "票券資訊"}
                  </h3>
                  {result.kind === "found" && !result.admissible && (
                    <p className="text-sm text-red-700 font-bold">
                      此票券尚未完成付款，請勿放行。可請客人出示付款證明，或至訂單管理確認付款狀態。
                    </p>
                  )}
                  {result.alreadyCheckedIn && result.reg.checkedInAt && (
                    <p className="text-sm text-amber-700">
                      此票券 {result.reg.ticketCount} 位已全數報到（最後報到 {new Date(result.reg.checkedInAt).toLocaleString("zh-TW")}）
                    </p>
                  )}
                  {result.kind === "checked" && !result.alreadyCheckedIn && remainingOf(result.reg) > 0 && (
                    <p className="text-sm text-amber-700 font-bold">
                      尚有 {remainingOf(result.reg)} 位未報到，之後可再掃同一張票補報到
                    </p>
                  )}
                </div>
              </div>

              {result.reg.isVip && (
                <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-100 border-2 border-amber-300 px-4 py-3 text-amber-800 font-bold">
                  <Crown size={20} className="shrink-0" />
                  VIP・可帶 6 歲以下兒童免費入場
                </div>
              )}

              <div className="bg-white/60 rounded-2xl p-4 grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">姓名：</div>
                <div className="font-bold">{result.reg.parentName}</div>
                <div className="text-muted-foreground">電話：</div>
                <div className="font-bold">{result.reg.phone}</div>
                {result.reg.email && (<>
                  <div className="text-muted-foreground">Email：</div>
                  <div className="font-bold break-all">{result.reg.email}</div>
                </>)}
                <div className="text-muted-foreground">入場人數：</div>
                <div className="font-bold">
                  {(result.reg.childCount && result.reg.childCount > 0) || (result.reg.infantCount && result.reg.infantCount > 0)
                    ? `共 ${result.reg.ticketCount} 位（${[
                        `大人 ${result.reg.ticketCount - (result.reg.childCount ?? 0) - (result.reg.infantCount ?? 0)}`,
                        ...(result.reg.childCount && result.reg.childCount > 0 ? [`兒童 ${result.reg.childCount}`] : []),
                        ...(result.reg.infantCount && result.reg.infantCount > 0 ? [`1 歲以下 ${result.reg.infantCount}`] : []),
                      ].join("、")}）`
                    : `${result.reg.ticketCount} 位`}
                </div>
                <div className="text-muted-foreground">入場日期：</div>
                <div className="font-bold text-primary">{result.reg.eventDate}</div>
                {(result.reg.checkedInCount ?? 0) > 0 && (
                  <>
                    <div className="text-muted-foreground">報到進度：</div>
                    <div className="font-bold">
                      已報到 {result.reg.checkedInCount} / {result.reg.ticketCount} 位
                      {remainingOf(result.reg) > 0 && (
                        <span className="text-amber-700">（尚餘 {remainingOf(result.reg)} 位）</span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {result.kind === "found" && result.admissible && !result.alreadyCheckedIn && result.reg.qrToken && (
                <div className="mt-6 space-y-3">
                  {remainingOf(result.reg) > 1 && (
                    <div className="bg-white/60 rounded-2xl p-4">
                      <div className="text-sm font-bold mb-2">本次報到人數</div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: remainingOf(result.reg) }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setCheckinCount(n)}
                            className={cn(
                              "w-12 h-12 rounded-xl border-2 font-bold transition-all",
                              checkinCount === n
                                ? "bg-green-600 border-green-600 text-white"
                                : "bg-white border-border hover:border-green-400",
                            )}
                            data-testid={`button-count-${n}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() =>
                      performCheckin(result.reg.qrToken!, Math.min(checkinCount, remainingOf(result.reg)))
                    }
                    className="w-full py-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                    data-testid="button-confirm-checkin"
                  >
                    <CheckCircle2 size={20} />
                    確認報到{remainingOf(result.reg) > 1 ? ` ${Math.min(checkinCount, remainingOf(result.reg))} 位` : ""}
                  </button>
                </div>
              )}

              <button
                onClick={() => { setResult({ kind: "idle" }); setTokenInput(""); }}
                className="mt-4 w-full py-2 text-sm text-muted-foreground hover:text-foreground"
                data-testid="button-clear"
              >
                清除並查詢下一張
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
