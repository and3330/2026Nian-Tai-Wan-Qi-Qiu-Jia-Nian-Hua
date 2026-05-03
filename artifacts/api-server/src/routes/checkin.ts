import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, registrationsTable } from "@workspace/db";

const router: IRouter = Router();

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/admin/checkin/lookup/:token", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
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
  });
});

router.post("/admin/checkin/:token", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;
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
