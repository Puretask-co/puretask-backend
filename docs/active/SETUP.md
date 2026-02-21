# Setup (Local Development)

**What it is:** How to run PureTask backend locally (clone, env, migrate, run).  
**What it does:** Gets a new contributor from zero to a running dev environment.  
**How we use it:** Follow in order when cloning the repo; use with ARCHITECTURE and DEPLOYMENT for prod.

---

## Prerequisites

- **Node.js** — LTS version (e.g. 18 or 20). Check: `node -v`
- **npm** or **pnpm** — for installing dependencies
- **Neon** (or Postgres) — database. Sign up at https://neon.tech and create a project to get `DATABASE_URL`
- **Stripe** — test keys from https://dashboard.stripe.com (optional for full payments)

## Environment variables

The app loads variables from a **`.env` file in the repo root** (same folder as `package.json`). That file is not in git; you must create it and add your own values (e.g. Neon connection string).

Copy `.env.example` to `.env` in repo root, or create `.env` with at least:

```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
JWT_SECRET=your-strong-random-secret-at-least-64-chars
JWT_EXPIRES_IN=30d
```

Optional for local: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `TWILIO_*`. See `.env.example` for the full list.

**Check that the database is reachable:** Run `npm run db:check`. If it says "DATABASE_URL is not set", add `DATABASE_URL=postgresql://...?sslmode=require` to `.env` (get the URI from Neon Dashboard → Connection string). If the DB still doesn't work, see [TROUBLESHOOTING.md — Database Connection Issues](./TROUBLESHOOTING.md).

## Install

1. **Clone** the repo (if not already).
2. **Install deps:** `npm install` (or `pnpm install`).
3. **DB migrations:** run `npm run db:migrate` (see `package.json`). The build step copies `src/config/cleanerLevels/contracts/*.json` into `dist/` so event contract validation works in production (see RUNBOOK §4.4).
4. **Seed** (if applicable): `npm run seed:gamification` for gamification config.
5. **Gamification:** Canonical spec is the uploaded bundle: [gamification_bundle/README.md](./gamification_bundle/README.md) (index) and lead doc [gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md](./gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md). Config in `src/config/cleanerLevels/` (goals, levels, rewards); contract JSON in `src/config/cleanerLevels/contracts/`. Rules and constants summary: [ARCHITECTURE §3.5](./ARCHITECTURE.md). Runtime config loader polls every 2 min (DB active versions + static fallback).

## Run locally

- **Backend:** `npm run dev` or `npm start` (typically port 4000).
- **Health:** `curl http://localhost:4000/health` and `curl http://localhost:4000/health/ready`.

Frontend, n8n, and workers are separate; see ARCHITECTURE and RUNBOOK for how they connect.

### Trust-Fintech frontend (port 3001)

- **Frontend .env.local:** Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000` so the app talks to this backend. **Use `http://` not `https://`** in local dev (backend does not serve TLS).
- **Backend CORS:** Allows `http://localhost:3000` and `http://localhost:3001`. Socket.IO uses `FRONTEND_ORIGIN` or `FRONTEND_URL` (default `http://localhost:3001`).
- **Backend .env:** Set `FRONTEND_URL=http://localhost:3001` if your frontend runs on 3001 (see `.env.example`).
- Trust contract: `/api/credits`, `/api/billing`, `/api/appointments`. Send `Authorization: Bearer <token>`. Check-in/check-out with photos: `/tracking/:jobId/check-in` and `/tracking/:jobId/check-out`.

### API verification script

From repo root (backend must be running: `npm run dev`):

```bash
API_BASE=http://localhost:4000 TEST_EMAIL=client@test.com TEST_PASSWORD=TestPass123! node scripts/run-api-verification.js
```

- **✅ GET /health passes** — backend is up; you should see JSON `{ ok: true }` at http://localhost:4000/health.
- **✅ POST /auth/login passes** — backend returns `{ token, user }`. Use an email/password for a user that exists and can log in (e.g. create via **POST /auth/register** with `{ email, password, role: "client" }`, then run verification with that email/password). Seed data in `000_SEED_TEST_DATA.sql` uses dummy password hashes, so login with those emails will fail unless you register real users.
- If health passes but login fails with **connection timeout**: DB (e.g. Neon) is slow or unreachable; connection timeout was increased to 20s for dev. Retry after a few seconds or check DATABASE_URL and Neon status.

