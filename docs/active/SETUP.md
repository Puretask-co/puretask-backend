# Setup (Local Development)

**What it is:** How to run PureTask backend locally (clone, env, migrate, run).  
**What it does:** Gets a new contributor from zero to a running dev environment.  
**How we use it:** Follow in order when cloning the repo; use with ARCHITECTURE and DEPLOYMENT for prod.

**Scope rule (docs governance):** This file is canonical for local setup and first-run flow. Keep deep operational incident handling in `RUNBOOK.md`, deployment-specific production procedures in `DEPLOYMENT.md`, and historical detail in archive/reference docs.

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

**Optional — S3/R2 job photo uploads:** For signed PUT URLs (client uploads directly to bucket), set: `STORAGE_PROVIDER` (s3 or r2), `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`; for R2 also set `STORAGE_ENDPOINT` (e.g. `https://<accountid>.r2.cloudflarestorage.com`). Optional: `STORAGE_PUBLIC_BASE_URL` (CDN or bucket public URL for photo display). Same code works for S3 and R2; only env changes. See `src/lib/storage.ts` and routes: `POST /uploads/sign`, `POST /jobs/:jobId/photos/commit`.

**Check that the database is reachable:** Run `npm run db:check`. If it says "DATABASE_URL is not set", add `DATABASE_URL=postgresql://...?sslmode=require` to `.env` (get the URI from Neon Dashboard → Connection string). If the DB still doesn't work, see [TROUBLESHOOTING.md — Database Connection Issues](./TROUBLESHOOTING.md).

### Switching from test DB to real DB

The app uses **one** database at a time: whatever is in `DATABASE_URL`. There is no code switch for "test" vs "real" — you change the environment.

| Where | What to do |
|-------|------------|
| **Local (.env)** | Replace `DATABASE_URL` with your **real** Postgres URL (e.g. production Neon or your live DB). Use `?sslmode=require` for Neon/cloud. Restart the server (`npm run dev`). |
| **Production (Railway etc.)** | In the service Variables, set `DATABASE_URL` to the production database connection string. Redeploy or restart so the process picks up the new value. |
| **Tests** | `TEST_DATABASE_URL` is only for **npm test** / integration tests: if set, tests use it instead of `DATABASE_URL` so tests don’t touch your real DB. Leave it unset when running the app. |

**Also when going to “real”:**

- **Stripe:** For real payments use live keys: `STRIPE_SECRET_KEY=sk_live_...`, `STRIPE_WEBHOOK_SECRET=whsec_...` from your live Stripe webhook. The app warns if you use a test key in production or a live key in development.
- **NODE_ENV:** Set `NODE_ENV=production` in production so auth and safety checks run correctly (see DEPLOYMENT.md).

### Transfer data from test DB to real DB

If you’ve been using the test DB by mistake and want to copy that data into the real DB:

**Neon host reference (this repo):**

- **Test DB:** `ep-small-unit-af97hhtw-pooler.c-2.us-west-2.aws.neon.tech`
- **Production DB:** `ep-fragrant-bird-afmlkke1-pooler.c-2.us-west-2.aws.neon.tech`

Store full connection strings only in `.env` or environment; never commit them.

1. **Confirm which DB the app uses**  
   Run: `node scripts/check-which-db.js` — it prints host and database (no passwords).

2. **Dump from the test DB (source)**  
   Set `SOURCE_DATABASE_URL` to your **test** connection string (ep-small-unit...), then:
   ```powershell
   pg_dump $env:SOURCE_DATABASE_URL --no-owner --no-acl -f test_db_dump.sql
   ```
   Or CMD: `pg_dump "%SOURCE_DATABASE_URL%" --no-owner --no-acl -f test_db_dump.sql`

3. **Ensure production has the schema**  
   Set `DATABASE_URL` to your **production** connection string (ep-fragrant-bird...), then:
   ```bash
   npm run db:migrate
   ```

4. **Restore into production (target)**  
   Set `TARGET_DATABASE_URL` to the same **production** URL, then:
   ```powershell
   psql $env:TARGET_DATABASE_URL -f test_db_dump.sql
   ```
   **Warning:** If production already has data, this can create duplicates or conflicts. For an empty production DB it’s fine. Otherwise use a new Neon branch as target or restore only specific tables.

5. **Point the app at production**  
   In `.env`, set `DATABASE_URL` to the **production** (ep-fragrant-bird) connection string. Set `TEST_DATABASE_URL` to the **test** (ep-small-unit) URL so `npm test` uses test. Restart the server. Run `node scripts/check-which-db.js` to confirm.

