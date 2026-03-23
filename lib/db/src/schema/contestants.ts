import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contestantsTable = pgTable("contestants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  score: integer("score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContestantSchema = createInsertSchema(contestantsTable).omit({ id: true, createdAt: true });
export type InsertContestant = z.infer<typeof insertContestantSchema>;
export type Contestant = typeof contestantsTable.$inferSelect;