### Dashboard stubs (404/500 stabilizers)

So the Cleaner Dashboard and related UI don’t break when the full API isn’t implemented yet, the backend exposes **stub** endpoints that return empty/safe JSON:

- **GET /bookings/me** → `{ bookings: [] }` (auth required)
- **GET /cleaners/:cleanerId/reviews** → `{ reviews: [], page, per_page, total: 0 }` (auth required)
- **GET /cleaner/dashboard/analytics** and **GET /cleaner/goals** return stub data on DB/query failure instead of 500

Defined in `src/routes/dashboardStubs.ts` and in `cleanerEnhanced.ts` (fallback). Replace with real DB-backed implementations when ready.

## Database setup (existing or partial schema)

If you have an **existing** database that was created with an older migration set, run the one-time fix before the consolidated schema:

```bash
node scripts/run-migration.js DB/migrations/000_FIX_credit_ledger_delta_credits.sql
npm run db:migrate
```

The fix script drops conflicting credit views, adds missing columns (`credit_ledger.delta_credits`, `cleaner_profiles.stripe_connect_id` / `stripe_account_id`), and ensures a placeholder user `DEFAULT` exists for seed data. If you still see errors (e.g. FK or type mismatches), the cleanest option is to use a **fresh** database: create a new Neon branch or new Postgres database, set `DATABASE_URL` to it, then run `npm run db:migrate` only (no fix script needed on an empty DB).

### Fresh DB path (clean setup / new data)

For a **new** project or when you want a clean schema (e.g. new gamification data switch):

1. Create a new database (Neon branch, or new Postgres instance).
2. Set `DATABASE_URL` to that database. Do **not** run any fix script.
3. Run **only** `npm run db:migrate` (applies `000_COMPLETE_CONSOLIDATED_SCHEMA.sql`).
4. Optionally run seed: `npm run seed:gamification` (if available).
5. If you need event-style safety reports for gamification, run `057_pt_safety_reports.sql` after the consolidated schema (see [DB/migrations/README.md](../DB/migrations/README.md)).

See RUNBOOK §1 for production deploy; RUNBOOK §4.4 and [BUNDLE_SWITCH_GAP_ANALYSIS.md](./BUNDLE_SWITCH_GAP_ANALYSIS.md) for gamification/new-data notes.

## Common setup problems

- **Port in use** — Change `PORT` in `.env` or stop the process using the port.
- **Missing env vars** — Ensure `DATABASE_URL` and `JWT_SECRET` are set; see `.env.example`.
- **DB connection errors** — Check Neon dashboard, SSL (`?sslmode=require`), and firewall.
- **Migration timeout** — Large consolidated migration can hit Neon connection timeout; retry once, or run against a fresh DB.

## Testing

### Run tests

- `npm run test` — Run all tests (vitest)
- `npm run test:smoke` — Smoke tests only
- `npm run test:integration` — Integration tests only
- `npm run test:coverage` — With coverage report

Unit tests and contract tests use mocks where needed (auth, DB). Integration and smoke tests require `TEST_DATABASE_URL` or `DATABASE_URL` and `JWT_SECRET`.

### Environment variables for tests

