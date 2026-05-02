# 綠界 ECPay 電子發票串接技術文件

## 概述

本模組實作綠界科技（ECPay）B2C 電子發票 API v3.0 串接，支援：
- **開立發票**（B2CInvoice/Issue）
- **作廢發票**（B2CInvoice/Invalid）
- 個人發票（手機載具 / 自然人憑證 / 紙本）
- 公司發票（統一編號）
- 捐贈發票（愛心碼）

加密方式：AES-128-CBC + URL Encode

---

## 環境變數設定

```env
# ===== 必填 =====
ECPAY_INVOICE_MERCHANT_ID=你的發票特店編號
ECPAY_INVOICE_HASH_KEY=你的發票HashKey
ECPAY_INVOICE_HASH_IV=你的發票HashIV

# ===== 選填（備用） =====
# 若未設定 ECPAY_INVOICE_MERCHANT_ID，會 fallback 到 ECPAY_MERCHANT_ID
ECPAY_MERCHANT_ID=你的綠界特店編號
```

> **注意**：發票的 HashKey/HashIV 和金流付款的 HashKey/HashIV 是不同的，請在綠界後台分別取得。

### 測試環境（未設定 ECPAY_INVOICE_HASH_KEY 時自動啟用）

| 項目 | 值 |
|------|-----|
| MerchantID | 2000132 |
| HashKey | ejCk326UnaZWKisg |
| HashIV | q9jcZX8Ib9LM8wYk |
| API URL | https://einvoice-stage.ecpay.com.tw |

### 正式環境

| 項目 | 值 |
|------|-----|
| API URL | https://einvoice.ecpay.com.tw |

---

## 完整程式碼

### `ecpay-invoice.ts`

