---
name: Payment method classification
description: Where the real payment sub-method (CVS/ATM/credit) lives and how to map it for revenue splits.
---

The buyer's actual payment sub-method is NOT a top-level column. For NewebPay it lives at
`payment_transactions.raw_result -> 'Result' ->> 'PaymentType'` (the nested `Result` object —
the top-level `raw_result->>'PaymentType'` is always null).

Mapping used for the admin revenue split:
- provider `stripe` → 信用卡 (always card)
- provider `bank` → 銀行／臨櫃匯款 (manual transfer)
- NewebPay `PaymentType`: `CREDIT`→信用卡, `VACC`/`WEBATM`→ATM／網路ATM, `CVS`/`BARCODE`→超商繳費
- anything else / manual confirm (no Result) → 其他／手動確認

**Why:** the gateway only records the sub-method inside the settlement callback JSON, not in a column.

**How to apply:** for any per-method money report, join paid `registrations` to `payment_transactions`
on `payment_ref`, filter `payment_status='paid'` (excludes refunds), and `SUM(registrations.amount)`
(combo legs put the full amount on the first leg, 0/null on others, so this avoids double-counting).
Real data lives in production; dev DB is essentially empty.
