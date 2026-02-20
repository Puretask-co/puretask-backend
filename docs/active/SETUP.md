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

Copy `.env.example` to `.env` in repo root, or create `.env` with at least:

```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
JWT_SECRET=your-strong-random-secret-at-least-64-chars
JWT_EXPIRES_IN=30d
```

Optional for local: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `TWILIO_*`. See `.env.example` for the full list.

## Install

1. **Clone** the repo (if not already).
2. **Install deps:** `npm install` (or `pnpm install`).
3. **DB migrations:** run `npm run db:migrate` (see `package.json`).
4. **Seed** (if applicable): `npm run seed:gamification` for gamification config.
5. **Gamification:** Config in `src/config/cleanerLevels/` (goals, levels, rewards); event/metric contracts in `src/config/cleanerLevels/contracts/`. Full rules and constants: [ARCHITECTURE §3.5](./ARCHITECTURE.md). Bundle docs (event contract, metrics contract, spec matrix): [gamification_bundle](./gamification_bundle/README.md). Runtime config loader polls every 2 min (DB active versions + static fallback).

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

## Common setup problems

- **Port in use** — Change `PORT` in `.env` or stop the process using the port.
- **Missing env vars** — Ensure `DATABASE_URL` and `JWT_SECRET` are set; see `.env.example`.
- **DB connection errors** — Check Neon dashboard, SSL (`?sslmode=require`), and firewall.

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