| Test suite | Required env vars | Optional |
|------------|-------------------|----------|
| Unit tests (vitest) | `DATABASE_URL` or `TEST_DATABASE_URL`, `JWT_SECRET` | — |
| Integration tests | `TEST_DATABASE_URL` (preferred) or `DATABASE_URL` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` for Stripe tests |
| Smoke tests (full app) | `TEST_DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET` | Redis, SendGrid, Twilio for full flows |
| v1CoreFeatures | `TEST_DATABASE_URL`, `JWT_SECRET` | Applied NEON patches (job_status, cleaner_availability, credit_ledger) |
| v1Hardening | `TEST_DATABASE_URL`, `JWT_SECRET` | `STRIPE_SECRET_KEY` for Stripe webhook tests |
| payoutWeekly (unit) | None (mocks DB, Stripe, env) | — |

### Test database setup

1. Create a Neon branch or separate DB for tests.
2. Run `TEST_DATABASE_URL=... node scripts/setup-test-db.js` to apply schema + NEON patches.
3. Run `npm run test` or `npm run test:integration`.

**NEON patch order** (in setup-test-db.js): consolidated schema → gamification 041–056 → `000_NEON_PATCH_existing_db` → `000_NEON_PATCH_job_status_disputed` → `000_NEON_PATCH_cleaner_availability` → `000_NEON_PATCH_test_db_align`. The last patch fixes FKs (payouts, cleaner_availability), `is_cleaner_available` uuid/text cast, and `job_event_type` for integration tests.

For deployment to Railway, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### Archive non-active docs (Section 3, optional)

Obsolete or duplicate docs outside `docs/active/` (e.g. under `docs/deployment/`, `docs/testing/`, `docs/guides/`, `docs/status-reports/`) may be moved to `docs/archive/raw/` with a clear filename (e.g. `legacy-DeployToRailway.md`). Do not move anything referenced from [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) or [RUNBOOK.md](./RUNBOOK.md). Canonical docs live in `docs/active/` only.

---

## What to do next — detailed guide

Step-by-step instructions after the gamification bundle work: verify build, set up DB, configure env, run app/workers, optional tests and deploy. Use with [RUNBOOK.md](./RUNBOOK.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [BUNDLE_SWITCH_GAP_ANALYSIS.md](./BUNDLE_SWITCH_GAP_ANALYSIS.md).

**Already done for you (in repo):** Build step copies contract JSON to `dist/`; `npm run verify` runs build + 21 unit tests (gamification + event contract). You can re-run `npm run verify` anytime. **You still need to:** set up your database (Step 2), fill `.env` (Step 3), run the app locally (Step 4), and when ready deploy (Step 6). Steps 5, 7, 8 are optional.

### Quick checklist (order of operations)

| Step | What to do | Section below |
|------|------------|----------------|
| 1 | Verify build and unit tests | 1 |
| 2 | Set up database (fresh or existing) | 2 |
| 3 | Configure environment variables | 3 |
| 4 | Run the app and workers locally | 4 |
| 5 | (Optional) Run integration tests | 5 |
| 6 | Deploy to production when ready | 6 |
| 7 | (Optional) Enable strict event contract or run 057 | 7 |
| 8 | (Optional) Fix remaining test skips / metrics coverage | 8 |

### 1. Verify build and unit tests

1. **Install:** `npm ci`
2. **One command for build + unit tests:** `npm run verify` — runs build (including contract copy) and gamification + event-contract tests (21 tests). You should see `copy-contracts: copied 3 file(s)...` and all tests pass.
3. Or run separately: `npm run build` then `npm run test -- --run src/lib/gamification src/config/cleanerLevels/contracts`. Optional: `npm run test` for full suite.

**Done when:** `npm run verify` (or build + test) succeeds.

### 2. Set up the database

**Option A — Fresh database (recommended for new env or clean gamification data)**

1. Create a new database (Neon branch or new Postgres).
2. In `.env`: `DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require`
3. Run **only** the consolidated schema: `npm run db:migrate` (no fix script).
4. Optional seed: `npm run seed:gamification`
5. Optional: if you need event-style safety reports, run: `node scripts/run-migration.js DB/migrations/057_pt_safety_reports.sql` — see [RUNBOOK §4.4](./RUNBOOK.md).

**Option B — Existing database**

1. Back up the DB.
2. Run fix first: `node scripts/run-migration.js DB/migrations/000_FIX_credit_ledger_delta_credits.sql`
3. Then: `npm run db:migrate`
4. If you still see FK/column errors, consider a fresh DB (Option A); see “Fresh DB path” above in this doc.

**Done when:** You can connect and the app starts without schema errors.

### 3. Configure environment variables

1. Copy: `cp .env.example .env`
2. Fill required: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `PORT`. See `.env.example` for the full list.
3. Optional for local: `GAMIFICATION_ENABLED` (set to `false` to disable gamification), `STRICT_EVENT_CONTRACT` (set to `true` to validate events against the contract).
4. For production: set all secrets in Railway (or your host); see [DEPLOYMENT.md](./DEPLOYMENT.md).

**Done when:** `.env` has required variables and the app can start.

### 4. Run the app and workers locally

1. **Start API:** `npm run dev` (or `npm run build && npm start`)
2. **Health:** `curl http://localhost:4000/health` and `curl http://localhost:4000/health/ready` — expect `ok: true`
3. **Workers (optional):** Scheduler: `npm run worker:scheduler`. If `CRONS_ENQUEUE_ONLY=true`, also run: `npm run worker:durable-jobs:loop`. See [RUNBOOK §1.3](./RUNBOOK.md).

