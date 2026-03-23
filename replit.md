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

### Features
- **Home/Exhibition**: Hero section with event info, exhibition zones visible to all visitors (no login required)
- **Registration**: Ticket booking with 500/day capacity per date (July 23-26, 2026), no login required
- **News**: Latest announcements with detail pages
- **Contestants**: Balloon art competition showcase with scores
- **Sponsors**: Tiered sponsor display (platinum/gold/silver/bronze) with external links
- **Admin Dashboard**: Protected by username/password login. Registration monitoring, CSV export, news/contestant/sponsor CRUD
- **Admin Auth**: Custom login system (username: 1, password: aa3210). No Replit Auth / OIDC.

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
