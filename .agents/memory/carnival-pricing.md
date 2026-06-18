---
name: Carnival ticket pricing model
description: Equal-price (adult=child) model for carnival admission and the promo-validate base-amount rule.
---

# Carnival ticket pricing model

Carnival admission charges the SAME price for adults and children (no child discount):
- Everyone: single 200/head, combo 300/head.

Backend `resolveAmount` charges every head the adult unit price; the `CARNIVAL_CHILD_PRICE` override map is intentionally empty (children fall back to the adult price). Reintroduce a child tier only by adding entries there if policy changes again.

`ticketCount` stores TOTAL heads (adults + children); `childCount` stores children; adults = `ticketCount - childCount`. The adult/child split is kept ONLY for headcount/capacity/stats, not pricing. Both consume the 500/day capacity, so capacity sums `ticketCount`. Each order requires ≥1 adult; children cannot purchase alone.

Backward-compat: if a request omits `adultCount`, treat `ticketCount` as adults with `childCount = 0`.

## Promo validate base-amount rule
`POST /api/promo-codes/validate` falls back to `PROMO_PRICE_BOOK[ticketType] * ticketCount` when the caller omits `baseAmount`. With equal pricing this fallback is now correct (one unit price per type), but callers should still pass an authoritative `baseAmount` (frontend passes `baseTotal`) to stay robust if a child tier is ever reintroduced.
