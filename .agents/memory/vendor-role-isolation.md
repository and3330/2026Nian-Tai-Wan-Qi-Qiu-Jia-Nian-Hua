---
name: Vendor role isolation
description: Rules for the booth-vendor (vendor) admin role and its data isolation boundaries
---

- The `vendor` admin role is hard-bound to one vendors row via `admin_users.vendor_id`; POS invoice attribution always comes from the session (resolvePosVendor), never from the request body.
- **Why:** vendors must only ever see/collect their own money; trusting client-sent vendorId would allow cross-merchant fraud.
- **How to apply:** any new vendor-facing endpoint must scope queries by `req.adminUser.vendorId` and reject unbound/inactive vendors. Authenticated-only ("any admin") endpoints are NOT safe anymore — the vendor role counts as authenticated, so aggregate/analytics endpoints must list explicit roles (viewer/editor/checkin). Role changes away from vendor must null vendorId (resolveVendorBinding handles this).
- POS lookup's recent-invoice double-issue warning is filtered to the vendor's own invoices when role=vendor.
