# MacroMap

Personal-first nutrition tracker with optional multiuser support — fast diary
logging, shared chain-store menus with verified items, custom store builds,
full nutrition panels, fasting history, voice and natural-language logging,
weekly analysis, and exportable reports. Installable as an iPhone Safari PWA.

Exercise lives in Iron Log, recipes in The Cookbook — MacroMap does food only.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) + Lucide |
| Database | Neon Postgres + Drizzle ORM (`pg_trgm` for fuzzy duplicate detection) |
| Auth | Clerk (proxy middleware, webhook user sync) |
| Rate limiting | Upstash Redis (no-op locally when unset) |
| AI | Gemini (`@google/genai`) text generation (natural-language/voice parse, day analysis with rule-based fallback) |
| Speech | Web Speech API (browser-native, zero cost) |
| Barcode scan | Native `BarcodeDetector` with manual-entry fallback |
| PDF | React-PDF rendered in a Node route |
| Charts | Recharts (palette validated for CVD + contrast in both themes) |
| PWA | Serwist service worker, manifest, splash screens, safe-area CSS |

## Feature map

- **Diary** — Breakfast/Lunch/Dinner/Snacks plus custom buckets; log via
  search, barcode (camera or manual), voice, natural language ("2 eggs and a
  Subway footlong"), or saved-meal templates. Entries store immutable
  nutrition snapshots so later food edits never rewrite history.
- **Stores** — 11 seeded chains (top 10 US + MyProtein), official items with
  green verified badges, per-store accent theming (header/CTA/chips only;
  layout never shifts), ingredient-level custom builder with live nutrition,
  saved builds you can relog in one tap.
- **Shared food database** — open-write by design; trigram similarity warns
  before duplicates (`similarity > 0.4`), every edit is logged per-field in
  `food_edit_history` and shown on the food page.
- **Goals** — multiple profiles, per-day-of-week calorie/macro targets,
  one-tap activation.
- **Progress** — split dashboard: today's macros, 14-day calories vs goal,
  weight trend, body metrics log.
- **Fasting** — start/stop timer with live elapsed display and history.
- **Reports** — weekly summary API, CSV export (single file with a
  `record_type` discriminator), PDF export (streamed behind auth).

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in Clerk + Neon at minimum
pnpm db:migrate              # applies drizzle/migrations (enables pg_trgm)
pnpm db:seed                 # 11 stores, menus, ingredients, demo data
pnpm dev
```

Optional integrations degrade gracefully: without Upstash rate limits are
skipped; without `GEMINI_API_KEY` day-analysis falls back to rule-based
insights and natural-language logging returns 503; without `BARCODE_API_KEY`
(a free USDA FoodData Central key) the barcode pipeline stops after Open Food Facts.

### Clerk webhook

Point a Clerk webhook (user.created / user.updated / user.deleted) at
`/api/webhooks/clerk` and set `CLERK_WEBHOOK_SECRET`. Write routes also upsert
the user row lazily, so local dev works without a tunnel.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server (Turbopack; service worker disabled) |
| `pnpm build` | Production build (`--webpack`, required by Serwist on Next 16) |
| `pnpm test` | Vitest suite (40 tests: nutrition math, Zod boundaries, CSV, weekly summary, insights, dates/theming) |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm db:generate` / `db:migrate` / `db:seed` | Drizzle schema → SQL → apply → seed |
| `pnpm icons` | Regenerate PWA icons + splash screens from the SVG mark |

## Architecture notes

- **Immutable diary snapshots** — `diary_entries.nutrition_snapshot_json`
  stores label + scaled totals at log time; quantity edits rescale the stored
  snapshot rather than re-reading the (possibly edited) shared food.
- **Server-computed nutrition** — custom store orders only accept ingredients
  that belong to that store and compute the snapshot server-side.
- **Lazy DB client** — `src/lib/db/index.ts` proxies Drizzle creation so
  `next build` needs no `DATABASE_URL`. neon-http has no transactions;
  multi-statement writes are sequential by design.
- **Duplicate detection** — GIN trigram index over
  `name || ' ' || coalesce(brand_name, '')`; `POST /api/foods` returns a
  `duplicate_warning` payload unless `forceCreate` is set.
- **Store theming** — theme tokens live in Postgres; the store page sets CSS
  variables (`--primary`, `--cta`, `--store-*`) on a scoped wrapper, with
  luminance-based text contrast and an optional per-store override.
- **iPhone PWA** — black-translucent status bar, safe-area insets owned by the
  edge components (sticky header / bottom nav), `touch-action: manipulation`
  everywhere tappable, and 16px inputs on coarse pointers to kill focus zoom.

## Deploying

Vercel + Neon + Clerk production instance: set the env vars from
`.env.example`, run `pnpm db:migrate && pnpm db:seed` against the production
branch, then verify the PWA checklist on a real iPhone (install from Share →
Add to Home Screen, standalone launch, no pinch zoom, store accent shift).
