import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, registrationsTable } from "@workspace/db";
import {
  CreateRegistrationBody,
  GetRegistrationAvailabilityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const EVENT_DATES = ["2026-07-14", "2026-07-15", "2026-07-16"];
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
  const parsed = CreateRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { parentName, phone, ticketCount, eventDate } = parsed.data;

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

  const [registration] = await db
    .insert(registrationsTable)
    .values({ parentName, phone, ticketCount, eventDate })
    .returning();

  res.status(201).json(registration);
});

export default router;
