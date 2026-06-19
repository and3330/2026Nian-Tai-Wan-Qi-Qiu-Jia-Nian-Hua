import crypto from "crypto";

// Default values are NewebPay's public TEST/staging credentials, used only
// when no environment overrides are provided. Production deployments MUST
// set NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV, and
// (optionally) NEWEBPAY_MPG_URL to point at https://core.newebpay.com.
const NEWEBPAY_TEST_DEFAULTS = {
  merchantId: "MS149014346",
  hashKey: "Yb4VoFickhroXrSS1lJMEgXo9JrKquGz",
  hashIV: "dHU1ERbBYNJswxdt",
  mpgUrl: "https://ccore.newebpay.com/MPG/mpg_gateway",
};

function getConfig() {
  return {
    merchantId: process.env.NEWEBPAY_MERCHANT_ID || NEWEBPAY_TEST_DEFAULTS.merchantId,
    hashKey: process.env.NEWEBPAY_HASH_KEY || NEWEBPAY_TEST_DEFAULTS.hashKey,
    hashIV: process.env.NEWEBPAY_HASH_IV || NEWEBPAY_TEST_DEFAULTS.hashIV,
    mpgUrl: process.env.NEWEBPAY_MPG_URL || NEWEBPAY_TEST_DEFAULTS.mpgUrl,
  };
}

function aesEncrypt(data: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

function sha256Hash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
}

