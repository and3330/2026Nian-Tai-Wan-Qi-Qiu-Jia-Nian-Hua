import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, socialMarketingAccounts, socialPosts, marketingAutomationSettings } from "@workspace/db";
import {
  getOAuthUrl,
  handleOAuthCallback,
  publishPost,
  startSocialScheduler,
  adaptContentForPlatform,
  PLATFORM_CHAR_LIMITS,
  generateOAuthState,
  verifyOAuthState,
} from "../services/social-service";

const router: IRouter = Router();

function requireAuth(req: any, res: any, ...roles: string[]): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (roles.length > 0 && !req.hasRole(...roles)) {
    res.status(403).json({ error: "權限不足", code: "FORBIDDEN" });
    return false;
  }
  return true;
}

router.get("/admin/social-accounts", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const accounts = await db.select({
    id: socialMarketingAccounts.id,
    platform: socialMarketingAccounts.platform,
    platformAccountId: socialMarketingAccounts.platformAccountId,
    accountName: socialMarketingAccounts.accountName,
    accountType: socialMarketingAccounts.accountType,
    profileImageUrl: socialMarketingAccounts.profileImageUrl,
    isActive: socialMarketingAccounts.isActive,
    tokenExpiresAt: socialMarketingAccounts.tokenExpiresAt,
    createdAt: socialMarketingAccounts.createdAt,
  }).from(socialMarketingAccounts).orderBy(desc(socialMarketingAccounts.createdAt));
  res.json(accounts);
});

router.get("/admin/social-accounts/oauth-url/:platform", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  try {
    const { platform } = req.params;
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/admin/social-accounts/oauth-callback/${platform}`;
    const state = generateOAuthState();
    const url = getOAuthUrl(platform, redirectUri, state);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/admin/social-accounts/oauth-callback/:platform", async (req, res): Promise<void> => {
  const { platform } = req.params;
  const { code, state } = req.query;
  if (!code) {
    res.status(400).send("Missing authorization code");
    return;
  }
  if (!state || !verifyOAuthState(state as string)) {
    res.status(403).send(`<html><body><p>授權失敗：無效的安全驗證，請重新操作。</p></body></html>`);
    return;
  }
  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/admin/social-accounts/oauth-callback/${platform}`;
    const result = await handleOAuthCallback(platform, code as string, redirectUri);

    for (const account of result.accounts) {
      await db.insert(socialMarketingAccounts).values({
        platform: account.platform || platform,
        platformAccountId: account.platformAccountId,
        accountName: account.accountName,
        accountType: account.accountType,
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        tokenExpiresAt: account.tokenExpiresAt,
        profileImageUrl: account.profileImageUrl,
        metadata: account.metadata,
      }).onConflictDoUpdate({
        target: [socialMarketingAccounts.platform, socialMarketingAccounts.platformAccountId],
        set: {
          accountName: account.accountName,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          tokenExpiresAt: account.tokenExpiresAt,
          profileImageUrl: account.profileImageUrl,
          metadata: account.metadata,
          updatedAt: new Date(),
        },
      });
    }

    res.send(`<html><body><script>window.close();window.opener?.postMessage("oauth-success","*");</script><p>授權成功！您可以關閉此視窗。</p></body></html>`);
  } catch (err) {
    res.status(500).send(`<html><body><p>授權失敗：${(err as Error).message}</p></body></html>`);
  }
});

router.delete("/admin/social-accounts/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const { id } = req.params;
  const [deleted] = await db.delete(socialMarketingAccounts).where(eq(socialMarketingAccounts.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Account not found" }); return; }
  res.sendStatus(204);
});

router.patch("/admin/social-accounts/:id/toggle", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const { id } = req.params;
  const [account] = await db.select().from(socialMarketingAccounts).where(eq(socialMarketingAccounts.id, id)).limit(1);
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  const [updated] = await db.update(socialMarketingAccounts).set({
    isActive: !account.isActive, updatedAt: new Date(),
  }).where(eq(socialMarketingAccounts.id, id)).returning();
  res.json(updated);
});

router.get("/admin/social-posts", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const posts = await db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt));
  res.json(posts);
});

router.post("/admin/social-posts", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const { content, platforms, hashtags, imageUrls, scheduledAt, status } = req.body;
  if (!content || !platforms?.length) {
    res.status(400).json({ error: "content and platforms are required" });
    return;
  }
  const postStatus = scheduledAt ? "scheduled" : (status || "draft");
  const [post] = await db.insert(socialPosts).values({
    content,
    platforms,
    hashtags: hashtags || null,
    imageUrls: imageUrls || [],
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    status: postStatus,
  }).returning();
  res.status(201).json(post);
});

router.patch("/admin/social-posts/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const { id } = req.params;
  const { content, platforms, hashtags, imageUrls, scheduledAt, status } = req.body;
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (content !== undefined) updateData.content = content;
  if (platforms !== undefined) updateData.platforms = platforms;
  if (hashtags !== undefined) updateData.hashtags = hashtags;
  if (imageUrls !== undefined) updateData.imageUrls = imageUrls;
  if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (status !== undefined) updateData.status = status;

  const [updated] = await db.update(socialPosts).set(updateData).where(eq(socialPosts.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(updated);
});

router.delete("/admin/social-posts/:id", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const { id } = req.params;
  const [deleted] = await db.delete(socialPosts).where(eq(socialPosts.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Post not found" }); return; }
  res.sendStatus(204);
});

router.post("/admin/social-posts/:id/publish", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const { id } = req.params;
  try {
    const result = await publishPost(id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/admin/social-posts/preview", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const { content, platforms, hashtags } = req.body;
  if (!content || !platforms?.length) {
    res.status(400).json({ error: "content and platforms are required" });
    return;
  }
  const previews: Record<string, { text: string; charCount: number; limit: number }> = {};
  for (const platform of platforms) {
    const adapted = adaptContentForPlatform(content, platform, hashtags);
    previews[platform] = {
      text: adapted,
      charCount: adapted.length,
      limit: PLATFORM_CHAR_LIMITS[platform] || 500,
    };
  }
  res.json(previews);
});

router.get("/admin/automation-settings", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const settings = await db.select().from(marketingAutomationSettings);
  res.json(settings);
});

router.put("/admin/automation-settings/:key", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const { key } = req.params;
  const { enabled, config } = req.body;

  const [existing] = await db.select().from(marketingAutomationSettings)
    .where(eq(marketingAutomationSettings.key, key)).limit(1);

  if (existing) {
    const [updated] = await db.update(marketingAutomationSettings).set({
      enabled: enabled !== undefined ? enabled : existing.enabled,
      config: config !== undefined ? config : existing.config,
      updatedAt: new Date(),
    }).where(eq(marketingAutomationSettings.key, key)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(marketingAutomationSettings).values({
      key,
      enabled: enabled || false,
      config: config || {},
    }).returning();
    res.status(201).json(created);
  }
});

startSocialScheduler();

export default router;
