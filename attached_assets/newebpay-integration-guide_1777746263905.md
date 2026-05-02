# 藍新金流（NewebPay）串接指南 — 測試環境版

> 適用於 Node.js / Express 後端 + React 前端的全端網站。  
> 本文件使用藍新測試環境，可直接複製實作，無需申請正式商店。  
> API 版本：MPG 2.3（信用卡 + ATM 虛擬帳號）

---

## 目錄

1. [測試環境金鑰](#1-測試環境金鑰)
2. [資料庫 Schema（Drizzle ORM）](#2-資料庫-schemadrizzle-orm)
3. [後端核心模組 `server/payment/newebpay.ts`](#3-後端核心模組)
4. [後端路由 — 發起付款 & 回調處理](#4-後端路由)
5. [前端 — 表單跳轉](#5-前端表單跳轉)
6. [退款 API](#6-退款-api)
7. [測試方式](#7-測試方式)
8. [常見問題](#9-常見問題)

---

## 1. 測試環境金鑰

以下為藍新公開的測試商店資訊，直接寫在程式碼中即可，不需設定環境變數：

| 項目 | 值 |
|------|-----|
| 商店代號（MerchantID） | `MS149014346` |
| HashKey（32 字元） | `Yb4VoFickhroXrSS1lJMEgXo9JrKquGz` |
| HashIV（16 字元） | `dHU1ERbBYNJswxdt` |
| MPG 付款網址 | `https://ccore.newebpay.com/MPG/mpg_gateway` |
| 退款 API 網址 | `https://ccore.newebpay.com/API/CreditCard/Close` |

測試信用卡：`4000-2211-1111-1111`，到期日填任意未來日期，CVV 填任意三碼。

---

## 2. 資料庫 Schema（Drizzle ORM）

在 `shared/schema.ts` 中新增付款交易紀錄表：

```typescript
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const paymentTransactions = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tradeNo: text("trade_no").notNull().unique(),
  providerTradeNo: text("provider_trade_no"),
  orderId: text("order_id").notNull(),
  orderType: text("order_type").notNull(),
  provider: text("provider").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
```

然後在 `server/storage.ts` 加入對應的 CRUD 方法：

```typescript
async createPaymentTransaction(data: {
  tradeNo: string;
  orderId: string;
  orderType: string;
  provider: string;
  amount: number;
}): Promise<PaymentTransaction> {
  const [tx] = await db
    .insert(paymentTransactions)
    .values({ ...data, status: "pending" })
    .returning();
  return tx;
}

async getPaymentTransactionByTradeNo(tradeNo: string): Promise<PaymentTransaction | undefined> {
  const [tx] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.tradeNo, tradeNo));
  return tx;
}

async updatePaymentTransactionStatus(tradeNo: string, status: string): Promise<void> {
  await db
    .update(paymentTransactions)
    .set({ status })
    .where(eq(paymentTransactions.tradeNo, tradeNo));
}
```

執行 `npm run db:push` 同步資料表。

---

## 3. 後端核心模組

建立 `server/payment/newebpay.ts`：

```typescript
import crypto from "crypto";

const MERCHANT_ID = "MS149014346";
const HASH_KEY = "Yb4VoFickhroXrSS1lJMEgXo9JrKquGz";
const HASH_IV = "dHU1ERbBYNJswxdt";
const MPG_URL = "https://ccore.newebpay.com/MPG/mpg_gateway";
const REFUND_URL = "https://ccore.newebpay.com/API/CreditCard/Close";

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

export function createNewebPayOrder(options: {
  orderId: string;
  amount: number;
  itemName: string;
  returnUrl: string;
  notifyUrl: string;
  clientBackUrl: string;
  email: string;
}) {
  const orderNo = `ORD${Date.now()}`.substring(0, 20);

  const tradeInfo: Record<string, string | number> = {
    MerchantID: MERCHANT_ID,
    RespondType: "JSON",
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    Version: "2.3",
    LangType: "zh-tw",
    MerchantOrderNo: orderNo,
    Amt: options.amount,
    ItemDesc: options.itemName.substring(0, 50),
    Email: options.email,
    ReturnURL: options.returnUrl,
    NotifyURL: options.notifyUrl,
    ClientBackURL: options.clientBackUrl,
    CREDIT: 1,
    VACC: 1,
  };

  const tradeInfoStr = buildQueryString(tradeInfo);
  const tradeInfoEncrypted = aesEncrypt(tradeInfoStr, HASH_KEY, HASH_IV);
  const tradeSha = sha256Hash(
    `HashKey=${HASH_KEY}&${tradeInfoEncrypted}&HashIV=${HASH_IV}`
  );

  return {
    apiUrl: MPG_URL,
    params: {
      MerchantID: MERCHANT_ID,
      TradeInfo: tradeInfoEncrypted,
      TradeSha: tradeSha,
      Version: "2.3",
    },
    orderNo,
    customOrderId: options.orderId,
  };
}

export function verifyNewebPayCallback(body: Record<string, string>): {
  valid: boolean;
  orderId: string;
  tradeNo: string;
  paid: boolean;
  rawData: any;
} {
  try {
    const tradeSha = sha256Hash(
      `HashKey=${HASH_KEY}&${body.TradeInfo}&HashIV=${HASH_IV}`
    );
    const valid = tradeSha === body.TradeSha;

    if (!valid) {
      console.log("[NewebPay] TradeSha verification failed");
      return { valid: false, orderId: "", tradeNo: "", paid: false, rawData: null };
    }

    const decrypted = aesDecrypt(body.TradeInfo, HASH_KEY, HASH_IV);
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

    return {
      valid: true,
      orderId: data.Result?.MerchantOrderNo || "",
      tradeNo: data.Result?.TradeNo || "",
      paid: data.Status === "SUCCESS",
      rawData: data,
    };
  } catch (err: any) {
    console.log(`[NewebPay] Callback verification error: ${err.message}`);
    return { valid: false, orderId: "", tradeNo: "", paid: false, rawData: null };
  }
}

export async function refundNewebPay(
  merchantOrderNo: string,
  _tradeNo: string,
  amount: number
): Promise<{ success: boolean; message: string }> {
  const postData: Record<string, string | number> = {
    RespondType: "JSON",
    Version: "1.1",
    Amt: amount,
    MerchantOrderNo: merchantOrderNo,
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    IndexType: 1,
    CloseType: 2,
  };

  const postDataStr = buildQueryString(postData);
  const postDataEncrypted = aesEncrypt(postDataStr, HASH_KEY, HASH_IV);

  try {
    const response = await fetch(REFUND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        MerchantID_: MERCHANT_ID,
        PostData_: postDataEncrypted,
      }).toString(),
    });

    const text = await response.text();
    console.log(`[NewebPay Refund] Response: ${text.substring(0, 500)}`);

    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      return { success: false, message: `回傳格式無法解析: ${text.substring(0, 200)}` };
    }

    if (result.Status === "SUCCESS") {
      return { success: true, message: result.Message || "退款成功" };
    } else {
      return { success: false, message: result.Message || `退款失敗 (${result.Status})` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "退款請求失敗" };
  }
}
```

---

## 4. 後端路由

在你的路由檔案（如 `server/routes.ts` 或 `server/routes/payment.ts`）中加入：

```typescript
import { createNewebPayOrder, verifyNewebPayCallback, refundNewebPay } from "./payment/newebpay";

app.post("/api/payment/newebpay/initiate", requireAuth, async (req, res) => {
  try {
    const userId = (req.session as any).userId;
    const { orderId, orderType } = req.body;

    const order = await storage.getOrderById(orderId);
    if (!order) return res.status(404).json({ message: "訂單不存在" });
    if (order.userId !== userId) return res.status(403).json({ message: "無權限" });
    if (order.status !== "pending_payment") {
      return res.status(400).json({ message: "訂單狀態不正確" });
    }

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = `${protocol}://${host}`;

    const user = await storage.getUserById(userId);

    const result = createNewebPayOrder({
      orderId,
      amount: order.finalAmount,
      itemName: order.itemName || "商品",
      returnUrl: `${baseUrl}/api/payment/newebpay/return`,
      notifyUrl: `${baseUrl}/api/payment/newebpay/notify`,
      clientBackUrl: `${baseUrl}/orders`,
      email: user?.email || "",
    });

    await storage.createPaymentTransaction({
      tradeNo: result.orderNo,
      orderId,
      orderType,
      provider: "newebpay",
      amount: order.finalAmount,
    });

    res.json({
      type: "form_redirect",
      apiUrl: result.apiUrl,
      params: result.params,
    });
  } catch (error: any) {
    console.error("[Payment Error]", error);
    res.status(500).json({ message: "付款初始化失敗" });
  }
});

app.post("/api/payment/newebpay/notify", async (req, res) => {
  try {
    const result = verifyNewebPayCallback(req.body);
    console.log(`[NewebPay Notify] valid=${result.valid} paid=${result.paid} orderId=${result.orderId}`);

    if (result.valid && result.paid && result.orderId) {
      const tx = await storage.getPaymentTransactionByTradeNo(result.orderId);

      if (tx && tx.status !== "paid") {
        const paidAmount = result.rawData?.Result?.Amt;
        if (!paidAmount || parseInt(paidAmount) === tx.amount) {
          await storage.updateOrderStatus(tx.orderId, "paid");
          await storage.updatePaymentTransactionStatus(tx.tradeNo, "paid");
        } else {
          console.log(`[NewebPay] 金額不符: 預期=${tx.amount} 實際=${paidAmount}`);
        }
      }
    }

    res.send("OK");
  } catch (error: any) {
    console.error(`[NewebPay Notify Error] ${error.message}`);
    res.status(500).send("Error");
  }
});

app.post("/api/payment/newebpay/return", async (req, res) => {
  try {
    const result = verifyNewebPayCallback(req.body);

    if (result.valid && result.paid && result.orderId) {
      const tx = await storage.getPaymentTransactionByTradeNo(result.orderId);
      if (tx && tx.status !== "paid") {
        await storage.updateOrderStatus(tx.orderId, "paid");
        await storage.updatePaymentTransactionStatus(tx.tradeNo, "paid");
      }
    }

    res.redirect("/orders?payment=success");
  } catch (error: any) {
    console.error(`[NewebPay Return Error] ${error.message}`);
    res.redirect("/orders?payment=error");
  }
});
```

### 重要提醒

- **Notify**（背景通知）和 **Return**（前端跳轉）是兩個獨立的回調，可能先後順序不同，兩邊都要做冪等處理（檢查 `tx.status !== "paid"` 避免重複更新）。
- Notify URL 必須是外部可訪問的 HTTPS 網址。Replit 部署後的網址格式為 `https://YOUR_APP.replit.app`。
- Return 是 POST 方法（不是 GET），藍新以表單 POST 跳轉回來。

---

## 5. 前端表單跳轉

當後端回傳 `{ type: "form_redirect", apiUrl, params }` 時，前端需要動態建立一個隱藏表單並提交：

```tsx
async function handlePayment(orderId: string, orderType: string) {
  const response = await fetch("/api/payment/newebpay/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ orderId, orderType }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.message || "付款失敗");
    return;
  }

  if (data.type === "form_redirect") {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = data.apiUrl;

    for (const [key, value] of Object.entries(data.params as Record<string, string>)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }
}
```

> 藍新付款流程是「表單 POST 跳轉」，不是 AJAX 呼叫。使用者會離開你的網站進入藍新付款頁面，付款完成後再跳回 Return URL。

---

## 6. 退款 API

```typescript
app.post("/api/admin/refund/newebpay", requireAdmin, async (req, res) => {
  try {
    const { merchantOrderNo, tradeNo, amount } = req.body;

    const result = await refundNewebPay(merchantOrderNo, tradeNo, amount);

    if (result.success) {
      await storage.updatePaymentTransactionStatus(merchantOrderNo, "refunded");
    }

    res.json(result);
  } catch (error: any) {
    console.error("[Refund Error]", error);
    res.status(500).json({ success: false, message: "退款處理失敗" });
  }
});
```

---

## 7. 測試方式

1. 使用測試信用卡號 `4000-2211-1111-1111` 進行付款
2. 到期日填任意未來日期（如 `12/30`）
3. CVV 填任意三碼（如 `123`）
4. 付款成功後，藍新會同時觸發 Notify 和 Return 回調
5. 在你的 console log 中確認 `[NewebPay Notify]` 和 `[NewebPay Return]` 訊息

---

## 8. 常見問題

### Q: 加密後 TradeSha 驗證失敗？
HashKey 必須是 32 字元、HashIV 必須是 16 字元。確認沒有多餘的空白或換行。

### Q: Notify 收不到回調？
- 確認網址是 HTTPS 且外部可訪問
- Replit 部署後的網址格式為 `https://YOUR_APP.replit.app`
- 藍新會在付款後約 1-3 秒發送 Notify，若你的伺服器沒有回傳 `200 OK`，會在 1、5、30 分鐘後重試

### Q: Return 跳轉顯示 404？
Return 的 HTTP 方法是 **POST**（不是 GET），確認你的路由使用 `app.post()`。

### Q: 訂單編號重複？
`MerchantOrderNo` 在同一個商店內必須唯一，建議使用時間戳前綴（如 `ORD${Date.now()}`）。長度上限 20 字元。

### Q: 如何啟用超商代碼 / WebATM 等其他付款方式？
在 `tradeInfo` 物件中加入對應欄位：
```typescript
CVS: 1,      // 超商代碼
BARCODE: 1,  // 超商條碼
WEBATM: 1,   // WebATM
```

### Q: 金額必須是整數嗎？
是的，藍新的 `Amt` 欄位只接受正整數（新台幣元），不支援小數。

---

## 快速整合步驟摘要

1. 建立 `payment_transactions` 資料表（執行 `npm run db:push`）
2. 複製 `server/payment/newebpay.ts` 核心模組（金鑰已內建）
3. 加入 3 個路由：`initiate`、`notify`、`return`
4. 前端實作表單跳轉邏輯
5. 用測試信用卡 `4000-2211-1111-1111` 跑完整流程
