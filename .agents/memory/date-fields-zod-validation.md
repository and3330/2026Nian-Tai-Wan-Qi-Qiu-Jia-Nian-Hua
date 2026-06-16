---
name: Date fields — drizzle vs zod response validation
description: Why date-only columns 500 on response .parse() and how the spec must model them
---

Routes validate their JSON output with the generated zod schemas (e.g. `SomeResponse.parse(rows)`).
Drizzle returns two different runtime types for date-ish columns:
- `timestamp` columns (e.g. createdAt, checkedInAt) → JS `Date` objects.
- `date` columns declared `mode: "string"` (e.g. eventDate) → plain `"YYYY-MM-DD"` strings.

The orval zod config uses `useDates: true`, so any spec field with `format: date` OR
`format: date-time` generates `zod.date()`. That means a date-only column (string at runtime)
fails `zod.date()` with `ZodError: "Expected date, received string"`, and the route returns 500.

**Why this hid for so long:** `.parse([])` on an empty array passes, so endpoints look healthy
until the table actually has rows (first real production registration triggered it).

**Rule:** in `lib/api-spec/openapi.yaml`, model date-ONLY values as a plain `type: string`
(no `format: date`) on every RESPONSE schema, so zod generates `zod.string()`. Keep real
timestamps as `format: date-time` (drizzle Date passes `zod.date()`). Leave request-body
schemas alone — changing them alters the client contract/types unnecessarily.

**Also:** the frontend compares eventDate as an exact `"YYYY-MM-DD"` string (date pickers,
refund day filters). Never serialize eventDate as an ISO datetime — it must stay `"YYYY-MM-DD"`.

After editing the spec, run `pnpm --filter @workspace/api-spec run codegen`, then rebuild
api-server + web. Restart the api workflow so dev picks up the regenerated bundled deps.
