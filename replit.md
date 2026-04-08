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
- **一般民眾 (General Public)** — `/carnival` page: AI教育科技, 親子手作坊, 氣球表演, 比賽展件參觀. Tickets: 200元/日, 300元/兩日套票. Dates: 7/25-26.
- **業內同行 (Industry Professionals)** — `/contestants` page: 研習會, 五大交流活動, 大師工作坊 (人偶拉線技法, W大型裝置技法), 交流大賽. Tickets: 5,000-12,000元. Dates: 7/23-26.

Homepage (`/`) has a dual-path entrance section ("我想參觀嘉年華" / "我是氣球同行") directing users to the appropriate page.
Registration page (`/registration`) has an identity selector splitting into visitor vs professional registration flows.

### Features
- **Homepage**: Hero + dual-path entrance (嘉年華 vs 同行) + schedule overview + news + ticket info
- **Carnival Page** (`/carnival`): Public activity page for general visitors with 4 highlights, schedule, pricing
- **Contestants/Exchange Page** (`/contestants`): Professional exchange with workshops, 5 competition rules, schedule, pricing
- **Registration**: Identity-based split — visitors see 7/25-26 dates (200/300元); professionals see ticket tiers (5K/8K/12K)
- **News**: Latest announcements with detail pages
- **Sponsors**: Tiered sponsor display with external links
- **Admin Dashboard**: Protected by username/password login. Registration monitoring, CSV export, news/contestant/sponsor CRUD
- **Admin Auth**: Custom login system (username: 1, password: aa3210). No Replit Auth / OIDC.

### Navigation
首頁, 氣球嘉年華, 同行交流會, 報名訂票, 最新消息, 贊助廠商

### Database Tables
- `sessions` - Admin auth sessions
- `users` - Legacy user table (unused after auth migration)
- `registrations` - Event registrations (parent_name, phone, ticket_count, event_date)
- `news` - News articles (title, content, summary)
- `contestants` - Competition participants (name, description, image_url, score)
- `sponsors` - Sponsor information (name, logo_url, website_url, tier)
- `exhibitions` - Exhibition zones (name, description, location, open/close times)

### API Endpoints
- `GET /api/exhibitions` - List exhibition zones
- `POST /api/registrations` - Create registration (with capacity check)
- `GET /api/registrations/availability` - Check remaining tickets per date
- `GET /api/news` - List news articles
- `GET /api/news/:id` - Get single news article
- `GET /api/contestants` - List contestants
- `GET /api/sponsors` - List sponsors
- `GET /api/admin/registrations` - Admin: list registrations
- `GET /api/admin/registrations/export` - Admin: CSV export
- `GET /api/admin/stats` - Admin: registration stats
- `POST/PUT/DELETE /api/admin/news/:id` - Admin: news CRUD
- `POST/PUT/DELETE /api/admin/contestants/:id` - Admin: contestant CRUD
- `GET/POST/PUT/DELETE /api/admin/sponsors/:id` - Admin: sponsor CRUD
- Auth endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/user`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)
Express 5 API server with custom admin auth, registration system, news, contestants, sponsors, exhibitions, and admin routes.

### `artifacts/balloon-carnival` (`@workspace/balloon-carnival`)
React + Vite frontend for the 2026 Taiwan Balloon Carnival website. Uses Tailwind CSS, shadcn/ui, wouter routing, React Query, and custom admin auth.

### `lib/db` (`@workspace/db`)
Drizzle ORM schema + PostgreSQL connection. Tables: sessions, users, registrations, news, contestants, sponsors, exhibitions.

### `lib/api-spec` (`@workspace/api-spec`)
OpenAPI 3.1 spec and Orval codegen config.

### `lib/api-zod` (`@workspace/api-zod`)
Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)
Generated React Query hooks and fetch client.

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)
Admin auth client providing AuthProvider context and useAuth() hook for login/logout/session state.

### `scripts` (`@workspace/scripts`)
Utility scripts package.
