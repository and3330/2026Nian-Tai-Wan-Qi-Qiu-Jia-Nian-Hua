import { Router, type IRouter } from "express";
import { eq, like, desc, and, sql, isNull, inArray } from "drizzle-orm";
import {
  db,
  registrationsTable,
  invoicesTable,
  vendorsTable,
  productsTable,
  posOrdersTable,
  type PosOrderItem,
} from "@workspace/db";
import { issueInvoice, voidInvoice, type InvoiceIssueOptions } from "../lib/ecpay-invoice";
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

// ── POS 商品目錄 ────────────────────────────────────────────────────────────
// vendor 帳號永遠被鎖在自己的 vendorId；editor/owner 可用 ?vendorId= 代管任一
// 攤位，不帶 vendorId（或 vendorId=0）代表主辦方商品（vendor_id IS NULL）。

async function resolveProductScope(req: any, res: any): Promise<{ ok: true; vendorId: number | null } | { ok: false }> {
  if (req.adminUser?.role === "vendor") {
    const v = await resolvePosVendor(req);
    if (!v.ok || v.vendorId == null) {
      res.status(403).json({ error: v.ok ? "此帳號未綁定商家" : v.error });
      return { ok: false };
    }
    return { ok: true, vendorId: v.vendorId };
  }
  const raw = req.query?.vendorId ?? req.body?.vendorId;
  const n = Number(raw);
  return { ok: true, vendorId: Number.isInteger(n) && n > 0 ? n : null };
}

// 給 POS 畫面的攤位清單（工作人員代攤位結帳用）：僅回傳啟用中的基本欄位，
// 不含銷售統計，checkin 等級即可存取（/admin/vendors 完整版仍為 editor 限定）。
router.get("/admin/pos/vendors", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin")) return;
  const rows = await db
    .select({ id: vendorsTable.id, name: vendorsTable.name, boothNumber: vendorsTable.boothNumber })
    .from(vendorsTable)
    .where(eq(vendorsTable.active, true))
    .orderBy(vendorsTable.id);
  res.json({ vendors: rows });
});

router.get("/admin/pos/products", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin", "vendor")) return;
  // 工作人員可用 ?vendorId=all 一次取回所有攤商＋主辦方的商品（跨攤結帳用）
  if (req.adminUser?.role !== "vendor" && req.query.vendorId === "all") {
    const includeInactive = req.query.all === "1";
    const rows = await db
      .select()
      .from(productsTable)
      .where(includeInactive ? undefined : eq(productsTable.active, true))
      .orderBy(productsTable.vendorId, productsTable.sortOrder, productsTable.id);
    res.json({ vendorId: "all", products: rows });
    return;
  }
  const scope = await resolveProductScope(req, res);
  if (!scope.ok) return;
  const includeInactive = req.query.all === "1";
  const vendorCond =
    scope.vendorId == null ? isNull(productsTable.vendorId) : eq(productsTable.vendorId, scope.vendorId);
  const rows = await db
    .select()
    .from(productsTable)
    .where(includeInactive ? vendorCond : and(vendorCond, eq(productsTable.active, true)))
    .orderBy(productsTable.sortOrder, productsTable.id);
  res.json({ vendorId: scope.vendorId, products: rows });
});

router.post("/admin/pos/products", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor", "vendor")) return;
  const scope = await resolveProductScope(req, res);
  if (!scope.ok) return;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const price = Number(req.body?.price);
  if (!name || name.length > 100) { res.status(400).json({ error: "請輸入商品名稱（100 字內）" }); return; }
  if (!Number.isInteger(price) || price <= 0 || price > 1000000) {
    res.status(400).json({ error: "價格必須為 1 ~ 1,000,000 的整數" });
    return;
  }
  const [row] = await db
    .insert(productsTable)
    .values({ vendorId: scope.vendorId, name, price })
    .returning();
  logger.info({ id: row.id, vendorId: scope.vendorId, name, price }, "[POS] product created");
  res.json({ product: row });
});

