# Inventory — Internal Mobile Device Inventory

Production MVP for tracking inventory levels, stock adjustments, and audit logs. Product catalog is seeded from [BigM Mobile](https://bigmmobile.com.au/) public shop data via the included crawler.

## Stack

- **Next.js 15** (App Router, TypeScript, RSC)
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (PostgreSQL, Auth, RLS)
- **Vercel** (deployment target)

## Environments

Three ways to run the app — switch by npm script or env file:

| Profile | Command | Database | When to use |
|---------|---------|----------|-------------|
| **Local Postgres** | `npm run dev:local` | Real PostgreSQL in Docker (`supabase start`) | Daily dev & integration tests |
| **Supabase Cloud** | `npm run dev:cloud` | Your online Supabase project | Staging / shared team DB |
| **In-memory mock** | `npm run dev:mock` | No DB (RAM only) | Quick UI check, no Docker |

```text
env/local.env          →  npm run dev:local   (committed, local keys)
env/cloud.env          →  npm run dev:cloud   (you create from example, gitignored)
(no env file)          →  npm run dev:mock
```

---

## Local Postgres setup (recommended)

Uses [Supabase CLI](https://supabase.com/docs/guides/cli) to run **real PostgreSQL + Auth** on your machine. Same code as cloud — only the env file changes.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started):

```bash
brew install supabase/tap/supabase
```

### First-time setup

```bash
cd bigmmobile-clone
npm install

# Start Postgres + Auth, run migrations + seed.sql, create dev user
npm run setup:local
```

This runs:

1. `supabase start` — local stack on `http://127.0.0.1:54321`
2. `supabase db reset` — applies `supabase/migrations/*.sql` + `supabase/seed.sql`
3. `npm run db:user` — creates login `demo@local.dev` / `demo123`

### Run the app

```bash
npm run dev:local
```

Open [http://localhost:3000](http://localhost:3000) → log in with `demo@local.dev` / `demo123`.

### Useful local DB commands

| Command | Description |
|---------|-------------|
| `npm run db:start` | Start local Supabase (Docker) |
| `npm run db:stop` | Stop local stack |
| `npm run db:status` | Show URLs and keys |
| `npm run db:reset` | Drop DB, re-run migrations + `seed.sql` |
| `npm run db:user` | Create dev auth user |
| `npm run seed:local` | Import full crawler catalog (~4.5k rows) |
| `npm run setup:local` | start + reset + dev user |

**Supabase Studio** (local DB UI): [http://127.0.0.1:54323](http://127.0.0.1:54323)

---

## Supabase Cloud setup

When you're ready to connect to your online project:

```bash
cp env/cloud.env.example env/cloud.env
# Edit env/cloud.env with keys from Supabase → Project Settings → API
```

Run migrations once in **SQL Editor** (or `supabase link` + `supabase db push`):

1. `supabase/migrations/000_create_tables.sql`
2. `supabase/migrations/001_inventory_rls.sql`

Create an Auth user in the dashboard, then:

```bash
npm run dev:cloud
npm run seed:cloud   # optional full catalog import
```

---

## Mock mode (no database)

Fastest option — no Docker, no Supabase:

```bash
npm run dev:mock
```

Log in with any email/password. Data lives in memory and resets on restart.

---

## Project structure

```
bigmmobile-clone/
├── env/
│   ├── local.env           # Local Postgres keys (committed)
│   └── cloud.env.example   # Cloud template → copy to cloud.env
├── supabase/
│   ├── config.toml         # Local stack config
│   ├── migrations/         # Schema + RLS
│   └── seed.sql            # Sample rows on db reset
├── bigm-crawler/
├── scripts/
└── src/
```

## Features

- **Auth**: Email/password login; middleware protects `/dashboard/*`
- **Category navigation**: Sidebar tabs for All Products, Phones, Cases, Tablets, Parts, Accessories, Repair, Other
- **Dashboard KPIs**: Total units, inventory value (cost × qty), low-stock alert (qty 1–2), SKU count
- **Products table**: Search, brand filter, low-stock toggle, +/- stock adjustment with toast feedback
- **Add product**: Dialog form with category + validation; writes `INITIAL_ADD` to `stock_logs` when qty > 0
- **Audit trail**: Every adjustment writes to `stock_logs` (`ADJUSTED_UP` / `ADJUSTED_DOWN`)

### Category routes

| Sidebar link | URL |
|--------------|-----|
| All Products | `/dashboard/products/all` |
| Phones | `/dashboard/products/phones` |
| Cases | `/dashboard/products/cases` |
| Tablets | `/dashboard/products/tablets` |
| Parts | `/dashboard/products/parts` |
| Accessories | `/dashboard/products/accessories` |
| Repair | `/dashboard/products/repair` |
| Other | `/dashboard/products/other` |

Crawler categories (~409 raw labels) are mapped into these 7 groups via [`src/lib/categories.ts`](src/lib/categories.ts).

### Backfill categories after upgrade

If you already seeded products before categories were added:

```bash
# Apply migration (or full reset)
supabase migration up
# OR: npm run db:reset

# Re-import with category mapping (preserves existing stock quantities)
npm run seed:local
```

## Deploy to Vercel

1. Push repo to GitHub; import in Vercel (root = repo root).
2. Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In Supabase Auth → URL Configuration, add your Vercel URL to redirect allow list.
4. Run migrations on production DB; seed once from your machine with `npm run seed:cloud`.

## All scripts

| Command | Description |
|---------|-------------|
| `npm run dev:local` | App → local PostgreSQL |
| `npm run dev:cloud` | App → Supabase cloud |
| `npm run dev:mock` | App → in-memory mock |
| `npm run setup:local` | First-time local DB bootstrap |
| `npm run db:reset` | Reset local DB + migrations + seed |
| `npm run seed:local` | Seed local DB from crawler JSON |
| `npm run seed:cloud` | Seed cloud DB from crawler JSON |
| `npm run build` | Production build |

## License

Private / internal use.
