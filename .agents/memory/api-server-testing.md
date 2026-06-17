---
name: api-server testing
description: How integration tests are set up and run for artifacts/api-server
---

# api-server integration tests

The api-server uses **vitest + supertest** (run via `pnpm --filter @workspace/api-server run test`). Tests live in `artifacts/api-server/test/` (NOT in `src/`), which keeps them out of the build/typecheck tsconfig (`include: ["src"]`).

**Key decisions:**
- Tests mount the real route router on a minimal express app (`makeTestApp` in `test/helpers.ts`) instead of importing `src/app.ts`, because `app.ts` has boot-time side effects (seeds email templates, starts the hourly reminder `setInterval`).
- Tests run against the **shared dev Postgres** (`DATABASE_URL`), not an isolated DB. To stay safe and deterministic, every row a test creates is tagged with a `__torTEST__` prefix in `parent_name`; cleanup deletes only `parent_name LIKE '__torTEST__%'` rows. **Never** truncate/delete unscoped — real data lives in the same table.
- Capacity tests fill inventory to the cap with directly-inserted marker rows (`seedParticipants`) relative to the *current* live count, so they don't assume an empty table.
- `vitest.config.ts` sets `fileParallelism: false` so suites sharing the DB don't race on capacity counts.

**Why:** there was no test infra before; this pattern lets integration tests run against the real schema without provisioning a separate DB and without corrupting dev data.

**Pre-existing unrelated failure:** `pnpm --filter @workspace/api-server run typecheck` fails at `src/routes/payments.ts` (`Property 'user' does not exist on Request`) independent of tests — don't be alarmed.