router.put("/admin/pos/products/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor", "vendor")) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "找不到商品" }); return; }
  if (req.adminUser?.role === "vendor") {
    const v = await resolvePosVendor(req);
    if (!v.ok || v.vendorId == null || existing.vendorId !== v.vendorId) {
      res.status(403).json({ error: v.ok ? "只能管理自己商家的商品" : v.error });
      return;
    }
  }
  const patch: Partial<typeof existing> = {};
  if (typeof req.body?.name === "string") {
    const name = req.body.name.trim();
    if (!name || name.length > 100) { res.status(400).json({ error: "請輸入商品名稱（100 字內）" }); return; }
    patch.name = name;
  }
  if (req.body?.price !== undefined) {
    const price = Number(req.body.price);
    if (!Number.isInteger(price) || price <= 0 || price > 1000000) {
      res.status(400).json({ error: "價格必須為 1 ~ 1,000,000 的整數" });
      return;
    }
    patch.price = price;
  }
  if (typeof req.body?.active === "boolean") patch.active = req.body.active;
  if (req.body?.sortOrder !== undefined && Number.isInteger(Number(req.body.sortOrder))) {
    patch.sortOrder = Number(req.body.sortOrder);
  }
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "沒有要修改的欄位" }); return; }
  const [row] = await db.update(productsTable).set(patch).where(eq(productsTable.id, id)).returning();
  res.json({ product: row });
});

router.delete("/admin/pos/products/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor", "vendor")) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "找不到商品" }); return; }
  if (req.adminUser?.role === "vendor") {
    const v = await resolvePosVendor(req);
    if (!v.ok || v.vendorId == null || existing.vendorId !== v.vendorId) {
      res.status(403).json({ error: v.ok ? "只能管理自己商家的商品" : v.error });
      return;
    }
  }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

// ── POS 訂單（結帳）────────────────────────────────────────────────────────
// 付款在系統外完成（現金或客人自己的卡／Apple Pay），paymentMethod 只是記錄。
// 金額一律以資料庫目前的商品價格於伺服器端重算，不信任前端傳來的價格。
const PAYMENT_METHODS = new Set(["cash", "credit_card", "online", "apple_pay"]);

