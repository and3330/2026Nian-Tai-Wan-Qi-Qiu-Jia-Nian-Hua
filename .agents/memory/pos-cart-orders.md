---
name: POS cart orders
description: 現場 POS 購物車結帳的架構規則（金額重算、vendor 隔離、發票由訂單開立）
---
- POS 結帳金額一律在伺服器端以 DB 目前商品價格重算，不信任前端傳來的價格；商品必須歸屬結帳攤位（vendorId null=主辦方）。
- paymentMethod（cash/credit_card/online/apple_pay）僅為紀錄，不串金流。
- **Why:** 用戶明確不做線上金流；前端價格可被竄改。
- 發票由 pos_orders 開立（品名帶商品明細、paymentRef 沿用訂單 POS- 編號）；重複開立以 order.invoiceId + invoice status guard。
- vendor 角色的任何商品/訂單/發票操作都必須經 resolvePosVendor（驗證綁定且 active），不可直接比對 req.adminUser.vendorId——後者曾被 architect 判為隔離漏洞。
- **How to apply:** 新增任何 /admin/pos/* 端點時沿用此模式。
