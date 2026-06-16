---
name: After api-spec codegen, rebuild lib declarations
description: Why web typecheck still errors with stale generated types after codegen
---

After editing `lib/api-spec/openapi.yaml` and running
`pnpm --filter @workspace/api-spec run codegen`, the generated **source**
(`lib/api-client-react/src`, `lib/api-zod/src`) is updated, but the artifacts
(e.g. balloon-carnival web) consume these workspace packages through TypeScript
project references, which resolve to each lib's built `dist/*.d.ts`.

So a fresh `tsc --noEmit` in the web app can still error with "Property X does
not exist on type Y" even though the new field is in the generated src.

**Fix:** run `pnpm run typecheck:libs` (root `tsc --build`) to regenerate the
composite libs' `dist/.d.ts`, then the web typecheck/build picks up the new
types. (api-server build is bundled with esbuild so it sees src directly and
doesn't need this.)
