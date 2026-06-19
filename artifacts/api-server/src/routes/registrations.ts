import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import QRCode from "qrcode";
import { db, registrationsTable } from "@workspace/db";
import { GetRegistrationAvailabilityResponse } from "@workspace/api-zod";
import { sendConfirmationEmail } from "../services/email-service";
import { logger } from "../lib/logger";
import { applyPromoInTx, normalizeCode } from "../lib/promo-codes";

const router: IRouter = Router();

type CreateRegistrationInput = {
  parentName: string;
  phone: string;
  email?: string | null;
  // Total heads admitted by this order (adults + children + infants). Capacity
  // counts this — infants under 1 占名額 but pay nothing.
  ticketCount: number;
  // How many of the heads are children (同票價). adults = ticketCount - childCount - infantCount.
  childCount: number;
  // How many of the heads are infants under 1 year — free admission.
  infantCount: number;
  eventDate: string;
};

function parseRegistrationBody(body: any): { ok: true; data: CreateRegistrationInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { parentName, phone, email, eventDate } = body;
  if (typeof parentName !== "string" || !parentName.trim()) return { ok: false, error: "parentName is required" };
  if (typeof phone !== "string" || !phone.trim()) return { ok: false, error: "phone is required" };
  if (email != null && (typeof email !== "string" || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))))
    return { ok: false, error: "email format is invalid" };

  // Headcount: prefer the explicit adult/child split; fall back to a legacy
  // `ticketCount` (treated as all adults) for older clients. Every order needs
  // at least one adult; children (未滿 6 歲) may not buy on their own.
  const rawAdult = body.adultCount;
  const adultCount =
    typeof rawAdult === "number"
      ? rawAdult
      : typeof body.ticketCount === "number"
        ? body.ticketCount
        : NaN;
  const childCount = typeof body.childCount === "number" ? body.childCount : 0;
  const infantCount = typeof body.infantCount === "number" ? body.infantCount : 0;
  if (!Number.isInteger(adultCount) || adultCount < 1) return { ok: false, error: "每筆訂單至少需要 1 位大人" };
  if (!Number.isInteger(childCount) || childCount < 0) return { ok: false, error: "childCount is invalid" };
  if (!Number.isInteger(infantCount) || infantCount < 0) return { ok: false, error: "infantCount is invalid" };
  const ticketCount = adultCount + childCount + infantCount;
  if (ticketCount < 1 || ticketCount > 10) return { ok: false, error: "總人數需介於 1 到 10 人之間" };

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
      childCount,
      infantCount,
      eventDate: eventDateStr,
    },
  };
}

const EVENT_DATES = ["2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"];
const DEFAULT_DAILY_CAPACITY = 500;
// Per-date overrides — 7/24 and 7/25 hold 1000 people each; other days fall
// back to the default capacity.
const DATE_CAPACITY: Record<string, number> = {
  "2026-07-24": 1000,
  "2026-07-25": 1000,
};
function capacityForDate(date: string): number {
  return DATE_CAPACITY[date] ?? DEFAULT_DAILY_CAPACITY;
}

// Only PAID registrations consume a seat. Unpaid orders (pending /
// awaiting_transfer) do NOT count toward the daily headcount shown on the
// home page or toward the sold-out check, so an abandoned checkout never
// blocks a real buyer.
const isPaidLeg = sql`${registrationsTable.paymentStatus} = 'paid'`;

// 戰鬥陀螺賽（線上報名）— a separate inventory from the 500-per-day carnival
// admission. Tournament rows live on 7/26 too, but are counted independently so
// they neither consume nor are blocked by the general 500 daily capacity.
const TOURNAMENT_DATE = "2026-07-26";
const TOURNAMENT_CAPACITY = 128;
const TOURNAMENT_PARTICIPANT_TYPE = "tournament";
const TOURNAMENT_COMPANION_TYPE = "tournament-companion";

// SQL fragment: a row belongs to the general carnival inventory (i.e. it is NOT
// a tournament participant/companion leg). Used everywhere the 500-per-day cap
// is computed so tournament sales stay isolated.
const isCarnivalLeg = sql`(${registrationsTable.ticketType} IS NULL OR ${registrationsTable.ticketType} NOT IN (${TOURNAMENT_PARTICIPANT_TYPE}, ${TOURNAMENT_COMPANION_TYPE}))`;

