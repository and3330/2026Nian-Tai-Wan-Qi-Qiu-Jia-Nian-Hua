import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  paymentRef: text("payment_ref").notNull(),
  invoiceType: text("invoice_type").notNull(),
  carrierType: text("carrier_type"),
  carrierNum: text("carrier_num"),
  taxId: text("tax_id"),
  companyTitle: text("company_title"),
  loveCode: text("love_code"),
  buyerName: text("buyer_name"),
  buyerEmail: text("buyer_email"),
  buyerPhone: text("buyer_phone"),
  buyerAddr: text("buyer_addr"),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: text("invoice_date"),
  randomNumber: text("random_number"),
  errorMessage: text("error_message"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
});

export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;
