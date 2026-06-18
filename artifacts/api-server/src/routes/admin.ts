import { Router, type IRouter } from "express";
import { eq, desc, sql, inArray, or, and, isNull } from "drizzle-orm";
import {
  db,
  registrationsTable,
  newsTable,
  contestantsTable,
  sponsorsTable,
  paymentTransactionsTable,
  invoicesTable,
  refundRequestsTable,
} from "@workspace/db";
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
import { sendConfirmationEmail } from "../services/email-service";
import { markPaymentPaid } from "./payments";
import { logger } from "../lib/logger";

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
  tournament: "戰鬥陀螺賽參賽",
  "tournament-companion": "戰鬥陀螺賽隨同票",
};

// Tournament legs live on 7/26 but belong to their own 128-slot inventory, so
// they must be excluded wherever the 500/day carnival capacity is computed.
const isCarnivalLeg = sql`(${registrationsTable.ticketType} IS NULL OR ${registrationsTable.ticketType} NOT IN ('tournament', 'tournament-companion'))`;
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

// Auth helper that optionally enforces a set of allowed roles. The owner role
// always passes (granted by req.hasRole). When no roles are provided the helper
// only requires the caller to be authenticated (≈ viewer+).
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

router.get("/admin/registrations", async (req, res): Promise<void> => {
  // Contains PII (parent name/phone/email). Restrict to editor+ (owner allowed via hasRole).
  if (!requireAuth(req, res, "editor")) return;

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
  // Bulk PII export — editor+ only.
  if (!requireAuth(req, res, "editor")) return;

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

// Bulk-delete orders from the admin orders area. The caller sends registration
// row ids ("legs"); an order is the group of registrations sharing a paymentRef.
// To avoid leaving orphan financial records, deletion is order-level: for every
// paymentRef touched we also remove the matching payment_transactions, invoices
// and refund_requests (all linked by the paymentRef string, not a DB FK). All
// legs sharing a deleted ref are removed even if not explicitly listed, so an
// order is never left half-deleted. Registrations with no paymentRef (e.g. free
// / standalone rows) are deleted by id. The whole operation runs in one
// transaction.
router.post("/admin/registrations/bulk-delete", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;

  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  const cleanIds = Array.from(
    new Set(
      (ids ?? [])
        .map((v: unknown) => Number(v))
        .filter((n: number) => Number.isInteger(n) && n > 0),
    ),
  ) as number[];

  if (cleanIds.length === 0) {
    res.status(400).json({ error: "請提供要刪除的訂單" });
    return;
  }

  // Resolve which orders these registrations belong to.
  const rows = await db
    .select({ id: registrationsTable.id, paymentRef: registrationsTable.paymentRef })
    .from(registrationsTable)
    .where(inArray(registrationsTable.id, cleanIds));

  if (rows.length === 0) {
    res.json({ deletedCount: 0, ordersDeleted: 0 });
    return;
  }

  const refs = Array.from(
    new Set(
      rows
        .map((r) => r.paymentRef)
        .filter((r): r is string => Boolean(r)),
    ),
  );
  const standaloneIds = rows.filter((r) => !r.paymentRef).map((r) => r.id);

  let deletedCount = 0;
  await db.transaction(async (tx) => {
    const conds = [];
    if (refs.length > 0)
      conds.push(inArray(registrationsTable.paymentRef, refs));
    if (standaloneIds.length > 0)
      conds.push(inArray(registrationsTable.id, standaloneIds));

    const deletedRegs = await tx
      .delete(registrationsTable)
      .where(conds.length === 1 ? conds[0] : or(...conds))
      .returning({ id: registrationsTable.id });
    deletedCount = deletedRegs.length;

    if (refs.length > 0) {
      await tx
        .delete(paymentTransactionsTable)
        .where(inArray(paymentTransactionsTable.paymentRef, refs));
      await tx
        .delete(invoicesTable)
        .where(inArray(invoicesTable.paymentRef, refs));
      await tx
        .delete(refundRequestsTable)
        .where(inArray(refundRequestsTable.paymentRef, refs));
    }
  });

  res.json({ deletedCount, ordersDeleted: refs.length + standaloneIds.length });
});

// Toggle the early-bird VIP flag on an order. VIP is purely an admission label
// shown in the orders list and at check-in (staff let the buyer's under-6
// children in free) — it does NOT change pricing, ticket counts, or trigger any
// refund. Applied to every leg sharing the order's paymentRef so the flag shows
// on each leg's QR at check-in. Editor+ only.
router.post("/admin/registrations/set-vip", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;

  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  const cleanIds = Array.from(
    new Set(
      (ids ?? [])
        .map((v: unknown) => Number(v))
        .filter((n: number) => Number.isInteger(n) && n > 0),
    ),
  ) as number[];
  const isVip = req.body?.isVip === true;

  if (cleanIds.length === 0) {
    res.status(400).json({ error: "請提供要設定的訂單" });
    return;
  }

  // Expand to whole orders: any leg sharing a paymentRef gets the same flag.
  const rows = await db
    .select({ id: registrationsTable.id, paymentRef: registrationsTable.paymentRef })
    .from(registrationsTable)
    .where(inArray(registrationsTable.id, cleanIds));

  const refs = Array.from(
    new Set(rows.map((r) => r.paymentRef).filter((r): r is string => Boolean(r))),
  );
  const standaloneIds = rows.filter((r) => !r.paymentRef).map((r) => r.id);

  let updated = 0;
  await db.transaction(async (tx) => {
    const conds = [];
    if (refs.length > 0) conds.push(inArray(registrationsTable.paymentRef, refs));
    if (standaloneIds.length > 0) conds.push(inArray(registrationsTable.id, standaloneIds));
    if (conds.length === 0) return;
    const updatedRows = await tx
      .update(registrationsTable)
      .set({ isVip })
      .where(conds.length === 1 ? conds[0] : or(...conds))
      .returning({ id: registrationsTable.id });
    updated = updatedRows.length;
  });

  res.json({ updated, isVip });
});

