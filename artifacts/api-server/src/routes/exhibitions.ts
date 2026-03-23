import { Router, type IRouter } from "express";
import { db, exhibitionsTable } from "@workspace/db";
import { ListExhibitionsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/exhibitions", async (_req, res): Promise<void> => {
  const exhibitions = await db.select().from(exhibitionsTable);
  res.json(ListExhibitionsResponse.parse(exhibitions));
});

export default router;
