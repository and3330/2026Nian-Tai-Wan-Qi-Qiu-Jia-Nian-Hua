import { Router, type IRouter } from "express";
import { db, contestantsTable } from "@workspace/db";
import { ListContestantsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contestants", async (_req, res): Promise<void> => {
  const contestants = await db.select().from(contestantsTable);
  res.json(ListContestantsResponse.parse(contestants));
});

export default router;