async function getDateCounts(): Promise<Record<string, number>> {
  // Refunded registrations release their seats back to inventory.
  const rows = await db
    .select({
      eventDate: registrationsTable.eventDate,
      total: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)`,
    })
    .from(registrationsTable)
    .where(sql`${isPaidLeg} AND ${isCarnivalLeg}`)
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
    const totalCapacity = capacityForDate(date);
    return {
      date: new Date(date),
      totalCapacity,
      registered,
      remaining: Math.max(0, totalCapacity - registered),
    };
  });
  res.json(GetRegistrationAvailabilityResponse.parse(availability));
});

// Adult (滿 6 歲以上) prices.
const PRICE_BOOK: Record<string, number> = {
  single: 200,
  combo: 300,
  "four-day-pass": 12000,
  workshop: 8000,
  competition: 5000,
  // 戰鬥陀螺賽：參賽者本人（含 7/26 入場 QR）600、隨同一般門票 200。
  tournament: 600,
  "tournament-companion": 200,
};

// Children pay the same price as adults — no child discount. Kept as an
// (empty) override map so any future per-type child pricing can be reintroduced
// here; absent types fall back to the adult price for every head.
const CARNIVAL_CHILD_PRICE: Record<string, number> = {};

function resolveAmount(
  rawTicketType: string | null,
  ticketCount: number,
  childCount: number,
  infantCount: number,
  amountPerOrder: number | null,
): { ok: true; ticketType: string | null; amount: number | null } | { ok: false; error: string } {
  let amount: number | null = null;
  if (rawTicketType && PRICE_BOOK[rawTicketType] != null) {
    const adultPrice = PRICE_BOOK[rawTicketType];
    const childPrice = CARNIVAL_CHILD_PRICE[rawTicketType] ?? adultPrice;
    const children = childCount ?? 0;
    const infants = infantCount ?? 0;
    const adults = ticketCount - children - infants;
    if (adults < 0) return { ok: false, error: "childCount/infantCount exceeds total tickets" };
    // Infants under 1 are free; only adults + children are charged.
    amount = adultPrice * adults + childPrice * children;
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
    .where(sql`${registrationsTable.eventDate} = ${date} AND ${isPaidLeg} AND ${isCarnivalLeg}`);
  return Number(row?.total ?? 0);
}

// Counts confirmed-or-pending tournament participants (the 600-tier "本人"
// legs). Companion general tickets do NOT consume the 128-slot competitor cap.
async function countTournamentParticipants(tx: DbExecutor | typeof db): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`COALESCE(SUM(${registrationsTable.ticketCount}), 0)` })
    .from(registrationsTable)
    .where(
      sql`${registrationsTable.ticketType} = ${TOURNAMENT_PARTICIPANT_TYPE} AND ${registrationsTable.paymentStatus} <> 'refunded'`,
    );
  return Number(row?.total ?? 0);
}

router.post("/registrations", async (req, res): Promise<void> => {
  const parsed = parseRegistrationBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const { parentName, phone, email, ticketCount, childCount, infantCount, eventDate } = parsed.data;

  if (!EVENT_DATES.includes(eventDate)) {
    res.status(400).json({ error: "Invalid event date" });
    return;
  }

  const rawTicketType = typeof req.body?.ticketType === "string" ? req.body.ticketType.trim() : null;
  const rawAmount = req.body?.amount;
  const amountPerOrder = typeof rawAmount === "number" && Number.isFinite(rawAmount) ? Math.round(rawAmount) : null;
  const priced = resolveAmount(rawTicketType, ticketCount, childCount, infantCount, amountPerOrder);
  if (!priced.ok) {
    res.status(400).json({ error: priced.error });
    return;
  }

  const qrToken = crypto.randomBytes(16).toString("hex");
  const rawPromoCode = normalizeCode(req.body?.promoCode);

  try {
    const result = await db.transaction(async (tx) => {
      await lockDate(tx, eventDate);
      const currentCount = await countForDate(tx, eventDate);
      const cap = capacityForDate(eventDate);
      const remaining = Math.max(0, cap - currentCount);
      if (currentCount + ticketCount > cap) {
        return { soldOut: true as const, remaining, date: eventDate };
      }

      let finalAmount = priced.amount;
      let promoCode: string | null = null;
      let discountAmount: number | null = null;
      if (rawPromoCode && priced.amount != null && priced.amount > 0) {
        const promoResult = await applyPromoInTx(tx, {
          code: rawPromoCode,
          baseAmount: priced.amount,
          ticketType: priced.ticketType,
        });
        if (!promoResult.ok) {
          return { promoFail: true as const, error: promoResult.error, code: promoResult.code };
        }
        finalAmount = promoResult.finalAmount;
        promoCode = promoResult.code;
        discountAmount = promoResult.discountAmount;
      }

      const [reg] = await tx
        .insert(registrationsTable)
        .values({
          parentName,
          phone,
          email: email ?? null,
          ticketCount,
          childCount,
          infantCount,
          eventDate,
          ticketType: priced.ticketType,
          amount: finalAmount,
          promoCode,
          discountAmount,
          qrToken,
        })
        .returning();
      return { soldOut: false as const, registration: reg };
    });

    if ("promoFail" in result && result.promoFail) {
      res.status(400).json({ error: result.error, code: result.code ?? "PROMO_INVALID" });
      return;
    }

    if (result.soldOut) {
      res.status(409).json({
        error: `${result.date} 票券已售完，剩餘 ${result.remaining} 張`,
        code: "SOLD_OUT",
        eventDate: result.date,
        remaining: result.remaining,
      });
      return;
    }

    // Only free orders get the confirmation (with entry QR) at creation time.
    // Paid orders receive it after payment is confirmed (see markPaymentPaid).
    if (result.registration.email && (result.registration.amount ?? 0) <= 0) {
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
  const { parentName, phone, email, ticketCount, childCount, infantCount } = baseParsed.data;

  const rawTicketType = typeof body.ticketType === "string" ? (body.ticketType as string).trim() : null;
  const rawAmount = body.amount;
  const amountPerOrder = typeof rawAmount === "number" && Number.isFinite(rawAmount) ? Math.round(rawAmount) : null;
  const priced = resolveAmount(rawTicketType, ticketCount, childCount, infantCount, amountPerOrder);
  if (!priced.ok) {
    res.status(400).json({ error: priced.error });
    return;
  }

  const rawPromoCode = normalizeCode(body.promoCode);

  try {
    const result = await db.transaction(async (tx) => {
      // Always lock dates in sorted order to prevent deadlocks between
      // concurrent transactions that touch overlapping dates.
      const sortedDates = [...normalizedDates].sort();
      for (const d of sortedDates) await lockDate(tx, d);

      for (const d of normalizedDates) {
        const count = await countForDate(tx, d);
        const cap = capacityForDate(d);
        if (count + ticketCount > cap) {
          return { soldOut: true as const, date: d, remaining: Math.max(0, cap - count) };
        }
      }

      let finalAmount = priced.amount;
      let promoCode: string | null = null;
      let discountAmount: number | null = null;
      if (rawPromoCode && priced.amount != null && priced.amount > 0) {
        const promoResult = await applyPromoInTx(tx, {
          code: rawPromoCode,
          baseAmount: priced.amount,
          ticketType: priced.ticketType,
        });
        if (!promoResult.ok) {
          return { promoFail: true as const, error: promoResult.error, code: promoResult.code };
        }
        finalAmount = promoResult.finalAmount;
        promoCode = promoResult.code;
        discountAmount = promoResult.discountAmount;
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
            childCount,
            infantCount,
            eventDate: d,
            // Only the first leg carries the ticketType + amount so the
            // payment total isn't double-counted.
            ticketType: i === 0 ? priced.ticketType : null,
            amount: i === 0 ? finalAmount : null,
            promoCode: i === 0 ? promoCode : null,
            discountAmount: i === 0 ? discountAmount : null,
            qrToken,
          })
          .returning();
        inserted.push(reg);
      }
      return { soldOut: false as const, registrations: inserted };
    });

    if ("promoFail" in result && result.promoFail) {
      res.status(400).json({ error: result.error, code: result.code ?? "PROMO_INVALID" });
      return;
    }

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
    // Free combos get the confirmation now; paid combos after payment is confirmed.
    if (head?.email && (head.amount ?? 0) <= 0) {
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

// Remaining online slots for the 戰鬥陀螺賽 (128-competitor cap, isolated from
// the 500/day carnival admission).
router.get("/registrations/tournament/availability", async (req, res): Promise<void> => {
  const registered = await countTournamentParticipants(db);
  const remaining = Math.max(0, TOURNAMENT_CAPACITY - registered);
  res.json({
    capacity: TOURNAMENT_CAPACITY,
    registered,
    remaining,
    soldOut: remaining <= 0,
  });
});

// Atomic 戰鬥陀螺賽 order: one row per participant ("本人", 600, own 7/26 entry
// QR) and one row per companion ("隨同一般門票", 200). All legs share a paymentRef
// once payment is initiated. The 128-competitor cap is enforced under a per-key
// advisory lock so concurrent buyers serialize. Tournament orders are always
// paid online — confirmation + QR emails are sent after payment (markPaymentPaid).
router.post("/registrations/tournament", async (req, res): Promise<void> => {
  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : null;
  if (!body) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const parentName = typeof body.parentName === "string" ? body.parentName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!parentName) {
    res.status(400).json({ error: "parentName is required" });
    return;
  }
  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }
  const emailRaw = body.email;
  if (typeof emailRaw !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw.trim())) {
    res.status(400).json({ error: "email is required and must be valid" });
    return;
  }
  const email = emailRaw.trim();

  // Two purchase paths share this endpoint:
  //  - "participant": the registrant competes (1 own entry, 600) and may add N
  //    companion/spectator tickets. Consumes one slot of the 128 participant cap.
  //  - "spectator": companion/observer-only purchase of N general entry tickets.
  //    Independent of the 128 cap (and of the carnival 500/day cap).
  const mode = body.mode === "spectator" ? "spectator" : body.mode === "participant" ? "participant" : null;
  if (!mode) {
    res.status(400).json({ error: "mode must be 'participant' or 'spectator'" });
    return;
  }
  const companionCount = body.companionCount == null ? 0 : Number(body.companionCount);
  const minCompanions = mode === "spectator" ? 1 : 0;
  if (!Number.isInteger(companionCount) || companionCount < minCompanions || companionCount > 20) {
    res.status(400).json({
      error: `companionCount must be between ${minCompanions} and 20`,
    });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const inserted: Array<typeof registrationsTable.$inferSelect> = [];

      // Participant leg: own entry. Serialize with an advisory lock and re-count
      // inside the txn so the 128 cap cannot be oversold under concurrency.
      if (mode === "participant") {
        await lockDate(tx, "tournament");
        const current = await countTournamentParticipants(tx);
        if (current + 1 > TOURNAMENT_CAPACITY) {
          return { soldOut: true as const, remaining: Math.max(0, TOURNAMENT_CAPACITY - current) };
        }
        const [reg] = await tx
          .insert(registrationsTable)
          .values({
            parentName,
            phone,
            email,
            ticketCount: 1,
            eventDate: TOURNAMENT_DATE,
            ticketType: TOURNAMENT_PARTICIPANT_TYPE,
            amount: PRICE_BOOK[TOURNAMENT_PARTICIPANT_TYPE],
            qrToken: crypto.randomBytes(16).toString("hex"),
          })
          .returning();
        inserted.push(reg);
      }

      // Companion/spectator leg: a SINGLE row with ticketCount = N carrying one
      // QR that admits N people (matches the existing single-ticket model). The
      // amount is the full N × unit price; payment sums per-leg amounts.
      if (companionCount > 0) {
        const [reg] = await tx
          .insert(registrationsTable)
          .values({
            parentName,
            phone,
            email,
            ticketCount: companionCount,
            eventDate: TOURNAMENT_DATE,
            ticketType: TOURNAMENT_COMPANION_TYPE,
            amount: PRICE_BOOK[TOURNAMENT_COMPANION_TYPE] * companionCount,
            qrToken: crypto.randomBytes(16).toString("hex"),
          })
          .returning();
        inserted.push(reg);
      }

      return { soldOut: false as const, registrations: inserted };
    });

    if (result.soldOut) {
      res.status(409).json({
        error: `戰鬥陀螺賽參賽名額已額滿，剩餘 ${result.remaining} 個名額`,
        code: "SOLD_OUT",
        remaining: result.remaining,
      });
      return;
    }

    res.status(201).json({ registrations: result.registrations });
  } catch (err) {
    logger.error({ err }, "[Registration] tournament create failed");
    res.status(500).json({ error: "戰鬥陀螺賽報名建立失敗，請稍後再試" });
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
