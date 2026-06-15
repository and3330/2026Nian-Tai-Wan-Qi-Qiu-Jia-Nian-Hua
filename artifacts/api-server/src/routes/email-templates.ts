import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailTemplatesTable } from "@workspace/db";
import {
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
  buildConfirmationEmailHtml,
  buildRegistrationVars,
  getEmailMode,
  getQrImageUrl,
  renderTemplate,
  sendEmail,
} from "../services/email-service";

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

router.get("/admin/email-templates", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const rows = await db.select().from(emailTemplatesTable);
  // Sort in canonical order
  const order = new Map<string, number>(EMAIL_TEMPLATE_KEYS.map((k, i) => [k, i]));
  rows.sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
  res.json(rows);
});

router.put("/admin/email-templates/:key", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const key = req.params.key;
  if (!EMAIL_TEMPLATE_KEYS.includes(key as EmailTemplateKey)) {
    res.status(404).json({ error: "Unknown template key" });
    return;
  }
  const { subject, body } = req.body || {};
  if (typeof subject !== "string" || !subject.trim() || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "subject 與 body 為必填" });
    return;
  }
  const [updated] = await db
    .update(emailTemplatesTable)
    .set({ subject, body, updatedAt: new Date() })
    .where(eq(emailTemplatesTable.key, key))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(updated);
});

router.post("/admin/email-templates/:key/test", async (req, res): Promise<void> => {
  if (!requireAuth(req, res, "editor")) return;
  const key = req.params.key;
  if (!EMAIL_TEMPLATE_KEYS.includes(key as EmailTemplateKey)) {
    res.status(404).json({ error: "Unknown template key" });
    return;
  }
  const { recipient } = req.body || {};
  if (typeof recipient !== "string" || !recipient.includes("@")) {
    res.status(400).json({ error: "請提供有效的收件人 email" });
    return;
  }
  const [tpl] = await db
    .select()
    .from(emailTemplatesTable)
    .where(eq(emailTemplatesTable.key, key))
    .limit(1);
  if (!tpl) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const sampleVars = buildRegistrationVars({
    parentName: "測試 王先生",
    phone: "0912345678",
    eventDate: "2026-07-25",
    ticketCount: 2,
    qrToken: "sample-token-preview",
  });
  // Override qrUrl with a clearly-fake one so we don't promise a real QR
  sampleVars.qrUrl = getQrImageUrl("sample-token-preview");
  const result = await sendEmail({
    to: recipient,
    subject: renderTemplate(tpl.subject, sampleVars),
    body: renderTemplate(tpl.body, sampleVars),
    qrImageUrl: sampleVars.qrUrl,
    htmlOverride:
      key === "confirmation" ? buildConfirmationEmailHtml(sampleVars) : undefined,
  });
  res.json({
    delivered: result.delivered,
    mode: getEmailMode(),
    message: result.message,
  });
});

export default router;