```typescript
import crypto from "crypto";

// ========== 設定 ==========

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
    hashKey:
      process.env.ECPAY_INVOICE_HASH_KEY ||
      ECPAY_INVOICE_TEST_CONFIG.hashKey,
    hashIV:
      process.env.ECPAY_INVOICE_HASH_IV ||
      ECPAY_INVOICE_TEST_CONFIG.hashIV,
    apiUrl: isTest
      ? ECPAY_INVOICE_TEST_CONFIG.apiUrl
      : "https://einvoice.ecpay.com.tw",
  };
}

// ========== AES 加解密 ==========

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

// ========== 型別定義 ==========

export interface InvoiceIssueOptions {
  /** 關聯編號（訂單編號），最長 30 字元，不可重複 */
  relateNumber: string;
  /** 買方 Email（與 customerPhone 至少填一項） */
  customerEmail: string;
  /** 買方名稱 */
  customerName?: string;
  /** 買方手機號碼 */
  customerPhone?: string;
  /** 買方地址 */
  customerAddr?: string;
  /** 發票類型：個人 / 公司 / 捐贈 */
  invoiceType: "personal" | "company" | "donation";
  /** 載具類型：phone_barcode=手機條碼 / citizen_certificate=自然人憑證 / ecpay_carrier=綠界載具 */
  carrierType?: string;
  /** 載具編號 */
  carrierNum?: string;
  /** 愛心碼（捐贈時必填） */
  loveCode?: string;
  /** 統一編號（公司發票必填，8 碼） */
  taxId?: string;
  /** 公司抬頭 */
  companyTitle?: string;
  /** 發票總金額（含稅） */
  salesAmount: number;
  /** 商品明細 */
  items: {
    name: string;
    count: number;
    unitPrice: number;
    amount: number;
  }[];
}

export interface InvoiceIssueResult {
  success: boolean;
  /** 發票號碼，如 AB12345678 */
  invoiceNumber?: string;
  /** 發票開立日期 */
  invoiceDate?: string;
  /** 隨機碼（4 碼） */
  randomNumber?: string;
  /** 錯誤訊息 */
  message?: string;
  /** 綠界原始回應 */
  rawResponse?: any;
}

export interface InvoiceVoidResult {
  success: boolean;
  message?: string;
}

// ========== 開立發票 ==========

export async function issueInvoice(
  options: InvoiceIssueOptions
): Promise<InvoiceIssueResult> {
  const config = getInvoiceConfig();

  let print = "0";
  let donation = "0";
  let carrierType = "";
  let carrierNum = "";
  let loveCode = "";
  let customerIdentifier = "";

  // --- 驗證 ---
  if (options.salesAmount <= 0) {
    return { success: false, message: "發票金額必須大於 0" };
  }
  if (!options.customerEmail && !options.customerPhone) {
    return { success: false, message: "買方 Email 和手機號碼至少需填一項" };
  }

  // --- 發票類型處理 ---
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
    // 個人發票 - 載具處理
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

  // --- 組裝請求 ---
  const timestamp = Math.floor(Date.now() / 1000);

  const invoiceData: Record<string, any> = {
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
    TaxType: "1", // 應稅
    SalesAmount: options.salesAmount,
    InvoiceRemark: "", // 可自訂備註
    Items: options.items.map((i, idx) => ({
      ItemSeq: idx + 1,
      ItemName: (i.name || "商品").substring(0, 100),
      ItemCount: i.count,
      ItemWord: "式",
      ItemPrice: i.unitPrice,
      ItemAmount: i.amount,
    })),
    InvType: "07", // 一般稅額
    vat: "1",
  };

  const encryptedData = aesEncrypt(
    JSON.stringify(invoiceData),
    config.hashKey,
    config.hashIV
  );

  const requestBody = {
    MerchantID: config.merchantId,
    RqHeader: {
      Timestamp: timestamp,
      Revision: "3.0.0",
    },
    Data: encryptedData,
  };

  // --- 發送請求 ---
  try {
    const response = await fetch(`${config.apiUrl}/B2CInvoice/Issue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const responseJson = (await response.json()) as any;
    console.log(
      `[ECPay Invoice] Issue response: TransCode=${responseJson.TransCode} TransMsg=${responseJson.TransMsg}`
    );

    if (responseJson.TransCode !== 1 || !responseJson.Data) {
      let errorMsg =
        responseJson.TransMsg || responseJson.message || "發票開立失敗";
      if (
        responseJson.TransCode === 110 ||
        (errorMsg && errorMsg.includes("decrypt fail"))
      ) {
        errorMsg = `發票加密驗證失敗：請確認 ECPAY_INVOICE_MERCHANT_ID、ECPAY_INVOICE_HASH_KEY、ECPAY_INVOICE_HASH_IV 設定正確 (MerchantID: ${config.merchantId})`;
      }
      return { success: false, message: errorMsg, rawResponse: responseJson };
    }

    // --- 解密回應 ---
    let decryptedData: any;
    try {
      const decryptedStr = aesDecrypt(
        responseJson.Data,
        config.hashKey,
        config.hashIV
      );
      decryptedData = JSON.parse(decryptedStr);
    } catch (decErr: any) {
      return {
        success: false,
        message: `發票回傳解密失敗: ${decErr.message}`,
        rawResponse: responseJson,
      };
    }

    const rtnCode = Number(decryptedData.RtnCode);
    if (rtnCode === 1) {
      return {
        success: true,
        invoiceNumber:
          decryptedData.InvoiceNo || decryptedData.InvoiceNumber,
        invoiceDate: decryptedData.InvoiceDate,
        randomNumber: decryptedData.RandomNumber,
        rawResponse: decryptedData,
      };
    } else {
      return {
        success: false,
        message: decryptedData.RtnMsg || "發票開立失敗",
        rawResponse: decryptedData,
      };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "發票開立請求失敗" };
  }
}

// ========== 作廢發票 ==========

