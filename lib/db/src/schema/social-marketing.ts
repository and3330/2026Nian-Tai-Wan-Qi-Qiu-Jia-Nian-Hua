import { pgTable, uuid, text, boolean, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const socialMarketingAccounts = pgTable("social_marketing_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull(),
  platformAccountId: text("platform_account_id").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull().default("page"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  profileImageUrl: text("profile_image_url"),
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_sma_platform").on(table.platform),
  unique("uq_sma_platform_account").on(table.platform, table.platformAccountId),
]);

export const socialPosts = pgTable("social_posts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  platforms: text("platforms").array().notNull().default(sql`ARRAY[]::text[]`),
  hashtags: text("hashtags"),
  imageUrls: text("image_urls").array().default(sql`ARRAY[]::text[]`),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  status: text("status").notNull().default("draft"),
  platformResults: jsonb("platform_results"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_social_posts_status").on(table.status),
  index("idx_social_posts_scheduled").on(table.scheduledAt),
]);

export const marketingAutomationSettings = pgTable("marketing_automation_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SocialMarketingAccount = typeof socialMarketingAccounts.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type MarketingAutomationSetting = typeof marketingAutomationSettings.$inferSelect;
