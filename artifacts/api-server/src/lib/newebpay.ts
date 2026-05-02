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
  rawData: Record<string, unknown> | null;
}

export function verifyNewebPayCallback(body: Record<string, string>): NewebPayCallbackResult {
  try {
    if (!body.TradeInfo || !body.TradeSha) {
      return { valid: false, orderNo: "", tradeNo: "", paid: false, amount: null, rawData: null };
    }
    const cfg = getConfig();
    const tradeSha = sha256Hash(`HashKey=${cfg.hashKey}&${body.TradeInfo}&HashIV=${cfg.hashIV}`);
    const valid = tradeSha === body.TradeSha;
    if (!valid) {
      return { valid: false, orderNo: "", tradeNo: "", paid: false, amount: null, rawData: null };
    }

    const decrypted = aesDecrypt(body.TradeInfo, cfg.hashKey, cfg.hashIV);
    let data: any;
    try {
      data = JSON.parse(decrypted);
    } catch {
      const params = new URLSearchParams(decrypted);
      data = {
        Status: params.get("Status"),
        Result: Object.fromEntries(params.entries()),
      };
    }

    const result = data.Result || {};
    const amtRaw = result.Amt;
    const amount = amtRaw == null ? null : parseInt(String(amtRaw), 10);
    return {
      valid: true,
      orderNo: String(result.MerchantOrderNo || ""),
      tradeNo: String(result.TradeNo || ""),
      paid: data.Status === "SUCCESS",
      amount: Number.isNaN(amount as number) ? null : amount,
      rawData: data,
    };
  } catch {
    return { valid: false, orderNo: "", tradeNo: "", paid: false, amount: null, rawData: null };
  }
}
