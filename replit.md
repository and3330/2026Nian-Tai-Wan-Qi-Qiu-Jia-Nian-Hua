# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Auth**: Custom username/password admin login (session-based)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── balloon-carnival/   # 2026 臺灣氣球嘉年華 React frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── replit-auth-web/    # Admin auth client (AuthProvider + useAuth hook)
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## Project: 2026 臺灣氣球嘉年華

### Dual-Audience Architecture
The website serves two distinct audiences with clear separation:
- **一般民眾 (General Public)** — `/carnival` page: AI教育科技, 親子手作坊, 氣球表演, 比賽展件參觀. Tickets: 200元/日, 300元/兩日套票. Dates: 7/25-26. Embedded visitor registration form.
- **業內同行 (Industry Professionals)** — `/conference` page (傳奇工匠研討會): 研習會, 五大交流活動, 大師工作坊, 交流大賽. Tickets: 5,000-12,000元. Dates: 7/23-26. Embedded professional registration form.

Homepage (`/`) has a dual-path entrance section ("氣球嘉年華購票" / "傳奇工匠研討會") directing users to the appropriate page.
Each activity page has its own embedded registration form — no standalone registration page.

### Features
- **Homepage**: Hero + dual-path entrance (嘉年華 vs 研討會) + schedule overview + news + ticket info
- **Carnival Page** (`/carnival`): Public activity page for general visitors with embedded ticket purchase form
- **Conference Page** (`/conference`): 傳奇工匠研討會 — professional workshops, competitions, embedded registration
- **News**: Latest announcements with detail pages
- **Sponsors**: Tiered sponsor display with external links
- **Admin Dashboard** (`/admin`): Protected by username/password login. 票務營運總覽 with KPIs (今日售票數, 累計收入, 累計售票, 剩餘名額), 每日售票趨勢 line chart (last 14 days), 各票種佔比 pie chart (per session date), 各日剩餘名額 stacked bar chart, 最新報名名單 table, and CSV export (with 票種, 入場日期, 單價, 小計, 付款狀態 columns). Plus news/contestant/sponsor CRUD.
- **Social Media Marketing** (admin): FB/IG/Threads OAuth binding, post creation/scheduling/publishing, calendar view, automation settings
- **Admin Auth**: Custom login system (username: 1, password: aa3210). No Replit Auth / OIDC.

### Navigation
首頁, 氣球嘉年華, 傳奇工匠研討會, 最新消息, 贊助廠商

### Admin Navigation
報名監控總覽, 現場報到, Email 模板, 最新消息管理, 研討會管理, 贊助廠商管理, 社群帳號, 社群貼文, 自動化設定

### Email & Reminders (Task #6)
- Registrations accept an optional `email`. When provided, a confirmation email with a personal QR code is sent immediately on registration.
- Each registration is assigned a unique `qrToken` (32 hex chars). The PNG render is served at `GET /api/qr/:token` (public, generated on demand by `qrcode`).
- A reminder scheduler (`services/reminder-scheduler.ts`) runs hourly inside the API server. It sends two reminders per registration: 7 days before the event (`weekReminderSentAt`) and 1 day before (`dayReminderSentAt`). Idempotent via timestamp columns.
- Email delivery uses `RESEND_API_KEY` when set (Resend HTTP API). Without the key, emails are logged to the server console — useful for development.
- Email templates are stored in `email_templates` (key, subject, body, updatedAt). Default templates for `confirmation`, `week_reminder`, `day_reminder` are seeded on boot. Admins can edit subject/body and send a test email from `/admin/email-templates`. Variables: `{{parentName}}`, `{{phone}}`, `{{eventDate}}`, `{{ticketCount}}`, `{{qrUrl}}`.
- Admin check-in lives at `/admin/checkin` — supports both manual token entry and on-device camera scanning (via `html5-qrcode`). Calls `GET /api/admin/checkin/lookup/:token` to preview the ticket and `POST /api/admin/checkin/:token` to mark `checkedInAt`. Re-scanning a checked-in ticket returns HTTP 409 with the original check-in timestamp.

