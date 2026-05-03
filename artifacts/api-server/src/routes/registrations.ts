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

  const counts = await getDateCounts();
  const currentCount = counts[eventDate] || 0;

  if (currentCount + ticketCount > DAILY_CAPACITY) {
    res.status(400).json({ error: "已額滿 - This date is fully booked" });
    return;
  }

  // Optional payment fields — accept ticketType + amount when the client is starting
  // a paid checkout flow. Server still validates amount against known prices.
  const rawTicketType = typeof req.body?.ticketType === "string" ? req.body.ticketType.trim() : null;
  const rawAmount = req.body?.amount;
  const amountPerOrder = typeof rawAmount === "number" && Number.isFinite(rawAmount) ? Math.round(rawAmount) : null;

  const PRICE_BOOK: Record<string, number> = {
    single: 200,
    combo: 300,
    "four-day-pass": 12000,
    workshop: 8000,
    competition: 5000,
  };

  let amount: number | null = null;
  if (rawTicketType && PRICE_BOOK[rawTicketType] != null) {
    amount = PRICE_BOOK[rawTicketType] * ticketCount;
    if (amountPerOrder != null && amountPerOrder !== amount) {
      res.status(400).json({ error: "Amount does not match ticket type pricing" });
      return;
    }
  } else if (amountPerOrder != null) {
    res.status(400).json({ error: "Unknown ticketType for amount" });
    return;
  }

  const qrToken = crypto.randomBytes(16).toString("hex");

  const [registration] = await db
    .insert(registrationsTable)
    .values({
      parentName,
      phone,
      email: email ?? null,
      ticketCount,
      eventDate,
      ticketType: rawTicketType,
      amount,
      qrToken,
    })
    .returning();

  if (registration.email) {
    sendConfirmationEmail(registration.id).catch((err) => {
      logger.error({ err, regId: registration.id }, "[Registration] confirmation email failed");
    });
  }

  res.status(201).json(registration);
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
