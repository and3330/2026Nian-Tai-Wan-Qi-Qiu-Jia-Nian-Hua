import { useState, useEffect, useRef, useCallback } from "react";
import { ScanLine, Search, CheckCircle2, AlertTriangle, XCircle, Camera, CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Registration = {
  id: number;
  parentName: string;
  phone: string;
  email: string | null;
  ticketCount: number;
  childCount?: number;
  eventDate: string;
  qrToken: string | null;
  checkedInAt: string | null;
  createdAt: string;
};

type LookupResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; reg: Registration; alreadyCheckedIn: boolean }
  | { kind: "checked"; reg: Registration; alreadyCheckedIn: boolean }
  | { kind: "error"; message: string };

const SCANNER_ELEMENT_ID = "qr-scanner-container";

export default function CheckinPage() {
  const [tokenInput, setTokenInput] = useState("");
  const [result, setResult] = useState<LookupResult>({ kind: "idle" });
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
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
      setResult({ kind: "found", reg: data.registration, alreadyCheckedIn: data.alreadyCheckedIn });
    } catch (err) {
      setResult({ kind: "error", message: (err as Error).message });
    }
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(tokenInput.trim());
  };

  const performCheckin = async (token: string) => {
    try {
      const res = await fetch(`/api/admin/checkin/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setResult({ kind: "checked", reg: data.registration, alreadyCheckedIn: true });
        return;
      }
      if (!res.ok) {
        setResult({ kind: "error", message: data.error || `報到失敗 (${res.status})` });
        return;
      }
      setResult({ kind: "checked", reg: data.registration, alreadyCheckedIn: false });
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

  const startScanner = useCallback(async () => {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
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
        () => {
          // ignore decode errors (per-frame noise)
        },
      );
      setScanning(true);
    } catch (err) {
      setCameraError((err as Error).message || "無法啟動相機");
      setScanning(false);
    }
  }, [performLookup]);

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
            id={SCANNER_ELEMENT_ID}
            className={cn(
              "w-full bg-muted/30 rounded-2xl overflow-hidden",
              scanning ? "min-h-[280px]" : "min-h-[160px] flex items-center justify-center text-muted-foreground text-sm",
            )}
          >
            {!scanning && !cameraError && "點擊「開始掃描」以啟動相機"}
            {cameraError && (
              <div className="text-red-500 text-sm p-4 text-center">
                <AlertTriangle className="mx-auto mb-2" /> 相機錯誤：{cameraError}
              </div>
            )}
          </div>
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
                {result.kind === "checked" && !result.alreadyCheckedIn ? (
                  <CheckCircle2 size={40} className="text-green-600 shrink-0" />
                ) : result.alreadyCheckedIn ? (
                  <AlertTriangle size={40} className="text-amber-600 shrink-0" />
                ) : (
                  <ScanLine size={40} className="text-primary shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-1">
                    {result.kind === "checked" && !result.alreadyCheckedIn
                      ? "報到成功 ✓"
                      : result.alreadyCheckedIn
                        ? "已重複報到"
                        : "票券資訊"}
                  </h3>
                  {result.alreadyCheckedIn && result.reg.checkedInAt && (
                    <p className="text-sm text-amber-700">
                      此票券已於 {new Date(result.reg.checkedInAt).toLocaleString("zh-TW")} 報到
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
                <div className="text-muted-foreground">入場人數：</div>
                <div className="font-bold">
                  {result.reg.childCount && result.reg.childCount > 0
                    ? `共 ${result.reg.ticketCount} 位（大人 ${result.reg.ticketCount - result.reg.childCount}、兒童 ${result.reg.childCount}）`
                    : `${result.reg.ticketCount} 位`}
                </div>
                <div className="text-muted-foreground">入場日期：</div>
                <div className="font-bold text-primary">{result.reg.eventDate}</div>
              </div>

              {result.kind === "found" && !result.alreadyCheckedIn && result.reg.qrToken && (
                <button
                  onClick={() => performCheckin(result.reg.qrToken!)}
                  className="mt-6 w-full py-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  data-testid="button-confirm-checkin"
                >
                  <CheckCircle2 size={20} /> 確認報到
                </button>
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
