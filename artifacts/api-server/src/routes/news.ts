import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, newsTable } from "@workspace/db";
import {
  GetNewsArticleParams,
  GetNewsArticleResponse,
  ListNewsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/news", async (_req, res): Promise<void> => {
  const articles = await db
    .select()
    .from(newsTable)
    .orderBy(desc(newsTable.createdAt));
  res.json(ListNewsResponse.parse(articles));
});

router.get("/news/:id", async (req, res): Promise<void> => {
  const params = GetNewsArticleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [article] = await db
    .select()
    .from(newsTable)
    .where(eq(newsTable.id, params.data.id));

  if (!article) {
    res.status(404).json({ error: "News article not found" });
    return;
  }

  res.json(GetNewsArticleResponse.parse(article));
});

export default router;
