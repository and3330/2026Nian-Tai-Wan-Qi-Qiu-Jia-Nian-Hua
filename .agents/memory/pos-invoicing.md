---
name: On-site POS e-invoice rules
description: Constraints for issuing standalone ECPay e-invoices from the staff POS scanner (cash sales at the venue).
---

# On-site POS e-invoice rules

- ECPay B2C personal invoices with Print=0 and no donation MUST have a carrier. POS supports two carriers: ECPay member carrier (綠界會員載具, email-bound — refuse tickets without email) and the customer's phone-barcode carrier (手機條碼 `/^\/[0-9A-Z.+-]{7}$/`, normalize trim+uppercase; no email needed since reg.phone satisfies the gateway's email-or-phone rule). **Why:** issuing without a carrier fails at the gateway.
- The POS QR scanner is shared between ticket QR and carrier Code39 scans via a scan-target ref; every scanner stop/failure path must reset it to "ticket" or later ticket scans get routed into the carrier field.
- POS invoices are standalone (cash collected in person): they are NOT tied to payment_transactions. They use a synthetic paymentRef `POS-<regId>-<timestamp>` so they surface in the existing invoice admin page and can be voided there.
- **How to apply:** any new invoice-issuing path must either attach a carrier / tax ID / love code, or set Print=1 with a buyer name; and any invoice row should always be persisted before calling ECPay so failures leave a `failed` row with the error message.
- Dev environment uses the PRODUCTION ECPay invoice credentials (secrets set) — never test-issue real invoices from dev; verify only lookup/validation paths.
