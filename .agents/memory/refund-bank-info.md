---
name: Refund bank-info collection flow
description: Rules for the tokenized refund bank-account form and role-based redaction of bank PII.
---

# Refund bank-info collection flow

- Refunds are wired manually by staff: after a buyer submits a refund request, the system emails a tokenized link (`/refund-info/:token`, 32-hex unguessable token stored on refund_requests) where the buyer fills purchase info + bank account. Admins can resend this email from the back-office. Buyer-facing copy must always state refunds take 7–14 working days.
- **Bank account details are financial PII.** Admin refund list/detail endpoints are readable by viewer/checkin roles, so bank fields (and the form token) MUST be redacted server-side for non-editor roles. **Why:** an architect review flagged full bank data leaking to check-in staff. **How to apply:** any new endpoint returning refund_requests rows must run them through the redaction helper unless editor-gated.
- The bank-info email is fire-and-forget on request submission (failures logged, admin can resend); email recipient = buyerContact if it's an email, else the order's registration email.
- Approving a refund (single or bulk) must void the whole order: registrations → refunded, payment transaction → refunded (in one DB transaction), then best-effort ECPay invoice void OUTSIDE the transaction with the outcome surfaced to the admin (never silently swallowed).
- Refund-request creation must stay atomic per order (advisory lock keyed on paymentRef around check+insert) or concurrent submissions create duplicate pending requests.
- Bulk admin operations process ids independently and report per-id results so one bad row never blocks the batch.
