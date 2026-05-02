import crypto from "crypto";

const ECPAY_INVOICE_TEST_CONFIG = {
  merchantId: "2000132",
  hashKey: "ejCk326UnaZWKisg",
  hashIV: "q9jcZX8Ib9LM8wYk",
  apiUrl: "https://einvoice-stage.ecpay.com.tw",
};

function getInvoiceConfig() {
  const isTest = !process.env.ECPAY_INVOICE_HASH_KEY;
  return {
    merchantId:
      process.env.ECPAY_INVOICE_MERCHANT_ID ||
      process.env.ECPAY_MERCHANT_ID ||
      ECPAY_INVOICE_TEST_CONFIG.merchantId,
    hashKey: process.env.ECPAY_INVOICE_HASH_KEY || ECPAY_INVOICE_TEST_CONFIG.hashKey,
    hashIV: process.env.ECPAY_INVOICE_HASH_IV || ECPAY_INVOICE_TEST_CONFIG.hashIV,
    apiUrl: isTest ? ECPAY_INVOICE_TEST_CONFIG.apiUrl : "https://einvoice.ecpay.com.tw",
    isTest,
  };
}

function aesEncrypt(data: string, key: string, iv: string): string {
  const keyBuf = Buffer.from(key, "utf-8");
  const ivBuf = Buffer.from(iv, "utf-8");
  const cipher = crypto.createCipheriv("aes-128-cbc", keyBuf, ivBuf);
  cipher.setAutoPadding(true);
  const encoded = encodeURIComponent(data);
  let encrypted = cipher.update(encoded, "utf-8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function aesDecrypt(encryptedData: string, key: string, iv: string): string {
  const keyBuf = Buffer.from(key, "utf-8");
  const ivBuf = Buffer.from(iv, "utf-8");
  const decipher = crypto.createDecipheriv("aes-128-cbc", keyBuf, ivBuf);
  decipher.setAutoPadding(true);
  let decrypted = decipher.update(encryptedData, "base64", "utf-8");
  decrypted += decipher.final("utf-8");
  return decodeURIComponent(decrypted);
}

export interface InvoiceItem {
  name: string;
  count: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceIssueOptions {
  relateNumber: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  customerAddr?: string;
  invoiceType: "personal" | "company" | "donation";
  carrierType?: "phone_barcode" | "citizen_certificate" | "ecpay_carrier" | "" | null;
  carrierNum?: string;
  loveCode?: string;
  taxId?: string;
  companyTitle?: string;
  salesAmount: number;
  items: InvoiceItem[];
}

export interface InvoiceIssueResult {
  success: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  randomNumber?: string;
  message?: string;
  rawResponse?: unknown;
}

export interface InvoiceVoidResult {
  success: boolean;
  message?: string;
}

export async function issueInvoice(options: InvoiceIssueOptions): Promise<InvoiceIssueResult> {
  const config = getInvoiceConfig();

  let print = "0";
  let donation = "0";
  let carrierType = "";
  let carrierNum = "";
  let loveCode = "";
  let customerIdentifier = "";

  if (options.salesAmount <= 0) {
    return { success: false, message: "發票金額必須大於 0" };
  }
  if (!options.customerEmail && !options.customerPhone) {
    return { success: false, message: "買方 Email 和手機號碼至少需填一項" };
  }

  if (options.invoiceType === "donation") {
    donation = "1";
    loveCode = options.loveCode || "";
    print = "0";
    if (!loveCode) {
      return { success: false, message: "捐贈發票需填寫愛心碼" };
    }
  } else if (options.invoiceType === "company") {
    customerIdentifier = options.taxId || "";
    if (!customerIdentifier || customerIdentifier.length !== 8) {
      return { success: false, message: "公司發票需填寫 8 碼統一編號" };
    }
    print = "1";
  } else {
    if (options.carrierType === "phone_barcode") {
      carrierType = "3";
      carrierNum = (options.carrierNum || "").replace(/\+/g, " ");
    } else if (options.carrierType === "citizen_certificate") {
      carrierType = "2";
      carrierNum = options.carrierNum || "";
    } else if (options.carrierType === "ecpay_carrier") {
      carrierType = "1";
      carrierNum = "";
    } else {
      carrierType = "";
      print = "0";
    }
  }

  const customerName =
    options.invoiceType === "company"
      ? options.companyTitle || options.customerName || ""
      : options.customerName || "";
  const customerAddr = options.customerAddr || "";

  if (print === "1" && !customerName) {
    return { success: false, message: "列印發票時買方名稱為必填" };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const invoiceData: Record<string, unknown> = {
    MerchantID: config.merchantId,
    RelateNumber: options.relateNumber.substring(0, 30),
    CustomerID: "",
    CustomerIdentifier: customerIdentifier,
    CustomerName: customerName,
    CustomerAddr: customerAddr,
    CustomerPhone: options.customerPhone || "",
    CustomerEmail: options.customerEmail || "",
    ClearanceMark: "",
    Print: print,
    Donation: donation,
    LoveCode: loveCode,
    CarrierType: carrierType,
    CarrierNum: carrierNum,
    TaxType: "1",
    SalesAmount: options.salesAmount,
    InvoiceRemark: "",
    Items: options.items.map((i, idx) => ({
      ItemSeq: idx + 1,
      ItemName: (i.name || "商品").substring(0, 100),
      ItemCount: i.count,
      ItemWord: "式",
      ItemPrice: i.unitPrice,
      ItemAmount: i.amount,
    })),
    InvType: "07",
    vat: "1",
  };

  const encryptedData = aesEncrypt(JSON.stringify(invoiceData), config.hashKey, config.hashIV);
  const requestBody = {
    MerchantID: config.merchantId,
    RqHeader: { Timestamp: timestamp, Revision: "3.0.0" },
    Data: encryptedData,
  };

  try {
    const response = await fetch(`${config.apiUrl}/B2CInvoice/Issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const responseJson = (await response.json()) as Record<string, unknown>;

    if (responseJson.TransCode !== 1 || !responseJson.Data) {
      let errorMsg =
        (responseJson.TransMsg as string) || (responseJson.message as string) || "發票開立失敗";
      if (
        responseJson.TransCode === 110 ||
        (errorMsg && errorMsg.includes("decrypt fail"))
      ) {
        errorMsg = `發票加密驗證失敗：請確認 ECPAY_INVOICE_MERCHANT_ID、ECPAY_INVOICE_HASH_KEY、ECPAY_INVOICE_HASH_IV 設定正確 (MerchantID: ${config.merchantId})`;
      }
      return { success: false, message: errorMsg, rawResponse: responseJson };
    }

    let decryptedData: Record<string, unknown>;
    try {
      const decryptedStr = aesDecrypt(
        responseJson.Data as string,
        config.hashKey,
        config.hashIV,
      );
      decryptedData = JSON.parse(decryptedStr);
    } catch (decErr: unknown) {
      const message = decErr instanceof Error ? decErr.message : String(decErr);
      return {
        success: false,
        message: `發票回傳解密失敗: ${message}`,
        rawResponse: responseJson,
      };
    }

    const rtnCode = Number(decryptedData.RtnCode);
    if (rtnCode === 1) {
      return {
        success: true,
        invoiceNumber:
          (decryptedData.InvoiceNo as string) || (decryptedData.InvoiceNumber as string),
        invoiceDate: decryptedData.InvoiceDate as string,
        randomNumber: decryptedData.RandomNumber as string,
        rawResponse: decryptedData,
      };
    }
    return {
      success: false,
      message: (decryptedData.RtnMsg as string) || "發票開立失敗",
      rawResponse: decryptedData,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: message || "發票開立請求失敗" };
  }
}

export async function voidInvoice(
  invoiceNumber: string,
  invoiceDate: string,
  reason: string = "訂單取消",
): Promise<InvoiceVoidResult> {
  const config = getInvoiceConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  const voidData: Record<string, unknown> = {
    MerchantID: config.merchantId,
    InvoiceNo: invoiceNumber,
    InvoiceDate: invoiceDate,
    Reason: reason,
  };
  const encryptedData = aesEncrypt(JSON.stringify(voidData), config.hashKey, config.hashIV);
  const requestBody = {
    MerchantID: config.merchantId,
    RqHeader: { Timestamp: timestamp, Revision: "3.0.0" },
    Data: encryptedData,
  };

  try {
    const response = await fetch(`${config.apiUrl}/B2CInvoice/Invalid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const responseJson = (await response.json()) as Record<string, unknown>;

    if (responseJson.TransCode !== 1 || !responseJson.Data) {
      return {
        success: false,
        message: (responseJson.TransMsg as string) || "發票作廢失敗",
      };
    }
    let decryptedData: Record<string, unknown>;
    try {
      const decryptedStr = aesDecrypt(
        responseJson.Data as string,
        config.hashKey,
        config.hashIV,
      );
      decryptedData = JSON.parse(decryptedStr);
    } catch {
      return { success: false, message: "發票作廢回傳解密失敗" };
    }
    return {
      success: Number(decryptedData.RtnCode) === 1,
      message: decryptedData.RtnMsg as string,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message };
  }
}
