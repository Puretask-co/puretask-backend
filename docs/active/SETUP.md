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

## Run locally

- **Backend:** `npm run dev` or `npm start` (typically port 4000).
- **Health:** `curl http://localhost:4000/health` and `curl http://localhost:4000/health/ready`.

Frontend, n8n, and workers are separate; see ARCHITECTURE and RUNBOOK for how they connect.

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
