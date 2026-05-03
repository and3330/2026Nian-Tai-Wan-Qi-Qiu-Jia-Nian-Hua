import { eq, sql } from "drizzle-orm";
import { db, promoCodesTable, type PromoCode } from "@workspace/db";

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const PROMO_PRICE_BOOK: Record<string, number> = {
  single: 200,
  combo: 300,
  "four-day-pass": 12000,
  workshop: 8000,
  competition: 5000,
};

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;
  if (!/^[A-Z0-9_-]{2,32}$/.test(trimmed)) return null;
  return trimmed;
}

export type PromoApplyResult =
  | {
      ok: true;
      code: string;
      promoId: number;
      discountAmount: number;
      finalAmount: number;
      label: string;
    }
  | { ok: false; error: string; code?: string };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Validate (read-only) a promo code against a base amount + ticket type.
 * Does NOT increment used_count. Use applyPromoInTx for atomic apply.
 */
export async function previewPromo(args: {
  code: string;
  baseAmount: number;
  ticketType: string | null;
}): Promise<PromoApplyResult> {
  const [row] = await db
    .select()
    .from(promoCodesTable)
    .where(eq(promoCodesTable.code, args.code))
    .limit(1);
  if (!row) return { ok: false, error: "優惠碼不存在", code: "NOT_FOUND" };
  return evaluatePromo(row, args.baseAmount, args.ticketType);
}

function evaluatePromo(
  row: PromoCode,
  baseAmount: number,
  ticketType: string | null,
): PromoApplyResult {
  if (!row.active) return { ok: false, error: "優惠碼已停用", code: "INACTIVE" };
  const today = todayStr();
  if (row.validFrom && today < row.validFrom)
    return { ok: false, error: `優惠碼將於 ${row.validFrom} 開始可用`, code: "NOT_YET" };
  if (row.validUntil && today > row.validUntil)
    return { ok: false, error: "優惠碼已過期", code: "EXPIRED" };
  if (row.maxUses != null && row.usedCount >= row.maxUses)
    return { ok: false, error: "優惠碼使用次數已達上限", code: "EXHAUSTED" };
  if (row.appliesTo && ticketType !== row.appliesTo)
    return {
      ok: false,
      error: `此優惠碼僅適用於 ${row.appliesTo} 票種`,
      code: "TICKET_TYPE_MISMATCH",
    };

  let discount = 0;
  if (row.discountType === "percent") {
    discount = Math.floor((baseAmount * row.discountValue) / 100);
  } else if (row.discountType === "fixed") {
    discount = row.discountValue;
  } else {
    return { ok: false, error: "優惠碼設定錯誤", code: "BAD_TYPE" };
  }
  if (discount > baseAmount) discount = baseAmount;
  if (discount < 0) discount = 0;
  const finalAmount = Math.max(0, baseAmount - discount);
  const label =
    row.discountType === "percent"
      ? `${row.discountValue}% 折扣`
      : `折抵 NT$ ${row.discountValue}`;
  return {
    ok: true,
    code: row.code,
    promoId: row.id,
    discountAmount: discount,
    finalAmount,
    label,
  };
}

/**
 * Atomically validate + increment used_count within an existing tx.
 * Uses SELECT ... FOR UPDATE so concurrent applies of a max-limited code
 * cannot oversubscribe.
 */
export async function applyPromoInTx(
  tx: DbExecutor,
  args: { code: string; baseAmount: number; ticketType: string | null },
): Promise<PromoApplyResult> {
  const rows = await tx.execute(
    sql`SELECT * FROM ${promoCodesTable} WHERE ${promoCodesTable.code} = ${args.code} FOR UPDATE`,
  );
  const raw = (rows as { rows?: any[] }).rows ?? (rows as any);
  const row = Array.isArray(raw) ? raw[0] : null;
  if (!row) return { ok: false, error: "優惠碼不存在", code: "NOT_FOUND" };
  // Drizzle returns snake_case from raw execute; normalize.
  const promo: PromoCode = {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    appliesTo: row.applies_to,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    active: row.active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const result = evaluatePromo(promo, args.baseAmount, args.ticketType);
  if (!result.ok) return result;
  await tx
    .update(promoCodesTable)
    .set({ usedCount: promo.usedCount + 1 })
    .where(eq(promoCodesTable.id, promo.id));
  return result;
}