**Note:** You need `pg_dump` and `psql` (PostgreSQL client tools) installed. See also [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).

### Full schema dump (indexes, constraints, triggers) with pg_dump

`npm run db:dump:schema` uses a **Node-only** script that writes basic `CREATE TABLE` definitions. For a **full** schema dump (indexes, constraints, triggers, sequences, etc.), use the real PostgreSQL tools:

**1. Install PostgreSQL client tools**

| OS | How |
|----|-----|
| **Windows** | Install [PostgreSQL](https://www.postgresql.org/download/windows/) (e.g. from EDB). During setup, optionally install only “Command Line Tools”. After install, add the `bin` folder to PATH, e.g. `C:\Program Files\PostgreSQL\16\bin`. Or use [Chocolatey](https://chocolatey.org): `choco install postgresql` (adds to PATH). |
| **macOS** | `brew install libpq` then `brew link --force libpq` (or add `$(brew --prefix libpq)/bin` to PATH). |
| **Linux** | `apt install postgresql-client` (Debian/Ubuntu) or `yum install postgresql` (RHEL). |

Check: open a **new** terminal and run `pg_dump --version` and `psql --version`. If both work, you’re done.

**2. Put both DB URLs in `.env`**

Use the same names the script expects (any of these work):

- `PROD_URL` and `TEST_URL`, or  
- `TARGET_DATABASE_URL` (production) and `SOURCE_DATABASE_URL` (test), or  
- `PRODUCTION_DATABASE_URL` and `TEST_DATABASE_URL`.

**3. Run the full schema dump**

```bash
node scripts/dump-schema-only.js
```

Or add to `package.json` scripts: `"db:dump:schema:full": "node scripts/dump-schema-only.js"` and run:

```bash
npm run db:dump:schema:full
```

This writes **prod.sql** and **test.sql** in the repo root with full DDL (tables, indexes, constraints, triggers, etc.). Those files are gitignored.

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

### Full-stack local verification (recommended sequence)

From backend repo (`/workspace`):

1. `npm run db:check`
2. `npm run seed:e2e:users`

From frontend repo (`/workspace/puretask-frontend`):

3. `npm run test:fullstack:prepare`
4. `npm run test:api`
5. `npm run test:e2e:smoke`

Cleanup (backend repo):

6. `npm run reset:e2e:users`

If you only want to validate fixture script determinism on backend, run `npm run verify:e2e:fixtures`.

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
   - If the test DB uses legacy TEXT IDs (or mixed legacy state), the setup script now auto-falls back from `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` to `000_CONSOLIDATED_SCHEMA.sql` when it detects enum drift, and skips UUID-only unify migrations (059–061) when FK type mismatch (`42804`) is detected.
3. Run `npm run test` or `npm run test:integration`.

**NEON patch order** (in setup-test-db.js): consolidated schema (with automatic legacy fallback) → gamification 041–056 → `000_NEON_PATCH_existing_db` → `000_NEON_PATCH_job_status_disputed` → `000_NEON_PATCH_cleaner_availability` → `000_NEON_PATCH_test_db_align` → conditional unify migrations 059–061. The last patch fixes FKs (payouts, cleaner_availability), `is_cleaner_available` uuid/text cast, and `job_event_type` for integration tests.

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

### Prod vs test schema differences (and how to unify)

**Exact reference:** For a full category-by-category list of what each DB has and the exact differences (extensions, schemas, enums, tables), see [PROD_TEST_SCHEMA_REFERENCE.md](./PROD_TEST_SCHEMA_REFERENCE.md).

After running `npm run db:dump:schema:full`, **prod.sql** (production = ep-fragrant-bird) and **test.sql** (test = ep-small-unit) show the two databases have **diverged**. Each DB has important things the other doesn’t — it’s a **two-way** gap: prod has (x), test has (y); neither has everything.

**Recommendation: mend both directions via migrations.** Use one shared migration sequence that (1) adds test-only objects so prod gets them, and (2) adds prod-only objects so test gets them. Run the same migrations on both DBs so both end up with the same “best of both” schema.

---

#### 1. Extensions and schemas

| Item | Production | Test |
|------|------------|------|
| **pg_session_jwt** | ✅ Present | ❌ Missing |
| **pgrst** schema | ✅ Present | ❌ Missing |
| **neon_auth**, **notifications**, **puretask** | ✅ | ✅ |
| **citext**, **pgcrypto**, **uuid-ossp** | ✅ | ✅ |

**Production-only:** `pg_session_jwt` extension, `pgrst` schema (Neon/PostgREST-style). Test was likely created without those.

---

#### 2. Public types (enums)

**Production has many more** public enums (e.g. `actor_type`, `audit_actor_type_enum`, `availability_recurrence_enum`, `cleaner_earning_status`, `cleaner_status_enum`, `cleaning_type`, `client_status_enum`, `credit_change_reason_enum`, `credit_transaction_type_enum`, `credit_tx_type`, `dispute_status_enum`, `earning_status`, `job_event_type`, `job_event_type_enum`, `job_status_enum`, `notification_channel_enum`, `notification_status_enum`, `participant_type_enum`, `payout_status_enum`, `photo_type`, `reliability_event_type_enum`, `user_status`).  

**Test has fewer** public enums and one prod doesn’t list the same way: **invoice_status** (test has it; prod may have it elsewhere or under a different name in the dump order).

So: prod’s schema is “richer” (more enums and likely more migration history). Test looks like an older or different migration set.

---

#### 3. Tables (high level) — two-way gap

| Direction | Only in prod (test is missing these) | Only in test (prod is missing these) |
|-----------|--------------------------------------|--------------------------------------|
| **Enums** | Many (e.g. `job_status_enum`, `user_status`, `payout_status_enum`, …) | `invoice_status` |
| **Tables** | `admin_users`, `audit_log`, `backup_runs`, `cleaner_reliability_events`, `cleaner_reliability_scores`, `clients`, `customers`, `integration_events`, `job_gps_logs`, `job_time_logs`, `kpi_daily`, `message_threads`, `payment_failures`, `system_settings`, … | `ai_activity_log`, `ai_performance_metrics`, `ai_suggestions`, `cleaner_agreements`, `cleaner_client_notes`, `id_verifications`, `invalidated_tokens`, `invoice_line_items`, `invoice_status_history`, `invoices`, `message_delivery_log`, `payout_items`, `payout_reconciliation_flag_history`, `phone_verifications`, `reviews`, `stripe_events_processed`, `stripe_object_processed`, `worker_runs` |

So: **do not merge** the two dumps by hand. Use **migrations** to add “the other DB’s” objects to each: test-only → migrations run on prod (and test); prod-only → migrations run on test (and prod). Same migration sequence on both = one mended schema.

---

#### 3b. Recommendation: one schema (production), two DBs (prod + test)

**Should you do it this way? Is one DB "different enough" to stay separate?**

- **You do not need two different schemas.** The gaps are additive (missing tables/enums on one side), not "prod and test do incompatible things." So the goal is **one schema** that has everything, and **two databases** only for environment: production (live) and test (QA/staging, copy of prod).
- **Best approach: production as the single schema.**  
  1. **Take absolutely everything that's different about test and add it to production** — that's what 059, 060, 061 do (all test-only objects). Run those migrations on **production**. Production then has the full union (all prod-only + all test-only).  
  2. **Make test a copy of production.** Create a Neon branch from production, or run the same migration sequence on test so test gets the same schema. Test doesn't need its own "prod-only" migrations if test is created from prod or from the same migrations; prod already had those objects.  
  3. **From then on:** one migration path, run on both. One schema, two DBs.
- **When to use a two-way mend:** Only if you **cannot** reset or recreate test from prod (e.g. test has data or config you must keep, and test was built from an older/different schema). Then add prod-only objects to test via migrations so test catches up. Otherwise, prefer "add test's differences to prod, then make test = prod."
- **Separate DBs?** Yes — keep **two databases** (prod and test) for safety and environment. Same **schema** in both.

**TL;DR:** Add everything that's different in test to production (059–061). Then treat production as the single schema and make test a copy of prod. One schema, two DBs; no need for a second "prod-only" migration set unless test can't be reset.

---

#### 4. How to move to a unified schema

**Option A – Production gets everything; test = copy of prod (recommended)**  
Run 059–061 on **production** so prod has all test-only objects; then make test a copy of prod (Neon branch or same migrations). One schema, two DBs. See §3b and §6.

**Option B – Reset test to match production**

1. **Back up test** (data you care about): e.g. dump test data only, or note which tables you need.
2. **Reset test schema** (optional): drop and recreate the test DB, or drop all objects in `public` / `puretask` (leave `neon_auth` if Neon manages it).
3. **Apply the same migrations to test that production used:**  
   Point `DATABASE_URL` at **test**, run `npm run db:migrate` (and any other migrations you run in prod, in the same order). That uses `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` (or whatever prod was built from).  
   If prod was built from a different migration set, you’ll need to run that same set against test (e.g. from `DB/migrations/` in the same order as prod).
4. **Optional:** If you need **pg_session_jwt** or **pgrst** on test, add them (e.g. enable the extension in Neon for the test project, or run the same DDL prod used). Only do this if your app or Neon actually uses them in prod.

**Option C – Make production match test only (one source of truth = test)**

Only if you want **test** as the single schema. Then:

1. Export the **test** schema (you already have **test.sql**).
2. In a **safe/maintenance window**, apply that schema to production (e.g. new branch or restore from a backup first). Prefer applying **migrations** that add the test-only objects to prod, rather than replaying the full test dump (which could drop prod-only objects).

**Option D – Keep both as-is, but stop further drift**

- Document that **production** is canonical.
- Run **the same migrations** on both DBs from now on (e.g. from this repo’s `DB/migrations/` in the same order).  
- Do **not** run different migration sets or one-off scripts on only one DB.

---

#### 5. Concrete steps (Option B: test → match prod only)

| Step | Action |
|------|--------|
| 1 | **Back up test** – `pg_dump TEST_URL --data-only -F c -f test_data_only.dump` (if you need test data). |
| 2 | **Set app to use production** – In `.env`, set `DATABASE_URL` to production (ep-fragrant-bird). App now uses prod only. |
| 3 | **Align test schema with prod** – Either: (a) In Neon, create a **new** test branch from production (so test gets prod’s schema), then point `TEST_DATABASE_URL` at that branch; or (b) Drop test’s `public` and `puretask` (and pgrst if you create it), then run `npm run db:migrate` against test (with `DATABASE_URL=TEST_URL`), plus any extra migrations you run in prod. |
| 4 | **Add pg_session_jwt / pgrst on test (optional)** – Only if your app or Neon uses them in prod. Enable the extension in Neon for the test project if available, or apply the same DDL as prod. |
| 5 | **Use one migration path** – From now on, run the same `DB/migrations/` (in the same order) on both prod and test so they stay in sync. |

After this, **production’s schema is canonical**; test is a copy of it or built from the same migrations. (For a two-way mend instead, use §6.)

---

#### 6. Can we combine the best things from both? (Two-way mend)

**Yes.** Each DB has important things the other doesn’t; the right way is **migrations in both directions**, not merging the two dumps by hand.

**How it works:**

1. **One migration sequence, run on both DBs.** Some migrations add “test-only” objects (so prod gets them). Other migrations add “prod-only” objects (so test gets them). After running the full sequence on each, both have the same mended schema.
2. **Test → Prod (already in repo):** The following migrations add the “test-only” objects. Run them on **both** prod and test (prod gains invoices, reviews, worker_runs, etc.; test already has them or gets them):
   - **059_add_invoice_status_and_invoices.sql** — `invoice_status` enum, `invoice_number_seq`, `invoices`, `invoice_line_items`, `invoice_status_history`
   - **060_add_reviews_ai_worker_stripe_tables.sql** — `reviews`, `ai_activity_log`, `ai_performance_metrics`, `ai_suggestions`, `worker_runs`, `stripe_events_processed`, `stripe_object_processed`
   - **061_add_cleaner_id_payout_misc_tables.sql** — `cleaner_agreements`, `cleaner_client_notes`, `id_verifications`, `invalidated_tokens`, `message_delivery_log`, `phone_verifications`, `payout_items`, `payout_reconciliation_flag_history`
   - **062_job_photos_client_dispute_type.sql** — allows `job_photos.type = 'client_dispute'` for dispute evidence uploads (S3/R2 commit flow). Run after 061.
   Run in Neon SQL editor or: `node scripts/run-migration.js DB/migrations/059_add_invoice_status_and_invoices.sql` then 060, then 061, then 062.  
   **Note:** These migrations use UUID for `users(id)` and `cleaner_profiles(id)` references (production canonical). If your DB was built from the consolidated schema with `users.id` as TEXT, run them only after aligning to UUID or adapt column types in the migration files.
3. **Prod → Test (to add later):** To fully mend, add migrations that create the **prod-only** objects (e.g. `admin_users`, `audit_log`, `backup_runs`, `cleaner_reliability_*`, `clients`, `job_gps_logs`, `job_time_logs`, `kpi_daily`, `message_threads`, `payment_failures`, `system_settings`, plus any prod-only enums/extensions you need). Run those on **both** DBs too — harmless on prod (IF NOT EXISTS), and test gains the missing pieces.
4. **Result:** One migration history, one “best of both” schema. Prod and test stay in sync; neither is the single source of truth — they’re **mended together**.

**Why not merge the two dumps into one file?**

- **Name clashes:** Same table or type name, different columns or enums (e.g. `job_status` in both). You’d have to resolve by hand.
- **Order and dependencies:** Creation order and FKs differ between dumps. A single merged script would need a correct global order.
- **No clear history:** You’d have one big “merged” schema with no story for “why this table exists.” Migrations give you that story and make rollbacks easier.

So: **combining the best of both is a good goal; doing it via new migrations on top of one canonical schema is the good option and practice.** Raw merge of prod.sql + test.sql is possible but not recommended unless you’re doing a one-off migration and then freezing that as a new baseline.

#### 7. After you've run 059–061 on production: align test (details and data you need)

Production now has the full schema. To align test, use one of the following.

**Data you need**

| What | Where to get it | Example |
|------|-----------------|---------|
| **Production DB URL** | Neon → prod project (ep-fragrant-bird) → Connection string | `postgresql://...@ep-fragrant-bird-....neon.tech/neondb?sslmode=require` |
| **Test DB URL** | Neon → test project (ep-small-unit) or a new branch from prod | `postgresql://...@ep-small-unit-....neon.tech/neondb?sslmode=require` |

**Option A – Run 059–061 on your existing test DB (one command)**

1. In `.env`, set **TEST_DATABASE_URL** to your test DB connection string.
2. Run: **`npm run db:migrate:unify-test`**  
   This runs 059, 060, 061 in order on the test DB. Idempotent (safe if tables exist).
3. Done. Test has the same new tables as prod.

**Option B – Make test a copy of production (Neon branch)**

1. Neon → open **production** project → create a **branch** (e.g. name it `test`).
2. Copy the new branch's connection string.
3. In `.env` set **TEST_DATABASE_URL** to that string. Test DB then has the exact same schema (and data copy) as prod.

**What to put in `.env`**

- **DATABASE_URL** = production connection string (ep-fragrant-bird).
- **TEST_DATABASE_URL** = test connection string (ep-small-unit or Neon branch from prod).

Going forward: run the same migrations on both DBs so they stay in sync.

### Reference: key docs

| Topic | Doc |
|-------|-----|
| **Prod vs test exact differences** | [PROD_TEST_SCHEMA_REFERENCE.md](./PROD_TEST_SCHEMA_REFERENCE.md) |
| Local setup | This file (SETUP.md) |
| Ops and health | [RUNBOOK.md](./RUNBOOK.md) |
| Deploy and env | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Known issues | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| Gamification checklist | [BUNDLE_SWITCH_GAP_ANALYSIS.md](./BUNDLE_SWITCH_GAP_ANALYSIS.md) |
| Event contract / 057 | [RUNBOOK.md §4.4](./RUNBOOK.md) |

### Cursor Cloud VM bootstrap (recommended)

When multiple cloud agents work on this repo, repeated local setup can waste time. Keep a startup script in the VM environment config so new sessions are ready immediately.

**What the startup script should do (idempotent):**

1. Ensure apt sources use HTTPS (`archive.ubuntu.com`, `security.ubuntu.com`), then run `apt-get update`.
2. Install PostgreSQL server/client (`postgresql`, `postgresql-client`).
3. Start local PostgreSQL cluster and ensure local dev role/database exist:
   - user: `puretask`, password: `puretask_dev`
   - database: `puretask`
4. Run `npm install` in repo root.
5. Create `.env` only if missing, with local-safe defaults:
   - `DATABASE_URL=postgresql://puretask:puretask_dev@localhost:5432/puretask?sslmode=disable`
   - required `JWT_SECRET`, Stripe, and n8n placeholders so `src/config/env.ts` passes boot validation.
6. Run schema setup with fallback:
   - try `npm run db:migrate`
   - on failure, run `USE_LEGACY_SCHEMA=1 npm run db:setup:test`
7. Verify readiness with `npm run db:check`.

**Why this matters:** it standardizes first-run setup, removes package-manager/network drift issues, and gives every agent a working backend+DB baseline before feature work.
