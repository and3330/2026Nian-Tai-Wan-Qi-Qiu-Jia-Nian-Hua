import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, promoCodesTable } from "@workspace/db";
import { requireRole } from "../middlewares/authMiddleware";
import { logger } from "../lib/logger";
import { normalizeCode, previewPromo, PROMO_PRICE_BOOK } from "../lib/promo-codes";

const router: IRouter = Router();

// ── Public: preview a promo code (no increment) ───────────────────────────
router.post("/promo-codes/validate", async (req, res): Promise<void> => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const code = normalizeCode(body.code);
  if (!code) {
    res.status(400).json({ error: "請輸入有效的優惠碼" });
    return;
  }
  const ticketType = typeof body.ticketType === "string" ? body.ticketType.trim() : null;
  const ticketCount = typeof body.ticketCount === "number" && body.ticketCount > 0 ? Math.floor(body.ticketCount) : 1;
  if (ticketType && PROMO_PRICE_BOOK[ticketType] == null) {
    res.status(400).json({ error: "未知票種" });
    return;
  }
  let baseAmount = 0;
  if (typeof body.baseAmount === "number" && body.baseAmount > 0) {
    baseAmount = Math.round(body.baseAmount);
  } else if (ticketType) {
    baseAmount = PROMO_PRICE_BOOK[ticketType] * ticketCount;
  }
  if (baseAmount <= 0) {
    res.status(400).json({ error: "需提供 baseAmount 或合法 ticketType" });
    return;
  }
  const result = await previewPromo({ code, baseAmount, ticketType });
  if (!result.ok) {
    // Collapse code-existence-revealing errors (NOT_FOUND/INACTIVE/EXPIRED/
    // NOT_YET/EXHAUSTED) into a single generic response so unauthenticated
    // callers cannot enumerate which promo codes exist. Keep the internal
    // detail in the server log only. TICKET_TYPE_MISMATCH stays specific
    // because revealing it requires the caller to already know a real code.
    const SAFE_CODES = new Set(["TICKET_TYPE_MISMATCH"]);
    if (result.code && SAFE_CODES.has(result.code)) {
      res.status(400).json({ error: result.error, code: result.code });
    } else {
      logger.info({ code, internalCode: result.code }, "[PromoCodes] validate rejected");
      res.status(400).json({ error: "優惠碼無效或已失效", code: "INVALID" });
    }
    return;
  }
  res.json({
    code: result.code,
    discountAmount: result.discountAmount,
    finalAmount: result.finalAmount,
    baseAmount,
    label: result.label,
  });
});

// ── Admin: list ───────────────────────────────────────────────────────────
router.get("/admin/promo-codes", requireRole("editor", "viewer", "checkin"), async (req, res): Promise<void> => {
  const rows = await db.select().from(promoCodesTable).orderBy(desc(promoCodesTable.createdAt));
  res.json(rows);
});

function parsePromoBody(body: any): { ok: true; data: any } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const code = normalizeCode(body.code);
  if (!code) return { ok: false, error: "code 必須為 2-32 字元的英數字 (A-Z 0-9 _ -)" };
  const discountType = body.discountType;
  if (discountType !== "percent" && discountType !== "fixed")
    return { ok: false, error: "discountType 必須為 percent 或 fixed" };
  const discountValue = Number(body.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0)
    return { ok: false, error: "discountValue 必須為正數" };
  if (discountType === "percent" && discountValue > 100)
    return { ok: false, error: "百分比折扣不可超過 100" };
  const appliesTo = body.appliesTo == null || body.appliesTo === ""
    ? null
    : typeof body.appliesTo === "string" && PROMO_PRICE_BOOK[body.appliesTo] != null
      ? body.appliesTo
      : "__INVALID__";
  if (appliesTo === "__INVALID__") return { ok: false, error: "appliesTo 必須為合法票種或留空" };
  const maxUses = body.maxUses == null || body.maxUses === ""
    ? null
    : Number.isFinite(Number(body.maxUses)) && Number(body.maxUses) > 0
      ? Math.floor(Number(body.maxUses))
      : "__INVALID__";
  if (maxUses === "__INVALID__") return { ok: false, error: "maxUses 必須為正整數或留空" };
  const validFrom = body.validFrom && /^\d{4}-\d{2}-\d{2}$/.test(body.validFrom) ? body.validFrom : null;
  const validUntil = body.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(body.validUntil) ? body.validUntil : null;
  return {
    ok: true,
    data: {
      code,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      discountType,
      discountValue: Math.floor(discountValue),
      appliesTo,
      maxUses,
      validFrom,
      validUntil,
      active: body.active !== false,
    },
  };
}

router.post("/admin/promo-codes", requireRole("editor"), async (req, res): Promise<void> => {
  const parsed = parsePromoBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const [row] = await db
      .insert(promoCodesTable)
      .values({ ...parsed.data, createdBy: req.adminUser?.id ?? null })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "優惠碼已存在" });
      return;
    }
    logger.error({ err }, "[PromoCodes] create failed");
    res.status(500).json({ error: "建立失敗" });
  }
});

router.put("/admin/promo-codes/:id", requireRole("editor"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = parsePromoBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    const [row] = await db
      .update(promoCodesTable)
      .set(parsed.data)
      .where(eq(promoCodesTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "優惠碼已存在" });
      return;
    }
    logger.error({ err }, "[PromoCodes] update failed");
    res.status(500).json({ error: "更新失敗" });
  }
});

router.delete("/admin/promo-codes/:id", requireRole("editor"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
