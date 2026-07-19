import { pgTable, serial, text, integer, boolean, date, timestamp, index } from "drizzle-orm/pg-core";
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
    childCount: integer("child_count").notNull().default(0),
    infantCount: integer("infant_count").notNull().default(0),
    isVip: boolean("is_vip").notNull().default(false),
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
    // Heads admitted so far (partial check-in): a multi-person ticket may be
    // checked in across several scans until it reaches ticketCount.
    checkedInCount: integer("checked_in_count").notNull().default(0),
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
  checkedInCount: true,
  confirmationEmailSentAt: true,
  weekReminderSentAt: true,
  dayReminderSentAt: true,
});
export type InsertRegistration = z.infer<typeof insertRegistrationSchema>;
export type Registration = typeof registrationsTable.$inferSelect;
