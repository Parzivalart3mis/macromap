# MacroMap — Audit Plan (Pass 1)

## Executive Summary

MacroMap is a MyFitnessPal-parity nutrition PWA (Next.js 16 App Router, TypeScript,
Tailwind v4, Neon Postgres + Drizzle, Clerk, Vercel). Solo-maintained, ~1 real user
today, expected <10 in six months, ~<5 hrs/week available. Priority: **logging &
goal-math correctness**. Calibration therefore biases hard to **S**; hostile-traffic
hardening is never rated above P3 at this user count.

**This is a well-built codebase.** The audit spent most of its effort trying to break
the two categories that actually matter here — multi-tenant correctness and
logging/goal math — and largely failed to, which is the finding. Concretely
(all [verified]): every mutating API route scopes to the authenticated user or is
intentionally open-write and documented (`foods` PATCH); `proxy.ts` enforces
`auth.protect()` on all non-public routes; the nutrition math (`scaleNutrition`,
`sumNutrition`, `roundNutrition`), goal layering (`layerGoal`, `deltaCalories` = 4/4/9),
serving math (`computeServing`), and date/day-of-week handling are correct and, for the
math, unit-tested; weight logging is a proper `(userId, date)` upsert; CSP/HSTS/nosniff
headers are set; the verified-badge lookup is batched (no N+1).

So the plan is deliberately thin. Two small, additive, zero-risk fixes are worth doing
now, both serving the stated priority (robustness of the diary) or basic resilience:
a **max bound on diary-entry quantity** (a fat-finger can't silently corrupt a day's
totals), and an **error boundary + not-found page** (a render error currently drops to
a dead screen with no recovery). Everything else is deferred: the dependency-audit
advisories require package bumps (off-limits per the autonomy rules) and are low real
risk (unused MCP/hono transitive paths + a dev CLI); clickjacking headers and a fasting
TOCTOU are P3 hardening that only matters past current scale; the splash-on-marketing
behavior is a daily-used behavior not to be changed unasked. The 11 lint warnings are a
knowingly-accepted idiom. No findings were retracted; none needed to be.

## Ground Truth

- **Branch:** already `main` (Step 0 migration skipped). Remote: `origin` → github.com/Parzivalart3mis/macromap.
- **Baseline (the bar every commit must clear):**
  - `pnpm typecheck` — clean.
  - `pnpm lint` — **0 errors, 11 warnings** (idiomatic `load()`-in-effect / set-state-in-effect).
  - `pnpm test` — **8 files, 77 tests, all pass**.
  - `pnpm build` — succeeds.
  - `pnpm audit` — **42 transitive advisories** (1 low / 22 moderate / 19 high), all via `@google/genai` → `@modelcontextprotocol/sdk` → `hono`, and the `shadcn` CLI.
