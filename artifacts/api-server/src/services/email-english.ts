/** English counterparts for code-owned transactional messages. No delivery side effects. */
export type BuyerEmailKind = "confirmation" | "week_reminder" | "day_reminder";
export interface BuyerEmailDetails {
  parentName: string;
  phone: string;
  eventDate: string;
  ticketCount: number;
  childCount?: number;
  infantCount?: number;
  qrUrl: string;
  ticketType?: string | null;
}

export const englishSubjects: Record<BuyerEmailKind, string> = {
  confirmation: "Taiwan Balloon Carnival 2026 — Booking confirmed",
  week_reminder: "Taiwan Balloon Carnival 2026 — 7-day reminder",
  day_reminder: "Taiwan Balloon Carnival 2026 — Your visit is tomorrow",
};

export function englishBuyerBody(kind: BuyerEmailKind, vars: BuyerEmailDetails): string {
  const tournament = ["tournament", "tournament-companion"].includes(vars.ticketType ?? "");
  const children = vars.childCount ?? 0;
  const infants = vars.infantCount ?? 0;
  const heading = kind === "confirmation"
    ? "Thank you for your booking. Your payment has been confirmed."
    : kind === "week_reminder"
      ? "Your visit to Taiwan Balloon Carnival 2026 is in 7 days."
      : "Your visit to Taiwan Balloon Carnival 2026 is tomorrow.";
  return `Dear ${vars.parentName},

${heading}

BOOKING DETAILS
Name: ${vars.parentName}
Phone: ${vars.phone}
Admission date: ${vars.eventDate}
Total attendees: ${vars.ticketCount}
Adults: ${vars.ticketCount - children - infants}; children: ${children}; infants under 1: ${infants} (free).

YOUR ADMISSION QR CODE
${vars.qrUrl || "Your QR code will be available after payment."}
This QR code is your electronic ticket. Please save it and show it at the check-in desk, on your phone or printed on paper. Staff will scan it for admission.
If the image is not displayed, open the QR link above. Confirmation emails also include a QR image attachment when available.

VENUE AND TRANSPORT
POPOP Taipei (Taipei Bottle Cap Factory)
No. 13, Section 2, Nangang Road, Nangang District, Taipei City, Taiwan
Admission from 10:00; extended opening until 19:00 on July 25.
MRT: Take the Bannan (Blue) Line to Nangang Station, Exit 1. Walk approximately 5 minutes.
Parking is limited; public transport is recommended.
${tournament ? `
BEYBLADE TOURNAMENT
Date: Sunday, July 26, 2026
Check-in: 11:00–12:30, Building M, POPOP Taipei
Tournament starts at 13:00.
${vars.ticketType === "tournament-companion"
  ? "This is a companion admission ticket for July 26. You may watch the tournament but cannot compete."
  : "Please check in with your QR code during the check-in period. Late arrival may affect participation."}
` : ""}
${kind === "day_reminder" ? `ADMISSION REMINDERS
Please arrive 15 minutes early and bring identification.
Adults and children pay the same ticket price. Infants under 1 enter free but still count toward capacity and need a QR code for check-in.
` : ""}
${kind === "confirmation" ? `GIFT COUPON
NT$500 discount on eligible services at CM Life+
Coupon code: 2026balloon
Book air-conditioner or washing-machine cleaning services across Taiwan at https://cmsedu-life.com/ and enter the code at checkout for the NT$500 discount.
` : ""}
Questions? Contact us on LINE: https://lin.ee/OUbPwpi
Service phone: 02-2368-0623

Taiwan Balloon Carnival 2026 Organizing Team
This is an automated email. Please do not reply directly.`;
}

export function bilingualBody(chinese: string, english: string): string {
  return `${chinese.trim()}\n\n────────────────────────\nEnglish\n────────────────────────\n\n${english}`;
}

export function englishTextHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const linked = escaped.replace(/https:\/\/[^\s<>]+/g, (url) =>
    `<a href="${url}" style="color:#9a3412;text-decoration:underline;overflow-wrap:anywhere;">${url}</a>`);
  return `<section lang="en" style="padding:24px 32px;font-size:15px;line-height:1.7;color:#1f2933;"><h2 style="font-size:20px;">English — Taiwan Balloon Carnival 2026</h2>${linked.replace(/\n/g, "<br/>")}</section>`;
}
