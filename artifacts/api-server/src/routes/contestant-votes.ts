import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, contestantVotesTable, contestantsTable } from "@workspace/db";

const router: IRouter = Router();

const TOKEN_RE = /^[a-zA-Z0-9_-]{8,128}$/;

router.get("/contestant-votes/counts", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      contestantId: contestantVotesTable.contestantId,
      count: sql<number>`count(*)::int`,
    })
    .from(contestantVotesTable)
    .groupBy(contestantVotesTable.contestantId);
  res.json(rows.map((r) => ({ contestantId: r.contestantId, count: Number(r.count) })));
});

router.get("/contestant-votes/me", async (req, res): Promise<void> => {
  const token = String(req.query.token ?? "");
  if (!TOKEN_RE.test(token)) {
    res.json({ contestantIds: [] });
    return;
  }
  const rows = await db
    .select({ contestantId: contestantVotesTable.contestantId })
    .from(contestantVotesTable)
    .where(eq(contestantVotesTable.voterToken, token));
  res.json({ contestantIds: rows.map((r) => r.contestantId) });
});

router.post("/contestant-votes", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as { contestantId?: number; voterToken?: string };
  const contestantId = Number(body.contestantId);
  const voterToken = String(body.voterToken ?? "");
  if (!Number.isInteger(contestantId) || contestantId <= 0) {
    res.status(400).json({ error: "contestantId 不合法" });
    return;
  }
  if (!TOKEN_RE.test(voterToken)) {
    res.status(400).json({ error: "voterToken 不合法" });
    return;
  }
  const [exists] = await db
    .select({ id: contestantsTable.id })
    .from(contestantsTable)
    .where(eq(contestantsTable.id, contestantId))
    .limit(1);
  if (!exists) {
    res.status(404).json({ error: "找不到該參賽者" });
    return;
  }
  try {
    await db.insert(contestantVotesTable).values({ contestantId, voterToken });
  } catch (e: unknown) {
    const err = e as { code?: string; cause?: { code?: string } };
    const code = err.code ?? err.cause?.code;
    if (code === "23505") {
      res.status(409).json({ error: "您已對此參賽者投過票" });
      return;
    }
    throw e;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contestantVotesTable)
    .where(eq(contestantVotesTable.contestantId, contestantId));
  res.status(201).json({ ok: true, count: Number(count) });
});

export default router;
