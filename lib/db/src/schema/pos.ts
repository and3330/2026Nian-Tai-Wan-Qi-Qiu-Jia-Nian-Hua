import { pgTable, serial, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

// 攤位商品目錄 — vendor_id null 代表主辦方自己的商品（工作人員收款用）。
export const productsTable = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    vendorId: integer("vendor_id"),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_products_vendor").on(table.vendorId)],
);

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;

// 現場 POS 訂單 — 付款在場外完成（現金或客人自己的支付方式），這裡只記錄
// 「用什麼方式收了多少錢、買了什麼」。發票可當場或事後由訂單開立，
// paymentRef 沿用 POS-<regId>-<timestamp> 慣例，與 invoices 表以字串關聯。
export type PosOrderItem = {
  productId: number;
  name: string;
  unitPrice: number;
  qty: number;
};

export const posOrdersTable = pgTable(
  "pos_orders",
  {
    id: serial("id").primaryKey(),
    paymentRef: text("payment_ref").notNull().unique(),
    vendorId: integer("vendor_id"),
    registrationId: integer("registration_id").notNull(),
    buyerName: text("buyer_name"),
    buyerPhone: text("buyer_phone"),
    buyerEmail: text("buyer_email"),
    items: jsonb("items").$type<PosOrderItem[]>().notNull(),
    totalAmount: integer("total_amount").notNull(),
    // cash | credit_card | online | apple_pay
    paymentMethod: text("payment_method").notNull(),
    invoiceId: integer("invoice_id"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_pos_orders_vendor").on(table.vendorId),
    index("idx_pos_orders_registration").on(table.registrationId),
  ],
);

export type PosOrder = typeof posOrdersTable.$inferSelect;
export type InsertPosOrder = typeof posOrdersTable.$inferInsert;
