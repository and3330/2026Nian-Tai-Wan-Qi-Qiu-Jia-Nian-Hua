import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, registrationsTable } from "@workspace/db";

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

// A ticket may only be admitted once payment is confirmed. Genuinely free
// tickets (amount === 0, e.g. fully-discounted orders) are admissible too.
// NOTE: a null amount is NOT free — combo (two-day) orders store amount on the
// first leg only, so the second leg's amount is null and must rely on
// paymentStatus, which markPaymentPaid sets to "paid" on every leg of the order.
function isAdmissible(reg: {
  paymentStatus: string | null;
  amount: number | null;
}): boolean {
  return reg.paymentStatus === "paid" || reg.amount === 0;
}

// 每日報到統計：各活動日已報到人數 / 應到人數（可入場票券的總人頭數）。
router.get("/admin/checkin/stats", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "checkin")) return;
  const rows = await db
    .select({
      eventDate: registrationsTable.eventDate,
      checkedIn: sql<number>`coalesce(sum(${registrationsTable.checkedInCount}), 0)::int`,
      total: sql<number>`coalesce(sum(${registrationsTable.ticketCount}), 0)::int`,
    })
    .from(registrationsTable)
    .where(sql`${registrationsTable.paymentStatus} = 'paid' OR ${registrationsTable.amount} = 0`)
    .groupBy(registrationsTable.eventDate)
    .orderBy(registrationsTable.eventDate);
  res.json({ days: rows });
});

router.get("/admin/checkin/lookup/:token", async (req, res): Promise<void> => {
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
  res.json({
    registration: reg,
    alreadyCheckedIn: reg.checkedInCount >= reg.ticketCount,
    remaining: Math.max(0, reg.ticketCount - reg.checkedInCount),
    admissible: isAdmissible(reg),
  });
});

router.post("/admin/checkin/:token", async (req, res): Promise<void> => {
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
  if (!isAdmissible(reg)) {
    res.status(402).json({
      registration: reg,
      admissible: false,
      error: "此票券尚未完成付款，無法報到入場",
    });
    return;
  }
  const remaining = reg.ticketCount - reg.checkedInCount;
  if (remaining <= 0) {
    res.status(409).json({
      registration: reg,
      alreadyCheckedIn: true,
      error: `此票券 ${reg.ticketCount} 位已全數報到${reg.checkedInAt ? `（最後報到時間 ${reg.checkedInAt.toISOString()}）` : ""}`,
    });
    return;
  }
  // How many heads to admit this scan. Defaults to all remaining.
  const rawCount = (req.body ?? {}).count;
  let count = remaining;
  if (rawCount !== undefined && rawCount !== null) {
    count = Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > remaining) {
      res.status(400).json({
        error: `報到人數必須是 1 到 ${remaining} 之間的整數`,
        remaining,
      });
      return;
    }
  }
  // Atomic guarded increment: the WHERE clause re-checks the remaining
  // capacity so concurrent scans can never over-admit.
  const [updated] = await db
    .update(registrationsTable)
    .set({
      checkedInAt: new Date(),
      checkedInCount: sql`${registrationsTable.checkedInCount} + ${count}`,
    })
    .where(
      and(
        eq(registrationsTable.id, reg.id),
        sql`${registrationsTable.checkedInCount} + ${count} <= ${registrationsTable.ticketCount}`,
      ),
    )
    .returning();
  if (!updated) {
    res.status(409).json({
      registration: reg,
      error: "報到人數已變動，請重新查詢票券",
    });
    return;
  }
  res.json({
    registration: updated,
    alreadyCheckedIn: false,
    checkedInNow: count,
    remaining: updated.ticketCount - updated.checkedInCount,
  });
});

export default router;
