import { db, registrationsTable } from "@workspace/db";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  buildRegistrationVars,
  getTemplate,
  renderTemplate,
  sendEmail,
} from "./email-service";

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // hourly

function daysBetween(from: Date, toIso: string): number {
  const target = new Date(`${toIso}T00:00:00Z`).getTime();
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((target - start) / (24 * 60 * 60 * 1000));
}

export async function processReminders(now: Date = new Date()): Promise<{ week: number; day: number }> {
  const candidates = await db
    .select()
    .from(registrationsTable)
    .where(and(isNotNull(registrationsTable.email), isNotNull(registrationsTable.qrToken)));

  let weekSent = 0;
  let daySent = 0;

  for (const reg of candidates) {
    const days = daysBetween(now, reg.eventDate);
    const vars = buildRegistrationVars(reg);

    if (days === 7 && !reg.weekReminderSentAt) {
      try {
        const tpl = await getTemplate("week_reminder");
        const result = await sendEmail({
          to: reg.email!,
          subject: renderTemplate(tpl.subject, vars),
          body: renderTemplate(tpl.body, vars),
          qrImageUrl: vars.qrUrl,
        });
        if (result.delivered) {
          await db
            .update(registrationsTable)
            .set({ weekReminderSentAt: new Date() })
            .where(eq(registrationsTable.id, reg.id));
          weekSent++;
        }
      } catch (err) {
        logger.error({ err, regId: reg.id }, "[Reminder] week reminder failed");
      }
    }

    if (days === 1 && !reg.dayReminderSentAt) {
      try {
        const tpl = await getTemplate("day_reminder");
        const result = await sendEmail({
          to: reg.email!,
          subject: renderTemplate(tpl.subject, vars),
          body: renderTemplate(tpl.body, vars),
          qrImageUrl: vars.qrUrl,
        });
        if (result.delivered) {
          await db
            .update(registrationsTable)
            .set({ dayReminderSentAt: new Date() })
            .where(eq(registrationsTable.id, reg.id));
          daySent++;
        }
      } catch (err) {
        logger.error({ err, regId: reg.id }, "[Reminder] day reminder failed");
      }
    }
  }

  if (weekSent > 0 || daySent > 0) {
    logger.info({ weekSent, daySent }, "[Reminder] Sent reminder batch");
  }

  return { week: weekSent, day: daySent };
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler(): void {
  if (reminderInterval) return;
  logger.info("[Reminder] Scheduler started (hourly)");
  // Run once on start (delayed so DB seeding completes)
  setTimeout(() => {
    processReminders().catch((err) => logger.error({ err }, "[Reminder] initial run failed"));
  }, 5_000);
  reminderInterval = setInterval(() => {
    processReminders().catch((err) => logger.error({ err }, "[Reminder] tick failed"));
  }, REMINDER_INTERVAL_MS);
}

export function stopReminderScheduler(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

// Suppress unused-import warning for isNull (kept for future use cases)
void isNull;
