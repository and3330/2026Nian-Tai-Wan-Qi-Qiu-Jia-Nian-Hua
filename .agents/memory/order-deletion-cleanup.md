---
name: Deleting an order must clean all paymentRef-linked tables
description: Why deleting registration rows alone is wrong, and the rule for deleting/cancelling an order.
---

An "order" is a group of `registrations` rows ("legs") sharing the same `paymentRef`. Several other tables are linked to it **by the `paymentRef` string, NOT a DB foreign key**: `payment_transactions` (unique per ref), `invoices`, `refund_requests`.

**Rule:** any hard-delete of an order must run in one DB transaction and remove, for every touched `paymentRef`: all registrations sharing the ref + payment_transactions + invoices + refund_requests. Delete by `paymentRef`, not just by the registration ids passed in, so an order is never left half-deleted. Ref-less / standalone registrations are deleted by id.

**Why:** because there are no FK constraints, deleting only registration rows silently leaves orphan financial records. Worse, a deleted-but-pending NewebPay order could still receive a notify callback. (Safe today: `markPaymentPaid()` returns early when the transaction row is missing, so a callback after the transaction is deleted is a no-op — keep that property if refactoring.)

**How to apply:** whenever building delete/cancel/cleanup flows for orders, enumerate every table keyed by `paymentRef` and clean them together transactionally. Don't assume cascading deletes exist — there are none.