router.post("/admin/pos/orders", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin", "vendor")) return;
  const vendorRes = await resolvePosVendor(req);
  if (!vendorRes.ok) { res.status(403).json({ error: vendorRes.error }); return; }
  // 非 vendor 帳號（工作人員）可代任一攤位結帳：body.vendorId 指定，不帶則為主辦方；
  // vendorId="all" → 跨攤結帳，依商品所屬攤商自動拆單。
  let vendorId = vendorRes.vendorId;
  const splitMode = req.adminUser?.role !== "vendor" && req.body?.vendorId === "all";
  if (req.adminUser?.role !== "vendor" && !splitMode) {
    const n = Number(req.body?.vendorId);
    vendorId = Number.isInteger(n) && n > 0 ? n : null;
  }

  const { qrToken, paymentMethod } = req.body ?? {};
  if (typeof qrToken !== "string" || !qrToken.trim()) {
    res.status(400).json({ error: "缺少票券 QR token" });
    return;
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    res.status(400).json({ error: "付款方式錯誤" });
    return;
  }
  const rawItems: unknown[] = Array.isArray(req.body?.items) ? req.body.items : [];
  const wanted = rawItems
    .map((it: any) => ({ productId: Number(it?.productId), qty: Number(it?.qty) }))
    .filter((it) => Number.isInteger(it.productId) && Number.isInteger(it.qty) && it.qty > 0 && it.qty <= 99);
  if (wanted.length === 0 || wanted.length > 50) {
    res.status(400).json({ error: "請選擇 1~50 項商品" });
    return;
  }

  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.qrToken, qrToken.trim()))
    .limit(1);
  if (!reg) { res.status(404).json({ error: "找不到此 QR Code 對應的票券" }); return; }

  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, wanted.map((w) => w.productId)));
  const byId = new Map(products.map((p) => [p.id, p]));
  type LineItem = PosOrderItem & { vendorId: number | null };
  const items: LineItem[] = [];
  for (const w of wanted) {
    const p = byId.get(w.productId);
    if (!p || !p.active) { res.status(400).json({ error: "所選商品不存在或已下架，請重新整理商品清單" }); return; }
    if (!splitMode && (p.vendorId ?? null) !== (vendorId ?? null)) {
      res.status(403).json({ error: "只能販售自己商家的商品" });
      return;
    }
    items.push({ productId: p.id, name: p.name, unitPrice: p.price, qty: w.qty, vendorId: p.vendorId ?? null });
  }
  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  // 折價：正整數、不得超過小計（金額仍由伺服器端計算，前端只回報折多少）
  const discount = Number(req.body?.discount ?? 0) || 0;
  if (!Number.isInteger(discount) || discount < 0 || discount >= subtotal) {
    res.status(400).json({ error: "折價金額錯誤：必須為 0 以上的整數，且不得大於等於小計" });
    return;
  }
  if (subtotal - discount <= 0 || subtotal - discount > 1000000) {
    res.status(400).json({ error: "訂單金額異常" });
    return;
  }

  // 依攤商分組（非拆單模式全部同一組）。拆單時折價按各組小計比例分攤，
  // 尾差調整到小計最大的一組，確保各單合計 = 原始應收金額。
  const groups = new Map<number | null, LineItem[]>();
  for (const it of items) {
    const key = splitMode ? it.vendorId : (vendorId ?? null);
    const g = groups.get(key) ?? [];
    g.push(it);
    groups.set(key, g);
  }
  const groupList = [...groups.entries()].map(([gVendorId, gItems]) => ({
    vendorId: gVendorId,
    items: gItems.map(({ vendorId: _v, ...rest }) => rest),
    subtotal: gItems.reduce((s, it) => s + it.unitPrice * it.qty, 0),
    discount: 0,
  }));
  if (discount > 0) {
    let allocated = 0;
    for (const g of groupList) {
      g.discount = Math.floor((discount * g.subtotal) / subtotal);
      allocated += g.discount;
    }
    // 尾差給小計最大的一組（保證該組折後仍 > 0，因 discount < subtotal）
    const largest = groupList.reduce((a, b) => (b.subtotal > a.subtotal ? b : a));
    largest.discount += discount - allocated;
  }
  for (const g of groupList) {
    if (g.subtotal - g.discount <= 0) {
      res.status(400).json({ error: "折價金額過大，無法分攤到各攤商訂單" });
      return;
    }
  }

  const ts = Date.now();
  const createdOrders = [];
  for (let i = 0; i < groupList.length; i++) {
    const g = groupList[i];
    const paymentRef = groupList.length === 1 ? `POS-${reg.id}-${ts}` : `POS-${reg.id}-${ts}-${i + 1}`;
    const [order] = await db
      .insert(posOrdersTable)
      .values({
        paymentRef,
        vendorId: g.vendorId,
        registrationId: reg.id,
        buyerName: reg.parentName,
        buyerPhone: reg.phone,
        buyerEmail: reg.email,
        items: g.items,
        discount: g.discount,
        totalAmount: g.subtotal - g.discount,
        paymentMethod,
        createdBy: req.adminUser?.username ?? null,
      })
      .returning();
    logger.info(
      { orderId: order.id, paymentRef, vendorId: g.vendorId, totalAmount: order.totalAmount, paymentMethod, split: splitMode },
      "[POS] order created",
    );
    createdOrders.push(order);
  }
  res.json({ order: createdOrders[0], orders: createdOrders });
});

