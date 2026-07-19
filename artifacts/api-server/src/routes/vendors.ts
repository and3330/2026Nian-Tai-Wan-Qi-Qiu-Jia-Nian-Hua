import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, vendorsTable, invoicesTable, adminUsersTable } from "@workspace/db";
import { requireRole } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";

// 攤位商家管理 — editors/owner manage the vendor list and see a per-vendor
// sales report built from POS invoices (invoices.vendor_id). Vendor accounts
// themselves use /admin/pos/my-sales instead.
const router: IRouter = Router();

// List vendors with their bound account usernames and issued-sales totals.
router.get("/admin/vendors", requireRole("editor"), async (_req, res): Promise<void> => {
  try {
    const vendors = await db.select().from(vendorsTable).orderBy(desc(vendorsTable.id));
    const accounts = await db
      .select({ id: adminUsersTable.id, username: adminUsersTable.username, vendorId: adminUsersTable.vendorId })
      .from(adminUsersTable)
      .where(eq(adminUsersTable.role, "vendor"));
    const totals = await db
      .select({
        vendorId: invoicesTable.vendorId,
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${invoicesTable.amount}), 0)::int`,
      })
      .from(invoicesTable)
      .where(and(sql`${invoicesTable.vendorId} IS NOT NULL`, eq(invoicesTable.status, "issued")))
      .groupBy(invoicesTable.vendorId);
    const totalsMap = new Map(totals.map((t) => [t.vendorId, t]));
    res.json(
      vendors.map((v) => ({
        ...v,
        accounts: accounts.filter((a) => a.vendorId === v.id).map((a) => a.username),
        issuedCount: totalsMap.get(v.id)?.count ?? 0,
        issuedTotal: totalsMap.get(v.id)?.total ?? 0,
      })),
    );
  } catch (err) {
    logger.error({ err }, "[vendors] list error");
    res.status(500).json({ error: "載入商家失敗" });
  }
});

router.post("/admin/vendors", requireRole("editor"), async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const boothNumber = typeof body.boothNumber === "string" ? body.boothNumber.trim() || null : null;
  const contact = typeof body.contact === "string" ? body.contact.trim() || null : null;
  if (!name || name.length < 2) {
    res.status(400).json({ error: "商家名稱至少 2 個字" });
    return;
  }
  const [row] = await db.insert(vendorsTable).values({ name, boothNumber, contact }).returning();
  logger.info({ vendorId: row.id, name }, "[vendors] created");
  res.status(201).json(row);
});

router.put("/admin/vendors/:id", requireRole("editor"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "bad id" }); return; }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates: Partial<typeof vendorsTable.$inferInsert> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) { res.status(400).json({ error: "商家名稱至少 2 個字" }); return; }
    updates.name = name;
  }
  if (typeof body.boothNumber === "string" || body.boothNumber === null) {
    updates.boothNumber = (typeof body.boothNumber === "string" ? body.boothNumber.trim() : "") || null;
  }
  if (typeof body.contact === "string" || body.contact === null) {
    updates.contact = (typeof body.contact === "string" ? body.contact.trim() : "") || null;
  }
  if (typeof body.active === "boolean") updates.active = body.active;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "沒有可更新的欄位" });
    return;
  }
  const [row] = await db.update(vendorsTable).set(updates).where(eq(vendorsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "商家不存在" }); return; }
  res.json(row);
});

// Per-vendor invoice detail (editor) — used by the report drill-down.
router.get("/admin/vendors/:id/invoices", requireRole("editor"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "bad id" }); return; }
  const rows = await db
    .select({
      id: invoicesTable.id,
      amount: invoicesTable.amount,
      status: invoicesTable.status,
      invoiceNumber: invoicesTable.invoiceNumber,
      buyerName: invoicesTable.buyerName,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.vendorId, id))
    .orderBy(desc(invoicesTable.id))
    .limit(200);
  res.json(rows);
});

export default router;
