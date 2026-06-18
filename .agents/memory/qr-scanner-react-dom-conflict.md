---
name: html5-qrcode + React DOM conflict
description: Why the check-in scanner target div must stay free of React children
---

The check-in QR scanner uses `html5-qrcode` (dynamically imported). The library
injects its own `<video>`/canvas DOM nodes directly into the element whose `id`
you pass to `new Html5Qrcode(id)`.

**Rule:** the scanner target `<div id=...>` must have NO React-rendered children
ever. Put any placeholder text, error message, or overlay in *sibling* elements,
not inside the target div.

**Why:** if React also manages children inside the same node (e.g. a conditional
`{!scanning && "點擊開始掃描"}` placeholder), then when scanning toggles, React
tries to remove/replace a child that html5-qrcode has already restructured. React
throws a `removeChild`/`NotFoundError` during reconciliation, which is uncaught and
**blanks the entire page to white** (looks like the page "won't open"). It is a code
bug, not a missing browser plugin/permission.

**How to apply:** keep the target div empty; toggle its visibility with a class
(`hidden`) instead of conditionally rendering content inside it. Same applies to the
file-scan target div used by `scanFile`.