### Ad Guide Page (`/ad-guide`)
Meta (Facebook/Instagram) advertising guide for the carnival. Contains 3 ad copy variants (溫馨家庭風, 限量緊迫風, 活動亮點風), step-by-step Meta Ads Manager setup tutorial, and user journey with UTM parameter examples. Print-friendly layout with copy-to-clipboard buttons.

### Payment & Invoice
- **Payment methods** (3): NewebPay (信用卡/ATM via 藍新), Stripe Checkout (海外信用卡), 銀行轉帳 (匯款後人工確認).
- **Flow**: registration → `PaymentMethodModal` → `/api/payments/initiate` → provider redirect/form post or bank info screen → `/payment/result` polling page.
- **NewebPay notify** (`/api/payments/newebpay/notify`) verifies AES+SHA256, marks paid, then auto-issues ECPay invoice. Test creds built-in; production override via `NEWEBPAY_MERCHANT_ID/HASH_KEY/HASH_IV/MPG_URL` (set MPG_URL to `https://core.newebpay.com/MPG/mpg_gateway`).
- **Stripe webhook** (`/api/stripe/webhook`) mounted BEFORE `express.json` with raw body parser; `checkout.session.completed` marks paid + auto-issues invoice. Best-effort `confirmStripePayment` from result page covers webhook delays.
- **Bank transfer** stays in `awaiting_transfer` until admin marks paid (no auto-issuance until paid).
- **ECPay 電子發票 (B2C v3.0)**: `lib/ecpay-invoice.ts` — AES-128-CBC + URLencode + Base64 against `https://einvoice-stage.ecpay.com.tw` (test creds built-in; override via `ECPAY_INVOICE_MERCHANT_ID/HASH_KEY/HASH_IV`). Supports 個人 (手機條碼/自然人憑證/綠界載具/紙本), 公司 (統編), 捐贈 (愛心碼). Auto-issued in `markPaymentPaid`; lifecycle pending→issued/failed→voided stored in `invoices` table.
- **Admin endpoints** (cookie auth): `POST /api/payments/invoices/:ref/retry` re-issues failed/pending invoices; `POST /api/payments/invoices/:ref/void` calls B2CInvoice/Invalid (auto-strips `+HH:MM:SS` from invoiceDate).

### Database Tables
- `sessions` - Admin auth sessions
- `users` - Legacy user table (unused after auth migration)
- `registrations` - Event registrations (parent_name, phone, email, ticket_count, event_date, ticket_type, amount, payment_method, payment_status, payment_ref, qr_token, checked_in_at, confirmation_email_sent_at, week_reminder_sent_at, day_reminder_sent_at)
- `payment_transactions` - Payment orders (payment_ref, provider, amount, item_name, payer_email, status, provider_trade_no, paid_at, raw_result)
- `invoices` - ECPay 電子發票 (payment_ref, invoice_type, carrier_type/num, tax_id, company_title, love_code, invoice_number, invoice_date, random_number, status, raw_response, issued_at, voided_at)
- `email_templates` - Editable email templates (key: `confirmation` | `week_reminder` | `day_reminder`, subject, body)
- `news` - News articles (title, content, summary)
- `contestants` - Competition participants (name, description, image_url, score)
- `sponsors` - Sponsor information (name, logo_url, website_url, tier)
- `exhibitions` - Exhibition zones (name, description, location, open/close times)
- `social_marketing_accounts` - Connected social media accounts (FB/IG/Threads OAuth tokens)
- `social_posts` - Social media posts (content, platforms, scheduling, publish status)
- `marketing_automation_settings` - Automation config (auto-scheduler, auto-hashtag, notifications)

