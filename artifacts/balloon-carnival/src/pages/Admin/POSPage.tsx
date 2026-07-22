import { useState, useEffect, useRef, useCallback } from "react";
import {
  ReceiptText, Search, CheckCircle2, AlertTriangle, XCircle, Camera, CameraOff,
  Store, ShoppingCart, Plus, Minus, Banknote, CreditCard, Smartphone, Globe,
  Package, Trash2, ListOrdered, Pencil,
} from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
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

type Product = {
  id: number;
  vendorId: number | null;
  name: string;
  price: number;
  active: boolean;
  sortOrder: number;
};

type PosVendor = { id: number; name: string; boothNumber: string | null };

type PosOrder = {
  id: number;
  paymentRef: string;
  vendorId: number | null;
  buyerName: string | null;
  buyerEmail: string | null;
  items: { productId: number; name: string; unitPrice: number; qty: number }[];
  discount: number;
  totalAmount: number;
  paymentMethod: string;
  invoiceId: number | null;
  invoice: { id: number; status: string; invoiceNumber: string | null } | null;
  createdAt: string;
};

type LookupResult =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; reg: PosRegistration; recentInvoices: PosInvoice[]; token: string }
  | { kind: "error"; message: string };

type CheckoutState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "created"; order: PosOrder }
  | { kind: "failed"; message: string };

type IssueState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "issued"; invoiceNumber: string | null; amount: number }
  | { kind: "failed"; message: string };

type MySales = {
  vendor: { id: number; name: string; boothNumber: string | null } | null;
  totals: { count: number; total: number };
  today: { count: number; total: number };
  recent: { id: number; amount: number; status: string; invoiceNumber: string | null; buyerName: string | null; createdAt: string }[];
};

const PAYMENT_METHODS = [
  { value: "cash", label: "現金", icon: Banknote },
  { value: "credit_card", label: "信用卡", icon: CreditCard },
  { value: "online", label: "線上付款", icon: Globe },
  { value: "apple_pay", label: "Apple Pay", icon: Smartphone },
] as const;

const PAYMENT_LABEL: Record<string, string> = {
  cash: "現金",
  credit_card: "信用卡",
  online: "線上付款",
  apple_pay: "Apple Pay",
};

const SCANNER_ELEMENT_ID = "pos-qr-scanner-container";
const FILE_SCAN_ELEMENT_ID = "pos-qr-file-scan-container";
const CARRIER_SCANNER_ELEMENT_ID = "pos-carrier-scanner-container";

const SCANNER_CONSTRUCTOR_CONFIG = (formats: any) => ({
  // Native BarcodeDetector (when available) is far better at 1D
  // barcodes like the Code 39 phone-barcode carrier.
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  formatsToSupport: [formats.QR_CODE, formats.CODE_39, formats.CODE_128],
  verbose: false,
});

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

