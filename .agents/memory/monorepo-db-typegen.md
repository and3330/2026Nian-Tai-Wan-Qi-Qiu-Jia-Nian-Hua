---
name: lib/db type generation after schema changes
description: Why a new drizzle column can be invisible to api-server tsc until lib declarations are rebuilt.
---

# lib/db type generation after schema changes

`lib/db` is a composite TS project (`composite: true`, `emitDeclarationOnly`) that emits `.d.ts` into `lib/db/dist/`. `artifacts/api-server` consumes it through TS project `references`, so it type-checks against those emitted declarations, not the live `src`.

**Rule:** After editing any `lib/db/src/schema/*.ts` (e.g. adding a column), run `pnpm run typecheck:libs` (which is `tsc --build`) to regenerate `lib/db/dist/*.d.ts` BEFORE type-checking or trusting api-server's tsc.

**Why:** Without the rebuild, api-server tsc reads stale declarations and reports the new column as "does not exist" on insert/select types — a confusing error that looks like a code bug but is really a stale-typegen artifact.

**How to apply:** schema edit → `pnpm --filter @workspace/db push` (DB) → `pnpm run typecheck:libs` (types) → then per-artifact tsc.