function aesDecrypt(encrypted: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function buildQueryString(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export interface NewebPayOrderInput {
  orderNo: string;
  amount: number;
  itemName: string;
  email: string;
  returnUrl: string;
  notifyUrl: string;
  clientBackUrl: string;
}

export function createNewebPayOrder(input: NewebPayOrderInput): {
  apiUrl: string;
  params: Record<string, string>;
} {
  const cfg = getConfig();
  const tradeInfo: Record<string, string | number> = {
    MerchantID: cfg.merchantId,
    RespondType: "JSON",
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    Version: "2.3",
    LangType: "zh-tw",
    MerchantOrderNo: input.orderNo,
    Amt: input.amount,
    ItemDesc: input.itemName.substring(0, 50),
    Email: input.email || "noreply@balloon-carnival.tw",
    ReturnURL: input.returnUrl,
    NotifyURL: input.notifyUrl,
    ClientBackURL: input.clientBackUrl,
    CREDIT: 1,
    VACC: 1,
    CVS: 1,
  };

  const tradeInfoStr = buildQueryString(tradeInfo);
  const tradeInfoEncrypted = aesEncrypt(tradeInfoStr, cfg.hashKey, cfg.hashIV);
  const tradeSha = sha256Hash(`HashKey=${cfg.hashKey}&${tradeInfoEncrypted}&HashIV=${cfg.hashIV}`);

  return {
    apiUrl: cfg.mpgUrl,
    params: {
      MerchantID: cfg.merchantId,
      TradeInfo: tradeInfoEncrypted,
      TradeSha: tradeSha,
      Version: "2.3",
    },
  };
}

export interface NewebPayCallbackResult {
  valid: boolean;
  orderNo: string;
  tradeNo: string;
  paid: boolean;
  amount: number | null;
  // Present only when NewebPay has actually collected the money. For VACC/CVS,
  // the 取號 (virtual-account / store-code issued) callback reports
  // Status=SUCCESS but carries NO PayTime, so callers must not treat it as paid.
  payTime: string | null;
  rawData: Record<string, unknown> | null;
}

export function verifyNewebPayCallback(body: Record<string, string>): NewebPayCallbackResult {
  try {
    if (!body.TradeInfo || !body.TradeSha) {
      return { valid: false, orderNo: "", tradeNo: "", paid: false, amount: null, payTime: null, rawData: null };
    }
    const cfg = getConfig();
    const tradeSha = sha256Hash(`HashKey=${cfg.hashKey}&${body.TradeInfo}&HashIV=${cfg.hashIV}`);
    const valid = tradeSha === body.TradeSha;
    if (!valid) {
      return { valid: false, orderNo: "", tradeNo: "", paid: false, amount: null, payTime: null, rawData: null };
    }

    const decrypted = aesDecrypt(body.TradeInfo, cfg.hashKey, cfg.hashIV);
    let data: { Status?: string; Result?: Record<string, unknown> };
    try {
      data = JSON.parse(decrypted);
    } catch {
      const params = new URLSearchParams(decrypted);
      data = {
        Status: params.get("Status") ?? undefined,
        Result: Object.fromEntries(params.entries()),
      };
    }

    const result: Record<string, unknown> = data.Result ?? {};
    const amtRaw = result.Amt;
    const amount = amtRaw == null ? null : parseInt(String(amtRaw), 10);
    const payTimeRaw = result.PayTime;
    const payTime = payTimeRaw == null || String(payTimeRaw).trim() === "" ? null : String(payTimeRaw);
    return {
      valid: true,
      orderNo: String(result.MerchantOrderNo || ""),
      tradeNo: String(result.TradeNo || ""),
      paid: data.Status === "SUCCESS",
      amount: Number.isNaN(amount as number) ? null : amount,
      payTime,
      rawData: data,
    };
  } catch {
    return { valid: false, orderNo: "", tradeNo: "", paid: false, amount: null, payTime: null, rawData: null };
  }
}

export interface NewebPayTradeQueryResult {
  // Whether the query API call itself succeeded (NewebPay Status === "SUCCESS").
  ok: boolean;
  // Authoritative: NewebPay reports this order as actually paid (TradeStatus "1").
  paid: boolean;
  tradeStatus: string;
  tradeNo: string;
  amount: number | null;
  paymentType: string;
  payTime: string;
  message: string;
  raw: Record<string, unknown> | null;
}

// Queries NewebPay's official QueryTradeInfo API for the authoritative status of
// a single order. Used by the admin reconcile job to recover orders that were
// actually paid but whose notify/return callback never reached us. Read-only.
// TradeStatus codes: "0" 未付款, "1" 已付款, "2" 付款失敗, "3" 取消, "6" 退款.
export async function queryNewebPayTrade(
  orderNo: string,
  amount: number,
): Promise<NewebPayTradeQueryResult> {
  const cfg = getConfig();
  const checkStr = `IV=${cfg.hashIV}&Amt=${amount}&MerchantID=${cfg.merchantId}&MerchantOrderNo=${orderNo}&Key=${cfg.hashKey}`;
  const checkValue = sha256Hash(checkStr);
  let origin = "https://core.newebpay.com";
  try {
    origin = new URL(cfg.mpgUrl).origin;
  } catch {
    /* keep production default */
  }
  const queryUrl = `${origin}/API/QueryTradeInfo`;
  const body = buildQueryString({
    MerchantID: cfg.merchantId,
    Version: "1.3",
    RespondType: "JSON",
    CheckValue: checkValue,
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    MerchantOrderNo: orderNo,
    Amt: amount,
  });

  const res = await fetch(queryUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let json: { Status?: string; Message?: string; Result?: Record<string, unknown> };
  try {
    json = JSON.parse(text);
  } catch {
    return {
      ok: false,
      paid: false,
      tradeStatus: "",
      tradeNo: "",
      amount: null,
      paymentType: "",
      payTime: "",
      message: `非預期回應: ${text.slice(0, 120)}`,
      raw: null,
    };
  }
  const result: Record<string, unknown> = json.Result ?? {};
  const tradeStatus = String(result.TradeStatus ?? "");
  const amtRaw = result.Amt;
  const amt = amtRaw == null ? null : parseInt(String(amtRaw), 10);
  return {
    ok: json.Status === "SUCCESS",
    paid: tradeStatus === "1",
    tradeStatus,
    tradeNo: String(result.TradeNo || ""),
    amount: Number.isNaN(amt as number) ? null : amt,
    paymentType: String(result.PaymentType || ""),
    payTime: String(result.PayTime || ""),
    message: String(json.Message || ""),
    raw: json as Record<string, unknown>,
  };
}
