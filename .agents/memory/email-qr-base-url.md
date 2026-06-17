---
name: Email QR base URL must be stable & public
description: Why QR images in transactional emails break for some recipients, and the rule for building their URLs.
---

QR codes embedded in emails are `<img src>` pointing at the public `/api/qr/:token` endpoint. The base URL is resolved from env, NOT the request.

**Rule:** the email base URL must resolve to a stable, publicly-reachable production domain — never the ephemeral workspace dev domain (`*.replit.dev`), which stops resolving once the workspace sleeps and leaves already-sent QR images broken.
- Precedence: `PUBLIC_BASE_URL` → `REPLIT_DOMAINS[0]` → `REPLIT_DEV_DOMAIN` (dev domain last). Pin `PUBLIC_BASE_URL=https://2026balloon.tw` in the production env so it is deterministic.

**Why:** "some confirmation emails have broken QR" was caused by emails whose base resolved to the ephemeral dev domain. Also, many email clients block remote images by default, so a remote QR alone is never 100% reliable.

**How to apply:** always include a clickable fallback link to the same QR URL beneath the image so recipients whose client blocks remote images can still open it. Do NOT switch to pure CID inline embedding — Gmail (web) blocks inline CID inconsistently. A stable remote URL + fallback link is the most compatible approach. Fixing the base URL only helps *future* sends; already-sent emails need a manual "resend confirmation" to be remediated.
