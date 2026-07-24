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
- totalHeads for combo orders = group regs by qrToken, take max ticketCount per group, sum (legs share the same people).
