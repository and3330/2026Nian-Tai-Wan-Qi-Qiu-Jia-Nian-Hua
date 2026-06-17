---
name: Stripe webhook path mismatch
description: Why the Stripe webhook route path must match the Stripe dashboard URL and the /api/payments/* convention
---

# Stripe webhook path must match what Stripe actually calls

The Stripe webhook route (registered raw, before `express.json()`, in api-server `app.ts`) must live at
`/api/payments/stripe/webhook` — matching both the URL configured in the Stripe dashboard and the
`/api/payments/*` convention used by every other payment route.

**Why:** It was originally registered at `/api/stripe/webhook` while Stripe POSTed to
`/api/payments/stripe/webhook`. The mismatch returned **404** on every webhook, so payments were never
marked paid server-side. The result page polled forever (customer saw no success), and customers
re-ordered → duplicate orders. A path mismatch fails silently — there is no error, just 404s in the logs.

**How to apply:** If customers report "paid but no confirmation" or duplicate orders, check the deployment
logs for `POST /api/payments/stripe/webhook` (or any payment callback) returning 404 first. Keep the code
route, the Stripe dashboard URL, and the NewebPay notify/return URLs all consistent. `markPaymentPaid` is
atomic/idempotent, so retried/duplicate callbacks are safe. Note: webhook signature verification is skipped
when `STRIPE_WEBHOOK_SECRET` is unset — production must have it set or forged "paid" events become possible.
