import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import QRCode from "qrcode";
import { db, registrationsTable } from "@workspace/db";
import { GetRegistrationAvailabilityResponse } from "@workspace/api-zod";
import { sendConfirmationEmail } from "../services/email-service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type CreateRegistrationInput = {
  parentName: string;
  phone: string;
  email?: string | null;
  ticketCount: number;
  eventDate: string;
};

function parseRegistrationBody(body: any): { ok: true; data: CreateRegistrationInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { parentName, phone, email, ticketCount, eventDate } = body;
  if (typeof parentName !== "string" || !parentName.trim()) return { ok: false, error: "parentName is required" };
  if (typeof phone !== "string" || !phone.trim()) return { ok: false, error: "phone is required" };
  if (email != null && (typeof email !== "string" || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))))
    return { ok: false, error: "email format is invalid" };
  if (typeof ticketCount !== "number" || ticketCount < 1 || ticketCount > 10)
    return { ok: false, error: "ticketCount must be between 1 and 10" };
  let eventDateStr: string;
  if (typeof eventDate === "string") eventDateStr = eventDate.length >= 10 ? eventDate.slice(0, 10) : eventDate;
  else if (eventDate instanceof Date) eventDateStr = eventDate.toISOString().slice(0, 10);
  else return { ok: false, error: "eventDate is required" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)) return { ok: false, error: "eventDate must be YYYY-MM-DD" };
  return {
    ok: true,
    data: {
      parentName: parentName.trim(),
      phone: phone.trim(),
      email: email && typeof email === "string" && email.trim() ? email.trim() : null,
      ticketCount,
      eventDate: eventDateStr,
    },
  };
}

const EVENT_DATES = ["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"];
const DAILY_CAPACITY = 500;

async function getDateCounts(): Promise<Record<string, number>> {
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
  return counts;
}

router.get("/registrations/availability", async (req, res): Promise<void> => {
  const counts = await getDateCounts();
  const availability = EVENT_DATES.map((date) => {
    const registered = counts[date] || 0;
    return {
      date: new Date(date),
      totalCapacity: DAILY_CAPACITY,
      registered,
      remaining: DAILY_CAPACITY - registered,
    };
  });
  res.json(GetRegistrationAvailabilityResponse.parse(availability));
});

const PRICE_BOOK: Record<string, number> = {
  single: 200,
  combo: 300,
  "four-day-pass": 12000,
  workshop: 8000,
  competition: 5000,
};

function resolveAmount(
  rawTicketType: string | null,
  ticketCount: number,
  amountPerOrder: number | null,
): { ok: true; ticketType: string | null; amount: number | null } | { ok: false; error: string } {
  let amount: number | null = null;
  if (rawTicketType && PRICE_BOOK[rawTicketType] != null) {
    amount = PRICE_BOOK[rawTicketType] * ticketCount;
    if (amountPerOrder != null && amountPerOrder !== amount) {
      return { ok: false, error: "Amount does not match ticket type pricing" };
    }
  } else if (amountPerOrder != null) {
    return { ok: false, error: "Unknown ticketType for amount" };
  }
  return { ok: true, ticketType: rawTicketType, amount };
}

// Drizzle transaction object — accepts both the top-level `db` and a tx in
// callbacks, kept loose because the concrete generic type is verbose.
type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Acquire a per-date advisory lock so concurrent purchases for the same date
// serialize against each other, eliminating the read-then-insert race.
async function lockDate(tx: DbExecutor, date: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`reg:${date}`}))`);
}

async function countForDate(tx: DbExecutor, date: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)` })
    .from(registrationsTable)
    .where(eq(registrationsTable.eventDate, date));
  return Number(row?.total ?? 0);
}

router.post("/registrations", async (req, res): Promise<void> => {
  const parsed = parseRegistrationBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const { parentName, phone, email, ticketCount, eventDate } = parsed.data;

  if (!EVENT_DATES.includes(eventDate)) {
    res.status(400).json({ error: "Invalid event date" });
    return;
  }

  const rawTicketType = typeof req.body?.ticketType === "string" ? req.body.ticketType.trim() : null;
  const rawAmount = req.body?.amount;
  const amountPerOrder = typeof rawAmount === "number" && Number.isFinite(rawAmount) ? Math.round(rawAmount) : null;
  const priced = resolveAmount(rawTicketType, ticketCount, amountPerOrder);
  if (!priced.ok) {
    res.status(400).json({ error: priced.error });
    return;
  }

  const qrToken = crypto.randomBytes(16).toString("hex");

  try {
    const result = await db.transaction(async (tx) => {
      await lockDate(tx, eventDate);
      const currentCount = await countForDate(tx, eventDate);
      const remaining = Math.max(0, DAILY_CAPACITY - currentCount);
      if (currentCount + ticketCount > DAILY_CAPACITY) {
        return { soldOut: true as const, remaining, date: eventDate };
      }
      const [reg] = await tx
        .insert(registrationsTable)
        .values({
          parentName,
          phone,
          email: email ?? null,
          ticketCount,
          eventDate,
          ticketType: priced.ticketType,
          amount: priced.amount,
          qrToken,
        })
        .returning();
      return { soldOut: false as const, registration: reg };
    });

    if (result.soldOut) {
      res.status(409).json({
        error: `${result.date} 票券已售完，剩餘 ${result.remaining} 張`,
        code: "SOLD_OUT",
        eventDate: result.date,
        remaining: result.remaining,
      });
      return;
    }

    if (result.registration.email) {
      sendConfirmationEmail(result.registration.id).catch((err) => {
        logger.error({ err, regId: result.registration.id }, "[Registration] confirmation email failed");
      });
    }
    res.status(201).json(result.registration);
  } catch (err) {
    logger.error({ err }, "[Registration] create failed");
    res.status(500).json({ error: "報名建立失敗，請稍後再試" });
  }
});

