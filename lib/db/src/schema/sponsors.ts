import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sponsorsTable = pgTable("sponsors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").notNull(),
  websiteUrl: text("website_url").notNull(),
  tier: text("tier", { enum: ["platinum", "gold", "silver", "bronze"] }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSponsorSchema = createInsertSchema(sponsorsTable).omit({ id: true, createdAt: true });
export type InsertSponsor = z.infer<typeof insertSponsorSchema>;
export type Sponsor = typeof sponsorsTable.$inferSelect;
