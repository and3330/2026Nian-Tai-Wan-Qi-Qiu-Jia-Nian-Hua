import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

// 攤位商家 — on-site booth vendors. Each vendor can have its own admin account
// (admin_users.vendor_id) so booth staff log in, issue POS invoices, and see
// only their own sales totals. Editors/owner see all vendors and a revenue
// report per vendor.
export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  boothNumber: text("booth_number"),
  contact: text("contact"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Vendor = typeof vendorsTable.$inferSelect;
export type InsertVendor = typeof vendorsTable.$inferInsert;
