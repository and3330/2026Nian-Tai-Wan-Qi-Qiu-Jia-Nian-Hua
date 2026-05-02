import { Router, type IRouter } from "express";
import express from "express";
import { eq, inArray, sql } from "drizzle-orm";
import { db, registrationsTable, paymentTransactionsTable } from "@workspace/db";
import { createNewebPayOrder, verifyNewebPayCallback } from "../lib/newebpay";
import { getStripeClient, isStripeConfigured } from "../lib/stripe-client";
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

router.post("/payments/initiate", async (req, res): Promise<void> => {
  try {
    const { registrationIds, method, email } = req.body as {
      registrationIds?: unknown;
      method?: unknown;
      email?: unknown;
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

    await db.insert(paymentTransactionsTable).values({
      paymentRef,
      provider: method,
      amount: totalAmount,
      itemName,
      payerEmail,
      status: method === "bank" ? "awaiting_transfer" : "pending",
    });

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
  res.json({
    paymentRef: tx.paymentRef,
    provider: tx.provider,
    amount: tx.amount,
    status: tx.status,
    itemName: tx.itemName,
    paidAt: tx.paidAt,
    bankInfo: tx.provider === "bank" ? BANK_INFO : null,
  });
});

async function markPaymentPaid(
  paymentRef: string,
  providerTradeNo: string | null,
  rawResult: unknown,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentRef, paymentRef));
    if (!current || current.status === "paid") return;
    await tx
      .update(paymentTransactionsTable)
      .set({
        status: "paid",
        paidAt: now,
        providerTradeNo: providerTradeNo || current.providerTradeNo,
        rawResult: rawResult as any,
      })
      .where(eq(paymentTransactionsTable.paymentRef, paymentRef));
    await tx
      .update(registrationsTable)
      .set({ paymentStatus: "paid" })
      .where(eq(registrationsTable.paymentRef, paymentRef));
  });
}

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
