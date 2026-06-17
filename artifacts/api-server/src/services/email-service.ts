import { db, emailTemplatesTable, registrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
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

如有任何問題，請洽服務專線 02-2368-0623。

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
  // Prefer an explicit, stable public domain. Fall back to the deployment's
  // REPLIT_DOMAINS *before* the ephemeral REPLIT_DEV_DOMAIN, so production
  // emails never embed a workspace-only URL that stops resolving once the
  // workspace sleeps (which left previously-sent QR codes as broken images).
  const domain =
    process.env.PUBLIC_BASE_URL ||
    process.env.REPLIT_DOMAINS?.split(",")[0] ||
    process.env.REPLIT_DEV_DOMAIN;
  if (!domain) return "";
  if (domain.startsWith("http")) return domain.replace(/\/$/, "");
  return `https://${domain}`;
}

export function getQrImageUrl(qrToken: string): string {
  const base = getPublicBaseUrl();
  return `${base}/api/qr/${encodeURIComponent(qrToken)}`;
}

export interface EmailAttachment {
  filename: string;
  content: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  qrImageUrl?: string;
  htmlOverride?: string;
  attachments?: EmailAttachment[];
}

// Render the registration QR token into a PNG and return it as a base64
// attachment. Attaching the QR (rather than relying only on a remote <img>)
// guarantees the buyer always gets a scannable code, even when their mail
// client blocks remote images or the image URL is temporarily unreachable.
export async function buildQrAttachment(
  qrToken: string,
): Promise<EmailAttachment | null> {
  try {
    const buffer = await QRCode.toBuffer(qrToken, {
      errorCorrectionLevel: "M",
      type: "png",
      margin: 2,
      width: 480,
    });
    return { filename: "checkin-qr.png", content: buffer.toString("base64") };
  } catch (err) {
    logger.error({ err }, "[Email] Failed to build QR attachment");
    return null;
  }
}

export const EVENT_INFO = {
  name: "2026 臺灣氣球嘉年華",
  venue: "臺北瓶蓋工廠",
  address: "台北市南港區南港路二段 13 號",
  openTime: "10:00 起入場（7/25 延長至 19:00）",
  servicePhone: "02-2368-0623",
  lineUrl: "https://lin.ee/OUbPwpi",
  transport: [
    "捷運：搭乘板南線至「南港站」1 號出口，步行約 5 分鐘",
    "接駁車：活動期間提供免費接駁車，往返捷運南港站",
    "開車：現場停車位有限，建議搭乘大眾運輸前往",
  ],
} as const;

// 戰鬥陀螺賽 schedule shown in the confirmation email for tournament tickets.
export const TOURNAMENT_INFO = {
  date: "2026/07/26（日）",
  checkin: "11:00 – 12:30",
  venue: "臺北瓶蓋工廠 M 棟",
  start: "13:00 開賽",
} as const;

const TOURNAMENT_TICKET_TYPES = ["tournament", "tournament-companion"];

