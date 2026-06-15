import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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
    alreadyCheckedIn: !!reg.checkedInAt,
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
  if (reg.checkedInAt) {
    res.status(409).json({
      registration: reg,
      alreadyCheckedIn: true,
      error: `此票券已於 ${reg.checkedInAt.toISOString()} 報到過`,
    });
    return;
  }
  const [updated] = await db
    .update(registrationsTable)
    .set({ checkedInAt: new Date() })
    .where(eq(registrationsTable.id, reg.id))
    .returning();
  res.json({
    registration: updated,
    alreadyCheckedIn: false,
  });
});

export default router;