export async function voidInvoice(
  invoiceNumber: string,
  invoiceDate: string,
  reason: string = "訂單取消"
): Promise<InvoiceVoidResult> {
  const config = getInvoiceConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  const voidData: Record<string, any> = {
    MerchantID: config.merchantId,
    InvoiceNo: invoiceNumber,
    InvoiceDate: invoiceDate,
    Reason: reason,
  };

  const encryptedData = aesEncrypt(
    JSON.stringify(voidData),
    config.hashKey,
    config.hashIV
  );

  const requestBody = {
    MerchantID: config.merchantId,
    RqHeader: {
      Timestamp: timestamp,
      Revision: "3.0.0",
    },
    Data: encryptedData,
  };

  try {
    const response = await fetch(`${config.apiUrl}/B2CInvoice/Invalid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const responseJson = (await response.json()) as any;
    console.log(
      `[ECPay Invoice] Void response: TransCode=${responseJson.TransCode} TransMsg=${responseJson.TransMsg}`
    );

    if (responseJson.TransCode !== 1 || !responseJson.Data) {
      return {
        success: false,
        message: responseJson.TransMsg || "發票作廢失敗",
      };
    }

    let decryptedData: any;
    try {
      const decryptedStr = aesDecrypt(
        responseJson.Data,
        config.hashKey,
        config.hashIV
      );
      decryptedData = JSON.parse(decryptedStr);
    } catch {
      return { success: false, message: "發票作廢回傳解密失敗" };
    }

    return {
      success: Number(decryptedData.RtnCode) === 1,
      message: decryptedData.RtnMsg,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
```

---

## 使用範例

### 開立個人發票（手機載具）

```typescript
import { issueInvoice } from "./ecpay-invoice";

const result = await issueInvoice({
  relateNumber: "ORD20260408001",
  customerEmail: "buyer@example.com",
  customerName: "王小明",
  customerPhone: "0912345678",
  invoiceType: "personal",
  carrierType: "phone_barcode",
  carrierNum: "/ABC+123",
  salesAmount: 1500,
  items: [
    { name: "夏令營課程", count: 1, unitPrice: 1500, amount: 1500 },
  ],
});

if (result.success) {
  console.log(`發票號碼: ${result.invoiceNumber}`);
  console.log(`開立日期: ${result.invoiceDate}`);
  console.log(`隨機碼: ${result.randomNumber}`);
} else {
  console.error(`開立失敗: ${result.message}`);
}
```

### 開立公司發票（統一編號）

```typescript
const result = await issueInvoice({
  relateNumber: "ORD20260408002",
  customerEmail: "accounting@company.com",
  customerName: "ABC有限公司",
  invoiceType: "company",
  taxId: "12345678",
  companyTitle: "ABC有限公司",
  salesAmount: 10000,
  items: [
    { name: "企業培訓課程 A", count: 2, unitPrice: 3000, amount: 6000 },
    { name: "企業培訓課程 B", count: 1, unitPrice: 4000, amount: 4000 },
  ],
});
```

### 開立捐贈發票

```typescript
const result = await issueInvoice({
  relateNumber: "ORD20260408003",
  customerEmail: "donor@example.com",
  invoiceType: "donation",
  loveCode: "168001",
  salesAmount: 500,
  items: [
    { name: "商品", count: 1, unitPrice: 500, amount: 500 },
  ],
});
```

### 作廢發票

```typescript
import { voidInvoice } from "./ecpay-invoice";

const result = await voidInvoice(
  "AB12345678",     // 發票號碼
  "2026-04-08",     // 發票開立日期
  "客戶退貨退款"     // 作廢原因
);

if (result.success) {
  console.log("發票已作廢");
} else {
  console.error(`作廢失敗: ${result.message}`);
}
```

---

## 其他專案使用步驟

1. 複製 `ecpay-invoice.ts` 到你的專案
2. 設定環境變數：
   ```env
   ECPAY_INVOICE_MERCHANT_ID=你的發票特店編號
   ECPAY_INVOICE_HASH_KEY=你的發票HashKey
   ECPAY_INVOICE_HASH_IV=你的發票HashIV
   ```
3. 在你的路由中引入並呼叫：
   ```typescript
   import { issueInvoice, voidInvoice } from "./ecpay-invoice";
   ```

> 不設定 `ECPAY_INVOICE_HASH_KEY` 環境變數時，會自動使用綠界測試環境。

---

## API 加密流程

```
原始資料 (JSON) 
  → encodeURIComponent 
  → AES-128-CBC 加密 (使用 HashKey + HashIV) 
  → Base64 編碼 
  → 放入請求 Data 欄位
```

回應解密流程反向：

```
回應 Data 欄位 (Base64)
  → AES-128-CBC 解密
  → decodeURIComponent
  → JSON.parse
```

---

## 常見錯誤碼

| TransCode | 說明 | 處理方式 |
|-----------|------|---------|
| 1 | 成功 | 解密 Data 後檢查 RtnCode |
| 110 | decrypt fail | HashKey/HashIV/MerchantID 不正確 |
| 其他 | 見 TransMsg | 依錯誤訊息排查 |

| RtnCode | 說明 |
|---------|------|
| 1 | 開立/作廢成功 |
| 其他 | 見 RtnMsg |

---

## 載具類型對應

| 系統代碼 | ECPay CarrierType | 說明 |
|---------|-------------------|------|
| phone_barcode | 3 | 手機條碼載具（`/` 開頭，共 8 碼） |
| citizen_certificate | 2 | 自然人憑證（16 碼大寫英數） |
| ecpay_carrier | 1 | 綠界會員載具 |
| （空）| （空）| 紙本發票 |

---

## 綠界後台設定

1. 登入 [綠界商家後台](https://vendor.ecpay.com.tw/)
2. 進入「電子發票」→「API 串接設定」
3. 取得 **MerchantID**、**HashKey**、**HashIV**
4. 設定到環境變數

> 發票的金鑰（HashKey/HashIV）與金流付款的金鑰不同，請分開管理。
