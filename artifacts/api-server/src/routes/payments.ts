import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { eq, inArray, sql, desc, and, ne } from "drizzle-orm";
import { db, registrationsTable, paymentTransactionsTable, invoicesTable } from "@workspace/db";
import { createNewebPayOrder, verifyNewebPayCallback } from "../lib/newebpay";
import { getStripeClient, isStripeConfigured } from "../lib/stripe-client";
import { issueInvoice, voidInvoice, type InvoiceIssueOptions } from "../lib/ecpay-invoice";
import { notifyPurchaseSlack } from "../lib/slack-notify";
import { sendConfirmationEmail } from "../services/email-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const BANK_INFO = {
  bankName: "國泰世華銀行",
  accountName: "育邦文化教育科技股份有限公司",
  accountNumber: "017035007717",
};

function getBaseUrl(req: express.Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol;
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.get("host");
  if (!host) {
    const fallback = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (fallback) return `https://${fallback}`;
    return "http://localhost";
  }
  return `${proto}://${host}`;
}

function generatePaymentRef(): string {
  // Length must stay <= 20 for NewebPay MerchantOrderNo
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BC${ts}${rand}`.substring(0, 20);
}

async function loadEligibleRegistrations(ids: number[]) {
  if (!ids.length) return [];
  return db.select().from(registrationsTable).where(inArray(registrationsTable.id, ids));
}

interface InvoiceInput {
  invoiceType: "personal" | "company" | "donation";
  carrierType?: "phone_barcode" | "citizen_certificate" | "ecpay_carrier" | "" | null;
  carrierNum?: string;
  taxId?: string;
  companyTitle?: string;
  loveCode?: string;
  buyerName?: string;
  buyerAddr?: string;
  buyerPhone?: string;
}

function parseInvoiceInput(raw: unknown): InvoiceInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const invoiceType = r.invoiceType;
  if (invoiceType !== "personal" && invoiceType !== "company" && invoiceType !== "donation") {
    return null;
  }
  const out: InvoiceInput = { invoiceType };
  if (typeof r.carrierType === "string") out.carrierType = r.carrierType as InvoiceInput["carrierType"];
  if (typeof r.carrierNum === "string") out.carrierNum = r.carrierNum;
  if (typeof r.taxId === "string") out.taxId = r.taxId;
  if (typeof r.companyTitle === "string") out.companyTitle = r.companyTitle;
  if (typeof r.loveCode === "string") out.loveCode = r.loveCode;
  if (typeof r.buyerName === "string") out.buyerName = r.buyerName;
  if (typeof r.buyerAddr === "string") out.buyerAddr = r.buyerAddr;
  if (typeof r.buyerPhone === "string") out.buyerPhone = r.buyerPhone;
  return out;
}

function validateInvoice(invoice: InvoiceInput, hasContact: boolean): string | null {
  if (!hasContact) return "電子發票需要 Email 或手機其中一項";
  if (invoice.invoiceType === "company") {
    if (!invoice.taxId || invoice.taxId.length !== 8) return "公司發票需填寫 8 碼統一編號";
  }
  if (invoice.invoiceType === "donation") {
    if (!invoice.loveCode) return "捐贈發票需填寫愛心碼";
  }
  if (invoice.carrierType === "phone_barcode") {
    if (!invoice.carrierNum || !/^\/[A-Z0-9.\-+ ]{7}$/.test(invoice.carrierNum.toUpperCase())) {
      return "手機條碼格式錯誤（需以 / 開頭，共 8 碼）";
    }
  }
  if (invoice.carrierType === "citizen_certificate") {
    if (!invoice.carrierNum || !/^[A-Z]{2}[0-9]{14}$/.test(invoice.carrierNum.toUpperCase())) {
      return "自然人憑證格式錯誤（前 2 碼大寫英文 + 後 14 碼數字）";
    }
  }
  return null;
}

router.post("/payments/initiate", async (req, res): Promise<void> => {
  try {
    const { registrationIds, method, email, invoice: invoiceRaw } = req.body as {
      registrationIds?: unknown;
      method?: unknown;
      email?: unknown;
      invoice?: unknown;
    };

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      res.status(400).json({ error: "registrationIds is required" });
      return;
    }
    const ids = registrationIds.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
    if (ids.length !== registrationIds.length) {
      res.status(400).json({ error: "Invalid registrationIds" });
      return;
    }
    const allowedMethods = new Set(["newebpay", "stripe", "bank"]);
    if (typeof method !== "string" || !allowedMethods.has(method)) {
      res.status(400).json({ error: "method must be one of newebpay, stripe, bank" });
      return;
    }

    const registrations = await loadEligibleRegistrations(ids);
    if (registrations.length !== ids.length) {
      res.status(404).json({ error: "Some registrations not found" });
      return;
    }
    const alreadyPaid = registrations.find((r) => r.paymentStatus === "paid");
    if (alreadyPaid) {
      res.status(400).json({ error: "Some registrations are already paid" });
      return;
    }
    const totalAmount = registrations.reduce((sum, r) => sum + (r.amount || 0), 0);
    if (totalAmount <= 0) {
      res.status(400).json({ error: "Order amount must be positive" });
      return;
    }

    const ticketTypes = Array.from(new Set(registrations.map((r) => r.ticketType).filter(Boolean)));
    const itemName =
      ticketTypes.length === 1
        ? `2026 臺灣氣球嘉年華 — ${ticketTypes[0]}`
        : `2026 臺灣氣球嘉年華購票`;

    const paymentRef = generatePaymentRef();
    const payerEmail = typeof email === "string" && email.trim() ? email.trim() : null;

    const invoiceInput = parseInvoiceInput(invoiceRaw);
    if (invoiceRaw && !invoiceInput) {
      res.status(400).json({ error: "無效的發票類型" });
      return;
    }
    if (invoiceInput) {
      const buyerPhone = invoiceInput.buyerPhone || registrations[0]?.phone || null;
      const validationError = validateInvoice(invoiceInput, Boolean(payerEmail || buyerPhone));
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
    }

    await db.insert(paymentTransactionsTable).values({
      paymentRef,
      provider: method,
      amount: totalAmount,
      itemName,
      payerEmail,
      status: method === "bank" ? "awaiting_transfer" : "pending",
    });

    if (invoiceInput) {
      await db.insert(invoicesTable).values({
        paymentRef,
        invoiceType: invoiceInput.invoiceType,
        carrierType: invoiceInput.carrierType || null,
        carrierNum: invoiceInput.carrierNum || null,
        taxId: invoiceInput.taxId || null,
        companyTitle: invoiceInput.companyTitle || null,
        loveCode: invoiceInput.loveCode || null,
        buyerName: invoiceInput.buyerName || registrations[0]?.parentName || null,
        buyerEmail: payerEmail,
        buyerPhone: invoiceInput.buyerPhone || registrations[0]?.phone || null,
        buyerAddr: invoiceInput.buyerAddr || null,
        amount: totalAmount,
        status: "pending",
      });
    }

    await db
      .update(registrationsTable)
      .set({
        paymentMethod: method,
        paymentRef,
        paymentStatus: method === "bank" ? "awaiting_transfer" : "pending",
      })
      .where(inArray(registrationsTable.id, ids));

    const baseUrl = getBaseUrl(req);

    if (method === "newebpay") {
      const newebpay = createNewebPayOrder({
        orderNo: paymentRef,
        amount: totalAmount,
        itemName,
        email: payerEmail || "noreply@balloon-carnival.tw",
        returnUrl: `${baseUrl}/api/payments/newebpay/return`,
        notifyUrl: `${baseUrl}/api/payments/newebpay/notify`,
        clientBackUrl: `${baseUrl}/payment/result?ref=${paymentRef}`,
      });
      await db
        .update(paymentTransactionsTable)
        .set({ providerOrderNo: paymentRef })
        .where(eq(paymentTransactionsTable.paymentRef, paymentRef));
      res.status(201).json({
        type: "form_redirect",
        paymentRef,
        amount: totalAmount,
        apiUrl: newebpay.apiUrl,
        params: newebpay.params,
      });
      return;
    }

    if (method === "stripe") {
      if (!isStripeConfigured()) {
        res.status(503).json({
          error: "Stripe payments are not configured. Please contact the administrator.",
        });
        return;
      }
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "twd",
              product_data: { name: itemName },
              unit_amount: totalAmount,
            },
          },
        ],
        customer_email: payerEmail || undefined,
        client_reference_id: paymentRef,
        metadata: { paymentRef },
        success_url: `${baseUrl}/payment/result?ref=${paymentRef}&provider=stripe`,
        cancel_url: `${baseUrl}/payment/result?ref=${paymentRef}&provider=stripe&cancelled=1`,
      });
      await db
        .update(paymentTransactionsTable)
        .set({ providerOrderNo: session.id })
        .where(eq(paymentTransactionsTable.paymentRef, paymentRef));
      res.status(201).json({
        type: "redirect",
        paymentRef,
        amount: totalAmount,
        url: session.url,
      });
      return;
    }

    // method === "bank"
    notifyPurchaseSlack({
      parentName: registrations[0]?.parentName ?? "",
      phone: registrations[0]?.phone ?? "",
      email: payerEmail,
      ticketType: registrations[0]?.ticketType,
      ticketCount: registrations.reduce((sum, r) => sum + (r.ticketCount || 0), 0),
      eventDate: registrations[0]?.eventDate,
      amount: totalAmount,
      paymentMethod: "bank",
      paymentRef,
      awaitingTransfer: true,
    });
    res.status(201).json({
      type: "bank_info",
      paymentRef,
      amount: totalAmount,
      bankInfo: {
        ...BANK_INFO,
        memo: `請於匯款備註欄填寫訂單編號 ${paymentRef} 與報名人姓名，以利對帳`,
      },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "[payments/initiate] error");
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// Public order lookup — used by the customer self-service page.
// Requires BOTH the payment ref AND a matching contact (email or phone)
// so a leaked ref alone cannot reveal personal information.
router.post("/payments/lookup", async (req, res): Promise<void> => {
  try {
    const refRaw = typeof req.body?.ref === "string" ? req.body.ref.trim() : "";
    const contactRaw = typeof req.body?.contact === "string" ? req.body.contact.trim() : "";
    if (!refRaw || !contactRaw) {
      res.status(400).json({ error: "請輸入訂單編號與 Email 或手機號碼" });
      return;
    }
    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentRef, refRaw));
    if (!tx) {
      res.status(404).json({ error: "查無此訂單，請確認訂單編號是否正確" });
      return;
    }
    const regs = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.paymentRef, refRaw));
    if (!regs.length) {
      res.status(404).json({ error: "查無此訂單，請確認訂單編號是否正確" });
      return;
    }

    const contactNorm = contactRaw.toLowerCase();
    const contactIsEmail = contactNorm.includes("@");
    const contactDigits = contactRaw.replace(/\D/g, "");
    const matched = regs.some((r) => {
      if (contactIsEmail) {
        return (r.email || "").toLowerCase() === contactNorm;
      }
      return contactDigits.length >= 8 && (r.phone || "").replace(/\D/g, "") === contactDigits;
    });
    if (!matched) {
      // Identical message to the not-found case so attackers can't probe
      // whether a payment ref exists.
      res.status(404).json({ error: "查無此訂單，請確認訂單編號與聯絡方式是否正確" });
      return;
    }

    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.paymentRef, refRaw))
      .orderBy(desc(invoicesTable.id))
      .limit(1);

    res.json({
      paymentRef: tx.paymentRef,
      provider: tx.provider,
      amount: tx.amount,
      status: tx.status,
      itemName: tx.itemName,
      paidAt: tx.paidAt,
      bankInfo: tx.provider === "bank" ? BANK_INFO : null,
      registrations: regs.map((r) => ({
        id: r.id,
        parentName: r.parentName,
        phone: maskPhone(r.phone),
        email: maskEmail(r.email),
        ticketCount: r.ticketCount,
        ticketType: r.ticketType,
        eventDate: r.eventDate,
        amount: r.amount,
        paymentStatus: r.paymentStatus,
        qrToken: r.paymentStatus === "paid" ? r.qrToken : null,
        checkedInAt: r.checkedInAt,
      })),
      invoice: invoice
        ? {
            status: invoice.status,
            invoiceType: invoice.invoiceType,
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            randomNumber: invoice.randomNumber,
            errorMessage: invoice.errorMessage,
          }
        : null,
    });
  } catch (err) {
    logger.error({ err }, "[payments/lookup] error");
    res.status(500).json({ error: "查詢失敗，請稍後再試" });
  }
});

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

router.get("/payments/status/:ref", async (req, res): Promise<void> => {
  const ref = req.params.ref;
  const [tx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.paymentRef, ref));
  if (!tx) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.paymentRef, ref))
    .orderBy(desc(invoicesTable.id))
    .limit(1);
  res.json({
    paymentRef: tx.paymentRef,
    provider: tx.provider,
    amount: tx.amount,
    status: tx.status,
    itemName: tx.itemName,
    paidAt: tx.paidAt,
    bankInfo: tx.provider === "bank" ? BANK_INFO : null,
    invoice: invoice
      ? {
          status: invoice.status,
          invoiceType: invoice.invoiceType,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          randomNumber: invoice.randomNumber,
          errorMessage: invoice.errorMessage,
        }
      : null,
  });
});

async function markPaymentPaid(
  paymentRef: string,
  providerTradeNo: string | null,
  rawResult: unknown,
): Promise<void> {
  const now = new Date();
  let didTransitionToPaid = false;
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentRef, paymentRef));
    if (!current || current.status === "paid") return;
    // Atomic guard: only the transaction that actually flips status from
    // non-paid to paid proceeds with side effects. Concurrent callbacks
    // (webhook + return, or a manual bank confirm) will match 0 rows here and
    // therefore never duplicate the invoice / Slack / confirmation email.
    const flipped = await tx
      .update(paymentTransactionsTable)
      .set({
        status: "paid",
        paidAt: now,
        providerTradeNo: providerTradeNo || current.providerTradeNo,
        rawResult: (rawResult ?? null) as Record<string, unknown> | null,
      })
      .where(
        and(
          eq(paymentTransactionsTable.paymentRef, paymentRef),
          ne(paymentTransactionsTable.status, "paid"),
        ),
      )
      .returning({ id: paymentTransactionsTable.id });
    if (flipped.length === 0) return;
    await tx
      .update(registrationsTable)
      .set({ paymentStatus: "paid" })
      .where(eq(registrationsTable.paymentRef, paymentRef));
    didTransitionToPaid = true;
  });
  if (didTransitionToPaid) {
    // Fire-and-forget invoice issuance — failures should not roll back payment.
    issueInvoiceForPayment(paymentRef).catch((err) => {
      logger.error({ err, paymentRef }, "[ECPay Invoice] async issuance failed");
    });
    // Fire-and-forget Slack purchase notification.
    notifyPurchaseForPaymentRef(paymentRef).catch((err) => {
      logger.error({ err, paymentRef }, "[Slack] purchase notification lookup failed");
    });
    // Fire-and-forget customer confirmation email (with entry QR) — now that
    // payment is confirmed, the buyer receives their valid ticket.
    sendConfirmationAfterPayment(paymentRef).catch((err) => {
      logger.error({ err, paymentRef }, "[Confirmation] post-payment email failed");
    });
  }
}

// Sends the purchase confirmation (with QR) for the buyer of a paid order.
// One ticket email per registration leg — a two-day combo has a separate QR
// per day, so the buyer must receive both. sendConfirmationEmail is idempotent.
async function sendConfirmationAfterPayment(paymentRef: string): Promise<void> {
  const regs = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.paymentRef, paymentRef))
    .orderBy(registrationsTable.id);
  for (const reg of regs) {
    if (reg.email) {
      await sendConfirmationEmail(reg.id).catch((err) => {
        logger.error({ err, regId: reg.id }, "[Confirmation] leg email failed");
      });
    }
  }
}

async function notifyPurchaseForPaymentRef(paymentRef: string): Promise<void> {
  const regs = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.paymentRef, paymentRef));
  if (regs.length === 0) return;
  const [tx] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.paymentRef, paymentRef));
  const first = regs[0];
  const totalTickets = regs.reduce((sum, r) => sum + (r.ticketCount || 0), 0);
  notifyPurchaseSlack({
    parentName: first.parentName,
    phone: first.phone,
    email: first.email,
    ticketType: first.ticketType,
    ticketCount: totalTickets,
    eventDate: first.eventDate,
    amount: tx?.amount ?? first.amount,
    paymentMethod: first.paymentMethod,
    paymentRef,
  });
}

async function issueInvoiceForPayment(paymentRef: string): Promise<void> {
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.paymentRef, paymentRef))
    .orderBy(desc(invoicesTable.id))
    .limit(1);
  if (!invoice) {
    logger.info({ paymentRef }, "[ECPay Invoice] no invoice info recorded — skipping issuance");
    return;
  }
  if (invoice.status === "issued") {
    logger.info({ paymentRef }, "[ECPay Invoice] already issued — skipping");
    return;
  }
  const [payment] = await db
    .select()
    .from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.paymentRef, paymentRef));
  if (!payment) return;

  const options: InvoiceIssueOptions = {
    relateNumber: paymentRef,
    customerEmail: invoice.buyerEmail || payment.payerEmail || "",
    customerName: invoice.buyerName || undefined,
    customerPhone: invoice.buyerPhone || undefined,
    customerAddr: invoice.buyerAddr || undefined,
    invoiceType: invoice.invoiceType as "personal" | "company" | "donation",
    carrierType: invoice.carrierType as InvoiceIssueOptions["carrierType"],
    carrierNum: invoice.carrierNum || undefined,
    taxId: invoice.taxId || undefined,
    companyTitle: invoice.companyTitle || undefined,
    loveCode: invoice.loveCode || undefined,
    salesAmount: invoice.amount,
    items: [
      {
        name: payment.itemName,
        count: 1,
        unitPrice: invoice.amount,
        amount: invoice.amount,
      },
    ],
  };

  const result = await issueInvoice(options);
  if (result.success) {
    await db
      .update(invoicesTable)
      .set({
        status: "issued",
        invoiceNumber: result.invoiceNumber || null,
        invoiceDate: result.invoiceDate || null,
        randomNumber: result.randomNumber || null,
        rawResponse: (result.rawResponse ?? null) as Record<string, unknown> | null,
        issuedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(invoicesTable.id, invoice.id));
    logger.info(
      { paymentRef, invoiceNumber: result.invoiceNumber },
      "[ECPay Invoice] issued",
    );
  } else {
    await db
      .update(invoicesTable)
      .set({
        status: "failed",
        errorMessage: result.message || "未知錯誤",
        rawResponse: (result.rawResponse ?? null) as Record<string, unknown> | null,
      })
      .where(eq(invoicesTable.id, invoice.id));
    logger.error(
      { paymentRef, message: result.message },
      "[ECPay Invoice] issuance failed",
    );
  }
}

function requireAdmin(req: Request, res: Response, ...roles: string[]): boolean {
  if (typeof req.isAuthenticated !== "function" || !req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (roles.length > 0 && !req.hasRole(...(roles as Array<"owner" | "editor" | "checkin" | "viewer">))) {
    res.status(403).json({ error: "權限不足", code: "FORBIDDEN" });
    return false;
  }
  return true;
}

router.post("/payments/invoices/:ref/retry", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res, "editor")) return;
  try {
    const ref = req.params.ref;
    const [payment] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentRef, ref));
    if (!payment) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    if (payment.status !== "paid") {
      res.status(400).json({ error: "Payment is not paid yet" });
      return;
    }
    await issueInvoiceForPayment(ref);
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.paymentRef, ref))
      .orderBy(desc(invoicesTable.id))
      .limit(1);
    res.json({
      status: invoice?.status || "missing",
      invoiceNumber: invoice?.invoiceNumber || null,
      errorMessage: invoice?.errorMessage || null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "[invoice/retry] error");
    res.status(500).json({ error: "Failed to retry invoice issuance" });
  }
});

router.post("/payments/invoices/:ref/void", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res, "editor")) return;
  try {
    const ref = req.params.ref;
    const reason = String(req.body?.reason || "訂單取消");
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.paymentRef, ref))
      .orderBy(desc(invoicesTable.id))
      .limit(1);
    if (!invoice || !invoice.invoiceNumber || !invoice.invoiceDate) {
      res.status(400).json({ error: "No issued invoice found for this payment" });
      return;
    }
    // ECPay returns invoiceDate as "YYYY-MM-DD+HH:MM:SS"; the Invalid endpoint expects YYYY-MM-DD.
    const dateOnly = invoice.invoiceDate.split("+")[0]?.split(" ")[0]?.split("T")[0] ?? invoice.invoiceDate;
    const result = await voidInvoice(invoice.invoiceNumber, dateOnly, reason);
    if (result.success) {
      await db
        .update(invoicesTable)
        .set({ status: "voided", voidedAt: new Date() })
        .where(eq(invoicesTable.id, invoice.id));
    }
    res.json({ success: result.success, message: result.message });
  } catch (error: unknown) {
    logger.error({ err: error }, "[invoice/void] error");
    res.status(500).json({ error: "Failed to void invoice" });
  }
});

// Admin manually confirms a bank-transfer order once the money is received.
// Runs the exact same downstream flow as an online payment: mark paid →
// issue invoice → Slack notify → send the buyer their confirmation email + QR.
router.post("/payments/:ref/confirm-bank", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res, "editor")) return;
  try {
    const ref = req.params.ref;
    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentRef, ref));
    if (!tx) {
      res.status(404).json({ error: "找不到此訂單" });
      return;
    }
    if (tx.provider !== "bank") {
      res.status(400).json({ error: "此訂單不是銀行轉帳訂單" });
      return;
    }
    if (tx.status === "paid") {
      res.json({ status: "paid" });
      return;
    }
    await markPaymentPaid(ref, `manual-bank-${Date.now()}`, {
      confirmedBy: (req.user as { id?: number } | undefined)?.id ?? null,
      confirmedAt: new Date().toISOString(),
    });
    res.json({ status: "paid" });
  } catch (error: unknown) {
    logger.error({ err: error }, "[payments/confirm-bank] error");
    res.status(500).json({ error: "確認收款失敗，請稍後再試" });
  }
});

// NewebPay sends URL-encoded form bodies; rely on express.urlencoded middleware
// already applied at the app level.
router.post("/payments/newebpay/notify", async (req, res): Promise<void> => {
  try {
    const result = verifyNewebPayCallback(req.body);
    logger.info(
      { paid: result.paid, valid: result.valid, orderNo: result.orderNo },
      "[NewebPay Notify]",
    );
    if (result.valid && result.paid && result.orderNo) {
      const [tx] = await db
        .select()
        .from(paymentTransactionsTable)
        .where(eq(paymentTransactionsTable.paymentRef, result.orderNo));
      if (tx && tx.status !== "paid") {
        if (result.amount != null && result.amount !== tx.amount) {
          logger.warn({ expected: tx.amount, actual: result.amount }, "[NewebPay] amount mismatch");
        } else {
          await markPaymentPaid(result.orderNo, result.tradeNo, result.rawData);
        }
      }
    }
    res.send("OK");
  } catch (error: unknown) {
    logger.error({ err: error }, "[NewebPay Notify Error]");
    res.status(500).send("Error");
  }
});

router.post("/payments/newebpay/return", async (req, res): Promise<void> => {
  try {
    const result = verifyNewebPayCallback(req.body);
    if (result.valid && result.paid && result.orderNo) {
      const [tx] = await db
        .select()
        .from(paymentTransactionsTable)
        .where(eq(paymentTransactionsTable.paymentRef, result.orderNo));
      if (tx && tx.status !== "paid") {
        if (result.amount == null || result.amount === tx.amount) {
          await markPaymentPaid(result.orderNo, result.tradeNo, result.rawData);
        }
      }
    }
    const baseUrl = getBaseUrl(req);
    const ref = result.orderNo || "";
    const status = result.valid && result.paid ? "success" : "failed";
    res.redirect(`${baseUrl}/payment/result?ref=${encodeURIComponent(ref)}&provider=newebpay&status=${status}`);
  } catch (error: unknown) {
    logger.error({ err: error }, "[NewebPay Return Error]");
    res.redirect(getBaseUrl(req) + "/payment/result?status=error&provider=newebpay");
  }
});

// Stripe webhook is registered separately in app.ts (raw body required)
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  if (!isStripeConfigured()) return;
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  if (webhookSecret) {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } else {
    // Without a webhook secret, parse but don't trust signature (dev only)
    logger.warn("[Stripe] STRIPE_WEBHOOK_SECRET not set — skipping signature verification");
    event = JSON.parse(rawBody.toString("utf8"));
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as { client_reference_id?: string; metadata?: Record<string, string>; payment_intent?: string; id?: string };
    const ref = session.client_reference_id || session.metadata?.paymentRef;
    if (!ref) {
      logger.warn("[Stripe] webhook missing paymentRef");
      return;
    }
    const tradeNo = (session.payment_intent as string | undefined) || session.id || null;
    await markPaymentPaid(ref, tradeNo, event);
  }
}

// Used by the success-page client polling fallback when webhook is unavailable.
router.post("/payments/stripe/confirm", async (req, res): Promise<void> => {
  try {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }
    const ref = String(req.body?.paymentRef || "").trim();
    if (!ref) {
      res.status(400).json({ error: "paymentRef required" });
      return;
    }
    const [tx] = await db
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentRef, ref));
    if (!tx) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    if (tx.status === "paid") {
      res.json({ status: "paid" });
      return;
    }
    if (tx.provider !== "stripe" || !tx.providerOrderNo) {
      res.status(400).json({ error: "Not a Stripe payment" });
      return;
    }
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(tx.providerOrderNo);
    if (session.payment_status === "paid") {
      const tradeNo = typeof session.payment_intent === "string" ? session.payment_intent : session.id;
      await markPaymentPaid(ref, tradeNo, session as unknown as Record<string, unknown>);
      res.json({ status: "paid" });
      return;
    }
    res.json({ status: tx.status });
  } catch (error: unknown) {
    logger.error({ err: error }, "[stripe/confirm] error");
    res.status(500).json({ error: "Failed to confirm Stripe payment" });
  }
});

// Avoid unused-import warning when sql isn't otherwise needed
void sql;

export default router;
