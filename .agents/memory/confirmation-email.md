---
name: Confirmation email rendering
description: How the customer purchase-confirmation email is built and why it bypasses the editable template body.
---

# Confirmation email rendering

The customer "購票成功" confirmation email is rendered by a hardcoded rich HTML builder (`buildConfirmationEmailHtml` in api-server `email-service.ts`), passed via `htmlOverride` on `sendEmail`. It intentionally does NOT use the admin-editable template **body** for HTML — the editable template still drives the subject and the plain-text part only.

**Why:** The client wanted a branded, designed HTML email (header, ticket card, QR, check-in steps, venue/transport, LINE button). The plain-text-to-HTML wrapper couldn't produce that. So confirmation HTML is code-owned, not admin-owned.
**How to apply:** If asked to let admins edit the confirmation email's layout/look, you must change this contract (either render rich HTML from template content, or expose the static blocks as editable). Reminder emails (`week_reminder`, `day_reminder`) still use the generic `buildHtmlBody` wrapper.

## Always escape user data in emails
`buildConfirmationEmailHtml` interpolates user-supplied fields (parentName, phone). All dynamic values MUST go through `escapeHtml` (and URLs through `encodeURI`) — confirmed XSS/HTML-injection risk if not. Any new dynamic field added here needs the same treatment.

## QR images need a live registration row
`/api/qr/:token` only serves a PNG if a registration with that `qrToken` exists. To send a test confirmation with a *working* QR without consuming capacity, insert a temp registration with `paymentStatus: "refunded"` (capacity `countForDate` excludes only `refunded`; revenue stats count only `paid`) and keep the row — deleting it breaks the QR in the already-sent email.
