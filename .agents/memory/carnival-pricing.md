---
name: Carnival ticket pricing model
description: Adult/child pricing model for carnival admission and the promo-validate base-amount rule for mixed-price orders.
---

# Carnival ticket pricing model

Carnival admission has two price tiers per ticket type:
- Adult (滿6歲含以上): single 200, combo 300.
- Child (未滿6歲、115cm以下): single 50, combo 100.

`ticketCount` stores TOTAL heads (adults + children); `childCount` stores children; adults = `ticketCount - childCount`. Both adults and children consume the 500/day capacity, so capacity sums `ticketCount` and needs no change. Each order requires ≥1 adult; children cannot purchase alone.

Backward-compat: if a request omits `adultCount`, treat `ticketCount` as adults with `childCount = 0`.

## Promo validate must receive authoritative baseAmount for mixed-price orders
`POST /api/promo-codes/validate` falls back to `PROMO_PRICE_BOOK[ticketType] * ticketCount` (adult unit price × total heads) when the caller omits `baseAmount`.
**Why:** For orders containing children, that fallback over-counts (charges adult price for children), so the previewed discount and `finalAmount` diverge from the real charge.
**How to apply:** any caller with multiple unit prices in one order (adult+child) MUST pass `baseAmount` = the correctly-computed base total. The frontend passes `baseTotal`.
