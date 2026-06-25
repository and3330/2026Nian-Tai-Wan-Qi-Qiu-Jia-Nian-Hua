---
name: Carnival ticket pricing model
description: Equal-price (adult=child) model for carnival admission and the promo-validate base-amount rule.
---

# Carnival ticket pricing model

Carnival admission charges the SAME price for adults and children (no child discount):
- Everyone: single 300/head, combo 500/head. (Two-day combo is framed as saving NT$100 vs 2× single = 600.)
- Prices live in `PRICE_BOOK` (registrations.ts) + `PROMO_PRICE_BOOK` (promo-codes.ts); frontend copy duplicates them in CarnivalPage/HomePage/AdGuidePage. Any price change must touch all of these in lockstep or the displayed price will mismatch the backend's exact-amount check and 400 the order.

Backend `resolveAmount` charges every head the adult unit price; the `CARNIVAL_CHILD_PRICE` override map is intentionally empty (children fall back to the adult price). Reintroduce a child tier only by adding entries there if policy changes again.

Infants under 1 are FREE (Option B): they occupy a capacity slot and get their own QR/email headcount line, but are excluded from the payable amount. `infantCount` stores them.

`ticketCount` stores TOTAL heads (adults + children + infants); `childCount` and `infantCount` store the splits; adults = `ticketCount - childCount - infantCount`. Pricing charges only adults+children (use a "paidHeads = adult+child" figure); capacity uses the full `ticketCount` ("totalHeads"). Frontend mirrors this: `totalHeads` for availability, `paidHeads` for price. The 3 count selectors mutually clamp so adult+child+infant ≤ 10 (capacity per order). Each order requires ≥1 adult; children/infants cannot purchase alone.

Backward-compat: if a request omits `adultCount`, treat `ticketCount` as adults with `childCount = 0`.

## Promo validate base-amount rule
`POST /api/promo-codes/validate` falls back to `PROMO_PRICE_BOOK[ticketType] * ticketCount` when the caller omits `baseAmount`. With equal pricing this fallback is now correct (one unit price per type), but callers should still pass an authoritative `baseAmount` (frontend passes `baseTotal`) to stay robust if a child tier is ever reintroduced.