// 銷售統計：以 pos_orders 為準（含未開發票的訂單）。vendor 只看自己的；
// 工作人員／主辦方預設看全部，可用 ?vendorId 過濾（vendorId=0 → 主辦方自營）。
router.get("/admin/pos/stats", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin", "vendor")) return;
  let cond;
  if (req.adminUser?.role === "vendor") {
    const v = await resolvePosVendor(req);
    if (!v.ok || v.vendorId == null) {
      res.status(403).json({ error: v.ok ? "此帳號未綁定商家" : v.error });
      return;
    }
    cond = eq(posOrdersTable.vendorId, v.vendorId);
  } else if (req.query.vendorId !== undefined) {
    const n = Number(req.query.vendorId);
    cond = Number.isInteger(n) && n > 0 ? eq(posOrdersTable.vendorId, n) : isNull(posOrdersTable.vendorId);
  }
  const orders = await db.select().from(posOrdersTable).where(cond);

  // 今天（台北時間）的起點
  const taipeiDayStart = (d: Date): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(d); // YYYY-MM-DD
  const todayKey = taipeiDayStart(new Date());

  let totalRevenue = 0;
  let totalDiscount = 0;
  let todayRevenue = 0;
  let todayCount = 0;
  const byMethod = new Map<string, { count: number; total: number }>();
  const byProduct = new Map<string, { qty: number; total: number }>();
  const byDay = new Map<string, { count: number; total: number }>();

  for (const o of orders) {
    totalRevenue += o.totalAmount;
    totalDiscount += o.discount ?? 0;
    const dayKey = taipeiDayStart(new Date(o.createdAt));
    if (dayKey === todayKey) {
      todayRevenue += o.totalAmount;
      todayCount += 1;
    }
    const m = byMethod.get(o.paymentMethod) ?? { count: 0, total: 0 };
    m.count += 1;
    m.total += o.totalAmount;
    byMethod.set(o.paymentMethod, m);
    const d = byDay.get(dayKey) ?? { count: 0, total: 0 };
    d.count += 1;
    d.total += o.totalAmount;
    byDay.set(dayKey, d);
    for (const it of (o.items as PosOrderItem[] | null) ?? []) {
      const p = byProduct.get(it.name) ?? { qty: 0, total: 0 };
      p.qty += it.qty;
      p.total += it.unitPrice * it.qty;
      byProduct.set(it.name, p);
    }
  }

  res.json({
    orderCount: orders.length,
    totalRevenue,
    totalDiscount,
    today: { count: todayCount, total: todayRevenue },
    byMethod: [...byMethod.entries()]
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.total - a.total),
    byProduct: [...byProduct.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total),
    byDay: [...byDay.entries()]
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => (a.day < b.day ? 1 : -1)),
  });
});

// 訂單列表：vendor 只看自己的；工作人員／主辦方可看全部（可用 ?vendorId 過濾）
router.get("/admin/pos/orders", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin", "vendor")) return;
  let cond;
  if (req.adminUser?.role === "vendor") {
    const v = await resolvePosVendor(req);
    if (!v.ok || v.vendorId == null) {
      res.status(403).json({ error: v.ok ? "此帳號未綁定商家" : v.error });
      return;
    }
    cond = eq(posOrdersTable.vendorId, v.vendorId);
  } else if (req.query.vendorId !== undefined) {
    const n = Number(req.query.vendorId);
    cond = Number.isInteger(n) && n > 0 ? eq(posOrdersTable.vendorId, n) : isNull(posOrdersTable.vendorId);
  }
  const orders = await db
    .select()
    .from(posOrdersTable)
    .where(cond)
    .orderBy(desc(posOrdersTable.id))
    .limit(100);
  // 帶出各訂單發票狀態（有 invoiceId 才查）
  const invIds = orders.map((o) => o.invoiceId).filter((v): v is number => v != null);
  const invs = invIds.length
    ? await db
        .select({ id: invoicesTable.id, status: invoicesTable.status, invoiceNumber: invoicesTable.invoiceNumber })
        .from(invoicesTable)
        .where(inArray(invoicesTable.id, invIds))
    : [];
  const invById = new Map(invs.map((i) => [i.id, i]));
  res.json({
    orders: orders.map((o) => ({
      ...o,
      invoice: o.invoiceId != null ? invById.get(o.invoiceId) ?? null : null,
    })),
  });
});

