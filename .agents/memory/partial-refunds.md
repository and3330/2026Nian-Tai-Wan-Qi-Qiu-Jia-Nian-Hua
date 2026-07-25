---
name: Partial refund model
description: Rules for ticket-count-based (partial) refunds in the refund_requests flow.
---

- Refund amounts must be computed from the order's *remaining* (non-refunded) registration amounts, never from `payment_transactions.amount` — the tx row keeps the original full amount, so after a partial refund it over-refunds.
  **Why:** carrying-amount leg is decremented on partial approval; tx stays untouched/paid.
  **How to apply:** any new refund-math code should sum `amount` over regs with `paymentStatus !== 'refunded'`.
- Partial approval semantics: tickets stay valid, tx stays paid, invoice is NOT auto-voided (manual allowance reminder); only full refunds mark regs+tx refunded and void invoices.
- Re-application after an approved partial refund must be allowed: duplicate guard blocks only `pending` requests; the "already refunded" gate is `every(refunded)`, not `some`.
- Concurrency: buyer submission runs eligibility + duplicate check + insert in one txn under a per-order advisory lock with regs `FOR UPDATE`; admin PATCH uses a conditional `WHERE status='pending'` update and checks rowcount (TOCTOU).
- Combo legs do NOT share a qrToken — each day's leg has its own token; only the primary leg carries ticketType/amount (second leg has both null). totalHeads = sum ticketCount over typed legs; never group by qrToken. Partial approval must deduct all combo legs together as one group.
- Checked-in orders ARE refundable (policy decision, back-office discretion): no checked-in gate on buyer/admin submission; on partial approval, `checkedInCount` is clamped to the new ticketCount.
- All admin-initiated refunds go through refund_requests (POST /admin/refund-requests with reason → bank-info email → approve in 退票管理). The legacy direct-refund endpoint was removed — do not reintroduce a direct "mark refunded" path.
- NewebPay credit auto-refund on approval: gate on provider='newebpay' + raw_result.Result.PaymentType='CREDIT'; Close(CloseType=2) first, Cancel-authorization fallback only for full refunds (cancel is always full-amount). Best-effort after the DB txn — gateway failure never rolls back approval; result persisted in auto_refund_* columns.
- effectiveRefundAmount is the single source for both the gateway refund and the registration amount deduction: request amount; if null → full = order remaining amount, partial = remaining × count/totalHeads (rounded). Never let a null request amount silently become 0.
