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
  AdminGetSalesOverviewResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const EVENT_DATES = ["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"];
const DAILY_CAPACITY = 500;
const REFERENCE_TICKET_PRICE_TWD = 200;
const SESSION_LABELS: Record<string, string> = {
  "2026-07-23": "7/23（四）業內預展",
  "2026-07-24": "7/24（五）業內預展",
  "2026-07-25": "7/25（六）公開場",
  "2026-07-26": "7/26（日）公開場",
};
const TICKET_TYPE_LABELS: Record<string, string> = {
  single: "單日票",
  combo: "兩日套票",
  "four-day-pass": "四日通行證",
  workshop: "大師工作坊",
  competition: "交流大賽",
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "已付款",
  pending: "處理中",
  awaiting_transfer: "待匯款",
  unpaid: "未付款",
  failed: "付款失敗",
  refunded: "已退款",
};

function sessionLabel(date: string): string {
  return SESSION_LABELS[date] || date;
}

function ticketTypeLabel(t: string | null | undefined): string {
  if (!t) return "未指定";
  return TICKET_TYPE_LABELS[t] || t;
}

function paymentStatusLabel(s: string | null | undefined): string {
  if (!s) return "未付款";
  return PAYMENT_STATUS_LABELS[s] || s;
}

function toTaipeiDateString(d: Date): string {
  // Convert UTC date to YYYY-MM-DD in Asia/Taipei (UTC+8) without DST.
  const taipei = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return taipei.toISOString().split("T")[0];
}

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

  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const header =
    "ID,家長姓名,聯絡電話,票種,場次,入場日期,票數,訂單金額(元),付款狀態,付款方式,訂單編號,報名時間\n";
  const csvRows = rows.map((r) => {
    return [
      r.id,
      escape(r.parentName),
      escape(r.phone),
      escape(ticketTypeLabel(r.ticketType)),
      escape(sessionLabel(r.eventDate)),
      r.eventDate,
      r.ticketCount,
      r.amount ?? "",
      escape(paymentStatusLabel(r.paymentStatus)),
      escape(r.paymentMethod ?? ""),
      escape(r.paymentRef ?? ""),
      r.createdAt.toISOString(),
    ].join(",");
  });
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

router.get("/admin/sales-overview", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  // Per-session capacity (counts ALL non-failed registrations, regardless of payment status,
  // so reserved-but-unpaid seats still consume capacity).
  const sessionRows = await db
    .select({
      eventDate: registrationsTable.eventDate,
      total: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)`,
    })
    .from(registrationsTable)
    .where(sql`${registrationsTable.paymentStatus} <> 'failed'`)
    .groupBy(registrationsTable.eventDate);

  const sessionRegistered: Record<string, number> = {};
  for (const row of sessionRows) {
    sessionRegistered[row.eventDate] = Number(row.total);
  }

  // Paid daily sales trend (grouped by createdAt date in Asia/Taipei). Revenue uses the
  // real registration.amount so combo tickets — which write the full order amount on the
  // first row and 0/null on the second — are not double-counted.
  const trendRows = await db
    .select({
      day: sql<string>`to_char((${registrationsTable.createdAt} AT TIME ZONE 'Asia/Taipei')::date, 'YYYY-MM-DD')`,
      tickets: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${registrationsTable.amount}), 0)`,
    })
    .from(registrationsTable)
    .where(eq(registrationsTable.paymentStatus, "paid"))
    .groupBy(sql`(${registrationsTable.createdAt} AT TIME ZONE 'Asia/Taipei')::date`);

  const paidByDay: Record<string, { tickets: number; revenue: number }> = {};
  for (const row of trendRows) {
    paidByDay[row.day] = { tickets: Number(row.tickets), revenue: Number(row.revenue) };
  }

  // Build last-14-days trend window ending today (Taipei).
  const todayStr = toTaipeiDateString(new Date());
  const trend: { date: string; ticketsSold: number; revenue: number }[] = [];
  const todayUtcMidnight = new Date(`${todayStr}T00:00:00Z`).getTime();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayUtcMidnight - i * 24 * 60 * 60 * 1000);
    const ds = d.toISOString().split("T")[0];
    const entry = paidByDay[ds] || { tickets: 0, revenue: 0 };
    trend.push({ date: ds, ticketsSold: entry.tickets, revenue: entry.revenue });
  }

  const todayEntry = paidByDay[todayStr] || { tickets: 0, revenue: 0 };
  const todayTicketsSold = todayEntry.tickets;
  const todayRevenue = todayEntry.revenue;

  // Cumulative paid totals, derived from the real amount column.
  const [paidTotals] = await db
    .select({
      tickets: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${registrationsTable.amount}), 0)`,
    })
    .from(registrationsTable)
    .where(eq(registrationsTable.paymentStatus, "paid"));
  const totalTicketsSold = Number(paidTotals?.tickets ?? 0);
  const totalRevenue = Number(paidTotals?.revenue ?? 0);

  const totalCapacity = EVENT_DATES.length * DAILY_CAPACITY;
  const totalRegistered = EVENT_DATES.reduce(
    (sum, d) => sum + (sessionRegistered[d] || 0),
    0,
  );
  const overallFillPercentage = totalCapacity
    ? Math.round((totalRegistered / totalCapacity) * 1000) / 10
    : 0;

  // Ticket-type breakdown — grouped by the real ticket_type column (paid only).
  const typeRows = await db
    .select({
      ticketType: registrationsTable.ticketType,
      tickets: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${registrationsTable.amount}), 0)`,
    })
    .from(registrationsTable)
    .where(eq(registrationsTable.paymentStatus, "paid"))
    .groupBy(registrationsTable.ticketType);

  const ticketTypeBreakdown = typeRows
    .map((row) => {
      const ticketType = row.ticketType ?? "";
      const tickets = Number(row.tickets);
      const revenue = Number(row.revenue);
      const percentage = totalTicketsSold
        ? Math.round((tickets / totalTicketsSold) * 1000) / 10
        : 0;
      return {
        ticketType,
        label: ticketTypeLabel(row.ticketType),
        ticketsSold: tickets,
        revenue,
        percentage,
      };
    })
    .sort((a, b) => b.ticketsSold - a.ticketsSold);

  const sessionAvailability = EVENT_DATES.map((d) => {
    const registered = sessionRegistered[d] || 0;
    return {
      eventDate: d,
      label: sessionLabel(d),
      totalCapacity: DAILY_CAPACITY,
      registered,
      remaining: DAILY_CAPACITY - registered,
      fillPercentage: Math.round((registered / DAILY_CAPACITY) * 1000) / 10,
    };
  });

  const overview = {
    ticketPriceTwd: REFERENCE_TICKET_PRICE_TWD,
    todayTicketsSold,
    todayRevenue,
    totalTicketsSold,
    totalRevenue,
    totalCapacity,
    overallFillPercentage,
    dailySalesTrend: trend.map((t) => ({ ...t, date: new Date(t.date) })),
    ticketTypeBreakdown,
    sessionAvailability: sessionAvailability.map((s) => ({
      ...s,
      eventDate: new Date(s.eventDate),
    })),
  };

  res.json(AdminGetSalesOverviewResponse.parse(overview));
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