// Atomic combo purchase: creates registrations for two consecutive dates in
// a single transaction, locking both dates and verifying capacity for both
// before inserting either. Prevents the orphan-registration bug where the
// frontend had to make two sequential POSTs.
router.post("/registrations/combo", async (req, res): Promise<void> => {
  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : null;
  if (!body) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const dates = Array.isArray(body.eventDates) ? (body.eventDates as unknown[]) : null;
  if (!dates || dates.length < 2) {
    res.status(400).json({ error: "eventDates must contain at least two dates" });
    return;
  }
  const normalizedDates: string[] = [];
  for (const d of dates) {
    if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !EVENT_DATES.includes(d)) {
      res.status(400).json({ error: `Invalid event date: ${String(d)}` });
      return;
    }
    if (normalizedDates.includes(d)) {
      res.status(400).json({ error: "eventDates must be unique" });
      return;
    }
    normalizedDates.push(d);
  }

  const baseParsed = parseRegistrationBody({ ...body, eventDate: normalizedDates[0] });
  if (!baseParsed.ok) {
    res.status(400).json({ error: baseParsed.error });
    return;
  }
  const { parentName, phone, email, ticketCount } = baseParsed.data;

  const rawTicketType = typeof body.ticketType === "string" ? (body.ticketType as string).trim() : null;
  const rawAmount = body.amount;
  const amountPerOrder = typeof rawAmount === "number" && Number.isFinite(rawAmount) ? Math.round(rawAmount) : null;
  const priced = resolveAmount(rawTicketType, ticketCount, amountPerOrder);
  if (!priced.ok) {
    res.status(400).json({ error: priced.error });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Always lock dates in sorted order to prevent deadlocks between
      // concurrent transactions that touch overlapping dates.
      const sortedDates = [...normalizedDates].sort();
      for (const d of sortedDates) await lockDate(tx, d);

      for (const d of normalizedDates) {
        const count = await countForDate(tx, d);
        if (count + ticketCount > DAILY_CAPACITY) {
          return { soldOut: true as const, date: d, remaining: Math.max(0, DAILY_CAPACITY - count) };
        }
      }

      const inserted: Array<typeof registrationsTable.$inferSelect> = [];
      for (let i = 0; i < normalizedDates.length; i++) {
        const d = normalizedDates[i];
        const qrToken = crypto.randomBytes(16).toString("hex");
        const [reg] = await tx
          .insert(registrationsTable)
          .values({
            parentName,
            phone,
            email: email ?? null,
            ticketCount,
            eventDate: d,
            // Only the first leg carries the ticketType + amount so the
            // payment total isn't double-counted.
            ticketType: i === 0 ? priced.ticketType : null,
            amount: i === 0 ? priced.amount : null,
            qrToken,
          })
          .returning();
        inserted.push(reg);
      }
      return { soldOut: false as const, registrations: inserted };
    });

    if (result.soldOut) {
      res.status(409).json({
        error: `${result.date} 票券已售完，剩餘 ${result.remaining} 張，請改選其他票種`,
        code: "SOLD_OUT",
        eventDate: result.date,
        remaining: result.remaining,
      });
      return;
    }

    // Confirmation email is only sent for the first leg (it represents the
    // overall purchase); the second leg shares the same buyer + payment_ref
    // once the payment is initialized.
    const head = result.registrations[0];
    if (head?.email) {
      sendConfirmationEmail(head.id).catch((err) => {
        logger.error({ err, regId: head.id }, "[Registration] combo confirmation email failed");
      });
    }
    res.status(201).json({ registrations: result.registrations });
  } catch (err) {
    logger.error({ err }, "[Registration] combo create failed");
    res.status(500).json({ error: "套票報名建立失敗，請稍後再試" });
  }
});

router.get("/qr/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!token || token.length < 4) {
    res.status(404).json({ error: "Token not found" });
    return;
  }
  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.qrToken, token))
    .limit(1);
  if (!reg) {
    res.status(404).json({ error: "Token not found" });
    return;
  }
  try {
    const buffer = await QRCode.toBuffer(token, {
      errorCorrectionLevel: "M",
      type: "png",
      margin: 2,
      width: 480,
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (err) {
    logger.error({ err }, "[QR] Failed to generate QR code");
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

export default router;
