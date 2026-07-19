import { Router, type IRouter } from "express";
import { eq, like, desc, and, sql } from "drizzle-orm";
import { db, registrationsTable, invoicesTable, vendorsTable } from "@workspace/db";
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

// Resolve the vendor a POS sale belongs to. Vendor accounts are hard-bound to
// their own vendor (they cannot issue for anyone else); staff/owner issue
// without vendor attribution (vendorId = null → 主辦方).
async function resolvePosVendor(req: any): Promise<
  | { ok: true; vendorId: number | null }
  | { ok: false; error: string }
> {
  if (req.adminUser?.role !== "vendor") return { ok: true, vendorId: null };
  const vid = req.adminUser?.vendorId;
  if (!vid) return { ok: false, error: "此商家帳號尚未綁定商家，請聯絡主辦方設定" };
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vid));
  if (!vendor) return { ok: false, error: "綁定的商家不存在，請聯絡主辦方" };
  if (!vendor.active) return { ok: false, error: "此商家已停用，無法收款開立發票" };
  return { ok: true, vendorId: vendor.id };
}

router.get("/admin/pos/lookup/:token", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin", "vendor")) return;
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
  // accidental double-issue before charging again. Vendor accounts only see
  // their own vendor's invoices (no cross-vendor leakage).
  const ticketFilter = like(invoicesTable.paymentRef, `POS-${reg.id}-%`);
  const recentInvoices = await db
    .select({
      id: invoicesTable.id,
      amount: invoicesTable.amount,
      status: invoicesTable.status,
      invoiceNumber: invoicesTable.invoiceNumber,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .where(
      req.adminUser?.role === "vendor"
        ? and(ticketFilter, eq(invoicesTable.vendorId, req.adminUser.vendorId ?? -1))
        : ticketFilter,
    )
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
  if (!requireAuth(req, res, "checkin", "vendor")) return;
  const vendorRes = await resolvePosVendor(req);
  if (!vendorRes.ok) {
    res.status(403).json({ error: vendorRes.error });
    return;
  }
  const { qrToken, amount, carrierType, carrierNum } = req.body ?? {};
  if (typeof qrToken !== "string" || !qrToken.trim()) {
    res.status(400).json({ error: "缺少票券 QR token" });
    return;
  }
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0 || amt > 1000000) {
    res.status(400).json({ error: "金額必須為 1 ~ 1,000,000 的整數" });
    return;
  }
  // Carrier selection: default is the ECPay member carrier (email-bound);
  // staff may instead scan the customer's own phone-barcode carrier (財政部
  // 手機條碼, "/" + 7 chars) so the invoice lands directly in their carrier.
  const useCarrier: "ecpay_carrier" | "phone_barcode" =
    carrierType === "phone_barcode" ? "phone_barcode" : "ecpay_carrier";
  let barcode = "";
  if (useCarrier === "phone_barcode") {
    barcode = String(carrierNum ?? "").trim().toUpperCase();
    if (!/^\/[0-9A-Z.+-]{7}$/.test(barcode)) {
      res.status(400).json({ error: "手機條碼格式錯誤：應為「/」開頭共 8 碼（例如 /AB12+-.）" });
      return;
    }
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
  // the issuance would pass our precheck but fail at the ECPay gateway. The
  // phone-barcode carrier has no such dependency (reg.phone satisfies the
  // email-or-phone gateway requirement).
  if (useCarrier === "ecpay_carrier" && !reg.email) {
    res.status(400).json({
      error: "此票券沒有 Email，無法以會員載具開立；請改掃描客人的手機條碼載具",
    });
    return;
  }

  const paymentRef = `POS-${reg.id}-${Date.now()}`;
  const [row] = await db
    .insert(invoicesTable)
    .values({
      paymentRef,
      invoiceType: "personal",
      carrierType: useCarrier,
      carrierNum: useCarrier === "phone_barcode" ? barcode : null,
      buyerName: reg.parentName,
      buyerEmail: reg.email,
      buyerPhone: reg.phone,
      vendorId: vendorRes.vendorId,
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
    carrierType: useCarrier,
    carrierNum: useCarrier === "phone_barcode" ? barcode : undefined,
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

// Vendor self-service: own sales summary + recent invoices. Vendor accounts
// only ever see their own vendor's numbers.
router.get("/admin/pos/my-sales", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "vendor")) return;
  const vendorRes = await resolvePosVendor(req);
  if (!vendorRes.ok || vendorRes.vendorId == null) {
    res.status(403).json({ error: vendorRes.ok ? "此帳號未綁定商家" : vendorRes.error });
    return;
  }
  const vid = vendorRes.vendorId;
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vid));
  const [totals] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${invoicesTable.amount}), 0)::int`,
    })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.vendorId, vid), eq(invoicesTable.status, "issued")));
  const [today] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${invoicesTable.amount}), 0)::int`,
    })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.vendorId, vid),
        eq(invoicesTable.status, "issued"),
        sql`${invoicesTable.createdAt} >= date_trunc('day', now() AT TIME ZONE 'Asia/Taipei') AT TIME ZONE 'Asia/Taipei'`,
      ),
    );
  const recent = await db
    .select({
      id: invoicesTable.id,
      amount: invoicesTable.amount,
      status: invoicesTable.status,
      invoiceNumber: invoicesTable.invoiceNumber,
      buyerName: invoicesTable.buyerName,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.vendorId, vid))
    .orderBy(desc(invoicesTable.id))
    .limit(20);
  res.json({
    vendor: vendor ? { id: vendor.id, name: vendor.name, boothNumber: vendor.boothNumber } : null,
    totals: { count: totals?.count ?? 0, total: totals?.total ?? 0 },
    today: { count: today?.count ?? 0, total: today?.total ?? 0 },
    recent,
  });
});

export default router;
