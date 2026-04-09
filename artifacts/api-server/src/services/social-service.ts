import { db, socialMarketingAccounts, socialPosts, marketingAutomationSettings } from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import crypto from "crypto";

const oauthStateStore = new Map<string, { createdAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of oauthStateStore) {
    if (now - val.createdAt > 10 * 60 * 1000) oauthStateStore.delete(key);
  }
}, 60000);

export function generateOAuthState(): string {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStateStore.set(state, { createdAt: Date.now() });
  return state;
}

export function verifyOAuthState(state: string): boolean {
  if (!oauthStateStore.has(state)) return false;
  oauthStateStore.delete(state);
  return true;
}

export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  threads: 500,
  facebook: 5000,
  instagram: 2200,
};

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li>/gi, "・ ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function adaptContentForPlatform(content: string, platform: string, hashtags?: string): string {
  const limit = PLATFORM_CHAR_LIMITS[platform] || 500;
  let text = stripHtml(content);
  const hashtagStr = hashtags
    ? `\n\n${hashtags.split(",").map(t => t.trim()).filter(Boolean).map(t => t.startsWith("#") ? t : `#${t}`).join(" ")}`
    : "";
  const availableLen = limit - hashtagStr.length;
  if (text.length > availableLen) text = text.substring(0, availableLen - 3) + "...";
  return text + hashtagStr;
}

