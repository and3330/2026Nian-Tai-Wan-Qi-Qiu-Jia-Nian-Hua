---
name: Payment-to-entry lifecycle rules
description: Durable rules tying payment confirmation to ticket admission, email timing, and idempotency for the ticketing flow.
---

# Payment-to-entry lifecycle rules

These are the invariants the purchase→entry flow must preserve. Violating any one re-opens a "free entry" or "duplicate side-effect" hole.

## Admission requires payment
A ticket is admissible at check-in only if `paymentStatus === 'paid'` OR the order is genuinely free (`amount === 0`).
**Why:** Tickets get a QR token at registration creation, before payment. Without this gate, anyone who registers (esp. bank transfer) could enter without paying.
**How to apply:** `amount === null` is NOT free — combo (two-day) orders store amount on the first leg only; non-head legs are null. They rely on `paymentStatus`, which the paid-transition sets on every row sharing the `paymentRef`. Never loosen the gate to `amount == null` / `<= 0`.

## Confirmation email (with entry QR) is sent only after payment
For paid orders the buyer's confirmation (which carries the QR) must fire on the paid-transition, not at registration creation. Only free orders (`amount === 0`) get it at creation.
**Why:** Sending a valid entry QR before payment lets an unpaid buyer present a "購票成功" ticket.

## Paid transition must be atomic + idempotent
The status flip to `paid` and all downstream side effects (invoice issuance, Slack notify, confirmation email) must run exactly once per order. Use a conditional `UPDATE ... WHERE status <> 'paid'` and only fire side effects when it actually changed a row.
**Why:** NewebPay sends both a server notify AND a browser return; Stripe sends webhook + a client-poll confirm fallback; bank transfer adds a manual admin confirm. Several can race for the same order.

## Every method funnels through one paid-transition
NewebPay, Stripe, and the admin bank-transfer confirm all call the same paid-transition function, so they share invoice + Slack + email behavior and the idempotency guard. Bank transfer has no automatic callback — it is confirmed manually from the admin dashboard's "待確認匯款" list (editor role).

## Combo = one registration row per day
A two-day combo is multiple registration rows sharing one `paymentRef`, each with its own `qrToken` and `eventDate`. The buyer needs ALL legs' QRs, so confirmation emails must be sent per leg (buyer email is copied onto every leg).
