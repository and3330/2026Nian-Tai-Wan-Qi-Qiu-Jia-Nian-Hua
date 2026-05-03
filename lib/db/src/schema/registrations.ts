import { pgTable, serial, text, integer, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const registrationsTable = pgTable(
  "registrations",
  {
    id: serial("id").primaryKey(),
    parentName: text("parent_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    ticketCount: integer("ticket_count").notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    ticketType: text("ticket_type"),
    amount: integer("amount"),
    paymentMethod: text("payment_method"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    paymentRef: text("payment_ref"),
    promoCode: text("promo_code"),
    discountAmount: integer("discount_amount"),
    qrToken: text("qr_token").unique(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at", { withTimezone: true }),
    weekReminderSentAt: timestamp("week_reminder_sent_at", { withTimezone: true }),
    dayReminderSentAt: timestamp("day_reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_registrations_event_date").on(table.eventDate),
    index("idx_registrations_qr_token").on(table.qrToken),
  ],
);

export const insertRegistrationSchema = createInsertSchema(registrationsTable).omit({
  id: true,
  createdAt: true,
  qrToken: true,
  checkedInAt: true,
  confirmationEmailSentAt: true,
  weekReminderSentAt: true,
  dayReminderSentAt: true,
});
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;