// Directly refund a paid order from the back office (manual / offline refund).
// Marks every leg sharing the order's paymentRef as "refunded", which releases
// its seats back to capacity (all capacity queries exclude 'refunded'). This
// does NOT call the payment gateway — the actual money is refunded offline by
// staff via NewebPay / Stripe, matching the existing refund-request approval
// flow. Refuses orders that are already refunded, not yet paid, or have any
// checked-in leg. Applied to the whole order. Editor+ only.
router.post("/admin/registrations/refund", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;

  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  const cleanIds = Array.from(
    new Set(
      (ids ?? [])
        .map((v: unknown) => Number(v))
        .filter((n: number) => Number.isInteger(n) && n > 0),
    ),
  ) as number[];

  if (cleanIds.length === 0) {
    res.status(400).json({ error: "請提供要退票的訂單" });
    return;
  }

  // Resolve which orders these registrations belong to, then expand to every
  // leg of those orders so a combo refunds both days together.
  const seeds = await db
    .select({ id: registrationsTable.id, paymentRef: registrationsTable.paymentRef })
    .from(registrationsTable)
    .where(inArray(registrationsTable.id, cleanIds));

  if (seeds.length === 0) {
    res.status(404).json({ error: "找不到訂單" });
    return;
  }

  const refs = Array.from(
    new Set(seeds.map((r) => r.paymentRef).filter((r): r is string => Boolean(r))),
  );
  const standaloneIds = seeds.filter((r) => !r.paymentRef).map((r) => r.id);

  const orderCond =
    refs.length > 0 && standaloneIds.length > 0
      ? or(
          inArray(registrationsTable.paymentRef, refs),
          inArray(registrationsTable.id, standaloneIds),
        )
      : refs.length > 0
        ? inArray(registrationsTable.paymentRef, refs)
        : inArray(registrationsTable.id, standaloneIds);

  // Lock the order's legs, re-validate, and flip status in one transaction so a
  // concurrent check-in can't slip in between the guard and the update.
  const result = await db.transaction(async (tx) => {
    const legs = await tx
      .select({
        id: registrationsTable.id,
        paymentStatus: registrationsTable.paymentStatus,
        checkedInAt: registrationsTable.checkedInAt,
      })
      .from(registrationsTable)
      .where(orderCond)
      .for("update");

    if (legs.some((l) => l.checkedInAt)) {
      return { ok: false as const, status: 400, error: "已入場的票券無法退票" };
    }
    if (legs.every((l) => l.paymentStatus === "refunded")) {
      return { ok: false as const, status: 400, error: "此訂單已退款" };
    }
    if (!legs.some((l) => l.paymentStatus === "paid")) {
      return { ok: false as const, status: 400, error: "僅能對「已付款」訂單退票" };
    }

    const updatedRows = await tx
      .update(registrationsTable)
      .set({ paymentStatus: "refunded" })
      .where(and(orderCond, sql`${registrationsTable.paymentStatus} <> 'refunded'`))
      .returning({ id: registrationsTable.id });
    return { ok: true as const, updated: updatedRows.length };
  });

  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  logger.info(
    { refs, standaloneIds, updated: result.updated },
    "[refund] admin direct refund from orders manage",
  );
  res.json({ updated: result.updated, ordersRefunded: refs.length + standaloneIds.length });
});

