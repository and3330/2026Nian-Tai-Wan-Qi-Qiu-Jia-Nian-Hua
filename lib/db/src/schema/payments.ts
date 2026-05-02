import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  paymentRef: text("payment_ref").notNull().unique(),
  provider: text("provider").notNull(),
  providerOrderNo: text("provider_order_no"),
  providerTradeNo: text("provider_trade_no"),
  amount: integer("amount").notNull(),
  itemName: text("item_name").notNull(),
  payerEmail: text("payer_email"),
  status: text("status").notNull().default("pending"),
  rawResult: jsonb("raw_result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
