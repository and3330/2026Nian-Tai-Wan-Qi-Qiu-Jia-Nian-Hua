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
The status flip to `paid` and all downstream side effects (Slack notify, confirmation email) must run exactly once per order. Use a conditional `UPDATE ... WHERE status <> 'paid'` and only fire side effects when it actually changed a row.
**Why:** NewebPay sends both a server notify AND a browser return; Stripe sends webhook + a client-poll confirm fallback; bank transfer adds a manual admin confirm. Several can race for the same order.

## E-invoices are NOT auto-issued on payment — admins issue them manually/in batches
The paid-transition records the buyer's invoice preferences (an `invoicesTable` row stays `status='pending'`) but deliberately does NOT call ECPay to issue the e-invoice. Staff issue invoices from the admin 發票管理 page — per-order「開立發票」or「批量開立」, both hitting `POST /payments/invoices/:ref/retry` (editor-gated), which calls `issueInvoiceForPayment`.
**Why:** Organizer wants to review orders before issuing real government e-invoices, and avoid auto-issuing the moment payment lands. (Earlier the paid-transition fire-and-forget auto-issued.)
**How to apply:** Do NOT re-add an `issueInvoiceForPayment` call inside the paid-transition (`markPaymentPaid`). Keep recording the pending invoice row at `/payments/initiate` so the manual/batch flow has data. `issueInvoiceForPayment` must stay referenced only by the retry endpoint. Production vs test issuance is decided purely by whether `ECPAY_INVOICE_HASH_KEY` (+ MERCHANT_ID/HASH_IV) is set; unset = ECPay stage/sandbox (test merchant 2000132), set = real einvoice.ecpay.com.tw.

## Mutating PRODUCTION rows must go through an in-app admin action, never executeSql
The agent's `executeSql` is READ-ONLY against production, so bad data on the live site (e.g. test/sandbox invoices, missing buyer Email) cannot be fixed by the agent directly — the deployed app must expose a back-office action for staff to run.
**Why:** Org went live with many real-customer invoices that had been issued in ECPay sandbox; they had to be re-issued as real invoices, but prod was read-only to the agent.
**How to apply:** When the user needs production data fixed, build/extend an editor-gated admin endpoint + UI rather than reaching for SQL. For clearing bad invoices, prefer RESET (issued→pending, null out invoiceNumber/invoiceDate/randomNumber/errorMessage/rawResponse/issuedAt) over DELETE — deleting loses the buyer's invoice prefs (carrier/統編/捐贈碼) the real re-issue needs, and leaves paying customers with no invoice. Go-live order: (1) deploy with prod ECPay keys + no-auto-issue code, (2) RESET test rows, (3) batch 開立.

## RESET ≠ VOID — reset is local-only and risks double-issuing a REAL invoice
`POST /payments/invoices/:ref/reset` (editor-gated, latest row only) flips an `issued` invoice back to `pending` WITHOUT calling ECPay. It exists to clear sandbox/test invoices. For a real official invoice that was actually issued at ECPay, use VOID (`/void`) instead.
**Why:** Resetting then re-issuing a genuinely-issued government invoice creates a second official invoice for one order = tax/accounting problem. Reset only erases our local evidence, not the ECPay invoice.
**How to apply:** Keep reset SELECTION-based (explicit checkboxes), latest-row-only, with a strong confirm warning "測試發票專用". Do NOT make a blanket "reset all" that could sweep real invoices. The reset checkbox shares the same selection set as batch-issue, but each action only operates on its matching status subset (issue→pending/failed, reset→issued).

## Every method funnels through one paid-transition
NewebPay, Stripe, and the admin bank-transfer confirm all call the same paid-transition function, so they share invoice + Slack + email behavior and the idempotency guard. Bank transfer has no automatic callback — it is confirmed manually from the admin dashboard's "待確認匯款" list (editor role).

