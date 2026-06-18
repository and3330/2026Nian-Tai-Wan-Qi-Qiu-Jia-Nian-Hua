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

## "Missing confirmation email" is almost always "order never reached paid"
When buyers report no purchase-success email, check `paymentStatus` first — the email only fires on the paid-transition by design. An order stuck in `pending`/`awaiting_transfer`/`unpaid` correctly gets no email; it is not an email bug.
**Why:** Diagnosed a "many people didn't get the email" report: all paid+email orders had been sent; the complainers were all non-paid orders whose payment never came back.
**How to apply:** A NewebPay pending row with NO callback data (`raw_result IS NULL`, empty `provider_trade_no`) means no notify/return ever arrived = buyer never completed payment (abandoned card page, or got an ATM/超商 code and hasn't paid). To prove `notify` itself works, confirm some `paid` rows are `PaymentType` VACC/CVS — those async methods can ONLY confirm via server-side notify, so their success rules out a dropped-webhook bug. The authoritative per-order truth is NewebPay's QueryTradeInfo API, but it needs the real HASH_KEY/HASH_IV/MERCHANT_ID — see the env-secrets-masking note. An admin "reconcile" action queries QueryTradeInfo for each non-paid newebpay row and auto-confirms (via the shared paid-transition) only when NewebPay says paid AND the returned Amt EXACTLY equals our stored amount; a paid-but-amount-mismatch/missing result must be flagged for manual review, never auto-confirmed.

## Combo = one registration row per day
A two-day combo is multiple registration rows sharing one `paymentRef`, each with its own `qrToken` and `eventDate`. The buyer needs ALL legs' QRs, so confirmation emails must be sent per leg (buyer email is copied onto every leg).

## Tournament (戰鬥陀螺賽) is a separate inventory from carnival admission
Tournament rows live on the same date (7/26) as general carnival admission but belong to their own cap (128 competitors), tracked by `ticketType IN ('tournament','tournament-companion')`. Participant legs (`tournament`, 600, includes own entry) consume the 128 cap; companion legs (`tournament-companion`, 200, general 7/26 entry) do NOT.
**Why:** Mixing them either lets tournament sales eat the 500/day general cap or lets companions falsely fill competitor slots.
**How to apply:** Anywhere the 500/day carnival capacity is computed (availability endpoints, transactional `countForDate`, admin `/admin/stats` and `/admin/sales-overview` session-capacity), the query MUST exclude tournament leg types. Revenue/trend/paid-total aggregates intentionally still INCLUDE tournament sales. The 128 competitor count sums only `ticketType='tournament'`. Capacity check is serialized with an advisory lock keyed `"tournament"` + re-count inside the insert transaction.
