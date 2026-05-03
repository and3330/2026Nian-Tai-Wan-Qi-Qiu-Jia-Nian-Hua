import { db, emailTemplatesTable, registrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

export type EmailMode = "resend" | "console";

export const EMAIL_TEMPLATE_KEYS = ["confirmation", "week_reminder", "day_reminder"] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

const DEFAULT_TEMPLATES: Record<EmailTemplateKey, { subject: string; body: string }> = {
  confirmation: {
    subject: "【2026 臺灣氣球嘉年華】購票成功確認 - {{parentName}}",
    body: `親愛的 {{parentName}} 您好，

感謝您購買 2026 臺灣氣球嘉年華的入場票券！您的訂單已確認。

═══════════════════════════════════
🎫 票券資訊
═══════════════════════════════════
姓名：{{parentName}}
聯絡電話：{{phone}}
入場日期：{{eventDate}}
票數：{{ticketCount}} 張

📍 活動地點：臺北瓶蓋工廠（南港）
🕒 開放時間：10:00 起

═══════════════════════════════════
📱 您的報到 QR Code
═══════════════════════════════════
請於入場時出示以下 QR Code 進行報到：

{{qrUrl}}

(也可保存連結或直接出示本封 email)

如有任何問題，請洽服務專線 02-2720-8889。

期待與您相見！
2026 臺灣氣球嘉年華 主辦團隊
`,
  },
  week_reminder: {
    subject: "【提醒】2026 臺灣氣球嘉年華還有 7 天 - {{eventDate}}",
    body: `親愛的 {{parentName}} 您好，

距離您報名的 2026 臺灣氣球嘉年華 還有 7 天！

📅 入場日期：{{eventDate}}
📍 活動地點：臺北瓶蓋工廠（南港）
🎫 票數：{{ticketCount}} 張

請記得保存好您的報到 QR Code：
{{qrUrl}}

精彩活動等您一起來體驗！
2026 臺灣氣球嘉年華 主辦團隊
`,
  },
  day_reminder: {
    subject: "【明日入場】2026 臺灣氣球嘉年華 - {{eventDate}}",
    body: `親愛的 {{parentName}} 您好，

明天就是 2026 臺灣氣球嘉年華的活動日！

📅 入場日期：{{eventDate}}
📍 活動地點：臺北瓶蓋工廠（南港）
🕒 開放時間：10:00 起
🎫 票數：{{ticketCount}} 張

請於入場時出示報到 QR Code：
{{qrUrl}}

🔔 入場小提醒：
• 建議提早 15 分鐘抵達
• 請攜帶身分證明文件
• 6 歲以下兒童可免票隨大人入場

期待明日與您相見！
2026 臺灣氣球嘉年華 主辦團隊
`,
  },
};

export function getEmailMode(): EmailMode {
  return process.env.RESEND_API_KEY ? "resend" : "console";
}

export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function ensureDefaultTemplates(): Promise<void> {
  for (const key of EMAIL_TEMPLATE_KEYS) {
    const existing = await db
      .select()
      .from(emailTemplatesTable)
      .where(eq(emailTemplatesTable.key, key))
      .limit(1);
    if (existing.length === 0) {
      const def = DEFAULT_TEMPLATES[key];
      await db.insert(emailTemplatesTable).values({
        key,
        subject: def.subject,
        body: def.body,
      });
      logger.info({ key }, "[Email] Seeded default template");
    }
  }
}

export async function getTemplate(key: EmailTemplateKey): Promise<{ subject: string; body: string }> {
  const [row] = await db
    .select()
    .from(emailTemplatesTable)
    .where(eq(emailTemplatesTable.key, key))
    .limit(1);
  if (row) return { subject: row.subject, body: row.body };
  return DEFAULT_TEMPLATES[key];
}

function getPublicBaseUrl(): string {
  const domain =
    process.env.PUBLIC_BASE_URL ||
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!domain) return "";
  if (domain.startsWith("http")) return domain.replace(/\/$/, "");
  return `https://${domain}`;
}

export function getQrImageUrl(qrToken: string): string {
  const base = getPublicBaseUrl();
  return `${base}/api/qr/${encodeURIComponent(qrToken)}`;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  qrImageUrl?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  mode: EmailMode;
  message?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const mode = getEmailMode();

  if (mode === "console") {
    logger.info(
      {
        to: input.to,
        subject: input.subject,
        bodyPreview: input.body.slice(0, 200),
      },
      "[Email] (console mode) Would send email — set RESEND_API_KEY to deliver",
    );
    return { delivered: true, mode, message: "Logged to console (no RESEND_API_KEY configured)" };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const html = buildHtmlBody(input.body, input.qrImageUrl);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.to],
        subject: input.subject,
        text: input.body,
        html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      logger.error({ status: res.status, errText }, "[Email] Resend API error");
      return { delivered: false, mode, message: `Resend error ${res.status}: ${errText}` };
    }
    return { delivered: true, mode, message: "Sent via Resend" };
  } catch (err) {
    const msg = (err as Error).message;
    logger.error({ err }, "[Email] Resend fetch failed");
    return { delivered: false, mode, message: msg };
  }
}

function buildHtmlBody(body: string, qrImageUrl?: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  let html = escaped.replace(/\n/g, "<br/>");
  if (qrImageUrl) {
    const qrTag = `<br/><img src="${qrImageUrl}" alt="報到 QR Code" style="width:240px;height:240px;border:1px solid #eee;padding:8px;background:#fff;"/><br/>`;
    html = html.replace(qrImageUrl, qrTag);
  }
  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.7;color:#333;max-width:640px;margin:auto;padding:24px;">${html}</div>`;
}

export type RegistrationEmailVars = {
  parentName: string;
  phone: string;
  eventDate: string;
  ticketCount: number;
  qrUrl: string;
} & Record<string, string | number>;

export function buildRegistrationVars(reg: {
  parentName: string;
  phone: string;
  eventDate: string;
  ticketCount: number;
  qrToken: string | null;
}): RegistrationEmailVars {
  return {
    parentName: reg.parentName,
    phone: reg.phone,
    eventDate: reg.eventDate,
    ticketCount: reg.ticketCount,
    qrUrl: reg.qrToken ? getQrImageUrl(reg.qrToken) : "",
  };
}

export async function sendConfirmationEmail(registrationId: number): Promise<SendEmailResult | null> {
  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.id, registrationId))
    .limit(1);
  if (!reg || !reg.email || !reg.qrToken) return null;
  const tpl = await getTemplate("confirmation");
  const vars = buildRegistrationVars(reg);
  const result = await sendEmail({
    to: reg.email,
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
    qrImageUrl: vars.qrUrl,
  });
  if (result.delivered) {
    await db
      .update(registrationsTable)
      .set({ confirmationEmailSentAt: new Date() })
      .where(eq(registrationsTable.id, registrationId));
  }
  return result;
}
