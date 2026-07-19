---
name: Stale chunk after redeploy
description: Handling "Failed to fetch dynamically imported module" errors in production after a new deploy
---

- Every production deploy changes Vite's hashed chunk filenames; visitors with a stale cached page fail any lazy `import()` (e.g. the camera scanner module) with "Failed to fetch dynamically imported module".
- **Why:** staff kept the check-in/POS page open across deploys and the camera button broke on-site.
- **How to apply:** keep the global `vite:preloadError` listener in the web entry (reload once, sessionStorage-guarded 60s) and keep the friendly "系統剛更新，請重新整理" branch in camera error messages. Any new lazy-loaded feature gets this for free — don't remove the listener.
