---
name: API response columns require spec + codegen
description: Why a new DB column does not reach the frontend until openapi.yaml + codegen are updated.
---

Admin/API list & lookup responses are validated with `SomeResponse.parse(rows)` (zod), which **strips unknown keys**. Adding a column to a drizzle table is NOT enough — the value is silently dropped before it reaches the client.

**Why:** e.g. `/admin/registrations` does `AdminListRegistrationsResponse.parse(rows)`; the shared `Registration` schema lives in `lib/api-spec/openapi.yaml` and feeds both admin-list and check-in (`CheckinLookupResponse.registration`).

**How to apply:** to expose a new registration field end-to-end:
1. add the column in `lib/db/src/schema/registrations.ts` and `pnpm --filter @workspace/db push`
2. add the property to the relevant schema in `lib/api-spec/openapi.yaml` (the `Registration` component covers admin-list + check-in)
3. `pnpm --filter @workspace/api-spec run codegen` to regenerate `@workspace/api-zod` + `@workspace/api-client-react`
4. typecheck (`pnpm run typecheck:libs`, then api-server + web)

Note: `db.select()` includes every schema column, so production must have the column (push/migrate) before deploy or all queries on that table 500 at the SQL layer.
