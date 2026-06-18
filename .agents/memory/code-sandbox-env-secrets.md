---
name: Code sandbox masks secret values
description: The code_execution sandbox cannot read secret VALUES; viewEnvVars only reports presence, so external-API calls needing secrets must run in the deployed app.
---

# Code sandbox masks secret values

In the `code_execution` JS sandbox, `process.env` is undefined, and `viewEnvVars({keys})` returns `{envVars, secrets, runtimeManaged}` where `secrets` maps each requested key to a **boolean presence flag**, NOT the real value.

**Why:** Tried to call NewebPay's QueryTradeInfo API directly from the sandbox to verify which pending orders were actually paid; the merchant credentials came back as `true`/`true`/`true`, so the API rejected the call (`商店資料取得失敗`).

**How to apply:** Any task that must call a third-party API using a project secret (NewebPay query, signed requests, etc.) cannot be done from the code sandbox. Implement it as an endpoint/job inside the deployed app (which has the real env values) and trigger it there. The sandbox is fine for read-only production DB queries via `executeSql`, just not for secret-bearing outbound calls.