export function getOAuthUrl(platform: string, redirectUri: string, state: string): string {
  switch (platform) {
    case "facebook": {
      const appId = process.env.FACEBOOK_APP_ID;
      if (!appId) throw new Error("FACEBOOK_APP_ID not configured");
      const scopes = "pages_manage_posts,pages_read_engagement,pages_show_list,business_management";
      return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${state}`;
    }
    case "threads": {
      const appId = process.env.THREADS_APP_ID;
      if (!appId) throw new Error("THREADS_APP_ID not configured");
      const scopes = "threads_basic,threads_content_publish";
      return `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${state}`;
    }
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function handleOAuthCallback(
  platform: string, code: string, redirectUri: string
): Promise<{ accounts: Array<{
  platform: string;
  platformAccountId: string; accountName: string; accountType: string;
  accessToken: string; refreshToken?: string; tokenExpiresAt?: Date;
  profileImageUrl?: string; metadata?: any;
}> }> {
  switch (platform) {
    case "facebook": return handleFacebookCallback(code, redirectUri);
    case "threads": return handleThreadsCallback(code, redirectUri);
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function handleFacebookCallback(code: string, redirectUri: string) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Facebook app credentials not configured");

  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
  );
  const tokenData = await tokenRes.json() as any;
  if (tokenData.error) throw new Error(tokenData.error.message);

  const longTokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
  );
  const longTokenData = await longTokenRes.json() as any;
  const userToken = longTokenData.access_token || tokenData.access_token;
  const expiresIn = longTokenData.expires_in || 5184000;

  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture&access_token=${userToken}`
  );
  const pagesData = await pagesRes.json() as any;
  const accounts: any[] = [];

  if (pagesData.data) {
    for (const page of pagesData.data) {
      accounts.push({
        platform: "facebook",
        platformAccountId: page.id,
        accountName: page.name,
        accountType: "page",
        accessToken: page.access_token,
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        profileImageUrl: page.picture?.data?.url,
        metadata: { pageId: page.id },
      });

      try {
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,name,username,profile_picture_url}&access_token=${page.access_token}`
        );
        const igData = await igRes.json() as any;
        const ig = igData.instagram_business_account;
        if (ig) {
          accounts.push({
            platform: "instagram",
            platformAccountId: ig.id,
            accountName: ig.username || ig.name || `IG-${ig.id}`,
            accountType: "instagram_business",
            accessToken: page.access_token,
            tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
            profileImageUrl: ig.profile_picture_url,
            metadata: { igAccountId: ig.id, pageId: page.id },
          });
        }
      } catch {}
    }
  }
  return { accounts };
}

async function handleThreadsCallback(code: string, redirectUri: string) {
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appId || !appSecret) throw new Error("Threads credentials not configured");

  const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId, client_secret: appSecret,
      grant_type: "authorization_code", redirect_uri: redirectUri, code,
    }),
  });
  const tokenData = await tokenRes.json() as any;
  if (tokenData.error) throw new Error(tokenData.error_message || tokenData.error.message);

  const longTokenRes = await fetch(
    `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${appSecret}&access_token=${tokenData.access_token}`
  );
  const longTokenData = await longTokenRes.json() as any;
  const accessToken = longTokenData.access_token || tokenData.access_token;
  const expiresIn = longTokenData.expires_in || 5184000;

  const profileRes = await fetch(
    `https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`
  );
  const profile = await profileRes.json() as any;

  return {
    accounts: [{
      platform: "threads",
      platformAccountId: profile.id || tokenData.user_id,
      accountName: profile.username || `Threads-${profile.id}`,
      accountType: "threads",
      accessToken,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      profileImageUrl: profile.threads_profile_picture_url,
      metadata: { userId: profile.id },
    }],
  };
}

export async function refreshTokenIfNeeded(accountId: string): Promise<boolean> {
  const [account] = await db.select().from(socialMarketingAccounts)
    .where(eq(socialMarketingAccounts.id, accountId)).limit(1);
  if (!account || !account.tokenExpiresAt) return true;
  if (account.tokenExpiresAt.getTime() - Date.now() > 86400000) return true;

  try {
    if (account.platform === "threads") {
      const res = await fetch(
        `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${account.accessToken}`
      );
      const data = await res.json() as any;
      if (data.access_token) {
        await db.update(socialMarketingAccounts).set({
          accessToken: data.access_token,
          tokenExpiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
          updatedAt: new Date(),
        }).where(eq(socialMarketingAccounts.id, accountId));
        return true;
      }
    }
  } catch {}
  return false;
}

async function getAccountForPlatform(platform: string) {
  const accountType = platform === "instagram" ? "instagram_business" : undefined;
  const [account] = await db.select().from(socialMarketingAccounts).where(
    and(
      accountType
        ? eq(socialMarketingAccounts.accountType, accountType)
        : eq(socialMarketingAccounts.platform, platform),
      eq(socialMarketingAccounts.isActive, true)
    )
  ).limit(1);
  return account;
}

export async function publishToThreads(content: string, accountId?: string, imageUrl?: string) {
  let account;
  if (accountId) {
    [account] = await db.select().from(socialMarketingAccounts).where(eq(socialMarketingAccounts.id, accountId)).limit(1);
  } else {
    account = await getAccountForPlatform("threads");
  }
  if (!account) throw new Error("No Threads account connected");
  await refreshTokenIfNeeded(account.id);
  const [refreshed] = await db.select().from(socialMarketingAccounts).where(eq(socialMarketingAccounts.id, account.id)).limit(1);
  const token = refreshed?.accessToken || account.accessToken;
  const userId = (account.metadata as any)?.userId || account.platformAccountId;

  const createBody: any = { text: content, access_token: token };
  createBody.media_type = imageUrl ? "IMAGE" : "TEXT";
  if (imageUrl) createBody.image_url = imageUrl;

  const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createBody),
  });
  const createData = await createRes.json() as any;
  if (createData.error) throw new Error(`Threads: ${createData.error.message}`);

  const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createData.id, access_token: token }),
  });
  const publishData = await publishRes.json() as any;
  if (publishData.error) throw new Error(`Threads publish: ${publishData.error.message}`);
  return { postId: publishData.id, platform: "threads" };
}

export async function publishToFacebook(content: string, accountId?: string, imageUrl?: string) {
  let account;
  if (accountId) {
    [account] = await db.select().from(socialMarketingAccounts).where(eq(socialMarketingAccounts.id, accountId)).limit(1);
  } else {
    account = await getAccountForPlatform("facebook");
  }
  if (!account) throw new Error("No Facebook page connected");
  const pageId = (account.metadata as any)?.pageId || account.platformAccountId;

  if (imageUrl) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrl, message: content, access_token: account.accessToken }),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(`Facebook: ${data.error.message}`);
    return { postId: data.id || data.post_id, platform: "facebook" };
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: content, access_token: account.accessToken }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`Facebook: ${data.error.message}`);
  return { postId: data.id, platform: "facebook" };
}

export async function publishToInstagram(content: string, accountId?: string, imageUrl?: string) {
  let account;
  if (accountId) {
    [account] = await db.select().from(socialMarketingAccounts).where(eq(socialMarketingAccounts.id, accountId)).limit(1);
  } else {
    account = await getAccountForPlatform("instagram");
  }
  if (!account) throw new Error("No Instagram business account connected");
  if (!imageUrl) throw new Error("Instagram requires an image");
  const igAccountId = (account.metadata as any)?.igAccountId || account.platformAccountId;

  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption: content, access_token: account.accessToken }),
  });
  const createData = await createRes.json() as any;
  if (createData.error) throw new Error(`Instagram: ${createData.error.message}`);

  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createData.id, access_token: account.accessToken }),
  });
  const publishData = await publishRes.json() as any;
  if (publishData.error) throw new Error(`Instagram publish: ${publishData.error.message}`);
  return { postId: publishData.id, platform: "instagram" };
}

const publishFnMap: Record<string, Function> = {
  threads: publishToThreads,
  facebook: publishToFacebook,
  instagram: publishToInstagram,
};

async function getAutoHashtags(): Promise<string | null> {
  try {
    const [setting] = await db.select().from(marketingAutomationSettings)
      .where(eq(marketingAutomationSettings.key, "auto_hashtag")).limit(1);
    if (setting?.enabled && (setting.config as any)?.default_hashtags) {
      return (setting.config as any).default_hashtags;
    }
  } catch {}
  return null;
}

export async function publishPost(postId: string) {
  const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId)).limit(1);
  if (!post) throw new Error("Post not found");
  const imageUrl = post.imageUrls?.length ? post.imageUrls[0] : undefined;
  const results: Record<string, any> = {};
  const errors: string[] = [];

  let hashtags = post.hashtags || "";
  const autoHashtags = await getAutoHashtags();
  if (autoHashtags) {
    hashtags = hashtags ? `${hashtags},${autoHashtags}` : autoHashtags;
  }

  for (const platform of post.platforms) {
    const publishFn = publishFnMap[platform];
    if (!publishFn) { errors.push(`${platform}: Unsupported`); continue; }
    try {
      const adapted = adaptContentForPlatform(post.content, platform, hashtags || undefined);
      const result = await publishFn(adapted, undefined, imageUrl);
      results[platform] = { success: true, postId: result.postId };
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`${platform}: ${msg}`);
      results[platform] = { success: false, error: msg };
    }
  }

  const allFailed = Object.values(results).every((r: any) => !r.success);
  await db.update(socialPosts).set({
    status: allFailed ? "failed" : "published",
    publishedAt: allFailed ? undefined : new Date(),
    platformResults: results,
    errorMessage: errors.length ? errors.join("; ") : null,
    updatedAt: new Date(),
  }).where(eq(socialPosts.id, postId));

  return { results, errors };
}

async function isSchedulerEnabled(): Promise<boolean> {
  try {
    const [setting] = await db.select().from(marketingAutomationSettings)
      .where(eq(marketingAutomationSettings.key, "auto_scheduler")).limit(1);
    return setting?.enabled ?? true;
  } catch { return true; }
}

export async function processScheduledPosts() {
  const enabled = await isSchedulerEnabled();
  if (!enabled) return 0;

  const now = new Date();
  const pending = await db.select().from(socialPosts)
    .where(and(eq(socialPosts.status, "scheduled"), lte(socialPosts.scheduledAt, now)))
    .limit(10);

  for (const post of pending) {
    try {
      await publishPost(post.id);
    } catch (err) {
      await db.update(socialPosts).set({
        status: "failed", errorMessage: (err as Error).message, updatedAt: new Date(),
      }).where(eq(socialPosts.id, post.id));
    }
  }
  return pending.length;
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
export function startSocialScheduler() {
  if (schedulerInterval) return;
  console.log("[Social] Scheduler started (every 60s)");
  schedulerInterval = setInterval(async () => {
    try { await processScheduledPosts(); } catch {}
  }, 60000);
}
