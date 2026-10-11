import { describe, expect, it } from "vitest";
import { bilingualBody, englishBuyerBody, englishTextHtml, englishSubjects } from "../src/services/email-english";

const details = {
  parentName: 'Guest <img src=x onerror="alert(1)">',
  phone: "0000000000",
  eventDate: "2026-07-25",
  ticketCount: 4,
  childCount: 1,
  infantCount: 1,
  qrUrl: "https://example.test/api/qr/test-token",
};

describe("English transactional email content", () => {
  it("includes admission, headcounts, QR fallback, venue, transport and coupon", () => {
    const text = englishBuyerBody("confirmation", details);
    for (const value of ["Adults: 2", "children: 1", "infants under 1: 1", details.qrUrl,
      "Nangang Station", "2026balloon", "NT$500", "10:00", "19:00", "02-2368-0623"]) {
      expect(text).toContain(value);
    }
  });

  it("distinguishes companion admission from competitor check-in", () => {
    const companion = englishBuyerBody("confirmation", { ...details, ticketType: "tournament-companion" });
    const competitor = englishBuyerBody("confirmation", { ...details, ticketType: "tournament" });
    expect(companion).toContain("cannot compete");
    expect(competitor).toContain("Late arrival");
    expect(companion).toContain("11:00–12:30");
    expect(competitor).toContain("13:00");
  });

  it("renders both reminders with distinct timing and admission rules", () => {
    expect(englishBuyerBody("week_reminder", details)).toContain("in 7 days");
    const tomorrow = englishBuyerBody("day_reminder", details);
    expect(tomorrow).toContain("tomorrow");
    expect(tomorrow).toContain("15 minutes");
    expect(tomorrow).toContain("same ticket price");
    expect(tomorrow).not.toContain("GIFT COUPON");
    expect(englishSubjects.day_reminder).toContain("tomorrow");
  });

  it("retains the Chinese original and keeps buyer data escaped in HTML", () => {
    const text = englishBuyerBody("confirmation", details);
    const bilingual = bilingualBody("原始中文內容", text);
    expect(bilingual).toContain("原始中文內容");
    expect(bilingual).toContain(text);
    const html = englishTextHtml(text);
    expect(html).toContain('lang="en"');
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain(`href="${details.qrUrl}"`);
  });

  it("does not promise a QR code when no token exists", () => {
    expect(englishBuyerBody("confirmation", { ...details, qrUrl: "" }))
      .toContain("available after payment");
  });
});
