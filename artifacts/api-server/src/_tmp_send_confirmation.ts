import { eq } from "drizzle-orm";
import { db, emailTemplatesTable } from "@workspace/db";
import {
  buildConfirmationEmailHtml,
  buildRegistrationVars,
  getEmailMode,
  getQrImageUrl,
  renderTemplate,
  sendEmail,
} from "./services/email-service";

async function main() {
  const recipient = "service@cms-edu.com";
  const [tpl] = await db
    .select()
    .from(emailTemplatesTable)
    .where(eq(emailTemplatesTable.key, "confirmation"))
    .limit(1);
  if (!tpl) throw new Error("confirmation template not found");

  const sampleVars = buildRegistrationVars({
    parentName: "測試 王先生",
    phone: "0912345678",
    eventDate: "2026-07-25",
    ticketCount: 2,
    qrToken: "sample-token-preview",
  });
  sampleVars.qrUrl = getQrImageUrl("sample-token-preview");

  const result = await sendEmail({
    to: recipient,
    subject: renderTemplate(tpl.subject, sampleVars),
    body: renderTemplate(tpl.body, sampleVars),
    qrImageUrl: sampleVars.qrUrl,
    htmlOverride: buildConfirmationEmailHtml(sampleVars),
  });

  console.log(
    JSON.stringify(
      { delivered: result.delivered, mode: getEmailMode(), message: result.message, to: recipient },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