**Done when:** Health endpoints succeed and you can call protected routes with a valid JWT.

### 5. (Optional) Run integration tests

1. Use a test DB: set `DATABASE_URL` or `TEST_DATABASE_URL` and run migrations on it.
2. Run: `npm run test:integration`
3. Known skips: see [TROUBLESHOOTING.md — Integration tests: known skips and status](./TROUBLESHOOTING.md) (onboardingFlow full flow, v1Hardening webhook, v2Features stuckJobDetection; dispute/V3 not skipped but may need correct DB/cleanup).

**Done when:** Suite runs and you’ve accepted or fixed current skips.

### 6. Deploy to production

1. Read [DEPLOYMENT.md](./DEPLOYMENT.md).
2. Create production DB; set `DATABASE_URL` in the host; run migrations (e.g. `npm run db:migrate` in a one-off or CI).
3. Set all required env vars in Railway (see DEPLOYMENT.md): `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, Stripe, n8n, `FRONTEND_URL`, optionally `SENTRY_DSN`, `CRONS_ENQUEUE_ONLY=true`.
4. Build and start: `npm ci && npm run build` (contracts are copied automatically), then start API, scheduler, and (if applicable) durable job worker. See DEPLOYMENT for exact commands.
5. Verify production health and critical routes.

**Done when:** Production API and workers are running and health checks pass.

### 7. (Optional) Enable strict event contract or run 057

- **STRICT_EVENT_CONTRACT:** Set `STRICT_EVENT_CONTRACT=true` in production (or local) to validate `POST /cleaner/events` against the event contract. Contract JSON is already copied to `dist/` by the build. See [RUNBOOK §4.4](./RUNBOOK.md).
- **057 pt_safety_reports:** Run only if you need the safety-reports table: `node scripts/run-migration.js DB/migrations/057_pt_safety_reports.sql`. See [RUNBOOK §4.4](./RUNBOOK.md), [BUNDLE_SWITCH_GAP_ANALYSIS.md §5.2](./BUNDLE_SWITCH_GAP_ANALYSIS.md).

**Done when:** You’ve enabled the flag or run 057 only if needed.

### 8. (Optional) Follow-ups: tests and metrics

- **Integration tests:** Un-skip or fix onboarding full flow, v1Hardening webhook, v2Features stuckJobDetection; adjust cleanup order if FK errors occur. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
- **Metrics contract:** List keys from `src/config/cleanerLevels/contracts/metrics_contract_v1.json` and cross-check with `metricsCalculator`; optionally use `event_to_metric_mapping_v1.json`. See [BUNDLE_SWITCH_GAP_ANALYSIS.md §5.3](./BUNDLE_SWITCH_GAP_ANALYSIS.md).

**Done when:** You’ve addressed the items you care about.

### Reference: key docs

| Topic | Doc |
|-------|-----|
| Local setup | This file (SETUP.md) |
| Ops and health | [RUNBOOK.md](./RUNBOOK.md) |
| Deploy and env | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Known issues | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Gamification checklist | [BUNDLE_SWITCH_GAP_ANALYSIS.md](./BUNDLE_SWITCH_GAP_ANALYSIS.md) |
| Event contract / 057 | [RUNBOOK.md §4.4](./RUNBOOK.md) |
