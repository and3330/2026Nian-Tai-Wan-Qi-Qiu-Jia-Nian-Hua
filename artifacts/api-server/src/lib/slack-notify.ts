// Slack integration (Replit connector "slack") — outbound Web API only.
// Sends a notification to the configured Slack channel when a ticket is purchased.
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

const connectors = new ReplitConnectors();

// Channel to post purchase notifications to. Override via SLACK_CHANNEL_ID.
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "C0BA4ULKLMV";

export interface PurchaseNotification {
  parentName: string;
  phone: string;
  email?: string | null;
  ticketType?: string | null;
  ticketCount: number;
  eventDate?: string | null;
  amount?: number | null;
  paymentMethod?: string | null;
  paymentRef?: string | null;
  awaitingTransfer?: boolean;
}

function ticketTypeLabel(type?: string | null): string {
  if (type === "combo") return "兩日套票";
  if (type === "single") return "單日票";
  return type || "—";
}

function paymentMethodLabel(method?: string | null): string {
  switch (method) {
    case "newebpay":
      return "藍新金流";
    case "stripe":
      return "Stripe 信用卡";
    case "bank":
      return "銀行轉帳 / ATM";
    default:
      return method || "—";
  }
}

export async function sendPurchaseSlackNotification(
  info: PurchaseNotification,
): Promise<void> {
  const lines = [
    info.awaitingTransfer ? "🏦 *新訂單（待匯款）*" : "🎈 *新購票通知*",
    `• 姓名：${info.parentName}`,
    `• 電話：${info.phone}`,
    info.email ? `• Email：${info.email}` : null,
    `• 票種：${ticketTypeLabel(info.ticketType)}`,
    `• 票數：${info.ticketCount} 張`,
    info.ticketType === "combo"
      ? "• 入場日期：7/25 + 7/26"
      : info.eventDate
      ? `• 入場日期：${info.eventDate}`
      : null,
    info.amount != null ? `• 金額：NT$ ${info.amount.toLocaleString()}` : null,
    `• 付款方式：${paymentMethodLabel(info.paymentMethod)}`,
    info.paymentRef ? `• 訂單編號：${info.paymentRef}` : null,
  ].filter(Boolean);

  const response = await connectors.proxy("slack", "/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: SLACK_CHANNEL_ID,
      text: lines.join("\n"),
    }),
  });
  const result = (await response.json()) as { ok?: boolean; error?: string };
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error || "unknown"}`);
  }
}

export function notifyPurchaseSlack(info: PurchaseNotification): void {
  // Fire-and-forget — Slack failures must never block or roll back a payment.
  sendPurchaseSlackNotification(info).catch((err) => {
    logger.error({ err, paymentRef: info.paymentRef }, "[Slack] purchase notification failed");
  });
}
