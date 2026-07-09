import { Router, type IRouter } from "express";
import { eq, like, desc } from "drizzle-orm";
import { db, registrationsTable, invoicesTable } from "@workspace/db";
import { issueInvoice, type InvoiceIssueOptions } from "../lib/ecpay-invoice";
import { logger } from "../lib/logger";

// On-site POS: staff scans a ticket QR, enters a cash amount, and issues an
// ECPay e-invoice on the spot (item name fixed to "商品"). These invoices are
// standalone — they are NOT tied to a payment transaction; the paymentRef is a
// synthetic "POS-<regId>-<timestamp>" so they show up in 發票管理 and can be
// voided there like any other invoice.
const router: IRouter = Router();

function requireAuth(req: any, res: any, ...roles: string[]): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (roles.length > 0 && !req.hasRole(...roles)) {
    res.status(403).json({ error: "權限不足", code: "FORBIDDEN" });
    return false;
  }
  return true;
}

router.get("/admin/pos/lookup/:token", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin")) return;
  const token = req.params.token;
  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.qrToken, token))
    .limit(1);
  if (!reg) {
    res.status(404).json({ error: "找不到此 QR Code 對應的票券" });
    return;
  }
  // Recent POS invoices for this ticket — shown to staff so they notice an
  // accidental double-issue before charging again.
  const recentInvoices = await db
    .select({
      id: invoicesTable.id,
      amount: invoicesTable.amount,
      status: invoicesTable.status,
      invoiceNumber: invoicesTable.invoiceNumber,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .where(like(invoicesTable.paymentRef, `POS-${reg.id}-%`))
    .orderBy(desc(invoicesTable.id))
    .limit(5);
  res.json({
    registration: {
      id: reg.id,
      parentName: reg.parentName,
      phone: reg.phone,
      email: reg.email,
      eventDate: reg.eventDate,
      ticketType: reg.ticketType,
      ticketCount: reg.ticketCount,
      checkedInAt: reg.checkedInAt,
    },
    recentInvoices,
  });
});

router.post("/admin/pos/invoice", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin")) return;
  const { qrToken, amount } = req.body ?? {};
  if (typeof qrToken !== "string" || !qrToken.trim()) {
    res.status(400).json({ error: "缺少票券 QR token" });
    return;
  }
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0 || amt > 1000000) {
    res.status(400).json({ error: "金額必須為 1 ~ 1,000,000 的整數" });
    return;
  }
  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.qrToken, qrToken.trim()))
    .limit(1);
  if (!reg) {
    res.status(404).json({ error: "找不到此 QR Code 對應的票券" });
    return;
  }
  // ecpay_carrier (綠界會員載具) delivery is email-bound — without an email
  // the issuance would pass our precheck but fail at the ECPay gateway.
  if (!reg.email) {
    res.status(400).json({ error: "此票券沒有 Email，無法以會員載具開立電子發票" });
    return;
  }

  const paymentRef = `POS-${reg.id}-${Date.now()}`;
  const [row] = await db
    .insert(invoicesTable)
    .values({
      paymentRef,
      invoiceType: "personal",
      // ECPay member carrier: the invoice is stored in the buyer's ECPay
      // carrier and delivery is handled via their email. A B2C invoice with
      // Print=0/Donation=0 must have a carrier, so this is the safe default
      // for on-site cash sales where we only have the ticket holder's info.
      carrierType: "ecpay_carrier",
      buyerName: reg.parentName,
      buyerEmail: reg.email,
      buyerPhone: reg.phone,
      amount: amt,
      status: "pending",
    })
    .returning();

  const options: InvoiceIssueOptions = {
    relateNumber: paymentRef,
    customerEmail: reg.email || "",
    customerName: reg.parentName || undefined,
    customerPhone: reg.phone || undefined,
    invoiceType: "personal",
    carrierType: "ecpay_carrier",
    salesAmount: amt,
    items: [{ name: "商品", count: 1, unitPrice: amt, amount: amt }],
  };

  const result = await issueInvoice(options);
  if (result.success) {
    const [updated] = await db
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
      .where(eq(invoicesTable.id, row.id))
      .returning();
    logger.info(
      { paymentRef, amount: amt, invoiceNumber: result.invoiceNumber },
      "[POS] invoice issued",
    );
    res.json({ success: true, invoice: updated });
    return;
  }

  await db
    .update(invoicesTable)
    .set({
      status: "failed",
      errorMessage: result.message || "未知錯誤",
      rawResponse: (result.rawResponse ?? null) as Record<string, unknown> | null,
    })
    .where(eq(invoicesTable.id, row.id));
  logger.error({ paymentRef, amount: amt, message: result.message }, "[POS] invoice failed");
  res.status(502).json({ success: false, error: result.message || "發票開立失敗" });
});

export default router;