## "Missing confirmation email" is almost always "order never reached paid"
When buyers report no purchase-success email, check `paymentStatus` first — the email only fires on the paid-transition by design. An order stuck in `pending`/`awaiting_transfer`/`unpaid` correctly gets no email; it is not an email bug.
**Why:** Diagnosed a "many people didn't get the email" report: all paid+email orders had been sent; the complainers were all non-paid orders whose payment never came back.
**How to apply:** A NewebPay pending row with NO callback data (`raw_result IS NULL`, empty `provider_trade_no`) means no notify/return ever arrived = buyer never completed payment (abandoned card page, or got an ATM/超商 code and hasn't paid). To prove `notify` itself works, confirm some `paid` rows are `PaymentType` VACC/CVS — those async methods can ONLY confirm via server-side notify, so their success rules out a dropped-webhook bug. The authoritative per-order truth is NewebPay's QueryTradeInfo API, but it needs the real HASH_KEY/HASH_IV/MERCHANT_ID — see the env-secrets-masking note. An admin "reconcile" action queries QueryTradeInfo for each non-paid newebpay row and auto-confirms (via the shared paid-transition) only when NewebPay says paid AND the returned Amt EXACTLY equals our stored amount; a paid-but-amount-mismatch/missing result must be flagged for manual review, never auto-confirmed.

## Initiating a new charge must first re-check the gateway, not just our paid flag
Before `/payments/initiate` creates a NEW NewebPay order, it must check whether the registrations' existing pending `paymentRef` was ALREADY collected at the gateway (via QueryTradeInfo), and if so mark it paid + send the buyer to the success page instead of charging again.
**Why:** Our `paymentStatus` lags the gateway — NewebPay charges the card, then confirms asynchronously (notify/return). A buyer who retries in that window passes the `paymentStatus !== 'paid'` guard and gets charged a second time. This was the root cause of "付款成功卻要重複刷一次".
**How to apply:** Only fires on retries (first-time orders have null `paymentRef`, so no added latency). On a transient QueryTradeInfo failure, log and fall through to allow the legitimate retry (don't hard-block). Only the local `paymentStatus === 'paid'` short-circuit alone is insufficient.

## NewebPay callback Status=SUCCESS is NOT proof of payment (VACC/CVS 取號 trap)
A signed MPG notify/return reports `Status=SUCCESS` in two different situations: (a) a credit-card charge was collected, and (b) a VACC (ATM) / CVS (超商) order merely finished 取號 — an account/store code was issued but NO money has arrived. Marking (b) as paid issues QR tickets + invoices before the buyer ever pays.
**Why:** All three methods (CREDIT/VACC/CVS) are enabled on every order, so 取號 SUCCESS callbacks WILL arrive. Trusting `Status==='SUCCESS'` alone (the old notify/return code) was a real "free ticket before payment" hole.
**How to apply:** Callback settlement must confirm against authoritative QueryTradeInfo (`TradeStatus==='1'` AND exact Amt match) before the paid-transition — same gate as reconcile. The signed-callback fallback (when QueryTradeInfo is unreachable) is allowed ONLY when the decrypted Result carries a real `PayTime` (absent at 取號) AND an exact amount match — never on `Status` alone. For credit-card eventual-consistency lag, re-query QueryTradeInfo once after a short delay, but only when the callback already "looks paid" (so 取號 never waits/passes).

## Callback base URLs (Return/Notify) come from PUBLIC_BASE_URL, not proxy headers
NewebPay ReturnURL/NotifyURL (and Stripe success/cancel) must be the canonical public origin. Prefer `process.env.PUBLIC_BASE_URL` (set in production = https://2026balloon.tw); fall back to x-forwarded headers only in dev where it's unset.
**Why:** Deriving callback URLs purely from request headers is fragile — a misconfigured proxy yields wrong/internal callback URLs and the gateway can't reach us. email-service already trusts PUBLIC_BASE_URL; payments now matches.

## Refund = status flip only; capacity release is implicit; money is offline
Refunding an order (both the buyer-submitted refund-request approval AND the admin "退票" button in 訂單管理) just sets every leg's `paymentStatus = 'refunded'` for the whole order (by `paymentRef`). It does NOT call NewebPay/Stripe refund APIs — the actual money is returned offline by staff.
**Why:** No gateway refund integration exists; both refund paths deliberately keep the same offline-money model so they behave identically.
**How to apply:** Capacity is released purely because every capacity/availability query excludes `paymentStatus = 'refunded'` — so a refund needs no separate inventory write. Guard refunds: reject if any leg is checked in, if already fully refunded, or if not paid. Do the re-check + status flip in ONE transaction with `.for("update")` row locks so a concurrent check-in can't slip between guard and update. Admin direct refund is editor-only and expands a single leg id to the whole order before updating.

## Carnival capacity is DISPLAY-ONLY, paid-count, and NEVER hard-blocks a purchase
`registrations.ts` carnival capacity is a soft, paid-only number used purely for the home-page / purchase-page display. `getDateCounts` (home `/registrations/availability`) counts ONLY `paymentStatus='paid'` (`isPaidLeg`) + `isCarnivalLeg`. Neither `/registrations` (single) nor `/registrations/combo` enforce a sold-out cap anymore — both insert regardless of count; there is no SOLD_OUT response on the carnival paths. When a date's `remaining<=0` the UI shows "名額有限" (NOT "已額滿"/"售完") and the date stays purchasable.
**Why:** Product decisions — (a) abandoned/unpaid checkouts were inflating "剩餘名額" and blocking real buyers, so count only paid; (b) organizer wants to keep selling past the listed cap (they expand on-site), so capacity must never stop a sale.
**How to apply:** `capacityForDate()` / `DATE_CAPACITY` (7/25 & 7/26 = 1000, others `DEFAULT_DAILY_CAPACITY` 500) feeds DISPLAY only. Do NOT reintroduce a carnival sold-out/insufficient block on single or combo. If you ever need real inventory control, add a temporary reservation/expiry instead of a hard cap. The 戰鬥陀螺賽 128-cap is the ONLY remaining hard sold-out block and must stay. Avoid static buyer copy that claims a fixed "每日限量 N 名 / 額滿為止".

## Admin overview still separates HELD vs PAID (different surface from public capacity)
The admin overview intentionally still distinguishes seats that merely HOLD capacity (`paymentStatus NOT IN ('failed','refunded')`) from seats actually PAID (`= 'paid'`); "未付款預訂" = held − paid. This admin held/paid split was NOT migrated to paid-only and is independent of the public carnival capacity rule above.
**Why:** Admins want visibility into in-progress (unpaid) reservations; the public page wants confirmed attendance. They are deliberately different now.
**How to apply:** Always exclude refunded AND failed from "held"; use `isCarnivalLeg` to drop tournament legs. Per-session paid count is safe to sum across dates (combo = one leg per date, no double count).

## Combo = one registration row per day
A two-day combo is multiple registration rows sharing one `paymentRef`, each with its own `qrToken` and `eventDate`. The buyer needs ALL legs' QRs, so confirmation emails must be sent per leg (buyer email is copied onto every leg).

## Tournament (戰鬥陀螺賽) is a separate inventory from carnival admission
Tournament rows live on the same date (7/26) as general carnival admission but belong to their own cap (128 competitors), tracked by `ticketType IN ('tournament','tournament-companion')`. Participant legs (`tournament`, 600, includes own entry) consume the 128 cap; companion legs (`tournament-companion`, 200, general 7/26 entry) do NOT.
**Why:** Mixing them either lets tournament sales eat the 500/day general cap or lets companions falsely fill competitor slots.
**How to apply:** Anywhere the 500/day carnival capacity is computed (availability endpoints, transactional `countForDate`, admin `/admin/stats` and `/admin/sales-overview` session-capacity), the query MUST exclude tournament leg types. Revenue/trend/paid-total aggregates intentionally still INCLUDE tournament sales. The 128 competitor count sums only `ticketType='tournament'`. Capacity check is serialized with an advisory lock keyed `"tournament"` + re-count inside the insert transaction.
