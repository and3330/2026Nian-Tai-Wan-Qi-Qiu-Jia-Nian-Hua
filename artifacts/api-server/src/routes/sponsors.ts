import { Router, type IRouter } from "express";
import { db, sponsorsTable } from "@workspace/db";
import { ListSponsorsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sponsors", async (_req, res): Promise<void> => {
  const sponsors = await db.select().from(sponsorsTable);
  res.json(ListSponsorsResponse.parse(sponsors));
});

export default router;
