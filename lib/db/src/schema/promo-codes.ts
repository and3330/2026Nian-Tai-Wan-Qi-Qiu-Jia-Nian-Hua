import { pgTable, serial, text, integer, boolean, timestamp, date, index } from "drizzle-orm/pg-core";

export const promoCodesTable = pgTable(
  "promo_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    description: text("description"),
    discountType: text("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    appliesTo: text("applies_to"),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    validFrom: date("valid_from", { mode: "string" }),
    validUntil: date("valid_until", { mode: "string" }),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [index("idx_promo_codes_code").on(table.code)],
);

export type PromoCode = typeof promoCodesTable.$inferSelect;
export type InsertPromoCode = typeof promoCodesTable.$inferInsert;