// Shared gift coupon attached to every purchase-confirmation email
// (「禮物 Coupon 券專區」). A single code for all buyers — value provided by the
// organizer. Update here if the offer changes.
export const SHOP_COUPON = {
  title: "價值 500 元 商城優惠折扣套裝",
  code: "2026balloon",
  url: "https://cmsedu-life.com/",
  usage:
    "於 CM 生活＋平台（cmsedu-life.com）預約全台冷氣清潔服務、洗衣機清潔服務，結帳輸入優惠券碼即享 500 元折扣優惠。",
} as const;

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
  const html = input.htmlOverride || buildHtmlBody(input.body, input.qrImageUrl);

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
        ...(input.attachments && input.attachments.length > 0
          ? { attachments: input.attachments }
          : {}),
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
    const qrTag = `<br/><img src="${qrImageUrl}" alt="報到 QR Code" style="width:240px;height:240px;border:1px solid #eee;padding:8px;background:#fff;"/><br/><a href="${qrImageUrl}" style="color:#EF5739;font-weight:700;">若 QR Code 沒有顯示，請點此開啟</a><br/>`;
    html = html.replace(qrImageUrl, qrTag);
  }
  return `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.7;color:#333;max-width:640px;margin:auto;padding:24px;">${html}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEventDate(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return raw;
  const [, y, mo, d] = m;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  const wd = Number.isNaN(date.getTime()) ? "" : `（${weekdays[date.getDay()]}）`;
  return `${y}/${mo}/${d}${wd}`;
}

export function buildConfirmationEmailHtml(vars: {
  parentName: string;
  phone: string;
  eventDate: string;
  ticketCount: number;
  qrUrl: string;
  ticketType?: string | null;
}): string {
  const coral = "#EF5739";
  const yellow = "#FFB50A";
  const ink = "#1f2933";
  const muted = "#6b7280";
  const indigo = "#4338ca";
  const parentName = escapeHtml(vars.parentName);
  const phone = escapeHtml(vars.phone);
  const dateLabel = escapeHtml(formatEventDate(vars.eventDate));
  const qrUrl = encodeURI(vars.qrUrl);
  const isTournament = TOURNAMENT_TICKET_TYPES.includes(vars.ticketType ?? "");
  const isCompanion = vars.ticketType === "tournament-companion";

  const infoRow = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;color:${muted};font-size:14px;width:96px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;color:${ink};font-size:15px;font-weight:700;vertical-align:top;">${value}</td>
    </tr>`;

  const tournamentBlock = isTournament
    ? `
  <tr>
    <td style="padding:16px 32px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px;padding:18px 20px;">
        <tr><td>
          <div style="font-size:13px;font-weight:800;color:${indigo};letter-spacing:1px;margin-bottom:8px;">🌀 戰鬥陀螺賽資訊${isCompanion ? "（隨同入場票）" : "（參賽者）"}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("比賽日期", TOURNAMENT_INFO.date)}
            ${infoRow("報到時間", TOURNAMENT_INFO.checkin)}
            ${infoRow("報到地點", TOURNAMENT_INFO.venue)}
            ${infoRow("開賽時間", TOURNAMENT_INFO.start)}
          </table>
          <div style="color:${ink};font-size:13px;line-height:1.7;margin-top:10px;">${
            isCompanion
              ? "本票券為隨同一般入場票，可於 7/26 公開場入場並一同觀賽，無參賽資格。"
              : "請於報到時間內憑本 QR Code 完成報到，逾時恐影響賽程安排。"
          }</div>
        </td></tr>
      </table>
    </td>
  </tr>`
    : "";

  const transportItems = EVENT_INFO.transport
    .map(
      (t) =>
        `<tr><td style="padding:4px 0;color:${ink};font-size:14px;line-height:1.6;">🚇 ${t.replace(/^[^：]+：/, (p) => `<strong style="color:${coral};">${p}</strong>`)}</td></tr>`,
    )
    .join("");

  const qrBlock = vars.qrUrl
    ? `
      <tr>
        <td align="center" style="padding:8px 0 4px;">
          <img src="${qrUrl}" alt="入場報到 QR Code" width="220" height="220" style="display:block;width:220px;height:220px;border:1px solid #f0f0f0;border-radius:12px;padding:10px;background:#ffffff;" />
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:0 0 4px;color:${muted};font-size:13px;">此 QR Code 即為您的電子門票，請妥善保存</td>
      </tr>
      <tr>
        <td align="center" style="padding:2px 0 6px;font-size:13px;">
          <a href="${qrUrl}" style="color:${coral};font-weight:700;text-decoration:underline;">若 QR Code 沒有顯示，請點此開啟入場 QR Code</a>
        </td>
      </tr>`
    : `
      <tr>
        <td align="center" style="padding:12px;color:${muted};font-size:13px;">QR Code 將於付款完成後產生</td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${EVENT_INFO.name} 購票成功</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue','PingFang TC','Microsoft JhengHei',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 24px rgba(31,41,51,0.08);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,${coral} 0%,${yellow} 100%);padding:36px 32px;text-align:center;">
      <div style="font-size:34px;line-height:1;margin-bottom:10px;">🎈</div>
      <div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.5px;">${EVENT_INFO.name}</div>
      <div style="color:#fff7ed;font-size:15px;font-weight:600;margin-top:6px;">購票成功！期待與您相見 🎉</div>
    </td>
  </tr>

  <!-- Greeting -->
  <tr>
    <td style="padding:28px 32px 8px;">
      <p style="margin:0;color:${ink};font-size:16px;line-height:1.7;">親愛的 <strong>${parentName}</strong> 您好，</p>
      <p style="margin:10px 0 0;color:${ink};font-size:15px;line-height:1.7;">感謝您購買 ${EVENT_INFO.name} 的入場票券，您的訂單已確認。以下是您的票券資訊：</p>
    </td>
  </tr>

  <!-- Ticket card -->
  <tr>
    <td style="padding:16px 32px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f1;border:1px solid #ffe3cf;border-radius:14px;padding:18px 20px;">
        <tr><td>
          <div style="font-size:13px;font-weight:800;color:${coral};letter-spacing:1px;margin-bottom:6px;">🎫 票券資訊</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("姓名", parentName)}
            ${infoRow("聯絡電話", phone)}
            ${infoRow("入場日期", dateLabel)}
            ${infoRow("票數", `${vars.ticketCount} 張`)}
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  ${tournamentBlock}

  <!-- QR -->
  <tr>
    <td style="padding:20px 32px 4px;">
      <div style="font-size:13px;font-weight:800;color:${coral};letter-spacing:1px;margin-bottom:10px;text-align:center;">📱 您的報到 QR Code</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${qrBlock}
      </table>
    </td>
  </tr>

  <!-- Check-in -->
  <tr>
    <td style="padding:16px 32px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:14px;padding:16px 20px;">
        <tr><td>
          <div style="font-size:13px;font-weight:800;color:${ink};letter-spacing:1px;margin-bottom:8px;">✅ 簽到方式</div>
          <div style="color:${ink};font-size:14px;line-height:1.7;">
            1. 活動當日抵達會場入口的「報到處」<br/>
            2. 出示本封 email 中的 QR Code（手機畫面或列印皆可）<br/>
            3. 工作人員掃描後即可入場，${EVENT_INFO.openTime}
          </div>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Gift coupon (禮物 Coupon 券專區) -->
  <tr>
    <td style="padding:16px 32px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:18px 20px;">
        <tr><td>
          <div style="font-size:13px;font-weight:800;color:#b45309;letter-spacing:1px;margin-bottom:8px;">🎁 禮物 Coupon 券專區</div>
          <div style="color:${ink};font-size:15px;font-weight:700;margin-bottom:12px;">${escapeHtml(SHOP_COUPON.title)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#ffffff;border:1px dashed #f59e0b;border-radius:10px;padding:12px 16px;text-align:center;">
                <div style="font-size:12px;color:${muted};margin-bottom:4px;">優惠券碼</div>
                <div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#b45309;font-family:'Courier New',Consolas,monospace;">${escapeHtml(SHOP_COUPON.code)}</div>
              </td>
            </tr>
          </table>
          <div style="color:${ink};font-size:14px;line-height:1.7;margin-top:12px;">📌 使用方式：${escapeHtml(SHOP_COUPON.usage)}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
            <tr>
              <td style="background:#b45309;border-radius:10px;">
                <a href="${escapeHtml(SHOP_COUPON.url)}" target="_blank" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">前往 CM 生活＋ 預約服務 →</a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Venue & transport -->
  <tr>
    <td style="padding:16px 32px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:14px;padding:16px 20px;">
        <tr><td>
          <div style="font-size:13px;font-weight:800;color:${ink};letter-spacing:1px;margin-bottom:8px;">📍 活動地點與交通</div>
          <div style="color:${ink};font-size:15px;font-weight:700;margin-bottom:2px;">${EVENT_INFO.venue}</div>
          <div style="color:${muted};font-size:14px;margin-bottom:12px;">${EVENT_INFO.address}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${transportItems}
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- LINE CTA -->
  <tr>
    <td style="padding:22px 32px 6px;text-align:center;">
      <div style="color:${muted};font-size:14px;margin-bottom:12px;">有任何問題嗎？歡迎透過 LINE 與我們聯繫</div>
      <a href="${EVENT_INFO.lineUrl}" style="display:inline-block;background:#06C755;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;padding:13px 32px;border-radius:999px;">💬 加入 LINE 客服</a>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:22px 32px 32px;border-top:1px solid #f0f0f0;margin-top:12px;">
      <div style="color:${muted};font-size:13px;line-height:1.7;text-align:center;">
        服務專線：${EVENT_INFO.servicePhone}<br/>
        ${EVENT_INFO.name} 主辦團隊 敬上<br/>
        <span style="color:#9aa3af;">此信件為系統自動發送，請勿直接回覆。</span>
      </div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export type RegistrationEmailVars = {
  parentName: string;
  phone: string;
  eventDate: string;
  ticketCount: number;
  qrUrl: string;
  ticketType: string;
} & Record<string, string | number>;

export function buildRegistrationVars(reg: {
  parentName: string;
  phone: string;
  eventDate: string;
  ticketCount: number;
  qrToken: string | null;
  ticketType?: string | null;
}): RegistrationEmailVars {
  return {
    parentName: reg.parentName,
    phone: reg.phone,
    eventDate: reg.eventDate,
    ticketCount: reg.ticketCount,
    qrUrl: reg.qrToken ? getQrImageUrl(reg.qrToken) : "",
    ticketType: reg.ticketType ?? "",
  };
}

export async function sendConfirmationEmail(
  registrationId: number,
  opts?: { force?: boolean },
): Promise<SendEmailResult | null> {
  const [reg] = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.id, registrationId))
    .limit(1);
  if (!reg || !reg.email || !reg.qrToken) return null;
  // Idempotent: never send the confirmation twice for the same registration —
  // unless an admin explicitly forces a resend (e.g. buyer lost the email).
  if (!opts?.force && reg.confirmationEmailSentAt) return null;
  const tpl = await getTemplate("confirmation");
  const vars = buildRegistrationVars(reg);
  const qrAttachment = reg.qrToken ? await buildQrAttachment(reg.qrToken) : null;
  const result = await sendEmail({
    to: reg.email,
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
    qrImageUrl: vars.qrUrl,
    htmlOverride: buildConfirmationEmailHtml(vars),
    attachments: qrAttachment ? [qrAttachment] : undefined,
  });
  if (result.delivered) {
    await db
      .update(registrationsTable)
      .set({ confirmationEmailSentAt: new Date() })
      .where(eq(registrationsTable.id, registrationId));
  }
  return result;
}
