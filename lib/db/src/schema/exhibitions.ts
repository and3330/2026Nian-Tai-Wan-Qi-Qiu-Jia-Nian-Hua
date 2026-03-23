import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exhibitionsTable = pgTable("exhibitions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  openTime: text("open_time").notNull(),
  closeTime: text("close_time").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExhibitionSchema = createInsertSchema(exhibitionsTable).omit({ id: true, createdAt: true });
export type InsertExhibition = z.infer<typeof insertExhibitionSchema>;
export type Exhibition = typeof exhibitionsTable.$inferSelect;