### API Endpoints
- `GET /api/exhibitions` - List exhibition zones
- `POST /api/registrations` - Create registration (with capacity check, optional email triggers confirmation send + QR generation)
- `GET /api/registrations/availability` - Check remaining tickets per date
- `GET /api/qr/:token` - Public PNG of a registration's QR code (used in confirmation emails and success screens)
- `GET /api/admin/checkin/lookup/:token` - Admin: preview a ticket and its check-in status
- `POST /api/admin/checkin/:token` - Admin: mark a ticket as checked-in (409 if already checked-in)
- `GET /api/admin/email-templates` - Admin: list editable email templates
- `PUT /api/admin/email-templates/:key` - Admin: update template subject/body
- `POST /api/admin/email-templates/:key/test` - Admin: send a sample render of the template to a recipient
- `GET /api/news` - List news articles
- `GET /api/news/:id` - Get single news article
- `GET /api/contestants` - List contestants
- `GET /api/sponsors` - List sponsors
- `GET /api/admin/registrations` - Admin: list registrations
- `GET /api/admin/registrations/export` - Admin: CSV export
- `GET /api/admin/stats` - Admin: registration stats per event date
- `GET /api/admin/sales-overview` - Admin: aggregated ticketing KPIs, daily sales trend (14d), ticket-type breakdown, session availability
- `POST/PUT/DELETE /api/admin/news/:id` - Admin: news CRUD
- `POST/PUT/DELETE /api/admin/contestants/:id` - Admin: contestant CRUD
- `GET/POST/PUT/DELETE /api/admin/sponsors/:id` - Admin: sponsor CRUD
- Auth endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/user`
- `GET /api/admin/social-accounts` - List connected social accounts
- `GET /api/admin/social-accounts/oauth-url/:platform` - Get OAuth URL (with CSRF state)
- `GET /api/admin/social-accounts/oauth-callback/:platform` - OAuth callback (state verified)
- `DELETE /api/admin/social-accounts/:id` - Remove social account
- `PATCH /api/admin/social-accounts/:id/toggle` - Enable/disable social account
- `GET /api/admin/social-posts` - List social posts
- `POST /api/admin/social-posts` - Create social post
- `PATCH /api/admin/social-posts/:id` - Update social post
- `DELETE /api/admin/social-posts/:id` - Delete social post
- `POST /api/admin/social-posts/:id/publish` - Publish post immediately
- `POST /api/admin/social-posts/preview` - Preview post content per platform
- `GET /api/admin/automation-settings` - List automation settings
- `PUT /api/admin/automation-settings/:key` - Update automation setting
- `POST /api/storage/uploads/request-url` - Request presigned upload URL (admin auth required)
- `GET /api/storage/objects/*` - Serve uploaded objects (public, for social media image access)
- `GET /api/storage/public-objects/*` - Serve public assets from Object Storage tool pane

### Social Media Integration
- **Facebook**: OAuth → pages_manage_posts, pages_read_engagement, pages_show_list, business_management
- **Instagram**: Auto-discovered via Facebook page linkage (instagram_business_account)
- **Threads**: Separate OAuth → threads_basic, threads_content_publish
- **Scheduler**: Checks every 60s for scheduled posts, gated by `auto_scheduler` setting
- **Auto-hashtag**: When enabled, appends default hashtags to all published content
- Required env vars: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, THREADS_APP_ID, THREADS_APP_SECRET

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server with custom admin auth, registration system, news, contestants, sponsors, exhibitions, social marketing, and admin routes.

### `artifacts/balloon-carnival` (`@workspace/balloon-carnival`)
React + Vite frontend for the 2026 Taiwan Balloon Carnival website. Uses Tailwind CSS, shadcn/ui, wouter routing, React Query, and custom admin auth.

### `lib/db` (`@workspace/db`)
Drizzle ORM schema + PostgreSQL connection. Tables: sessions, users, registrations, news, contestants, sponsors, exhibitions, social_marketing_accounts, social_posts, marketing_automation_settings.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI 3.1 spec and Orval codegen config.

### `lib/api-zod` (`@workspace/api-zod`)
Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)
Generated React Query hooks and fetch client.

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)
Admin auth client providing AuthProvider context and useAuth() hook for login/logout/session state.

### `lib/object-storage-web` (`@workspace/object-storage-web`)
Uppy v5-based file upload components (ObjectUploader, useUpload hook) for uploading files to Replit Object Storage via presigned URLs.

### `scripts` (`@workspace/scripts`)
Utility scripts package.