// Resend the purchase-confirmation email (with entry QR) for the given
// registration "legs". Each leg of a two-day combo carries its own QR, so the
// caller passes every leg id and we resend per leg. Forced: bypasses the
// once-only guard so admins can re-deliver to buyers who lost the email. Only
// legs that already have a QR (i.e. paid) and an email actually send; others are
// reported as skipped.
router.post("/admin/registrations/resend-confirmation", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;

  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  const cleanIds = Array.from(
    new Set(
      (ids ?? [])
        .map((v: unknown) => Number(v))
        .filter((n: number) => Number.isInteger(n) && n > 0),
    ),
  ) as number[];

  if (cleanIds.length === 0) {
    res.status(400).json({ error: "請提供要重新發送的訂單" });
    return;
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of cleanIds) {
    try {
      const result = await sendConfirmationEmail(id, { force: true });
      if (result?.delivered) sent += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }

  res.json({ sent, skipped, failed });
});

// Manually mark one or more orders as paid (e.g. cash on site, an offline
// transfer, or any registration the organizer collected payment for outside the
// online gateways). The buyer then receives their data — the purchase
// confirmation email with the entry QR — just like an online payment.
//
// Two cases are handled:
//  1. Orders that already have a payment_transactions row (an online charge was
//     initiated but never completed): run the exact same paid flow as a real
//     payment via markPaymentPaid (status + invoice + Slack + confirmation
//     email). It is atomic and idempotent.
//  2. Truly manual orders with no transaction row (or no paymentRef at all):
//     flip the registration legs to paid, backfill paymentMethod="manual" where
//     unset, and send each leg its confirmation email + QR.
router.post("/admin/registrations/mark-paid", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;

  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  const cleanIds = Array.from(
    new Set(
      (ids ?? [])
        .map((v: unknown) => Number(v))
        .filter((n: number) => Number.isInteger(n) && n > 0),
    ),
  ) as number[];

  if (cleanIds.length === 0) {
    res.status(400).json({ error: "請提供要標記已付款的訂單" });
    return;
  }

  // Expand to whole orders: any leg sharing a paymentRef belongs to the same
  // order, so confirming one leg confirms all of them.
  const baseRows = await db
    .select({ id: registrationsTable.id, paymentRef: registrationsTable.paymentRef })
    .from(registrationsTable)
    .where(inArray(registrationsTable.id, cleanIds));

  if (baseRows.length === 0) {
    res.status(404).json({ error: "找不到訂單" });
    return;
  }

  const refs = Array.from(
    new Set(baseRows.map((r) => r.paymentRef).filter((r): r is string => Boolean(r))),
  );
  const standaloneIds = baseRows.filter((r) => !r.paymentRef).map((r) => r.id);

  const txRows =
    refs.length > 0
      ? await db
          .select({ paymentRef: paymentTransactionsTable.paymentRef })
          .from(paymentTransactionsTable)
          .where(inArray(paymentTransactionsTable.paymentRef, refs))
      : [];
  const refsWithTx = new Set(txRows.map((t) => t.paymentRef));

  // Only orders that have not yet been paid are eligible. This guards against
  // marking an already-paid / refunded / failed order at the endpoint level
  // (independent of whatever the UI offers).
  const MARKABLE_STATUSES = ["unpaid", "pending", "awaiting_transfer"];

  let confirmed = 0;
  let failed = 0;

  // Case 1: orders with a payment transaction → full paid flow. markPaymentPaid
  // is atomic + idempotent and returns whether it actually transitioned, so a
  // no-op (already paid / raced) does not inflate the confirmed count.
  for (const ref of refs) {
    if (!refsWithTx.has(ref)) continue;
    try {
      const didTransition = await markPaymentPaid(ref, `manual-${Date.now()}`, {
        manual: true,
        confirmedBy: (req as { user?: { id?: number } }).user?.id ?? null,
        confirmedAt: new Date().toISOString(),
      });
      if (didTransition) confirmed += 1;
    } catch (err) {
      logger.error({ err, ref }, "[mark-paid] transaction order failed");
      failed += 1;
    }
  }

  // Case 2: truly manual orders (no transaction row) + standalone legs.
  const manualRefs = refs.filter((r) => !refsWithTx.has(r));
  const manualLegIds = new Set<number>(standaloneIds);
  if (manualRefs.length > 0) {
    const legRows = await db
      .select({ id: registrationsTable.id })
      .from(registrationsTable)
      .where(inArray(registrationsTable.paymentRef, manualRefs));
    for (const r of legRows) manualLegIds.add(r.id);
  }

  const manualIds = Array.from(manualLegIds);
  if (manualIds.length > 0) {
    // Atomic guard: only legs in a markable (non-paid) state flip to paid, and
    // .returning() tells us exactly which rows actually transitioned. We send a
    // confirmation email only for those, so a concurrent/duplicate request that
    // matches 0 rows neither re-sends emails nor inflates the count.
    const flipped = await db
      .update(registrationsTable)
      .set({ paymentStatus: "paid" })
      .where(
        and(
          inArray(registrationsTable.id, manualIds),
          inArray(registrationsTable.paymentStatus, MARKABLE_STATUSES),
        ),
      )
      .returning({ id: registrationsTable.id });
    const flippedIds = flipped.map((r) => r.id);
    if (flippedIds.length > 0) {
      await db
        .update(registrationsTable)
        .set({ paymentMethod: "manual" })
        .where(
          and(
            inArray(registrationsTable.id, flippedIds),
            isNull(registrationsTable.paymentMethod),
          ),
        );
      confirmed += flippedIds.length;
      for (const legId of flippedIds) {
        try {
          await sendConfirmationEmail(legId);
        } catch (err) {
          logger.error({ err, legId }, "[mark-paid] manual confirmation email failed");
        }
      }
    }
  }

  res.json({ confirmed, failed });
});

router.get("/admin/stats", async (req, res): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const rows = await db
    .select({
      eventDate: registrationsTable.eventDate,
      total: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)`,
    })
    .from(registrationsTable)
    .where(isCarnivalLeg)
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
    .where(sql`${registrationsTable.paymentStatus} <> 'failed' AND ${isCarnivalLeg}`)
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
  if (!requireAuth(req, res, "editor")) return;

  const parsed = AdminCreateNewsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [article] = await db.insert(newsTable).values(parsed.data).returning();
  res.status(201).json(article);
});

router.put("/admin/news/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;

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
  if (!requireAuth(req, res, "editor")) return;

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
  if (!requireAuth(req, res, "editor")) return;

  const parsed = AdminCreateContestantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [contestant] = await db.insert(contestantsTable).values(parsed.data).returning();
  res.status(201).json(contestant);
});

router.put("/admin/contestants/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;

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
  if (!requireAuth(req, res, "editor")) return;

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
  if (!requireAuth(req, res, "editor")) return;

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
  if (!requireAuth(req, res, "editor")) return;

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
  if (!requireAuth(req, res, "editor")) return;

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
