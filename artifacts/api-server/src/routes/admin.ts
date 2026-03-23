import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, registrationsTable, newsTable, contestantsTable, sponsorsTable } from "@workspace/db";
import {
  AdminListRegistrationsQueryParams,
  AdminListRegistrationsResponse,
  AdminExportRegistrationsQueryParams,
  AdminCreateNewsBody,
  AdminUpdateNewsParams,
  AdminUpdateNewsBody,
  AdminUpdateNewsResponse,
  AdminDeleteNewsParams,
  AdminCreateContestantBody,
  AdminUpdateContestantParams,
  AdminUpdateContestantBody,
  AdminUpdateContestantResponse,
  AdminDeleteContestantParams,
  AdminGetStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const EVENT_DATES = ["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"];
const DAILY_CAPACITY = 500;

function requireAuth(req: any, res: any): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/admin/registrations", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const query = AdminListRegistrationsQueryParams.safeParse(req.query);
  let rows;
  if (query.success && query.data.date) {
    const dateStr = typeof query.data.date === "string" ? query.data.date : (query.data.date as Date).toISOString().split("T")[0];
    rows = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.eventDate, dateStr))
      .orderBy(desc(registrationsTable.createdAt));
  } else {
    rows = await db
      .select()
      .from(registrationsTable)
      .orderBy(desc(registrationsTable.createdAt));
  }
  res.json(AdminListRegistrationsResponse.parse(rows));
});

router.get("/admin/registrations/export", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const query = AdminExportRegistrationsQueryParams.safeParse(req.query);
  let rows;
  if (query.success && query.data.date) {
    const dateStr = typeof query.data.date === "string" ? query.data.date : (query.data.date as Date).toISOString().split("T")[0];
    rows = await db
      .select()
      .from(registrationsTable)
      .where(eq(registrationsTable.eventDate, dateStr))
      .orderBy(desc(registrationsTable.createdAt));
  } else {
    rows = await db
      .select()
      .from(registrationsTable)
      .orderBy(desc(registrationsTable.createdAt));
  }

  const header = "ID,家長姓名,聯絡電話,票數,活動日期,報名時間\n";
  const csvRows = rows.map(
    (r) =>
      `${r.id},"${r.parentName}","${r.phone}",${r.ticketCount},${r.eventDate},${r.createdAt.toISOString()}`
  );
  const csv = header + csvRows.join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=registrations.csv");
  res.send("\uFEFF" + csv);
});

router.get("/admin/stats", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const rows = await db
    .select({
      eventDate: registrationsTable.eventDate,
      total: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)`,
    })
    .from(registrationsTable)
    .groupBy(registrationsTable.eventDate);

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.eventDate] = Number(row.total);
  }

  const stats = EVENT_DATES.map((date) => ({
    date: new Date(date),
    totalCapacity: DAILY_CAPACITY,
    registered: counts[date] || 0,
    remaining: DAILY_CAPACITY - (counts[date] || 0),
  }));

  res.json(AdminGetStatsResponse.parse(stats));
});

router.post("/admin/news", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const parsed = AdminCreateNewsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [article] = await db.insert(newsTable).values(parsed.data).returning();
  res.status(201).json(article);
});

router.put("/admin/news/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = AdminUpdateNewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminUpdateNewsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [article] = await db
    .update(newsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(newsTable.id, params.data.id))
    .returning();

  if (!article) {
    res.status(404).json({ error: "News article not found" });
    return;
  }

  res.json(AdminUpdateNewsResponse.parse(article));
});

router.delete("/admin/news/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = AdminDeleteNewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(newsTable)
    .where(eq(newsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "News article not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/admin/contestants", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const parsed = AdminCreateContestantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [contestant] = await db.insert(contestantsTable).values(parsed.data).returning();
  res.status(201).json(contestant);
});

router.put("/admin/contestants/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = AdminUpdateContestantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminUpdateContestantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [contestant] = await db
    .update(contestantsTable)
    .set(parsed.data)
    .where(eq(contestantsTable.id, params.data.id))
    .returning();

  if (!contestant) {
    res.status(404).json({ error: "Contestant not found" });
    return;
  }

  res.json(AdminUpdateContestantResponse.parse(contestant));
});

router.delete("/admin/contestants/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const params = AdminDeleteContestantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(contestantsTable)
    .where(eq(contestantsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Contestant not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/admin/sponsors", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const sponsors = await db
    .select()
    .from(sponsorsTable)
    .orderBy(desc(sponsorsTable.createdAt));

  res.json(sponsors);
});

router.post("/admin/sponsors", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const { name, logoUrl, websiteUrl, tier } = req.body || {};
  if (!name || !logoUrl || !websiteUrl || !tier) {
    res.status(400).json({ error: "缺少必要欄位" });
    return;
  }

  const validTiers = ["platinum", "gold", "silver", "bronze"];
  if (!validTiers.includes(tier)) {
    res.status(400).json({ error: "無效的贊助等級" });
    return;
  }

  const [sponsor] = await db.insert(sponsorsTable).values({ name, logoUrl, websiteUrl, tier }).returning();
  res.status(201).json(sponsor);
});

router.put("/admin/sponsors/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = Number(req.params.id);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "無效的 ID" });
    return;
  }

  const { name, logoUrl, websiteUrl, tier } = req.body || {};
  const updateData: Record<string, unknown> = {};
  if (name) updateData.name = name;
  if (logoUrl) updateData.logoUrl = logoUrl;
  if (websiteUrl) updateData.websiteUrl = websiteUrl;
  if (tier) {
    const validTiers = ["platinum", "gold", "silver", "bronze"];
    if (!validTiers.includes(tier)) {
      res.status(400).json({ error: "無效的贊助等級" });
      return;
    }
    updateData.tier = tier;
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "未提供任何更新欄位" });
    return;
  }

  const [sponsor] = await db
    .update(sponsorsTable)
    .set(updateData)
    .where(eq(sponsorsTable.id, id))
    .returning();

  if (!sponsor) {
    res.status(404).json({ error: "找不到贊助廠商" });
    return;
  }

  res.json(sponsor);
});

router.delete("/admin/sponsors/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const id = Number(req.params.id);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "無效的 ID" });
    return;
  }

  const [deleted] = await db
    .delete(sponsorsTable)
    .where(eq(sponsorsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "找不到贊助廠商" });
    return;
  }

  res.sendStatus(204);
});

export default router;