// 從訂單開立發票：品名帶入實際商品明細，paymentRef 沿用訂單的 POS- 編號。
router.post("/admin/pos/orders/:id/invoice", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin", "vendor")) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const [order] = await db.select().from(posOrdersTable).where(eq(posOrdersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "找不到訂單" }); return; }
  if (req.adminUser?.role === "vendor") {
    const v = await resolvePosVendor(req);
    if (!v.ok || v.vendorId == null || order.vendorId !== v.vendorId) {
      res.status(403).json({ error: "只能為自己商家的訂單開立發票" });
      return;
    }
  }
  if (order.invoiceId != null) {
    const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, order.invoiceId)).limit(1);
    if (existing && (existing.status === "issued" || existing.status === "pending")) {
      res.status(400).json({ error: "此訂單已開立發票（或開立中），如需重開請先至發票管理作廢" });
      return;
    }
  }

  const { carrierType, carrierNum } = req.body ?? {};
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
  if (useCarrier === "ecpay_carrier" && !order.buyerEmail) {
    res.status(400).json({
      error: "此訂單客人沒有 Email，無法以會員載具開立；請改掃描客人的手機條碼載具",
    });
    return;
  }

  const [invRow] = await db
    .insert(invoicesTable)
    .values({
      paymentRef: order.paymentRef,
      invoiceType: "personal",
      carrierType: useCarrier,
      carrierNum: useCarrier === "phone_barcode" ? barcode : null,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      buyerPhone: order.buyerPhone,
      vendorId: order.vendorId,
      amount: order.totalAmount,
      status: "pending",
    })
    .returning();
  await db.update(posOrdersTable).set({ invoiceId: invRow.id }).where(eq(posOrdersTable.id, order.id));

  const result = await issueInvoice({
    relateNumber: order.paymentRef,
    customerEmail: order.buyerEmail || "",
    customerName: order.buyerName || undefined,
    customerPhone: order.buyerPhone || undefined,
    invoiceType: "personal",
    carrierType: useCarrier,
    carrierNum: useCarrier === "phone_barcode" ? barcode : undefined,
    salesAmount: order.totalAmount,
    items: [
      ...order.items.map((it) => ({
        name: it.name.slice(0, 100),
        count: it.qty,
        unitPrice: it.unitPrice,
        amount: it.unitPrice * it.qty,
      })),
      // 折價以負數明細列出，讓明細合計 = 發票金額（totalAmount 已扣折價）
      ...(order.discount > 0
        ? [{ name: "折價", count: 1, unitPrice: -order.discount, amount: -order.discount }]
        : []),
    ],
  } satisfies InvoiceIssueOptions);

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
      .where(eq(invoicesTable.id, invRow.id))
      .returning();
    logger.info({ orderId: order.id, paymentRef: order.paymentRef, invoiceNumber: result.invoiceNumber }, "[POS] order invoice issued");
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
    .where(eq(invoicesTable.id, invRow.id));
  logger.error({ orderId: order.id, message: result.message }, "[POS] order invoice failed");
  res.status(502).json({ success: false, error: result.message || "發票開立失敗" });
});

// 作廢訂單的發票（退款情境）：呼叫 ECPay 作廢後把發票標記 voided。
// vendor 只能作廢自己攤位的訂單發票；工作人員／主辦方可作廢任何 POS 訂單發票。
router.post("/admin/pos/orders/:id/invoice/void", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin", "vendor")) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "bad id" }); return; }
  const [order] = await db.select().from(posOrdersTable).where(eq(posOrdersTable.id, id)).limit(1);
  if (!order) { res.status(404).json({ error: "找不到訂單" }); return; }
  if (req.adminUser?.role === "vendor") {
    const v = await resolvePosVendor(req);
    if (!v.ok || v.vendorId == null || order.vendorId !== v.vendorId) {
      res.status(403).json({ error: "只能作廢自己商家的訂單發票" });
      return;
    }
  }
  if (order.invoiceId == null) { res.status(400).json({ error: "此訂單尚未開立發票" }); return; }
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, order.invoiceId)).limit(1);
  if (!invoice || invoice.status !== "issued" || !invoice.invoiceNumber || !invoice.invoiceDate) {
    res.status(400).json({ error: "此訂單沒有已開立的發票可作廢" });
    return;
  }
  const reason = String(req.body?.reason || "現場退款").slice(0, 20) || "現場退款";
  // ECPay 回傳的 invoiceDate 可能是 "YYYY-MM-DD+HH:MM:SS"；作廢 API 只要日期。
  const dateOnly = invoice.invoiceDate.split("+")[0]?.split(" ")[0]?.split("T")[0] ?? invoice.invoiceDate;
  try {
    const result = await voidInvoice(invoice.invoiceNumber, dateOnly, reason);
    if (result.success) {
      await db
        .update(invoicesTable)
        .set({ status: "voided", voidedAt: new Date() })
        .where(eq(invoicesTable.id, invoice.id));
      logger.info({ orderId: order.id, invoiceNumber: invoice.invoiceNumber }, "[POS] order invoice voided");
      res.json({ success: true });
      return;
    }
    res.status(502).json({ success: false, error: result.message || "發票作廢失敗" });
  } catch (err) {
    logger.error({ err, orderId: order.id }, "[POS] invoice void error");
    res.status(500).json({ error: "發票作廢失敗，請稍後再試" });
  }
});

export default router;
