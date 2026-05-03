import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const refundRequestsTable = pgTable(
  "refund_requests",
  {
    id: serial("id").primaryKey(),
    paymentRef: text("payment_ref").notNull(),
    buyerName: text("buyer_name").notNull(),
    buyerContact: text("buyer_contact").notNull(),
    reason: text("reason").notNull(),
    // pending | approved | rejected | rescheduled
    status: text("status").notNull().default("pending"),
    refundAmount: integer("refund_amount"),
    adminNote: text("admin_note"),
    processedBy: text("processed_by"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_refund_requests_status").on(table.status),
    index("idx_refund_requests_payment_ref").on(table.paymentRef),
  ],
);

export type RefundRequest = typeof refundRequestsTable.$inferSelect;
export type InsertRefundRequest = typeof refundRequestsTable.$inferInsert;