export default function POSPage() {
  const { role, hasRole } = useAuth();
  const isVendor = role === "vendor";
  const canManageProducts = isVendor || hasRole("editor");
  const [mySales, setMySales] = useState<MySales | null>(null);
  const [mySalesError, setMySalesError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [result, setResult] = useState<LookupResult>({ kind: "idle" });
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
  const carrierScannerRef = useRef<any>(null);
  const [carrierScanning, setCarrierScanning] = useState(false);
  const [carrierCameraError, setCarrierCameraError] = useState<string | null>(null);

  // ── 商品／購物車／結帳 ──
  const [vendors, setVendors] = useState<PosVendor[]>([]);
  // 0 = 主辦方（vendorId null）；vendor 帳號無此選擇（後端鎖定）
  const [selectedVendorId, setSelectedVendorId] = useState<number>(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [discountChoice, setDiscountChoice] = useState<number>(0);
  const [checkout, setCheckout] = useState<CheckoutState>({ kind: "idle" });

  // ── 商品管理／訂單 ──
  const [manageOpen, setManageOpen] = useState(false);
  const [manageProducts, setManageProducts] = useState<Product[]>([]);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const vendorQuery = isVendor ? "" : selectedVendorId > 0 ? `vendorId=${selectedVendorId}` : "";

  const refreshMySales = useCallback(async () => {
    if (!isVendor) return;
    try {
      const res = await fetch(`/api/admin/pos/my-sales`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMySalesError(data.error || `載入收款統計失敗 (${res.status})`);
        return;
      }
      setMySalesError(null);
      setMySales(data);
    } catch (err) {
      setMySalesError((err as Error).message);
    }
  }, [isVendor]);

  const refreshProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/pos/products${vendorQuery ? `?${vendorQuery}` : ""}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProductsError(data.error || `載入商品失敗 (${res.status})`);
        return;
      }
      setProductsError(null);
      setProducts(data.products || []);
    } catch (err) {
      setProductsError((err as Error).message);
    }
  }, [vendorQuery]);

  const refreshManageProducts = useCallback(async () => {
    if (!canManageProducts) return;
    try {
      const sep = vendorQuery ? `?${vendorQuery}&all=1` : "?all=1";
      const res = await fetch(`/api/admin/pos/products${sep}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setManageProducts(data.products || []);
    } catch { /* section is auxiliary — list stays stale on error */ }
  }, [canManageProducts, vendorQuery]);

  const refreshOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/pos/orders${vendorQuery ? `?${vendorQuery}` : ""}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOrdersError(data.error || `載入訂單失敗 (${res.status})`);
        return;
      }
      setOrdersError(null);
      setOrders(data.orders || []);
    } catch (err) {
      setOrdersError((err as Error).message);
    }
  }, [vendorQuery]);

  useEffect(() => {
    refreshMySales();
  }, [refreshMySales]);

  useEffect(() => {
    refreshProducts();
    setCart({});
  }, [refreshProducts]);

  useEffect(() => {
    if (manageOpen) refreshManageProducts();
  }, [manageOpen, refreshManageProducts]);

  useEffect(() => {
    if (ordersOpen) refreshOrders();
  }, [ordersOpen, refreshOrders]);

  useEffect(() => {
    if (isVendor) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pos/vendors`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setVendors(data.vendors || []);
      } catch { /* vendor selector simply stays 主辦方-only */ }
    })();
  }, [isVendor]);

  const stopCarrierScanner = useCallback(async () => {
    if (carrierScannerRef.current) {
      try {
        await carrierScannerRef.current.stop();
      } catch {}
      try {
        await carrierScannerRef.current.clear();
      } catch {}
      carrierScannerRef.current = null;
    }
    setCarrierScanning(false);
  }, []);

  const performLookup = useCallback(async (token: string) => {
    if (!token) return;
    // A fresh lookup rebuilds the carrier section; await full teardown so the
    // camera never outlives its target div (white-screen hazard).
    await stopCarrierScanner();
    setResult({ kind: "loading" });
    setIssueState({ kind: "idle" });
    setCheckout({ kind: "idle" });
    setCart({});
    setPaymentMethod("cash");
    setDiscountChoice(0);
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
  }, [stopCarrierScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(tokenInput.trim());
  };

  const cartItems = products
    .filter((p) => (cart[p.id] ?? 0) > 0)
    .map((p) => ({ product: p, qty: cart[p.id] }));
  const cartSubtotal = cartItems.reduce((s, it) => s + it.product.price * it.qty, 0);
  // 折價 −20／−50：小計必須大於折價金額才能套用
  const discountAmount = discountChoice > 0 && cartSubtotal > discountChoice ? discountChoice : 0;
  const cartTotal = cartSubtotal - discountAmount;

  const addToCart = (id: number, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const q = (next[id] ?? 0) + delta;
      if (q <= 0) delete next[id];
      else next[id] = Math.min(q, 99);
      return next;
    });
  };

  const handleCheckout = async () => {
    if (result.kind !== "found" || cartItems.length === 0) return;
    const methodLabel = PAYMENT_LABEL[paymentMethod] ?? paymentMethod;
    if (!window.confirm(`確認結帳？\n合計 NT$${cartTotal.toLocaleString()}（${methodLabel}）${discountAmount > 0 ? `，已含折價 −NT$${discountAmount}` : ""}\n${cartItems.map((it) => `${it.product.name} x${it.qty}`).join("、")}`)) return;
    setCheckout({ kind: "submitting" });
    try {
      const res = await fetch(`/api/admin/pos/orders`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken: result.token,
          paymentMethod,
          discount: discountAmount,
          items: cartItems.map((it) => ({ productId: it.product.id, qty: it.qty })),
          ...(isVendor ? {} : { vendorId: selectedVendorId > 0 ? selectedVendorId : undefined }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.order) {
        setCheckout({ kind: "failed", message: data.error || `結帳失敗 (${res.status})` });
        return;
      }
      setCheckout({ kind: "created", order: data.order });
      refreshMySales();
    } catch (err) {
      setCheckout({ kind: "failed", message: (err as Error).message });
    }
  };

  const handleIssueForOrder = async () => {
    if (checkout.kind !== "created" || result.kind !== "found") return;
    const barcode = barcodeInput.trim().toUpperCase();
    if (carrierChoice === "phone_barcode" && !/^\/[0-9A-Z.+-]{7}$/.test(barcode)) {
      setIssueState({ kind: "failed", message: "手機條碼格式錯誤：應為「/」開頭共 8 碼" });
      return;
    }
    const carrierLabel = carrierChoice === "phone_barcode" ? `手機條碼 ${barcode}` : "綠界會員載具（Email）";
    if (!window.confirm(`確認開立 NT$${checkout.order.totalAmount.toLocaleString()} 電子發票？\n載具：${carrierLabel}`)) {
      return;
    }
    setIssueState({ kind: "submitting" });
    try {
      const res = await fetch(`/api/admin/pos/orders/${checkout.order.id}/invoice`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        amount: checkout.order.totalAmount,
      });
      refreshMySales();
    } catch (err) {
      setIssueState({ kind: "failed", message: (err as Error).message });
    }
  };

  // ── 商品管理操作 ──
  const createProduct = async () => {
    const price = Number(newPrice);
    if (!newName.trim() || !Number.isInteger(price) || price <= 0) return;
    const res = await fetch(`/api/admin/pos/products${vendorQuery ? `?${vendorQuery}` : ""}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), price }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error || "新增失敗");
      return;
    }
    setNewName("");
    setNewPrice("");
    refreshManageProducts();
    refreshProducts();
  };

  const updateProduct = async (id: number, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/pos/products/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error || "修改失敗");
      return;
    }
    refreshManageProducts();
    refreshProducts();
  };

  const deleteProduct = async (p: Product) => {
    if (!window.confirm(`確定刪除商品「${p.name}」？（過去的訂單紀錄不受影響）`)) return;
    const res = await fetch(`/api/admin/pos/products/${p.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(data.error || "刪除失敗");
      return;
    }
    refreshManageProducts();
    refreshProducts();
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

  // 取得客人資料後掃描區會被隱藏 — 若相機仍在跑（例如邊掃邊手動查詢），
  // 這裡確保它被關掉，避免隱藏狀態下相機持續佔用。
  useEffect(() => {
    if (result.kind === "found" && scannerRef.current) {
      stopScanner();
    }
  }, [result.kind, stopScanner]);

  const onDecoded = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      if (decodedText === lastScannedRef.current && now - lastScanTimeRef.current < 3000) {
        return;
      }
      lastScannedRef.current = decodedText;
      lastScanTimeRef.current = now;
      setTokenInput(decodedText);
      // Camera stops as soon as a ticket is scanned, so the customer info
      // panel is visible immediately without a live video pushing it down.
      stopScanner();
      performLookup(decodedText);
    },
    [performLookup, stopScanner],
  );

  const onCarrierDecoded = useCallback(
    (decodedText: string) => {
      setBarcodeInput(decodedText.trim().toUpperCase());
      stopCarrierScanner();
    },
    [stopCarrierScanner],
  );

  const startScanner = useCallback(async () => {
    // Only one camera at a time — the device camera can't serve two streams.
    await stopCarrierScanner();
    setCameraError(null);
    setScanning(true);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(
        SCANNER_ELEMENT_ID,
        SCANNER_CONSTRUCTOR_CONFIG(Html5QrcodeSupportedFormats),
      );
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
    }
  }, [onDecoded, stopCarrierScanner]);

  const startCarrierScanner = useCallback(async () => {
    // Only one camera at a time — stop the ticket scanner first.
    await stopScanner();
    setCarrierCameraError(null);
    setCarrierScanning(true);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(
        CARRIER_SCANNER_ELEMENT_ID,
        SCANNER_CONSTRUCTOR_CONFIG(Html5QrcodeSupportedFormats),
      );
      carrierScannerRef.current = scanner;
      // Wide box for the 1D Code 39 carrier barcode.
      const config = { fps: 10, qrbox: { width: 300, height: 140 } };
      try {
        await scanner.start({ facingMode: "environment" }, config, onCarrierDecoded, () => {});
      } catch (primaryErr) {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) throw primaryErr;
        const rear =
          cameras.find((c) => /back|rear|environment|後/i.test(c.label)) ||
          cameras[cameras.length - 1];
        await scanner.start(rear.id, config, onCarrierDecoded, () => {});
      }
    } catch (err) {
      try {
        await carrierScannerRef.current?.clear();
      } catch {}
      carrierScannerRef.current = null;
      setCarrierCameraError(describeCameraError(err));
      setCarrierScanning(false);
    }
  }, [onCarrierDecoded, stopScanner]);

  const handleFileScan = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setCameraError(null);
      setDecodingFile(true);
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        const fileScanner = new Html5Qrcode(FILE_SCAN_ELEMENT_ID, {
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          verbose: false,
        });
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
          message: "照片中找不到 QR Code 或條碼，請重新對準拍攝，或改用手動輸入。",
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
      stopCarrierScanner();
    };
  }, [stopScanner, stopCarrierScanner]);

  const resetAll = async () => {
    // Await teardown before unmounting the carrier section (white-screen hazard).
    await stopCarrierScanner();
    setResult({ kind: "idle" });
    setIssueState({ kind: "idle" });
    setCheckout({ kind: "idle" });
    setCart({});
    setPaymentMethod("cash");
    setDiscountChoice(0);
    setTokenInput("");
    setCarrierChoice("ecpay_carrier");
    setBarcodeInput("");
    setCarrierCameraError(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display flex items-center gap-3">
          <ShoppingCart className="text-primary" /> 現場 POS 收銀
        </h1>
        <p className="text-muted-foreground mt-1">
          掃描客人門票 QR Code → 點選商品加入購物車 → 選擇付款方式結帳，之後可立即開立電子發票
        </p>
      </div>

      {!isVendor && vendors.length > 0 && (
        <div className="bg-white rounded-3xl border shadow-sm p-4 flex items-center gap-3 flex-wrap" data-testid="pos-vendor-select">
          <Store size={18} className="text-primary shrink-0" />
          <span className="text-sm font-bold">結帳攤位：</span>
          <select
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(Number(e.target.value))}
            className="px-3 py-2 border-2 rounded-xl text-sm focus:outline-none focus:border-primary"
            data-testid="select-pos-vendor"
          >
            <option value={0}>主辦方</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.boothNumber ? `（攤位 ${v.boothNumber}）` : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">商品清單、訂單與發票都會歸到所選攤位</span>
        </div>
      )}

      {isVendor && (
        <div className="bg-white rounded-3xl border-2 border-primary/20 shadow-sm p-6" data-testid="vendor-sales-panel">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
            <Store size={20} className="text-primary" />
            {mySales?.vendor
              ? <>我的收款統計 — {mySales.vendor.name}{mySales.vendor.boothNumber ? `（攤位 ${mySales.vendor.boothNumber}）` : ""}</>
              : "我的收款統計"}
          </h2>
          {mySalesError ? (
            <p className="text-sm text-red-600 flex items-center gap-2"><AlertTriangle size={16} /> {mySalesError}</p>
          ) : !mySales ? (
            <p className="text-sm text-muted-foreground">載入中…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-primary/5 p-4">
                  <div className="text-xs text-muted-foreground mb-1">今日收款（已開立）</div>
                  <div className="text-2xl font-bold text-primary" data-testid="text-today-total">NT${mySales.today.total.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">{mySales.today.count} 筆</div>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <div className="text-xs text-muted-foreground mb-1">累計收款（已開立）</div>
                  <div className="text-2xl font-bold" data-testid="text-all-total">NT${mySales.totals.total.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground mt-1">{mySales.totals.count} 筆</div>
                </div>
              </div>
              {mySales.recent.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-muted-foreground uppercase mb-2">最近收款</div>
                  <ul className="space-y-1 text-sm">
                    {mySales.recent.slice(0, 10).map((r) => (
                      <li key={r.id} className="flex justify-between gap-3 border-b last:border-0 py-1.5">
                        <span className="text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="font-mono text-xs self-center">{r.invoiceNumber || "—"}</span>
                        <span className="font-bold">NT${r.amount.toLocaleString()}</span>
                        <span className={cn("text-xs self-center", r.status === "issued" ? "text-green-600" : r.status === "failed" ? "text-red-500" : "text-muted-foreground")}>
                          {r.status === "issued" ? "已開立" : r.status === "failed" ? "失敗" : r.status === "voided" ? "已作廢" : r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 取得客人資料後整塊隱藏（用 CSS 隱藏而非卸載，避免 html5-qrcode 的
          target div 被移除；按「清除並服務下一位客人」後會再顯示） */}
      <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", result.kind === "found" && "hidden")}>
        {/* Camera scanner */}
        <div className="bg-white rounded-3xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Camera size={20} /> 掃描客人 QR Code
            </h2>
            <button
              onClick={() => {
                if (scanning) {
                  stopScanner();
                } else {
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

      {/* Result / checkout panel */}
      {result.kind !== "idle" && result.kind !== "loading" && (
        <div
          className={cn(
            "rounded-3xl border-2 shadow-sm p-6 sm:p-8",
            result.kind === "error"
              ? "bg-red-50 border-red-200"
              : checkout.kind === "created"
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
                {checkout.kind === "created" ? (
                  <CheckCircle2 size={40} className="text-green-600 shrink-0" />
                ) : (
                  <ShoppingCart size={40} className="text-primary shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-1">
                    {checkout.kind === "created" ? "結帳完成 ✓" : "客人資料"}
                  </h3>
                  {checkout.kind === "created" && (
                    <p className="text-sm text-green-700">
                      訂單 <span className="font-mono">{checkout.order.paymentRef}</span>
                      ・合計 NT${checkout.order.totalAmount.toLocaleString()}
                      ・{PAYMENT_LABEL[checkout.order.paymentMethod] ?? checkout.order.paymentMethod}
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

              {checkout.kind !== "created" && result.recentInvoices.length > 0 && (
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

              {/* ── 點餐／購物車：Shopify POS 式雙欄（左商品格點、右購物車結帳欄）── */}
              {checkout.kind !== "created" && (
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                  {/* 左：商品格點 */}
                  <div className="lg:col-span-3">
                    <label className="block font-bold text-sm mb-2">選擇商品</label>
                    {productsError ? (
                      <p className="text-sm text-red-600 flex items-center gap-2"><AlertTriangle size={16} /> {productsError}</p>
                    ) : products.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        目前沒有商品。{canManageProducts ? "請先在下方「商品管理」新增商品。" : "請聯絡主辦方建立商品清單。"}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {products.map((p) => {
                          const qty = cart[p.id] ?? 0;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => addToCart(p.id, 1)}
                              className={cn(
                                "relative rounded-2xl border-2 text-left transition-all overflow-hidden",
                                qty > 0
                                  ? "border-primary shadow-md"
                                  : "border-muted hover:border-primary/40 hover:shadow-sm",
                              )}
                              data-testid={`product-${p.id}`}
                            >
                              {/* 色塊頭部代替商品照片，顏色依商品 id 輪替 */}
                              <div
                                className={cn(
                                  "h-16 sm:h-20 flex items-center justify-center text-3xl",
                                  ["bg-orange-100", "bg-sky-100", "bg-green-100", "bg-pink-100", "bg-amber-100", "bg-violet-100"][p.id % 6],
                                )}
                              >
                                <Package size={28} className="text-black/20" />
                              </div>
                              <div className="px-3 py-2.5">
                                <div className="font-bold text-sm leading-tight line-clamp-2">{p.name}</div>
                                <div className="text-primary font-bold mt-0.5">NT${p.price.toLocaleString()}</div>
                              </div>
                              {qty > 0 && (
                                <span className="absolute top-2 right-2 min-w-6 h-6 px-1 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow">
                                  {qty}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 右：購物車結帳欄（桌機固定在側邊） */}
                  <div className="lg:col-span-2 lg:sticky lg:top-4 rounded-2xl border-2 border-primary/20 bg-white shadow-sm overflow-hidden" data-testid="pos-cart">
                    <div className="px-4 py-3 border-b bg-primary/5 font-bold text-sm flex items-center gap-2">
                      <ShoppingCart size={16} /> 購物車
                      {cartItems.length > 0 && (
                        <span className="text-xs font-normal text-muted-foreground">
                          （{cartItems.reduce((s, it) => s + it.qty, 0)} 件）
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      {cartItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">點左邊的商品加入購物車</p>
                      ) : (
                        cartItems.map(({ product: p, qty }) => (
                          <div key={p.id} className="flex items-center gap-2 text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{p.name}</div>
                              <div className="text-xs text-muted-foreground">NT${p.price.toLocaleString()}</div>
                            </div>
                            <button type="button" onClick={() => addToCart(p.id, -1)} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-muted shrink-0" data-testid={`cart-minus-${p.id}`}>
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center font-bold shrink-0">{qty}</span>
                            <button type="button" onClick={() => addToCart(p.id, 1)} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-muted shrink-0" data-testid={`cart-plus-${p.id}`}>
                              <Plus size={14} />
                            </button>
                            <span className="w-16 text-right font-bold shrink-0">NT${(p.price * qty).toLocaleString()}</span>
                          </div>
                        ))
                      )}
                      <div className="border-t pt-3 mt-2 space-y-1.5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">小計</span>
                          <span className="font-bold">NT${cartSubtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex gap-2">
                            {[20, 50].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => setDiscountChoice((v) => (v === amt ? 0 : amt))}
                                disabled={cartSubtotal <= amt}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition-all disabled:opacity-40",
                                  discountAmount === amt
                                    ? "border-red-400 bg-red-50 text-red-600"
                                    : "border-muted text-muted-foreground hover:border-red-300 hover:text-red-500",
                                )}
                                data-testid={`button-discount-${amt}`}
                              >
                                {discountAmount === amt ? `✓ 已折價 −$${amt}` : `折價 −$${amt}`}
                              </button>
                            ))}
                          </div>
                          {discountAmount > 0 && <span className="font-bold text-red-600">−NT${discountAmount}</span>}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold">合計</span>
                          <span className="text-2xl font-bold text-primary" data-testid="text-cart-total">NT${cartTotal.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <label className="block font-bold text-xs text-muted-foreground mb-1.5">付款方式（僅記錄，實際收款在系統外完成）</label>
                        <div className="grid grid-cols-2 gap-2">
                          {PAYMENT_METHODS.map((m) => (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => setPaymentMethod(m.value)}
                              className={cn(
                                "px-2 py-2.5 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-1.5 transition-all",
                                paymentMethod === m.value
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-muted text-muted-foreground hover:border-primary/40",
                              )}
                              data-testid={`payment-${m.value}`}
                            >
                              <m.icon size={15} /> {m.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {checkout.kind === "failed" && (
                        <p className="text-sm text-red-600 flex items-center gap-2">
                          <XCircle size={16} /> {checkout.message}
                        </p>
                      )}
                      <button
                        onClick={handleCheckout}
                        disabled={checkout.kind === "submitting" || cartItems.length === 0}
                        className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        data-testid="button-pos-checkout"
                      >
                        <CheckCircle2 size={20} />
                        {checkout.kind === "submitting"
                          ? "結帳中..."
                          : cartItems.length === 0
                            ? "請先選擇商品"
                            : `結帳 NT$${cartTotal.toLocaleString()}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 結帳完成後：開立發票 ── */}
              {checkout.kind === "created" && (
                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl bg-white/70 p-4 text-sm space-y-1">
                    {checkout.order.items.map((it, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{it.name} × {it.qty}</span>
                        <span className="font-bold">NT${(it.unitPrice * it.qty).toLocaleString()}</span>
                      </div>
                    ))}
                    {checkout.order.discount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>折價</span>
                        <span className="font-bold">−NT${checkout.order.discount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {issueState.kind === "issued" ? (
                    <div className="rounded-2xl bg-green-100 border border-green-300 p-4 text-sm text-green-800">
                      <p className="font-bold flex items-center gap-2"><ReceiptText size={16} /> 發票開立成功 ✓</p>
                      <p className="mt-1">
                        金額 NT${issueState.amount.toLocaleString()}
                        {issueState.invoiceNumber && <>・發票號碼 <span className="font-mono font-bold">{issueState.invoiceNumber}</span></>}
                        {carrierChoice === "phone_barcode"
                          ? "，發票已歸戶至客人的手機條碼載具。"
                          : "，發票已存入綠界電子發票平台並寄送 Email 通知客人。"}
                      </p>
                    </div>
                  ) : (
                    <>
                      <label className="block font-bold text-sm">開立電子發票（可跳過，之後也能從訂單補開）</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await stopCarrierScanner();
                            setCarrierChoice("ecpay_carrier");
                          }}
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
                        <>
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
                                if (carrierScanning) {
                                  stopCarrierScanner();
                                } else {
                                  startCarrierScanner();
                                }
                              }}
                              className={cn(
                                "px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center gap-2",
                                carrierScanning
                                  ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                  : "border-primary/30 text-primary hover:bg-primary/5",
                              )}
                              data-testid="button-scan-barcode"
                            >
                              {carrierScanning ? <><CameraOff size={16} /> 停止</> : <><Camera size={16} /> 掃描條碼</>}
                            </button>
                          </div>
                          {/* Dedicated inline carrier camera. Target div kept FREE
                              of React children (html5-qrcode owns it). */}
                          <div
                            className={cn(
                              "w-full bg-muted/30 rounded-2xl overflow-hidden",
                              carrierScanning ? "min-h-[220px]" : "hidden",
                            )}
                          >
                            <div id={CARRIER_SCANNER_ELEMENT_ID} className="w-full" />
                          </div>
                          {carrierScanning && (
                            <p className="text-xs text-primary text-center">
                              請對準客人手機上的「/」開頭條碼，掃到後會自動填入
                            </p>
                          )}
                          {carrierCameraError && (
                            <p className="text-xs text-red-600 text-center flex items-center justify-center gap-1">
                              <AlertTriangle size={14} /> {carrierCameraError}
                            </p>
                          )}
                        </>
                      )}

                      {issueState.kind === "failed" && (
                        <p className="text-sm text-red-600 flex items-center gap-2">
                          <XCircle size={16} /> {issueState.message}
                        </p>
                      )}
                      <button
                        onClick={handleIssueForOrder}
                        disabled={issueState.kind === "submitting"}
                        className="w-full py-4 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        data-testid="button-pos-issue"
                      >
                        <ReceiptText size={20} />
                        {issueState.kind === "submitting" ? "開立中，請稍候..." : "開立電子發票"}
                      </button>
                      <p className="text-xs text-muted-foreground text-center">
                        發票品名將帶入實際購買的商品明細
                      </p>
                    </>
                  )}
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

      {/* ── 商品管理 ── */}
      {canManageProducts && (
        <div className="bg-white rounded-3xl border shadow-sm p-6">
          <button
            type="button"
            onClick={() => setManageOpen((v) => !v)}
            className="w-full flex items-center justify-between"
            data-testid="button-toggle-products-manage"
          >
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Package size={20} className="text-primary" /> 商品管理
              {!isVendor && (
                <span className="text-xs font-normal text-muted-foreground">
                  （{selectedVendorId > 0 ? vendors.find((v) => v.id === selectedVendorId)?.name ?? "攤位" : "主辦方"}）
                </span>
              )}
            </h2>
            <span className="text-sm text-muted-foreground">{manageOpen ? "收合 ▲" : "展開 ▼"}</span>
          </button>
          {manageOpen && (
            <div className="mt-4 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="商品名稱"
                  className="flex-1 min-w-[160px] px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none focus:border-primary"
                  data-testid="input-new-product-name"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="價格"
                  className="w-28 px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none focus:border-primary"
                  data-testid="input-new-product-price"
                />
                <button
                  type="button"
                  onClick={createProduct}
                  disabled={!newName.trim() || !newPrice.trim()}
                  className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                  data-testid="button-add-product"
                >
                  <Plus size={16} /> 新增
                </button>
              </div>
              {manageProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">尚未建立商品。</p>
              ) : (
                <ul className="divide-y">
                  {manageProducts.map((p) => (
                    <li key={p.id} className="py-2.5 flex items-center gap-3 text-sm" data-testid={`manage-product-${p.id}`}>
                      <span className={cn("flex-1 font-medium", !p.active && "line-through text-muted-foreground")}>{p.name}</span>
                      <span className="font-bold">NT${p.price.toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const name = window.prompt("商品名稱：", p.name);
                          if (name === null) return;
                          const priceStr = window.prompt("價格（NT$）：", String(p.price));
                          if (priceStr === null) return;
                          updateProduct(p.id, { name: name.trim(), price: Number(priceStr) });
                        }}
                        className="p-2 rounded-lg border hover:bg-muted"
                        title="編輯"
                        data-testid={`button-edit-product-${p.id}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateProduct(p.id, { active: !p.active })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-xs font-bold",
                          p.active ? "text-amber-700 border-amber-300 hover:bg-amber-50" : "text-green-700 border-green-300 hover:bg-green-50",
                        )}
                        data-testid={`button-toggle-product-${p.id}`}
                      >
                        {p.active ? "下架" : "上架"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProduct(p)}
                        className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                        title="刪除"
                        data-testid={`button-delete-product-${p.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 最近訂單 ── */}
      <div className="bg-white rounded-3xl border shadow-sm p-6">
        <button
          type="button"
          onClick={() => setOrdersOpen((v) => !v)}
          className="w-full flex items-center justify-between"
          data-testid="button-toggle-orders"
        >
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ListOrdered size={20} className="text-primary" /> 最近訂單
          </h2>
          <span className="text-sm text-muted-foreground">{ordersOpen ? "收合 ▲" : "展開 ▼"}</span>
        </button>
        {ordersOpen && (
          <div className="mt-4">
            {ordersError ? (
              <p className="text-sm text-red-600 flex items-center gap-2"><AlertTriangle size={16} /> {ordersError}</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無訂單。</p>
            ) : (
              <ul className="divide-y text-sm">
                {orders.map((o) => (
                  <li key={o.id} className="py-3 space-y-1" data-testid={`order-${o.id}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{o.paymentRef}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span>
                        {o.buyerName || "—"}・{o.items.map((it) => `${it.name}×${it.qty}`).join("、")}
                        {o.discount > 0 && <span className="text-red-600">・折價−${o.discount}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod}</span>
                        <span className="font-bold">NT${o.totalAmount.toLocaleString()}</span>
                        <span className={cn(
                          "text-xs",
                          o.invoice?.status === "issued" ? "text-green-600" : o.invoice?.status === "failed" ? "text-red-500" : "text-muted-foreground",
                        )}>
                          {o.invoice?.status === "issued"
                            ? `發票 ${o.invoice.invoiceNumber ?? "已開立"}`
                            : o.invoice?.status === "failed"
                              ? "發票失敗"
                              : o.invoice?.status === "voided"
                                ? "發票已作廢"
                                : "未開發票"}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
