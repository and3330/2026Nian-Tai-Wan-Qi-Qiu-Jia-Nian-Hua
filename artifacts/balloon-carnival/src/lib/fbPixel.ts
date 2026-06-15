// Facebook (Meta) Pixel integration.
//
// The Pixel ID is read from the build-time env var `VITE_FB_PIXEL_ID`.
// If it is not set, every function here becomes a no-op, so the site works
// normally before the ID is provided. Once the ID is added and the app is
// rebuilt/redeployed, tracking activates automatically.

declare global {
  interface Window {
    fbq?: ((...args: any[]) => void) & { callMethod?: (...args: any[]) => void; queue?: any[] };
    _fbq?: unknown;
  }
}

const PIXEL_ID: string | undefined = import.meta.env.VITE_FB_PIXEL_ID;

let initialized = false;

export function isPixelEnabled(): boolean {
  return Boolean(PIXEL_ID);
}

/**
 * Inject the Meta Pixel base code and initialise it. Safe to call multiple
 * times — it only runs once. No-op when VITE_FB_PIXEL_ID is not configured.
 */
export function initPixel(): void {
  if (initialized) return;
  if (!PIXEL_ID) return;
  if (typeof window === "undefined") return;

  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq?.("init", PIXEL_ID);
  initialized = true;
  trackPageView();
}

/** Fire a standard PageView event (call on every route change). */
export function trackPageView(): void {
  if (!PIXEL_ID) return;
  window.fbq?.("track", "PageView");
}

/** Fire a standard Meta event with optional parameters. */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!PIXEL_ID) return;
  window.fbq?.("track", name, params);
}

/** Fire InitiateCheckout when the user starts the payment step. */
export function trackInitiateCheckout(params: {
  value: number;
  currency?: string;
  contents?: { id: string; quantity: number }[];
  num_items?: number;
}): void {
  trackEvent("InitiateCheckout", {
    currency: params.currency ?? "TWD",
    value: params.value,
    ...(params.contents ? { contents: params.contents, content_type: "product" } : {}),
    ...(params.num_items != null ? { num_items: params.num_items } : {}),
  });
}

/**
 * Fire Purchase on a confirmed paid order (the key ad-conversion event).
 * De-duplicated per orderId across reloads/revisits via localStorage so a
 * user refreshing the result page does not inflate Meta conversions.
 */
export function trackPurchase(params: {
  value: number;
  currency?: string;
  contentName?: string;
  orderId?: string;
}): void {
  if (!PIXEL_ID) return;

  const orderId = params.orderId;
  const storageKey = orderId ? `fb_purchase_tracked_${orderId}` : null;
  if (storageKey) {
    try {
      if (window.localStorage.getItem(storageKey)) return;
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* localStorage unavailable (private mode) — fall through and still track */
    }
  }

  window.fbq?.(
    "track",
    "Purchase",
    {
      currency: params.currency ?? "TWD",
      value: params.value,
      ...(params.contentName ? { content_name: params.contentName } : {}),
      ...(orderId ? { order_id: orderId } : {}),
    },
    ...(orderId ? [{ eventID: `purchase_${orderId}` }] : []),
  );
}