- **Auth:** `src/proxy.ts` (Next 16's renamed middleware) — `clerkMiddleware` + `auth.protect()` on non-public routes; per-route `requireDbUser`/`requireUserId`.

## Findings

### FUNC-01 — Diary-entry quantity/servingMultiplier have no upper bound
**Status:** [verified]
**Evidence:** src/lib/validations/diary.ts — `quantity: z.number().positive()`, `servingMultiplier: z.number().positive().default(1)` (create) and the same in the update schema; no `.max()`.
**Problem:** A mistaken large value (e.g. a pasted/fat-fingered `1000000`) is accepted and silently multiplied into the day's totals and the food's snapshot.
**Impact:** Corrupts the core artifact of the priority journey (the day's calorie/macro total) with no guard. Low likelihood at one user, but the diary is exactly what this project is about.
**Fix:** Add a generous `.max()` (well above any real serving count) to `quantity` and `servingMultiplier` in both the create and update schemas. Purely additive — rejects only absurd input.
**Priority:** P2   **Effort:** S   **Depends on:** —
**Action:** IMPLEMENT

### ARCH-01 — No error boundary or not-found page
**Status:** [verified]
**Evidence:** `find src/app` for `error.tsx` / `global-error.tsx` / `not-found.tsx` returns nothing.
**Problem:** Any unhandled render error in a client component bubbles to Next's default production error screen (a bare "Application error"); a bad URL hits the default 404. Neither offers recovery.
**Impact:** For a PWA in daily use, one render error becomes a dead white screen with no "reload" affordance. Resilience gap.
**Fix:** Add a route-segment `src/app/error.tsx` (reset + reload), a root `src/app/global-error.tsx`, and a `src/app/not-found.tsx`. Purely additive.
**Priority:** P2   **Effort:** S   **Depends on:** —
**Action:** IMPLEMENT

### SEC-01 — No clickjacking protection (frame-ancestors / X-Frame-Options)
**Status:** [verified]
**Evidence:** next.config.ts `csp` sets `frame-src` but no `frame-ancestors`; no `X-Frame-Options` header.
**Problem:** The app (incl. Clerk auth pages) can be embedded in a hostile iframe.
**Impact:** Clickjacking — hostile-traffic hardening, not a real threat at ~1 user.
**Fix (for later):** add `"frame-ancestors 'none'"` to the CSP array.
**Priority:** P3   **Effort:** S   **Depends on:** —
**Action:** DEFERRED — P3 hostile-traffic hardening; not material at <10 users (one-line fix noted for when scale grows).

### SEC-02 — Transitive dependency advisories (42)
**Status:** [verified]
**Evidence:** `pnpm audit` — 1 low / 22 moderate / 19 high, all via `@google/genai` → `@modelcontextprotocol/sdk` → `hono` and the `shadcn` CLI.
**Problem:** Known-vulnerable transitive versions in the tree.
**Impact:** Low real risk here — the MCP/hono paths are not exercised by the app (it calls `generateContent`, not MCP), and `shadcn` is a dev/CLI tool.
**Fix:** dependency version bumps.
**Priority:** P3   **Effort:** M   **Depends on:** —
**Action:** DEFERRED — requires package major bumps (off-limits per autonomy rules); low real risk. Re-audit after any `@google/genai` upgrade.

### FUNC-02 — Fasting start has a TOCTOU on the concurrent-session guard
**Status:** [verified]
**Evidence:** src/app/api/fasting/start/route.ts — SELECT-for-active then INSERT; two simultaneous starts could both pass the check.
**Problem:** Racing double-start could create two open fasting sessions.
**Impact:** Cosmetic at one user; would need a partial unique index to fix properly.
**Priority:** P3   **Effort:** M   **Depends on:** —
**Action:** DEFERRED — P3; needs a partial unique index (a migration on existing rows); not material at this scale.

### UX-01 — Splash renders on every full load, including the marketing route
**Status:** [verified]
**Evidence:** `SplashScreen` is mounted in the root `src/app/layout.tsx`, so it precedes the cinematic landing page too.
**Problem:** The branded splash (which helps perceived load of the app shell) is slightly redundant before the landing page's own hero.
**Impact:** Minor polish. The audit asked whether a splash helps: **it does** for the app shell — keep it; only its scope is debatable.
**Priority:** P3   **Effort:** S   **Depends on:** —
**Action:** DEFERRED — changing where the splash shows alters a behavior the owner sees daily; not to be changed unasked. Recommendation recorded, not implemented.

### Lint warnings (11) — knowingly accepted
0 errors, 11 warnings, all `react-hooks/set-state-in-effect` from the idiomatic `useEffect(() => { load() }, [load])` data-loading pattern used throughout. Cosmetic; not worth churn at <5 hrs/week. Accepted; the bar stays "0 errors, ≤11 warnings".

### No significant findings
- **[SEC] tenant scoping / auth** — verified clean (per-route + proxy.ts).
- **[FUNC] nutrition & goal math, dates, serving math** — verified correct; math is unit-tested.
- **[PERF]** — verified-badge lookup batched; queries indexed; ±1-day prefetch reasonable.
- **[TEST]** — 8 files / 77 tests cover the correctness-critical pure functions.
- **[DEPLOY]** — CSP/HSTS/headers set; PWA/Serwist; build passes; branch already `main`.
- **[FEAT]** — feature-rich already; no material gap this pass.

## Roadmap

| ID | Title | Priority | Effort | Depends on | Action |
|----|-------|----------|--------|-----------|--------|
| FUNC-01 | Bound diary-entry quantity/servingMultiplier | P2 | S | — | IMPLEMENT |
| ARCH-01 | Error boundary + not-found page | P2 | S | — | IMPLEMENT |
| SEC-01 | Clickjacking header (frame-ancestors) | P3 | S | — | DEFERRED |
| SEC-02 | Transitive dependency advisories | P3 | M | — | DEFERRED |
| FUNC-02 | Fasting start TOCTOU | P3 | M | — | DEFERRED |
| UX-01 | Scope splash off the marketing route | P3 | S | — | DEFERRED |

**Ordering:** FUNC-01 and ARCH-01 are independent; implemented in category order (FUNC → ARCH). No finding causes another.

## Deferred (with reasons)

- **SEC-01** — P3 hostile-traffic hardening; immaterial at <10 users.
- **SEC-02** — needs package major bumps (off-limits); low real risk (unused transitive paths + dev CLI).
- **FUNC-02** — P3; proper fix needs a partial unique index / migration; immaterial at one user.
- **UX-01** — would change a daily-used behavior unasked; recommendation only.
