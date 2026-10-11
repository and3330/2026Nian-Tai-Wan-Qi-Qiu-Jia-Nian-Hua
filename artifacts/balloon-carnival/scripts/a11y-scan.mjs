/**
 * Read-only accessibility regression scan. It never submits forms or logs in.
 * A clean axe result is NOT a WCAG conformance assessment.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = [
  "/", "/news", "/news/1", "/carnival", "/TOR", "/contestants",
  "/sponsors", "/ad-guide", "/lookup", "/payment/result",
  "/refund-info/a11y-invalid-token", "/admin/login", "/accessibility",
];
const adminRoutes = [
  "/admin", "/admin/orders", "/admin/invoices", "/admin/tournament",
  "/admin/news", "/admin/contestants", "/admin/sponsors",
  "/admin/social-accounts", "/admin/social-posts", "/admin/automation",
  "/admin/checkin", "/admin/pos", "/admin/email-templates", "/admin/users",
  "/admin/promo-codes", "/admin/refund-requests", "/admin/vendors",
];
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

if (process.argv.includes("--help")) {
  console.log(`Read-only axe/WCAG 2.2 AA regression scan.
Required: A11Y_BASE_URL (running preview URL, including artifact prefix)
Optional:
  A11Y_STORAGE_STATE  Temporary Playwright storage-state file for existing admin session.
                      Keep outside the repository; never commit session cookies.
  A11Y_ROUTES         Comma-separated paths (otherwise all public; admin with session).
  A11Y_LANGS          Comma-separated zh-TW,en (default both).
  A11Y_WIDTHS         Comma-separated pixel widths (default 1440,320).
  A11Y_OUTPUT         JSON output path (default generated-artifacts/accessibility/axe-results.json).
  A11Y_EXECUTABLE     Installed Chromium executable, if not managed by Playwright.
  A11Y_CDP_URL        Existing Chromium CDP endpoint, instead of launching Chromium.
Browser prerequisite: an installed Playwright Chromium browser or A11Y_EXECUTABLE.
No forms are submitted; no API writes are made by the scanner.
Exit 1: violations, navigation/scan failures, or unexpected admin redirects.
Incomplete axe findings still require human evaluation, even with exit 0.
`);
  process.exit(0);
}

if (!process.env.A11Y_BASE_URL) throw new Error("A11Y_BASE_URL is required. See --help.");
const base = new URL(process.env.A11Y_BASE_URL.replace(/\/?$/, "/"));
if (!["http:", "https:"].includes(base.protocol)) throw new Error("Expected HTTP(S) preview URL.");
const storageState = process.env.A11Y_STORAGE_STATE;
const routes = process.env.A11Y_ROUTES?.split(",") ??
  [...publicRoutes, ...(storageState ? adminRoutes : [])];
const languages = process.env.A11Y_LANGS?.split(",") ?? ["zh-TW", "en"];
const widths = (process.env.A11Y_WIDTHS ?? "1440,320").split(",").map(Number);
if (widths.some(w => !Number.isInteger(w) || w < 240 || w > 3000)) throw new Error("Invalid width.");
if (languages.some(lang => !["zh-TW", "en"].includes(lang))) throw new Error("Invalid language.");
if (routes.some(route => !route.startsWith("/") || route.startsWith("//") || route.includes("?")))
  throw new Error("Routes must be local paths without query strings or tokens.");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const output = resolve(process.env.A11Y_OUTPUT ??
  resolve(root, "generated-artifacts/accessibility/axe-results.json"));
const remote = Boolean(process.env.A11Y_CDP_URL);
const browser = remote
  ? await chromium.connectOverCDP(process.env.A11Y_CDP_URL)
  : await chromium.launch({
      headless: true,
      ...(process.env.A11Y_EXECUTABLE ? { executablePath: process.env.A11Y_EXECUTABLE } : {}),
    });
const results = [];
try {
  for (const lang of languages) {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        ...(storageState ? { storageState } : {}),
      });
      await context.addInitScript(value => localStorage.setItem("tbc-lang", value), lang);
      const page = await context.newPage();
      for (const route of routes) {
        const entry = { route, lang, width };
        try {
          const response = await page.goto(new URL(route.slice(1), base).href, {
            waitUntil: "domcontentloaded", timeout: 30000,
          });
          await page.locator("main").waitFor({ timeout: 15000 });
          await page.waitForTimeout(800);
          if (response && response.status() >= 400) throw new Error("HTTP navigation failed");
          if (route.startsWith("/admin") && route !== "/admin/login" &&
              new URL(page.url()).pathname.endsWith("/admin/login")) {
            throw new Error("Admin session unavailable; login page is not a tested admin page");
          }
          const report = await new AxeBuilder({ page }).withTags(tags).analyze();
          // Do not persist DOM HTML, field values, customer details, or session data.
          const summarize = findings => findings.map(item => ({
            id: item.id, impact: item.impact, help: item.help, helpUrl: item.helpUrl,
            targets: item.nodes.map(node => node.target),
          }));
          entry.violations = summarize(report.violations);
          entry.incomplete = summarize(report.incomplete);
          entry.passes = report.passes.length;
          entry.pageOverflow = await page.evaluate(() =>
            document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
          entry.languageMatches = await page.evaluate(expected =>
            document.documentElement.lang === expected, lang);
          console.log(`${lang} ${width} ${route}: ${entry.violations.length} violations; ${entry.incomplete.length} manual checks`);
        } catch (error) {
          // Never include a complete URL or session-bearing diagnostic.
          entry.error = error instanceof Error ? error.name : "ScanError";
          console.error(`Scan failed: ${lang} ${width} ${route}; verify route/session/browser.`);
        }
        results.push(entry);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({
  measuredAt: new Date().toISOString(),
  scope: "Rendered initial states only; interactive states require separate tests.",
  tags,
  note: "Not a certification. Incomplete findings, manual criteria and third-party flows need review.",
  results,
}, null, 2));
if (results.some(r => r.error || r.violations?.length || r.pageOverflow || r.languageMatches === false)) {
  process.exitCode = 1;
}
