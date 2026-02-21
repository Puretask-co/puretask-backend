# Deployment

**What it is:** How we deploy to Railway and manage production (environments, DB, CI/CD, rollback).  
**What it does:** Documents deploy flow so we can ship and roll back safely.  
**How we use it:** Follow when deploying; use rollback section when reverting.

---

## Exact backend structure for production

This is the **exact** process layout and commands for running the PureTask backend in production.

### Processes (what to run)

| Process | Command | Purpose |
|--------|---------|---------|
| **API server** | `npm run build` then `npm start` | Serves HTTP + Socket.IO. Entry: `node -r ./dist/instrument.js ./dist/index.js`. |
| **Scheduler** | `npm run worker:scheduler` | Either runs workers inline (cron) or **enqueues** to `durable_jobs` when `CRONS_ENQUEUE_ONLY=true`. |
| **Durable job worker** | `npm run worker:durable-jobs:loop` | **Required** if `CRONS_ENQUEUE_ONLY=true`. Consumes `durable_jobs` and runs enqueued workers. |

**Production recommendation:** Run **three** separate processes (or three Railway services):

1. **API** — `npm run build && npm start` (long-running).
2. **Scheduler** — `npm run worker:scheduler` (long-running; enqueues only when `CRONS_ENQUEUE_ONLY=true`).
3. **Worker** — `npm run worker:durable-jobs:loop` (long-running; processes the queue).

If `CRONS_ENQUEUE_ONLY=false`, you can run only **API** + **Scheduler** (scheduler runs workers directly on cron; no separate worker process).

### Build and start commands

```bash
# One-time build (or in CI/Railway build step)
npm ci
npm run build

# Start API (production)
npm start
# → node -r ./dist/instrument.js ./dist/index.js

# Start scheduler (separate process)
npm run worker:scheduler
# → ts-node src/workers/scheduler.ts

# Start durable worker (separate process; required when CRONS_ENQUEUE_ONLY=true)
npm run worker:durable-jobs:loop
# → ts-node src/workers/runDurableJobWorker.ts --loop
```

### Required environment variables (production)

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | e.g. `4000` (Railway sets automatically) |
| `DATABASE_URL` | Yes | Postgres connection string (Neon: use `?sslmode=require`) |
| `JWT_SECRET` | Yes | Long random string (≥64 chars) |
| `STRIPE_SECRET_KEY` | Yes | Live key in prod |
| `STRIPE_WEBHOOK_SECRET` | Yes | From Stripe webhook endpoint |
| `N8N_WEBHOOK_SECRET` | Yes | For n8n event verification |
| `FRONTEND_URL` | Yes | Production frontend origin (for CORS and links), e.g. `https://app.puretask.com` |
| `APP_URL` | Recommended | Same as frontend or API base URL for email links |
| `SENTRY_DSN` | Recommended | Error tracking |
| `CRONS_ENQUEUE_ONLY` | Recommended | `true` in prod so scheduler only enqueues; run worker separately |
| `PAYOUTS_ENABLED` | Optional | `true` when ready to process payouts (default `false`) |
| `REDIS_URL` | Optional | For rate limiting; if unset, in-memory limiter is used |

Optional: `JWT_EXPIRES_IN`, `SENDGRID_*`, `TWILIO_*`, `WORKERS_ENABLED`, `BOOKINGS_ENABLED`, etc. See `src/config/env.ts` and `.env.example`.

### Railway layout (example)

| Service | Build | Start | Env |
|---------|--------|--------|-----|
| **api** | `npm ci && npm run build` | `npm start` | All vars; `PORT` from Railway |
| **scheduler** | `npm ci && npm run build` | `node -r ./dist/instrument.js ./dist/workers/scheduler.js` | Same as api; no `PORT` needed |
| **worker** | `npm ci && npm run build` | `node -r ./dist/instrument.js ./dist/workers/runDurableJobWorker.js --loop` | Same as api; `CRONS_ENQUEUE_ONLY=true` |

If using **compiled JS** for scheduler/worker, point to `dist/` (e.g. `node dist/workers/scheduler.js`). If using ts-node in prod, use `npm run worker:scheduler` and `npm run worker:durable-jobs:loop` (ensure `ts-node` is a dependency).

### Directory / artifact layout (after build)

When using **STRICT_EVENT_CONTRACT=true**, the event contract JSON must be loadable at runtime. **Build already copies** contract JSON: `npm run build` runs `scripts/copy-contracts-to-dist.js` after `tsc`, so `dist/config/cleanerLevels/contracts/*.json` are present. See RUNBOOK §4.4.

```
puretask-backend/
├── dist/                    # Compiled output (npm run build)
│   ├── index.js             # API entry
│   ├── instrument.js        # Sentry (required by npm start)
│   ├── config/
│   ├── routes/
│   ├── services/
│   ├── workers/
│   │   ├── scheduler.js
│   │   └── runDurableJobWorker.js
│   └── ...
├── node_modules/
├── package.json
├── .env                     # Not in repo; set in Railway/host
└── DB/migrations/           # For migration runs
```

### Health and readiness

- **Liveness:** `GET /health` → 200, `{ ok: true }`.
- **Readiness:** `GET /health/ready` → 200 when DB is reachable.
- Use these for Railway (or any platform) health checks and load balancer probes.

### One-line summary

**Production = API process + Scheduler process + Durable worker process** (with `CRONS_ENQUEUE_ONLY=true`), same env (including `DATABASE_URL`, `JWT_SECRET`, Stripe, `FRONTEND_URL`), build once with `npm run build`, start API with `npm start`, scheduler with `worker:scheduler`, worker with `worker:durable-jobs:loop`.

---

## Environments

- **local** — Development on your machine (see SETUP.md).
- **staging** (if used) — Pre-production; same stack as prod, different env vars.
- **production** — Live API used by users.

## Railway setup

1. **Create project** — Railway Dashboard → Deploy from GitHub repo → select `puretask-backend`.
2. **Database** — Add Neon (or Railway Postgres); `DATABASE_URL` is set automatically or add it in Variables.
3. **Variables** — In the service → Variables tab, set at least:
   - `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`
   - Notifications: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `TWILIO_*`, `N8N_WEBHOOK_URL` (as needed)
   - `NODE_ENV=production`
   - **`SENTRY_DSN`** — For error tracking in production (Sentry Dashboard → Project Settings → DSN)
4. **Build/start** — Usually: build `npm run build`, start `node -r ./dist/instrument.js ./dist/index.js` (see `package.json` scripts).

Railway auto-deploys on push to the linked branch unless disabled.

## Database

- **Neon** — Use the connection string from Neon dashboard; ensure SSL (`?sslmode=require` in `DATABASE_URL`).
- **Migrations in prod** — Run migrations as part of deploy or via a one-off job; avoid breaking schema changes in a single deploy.
- **Schema verify** — After patch or restore: `PRODUCTION_DATABASE_URL=... npm run db:verify:production`.
- **Backup/restore** — See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md). Neon PITR; restore drill: create branch from restore point → update `DATABASE_URL` → run schema verify → smoke test.

## CI/CD

- **GitHub Actions** — Lint, test, build on push/PR (`.github/workflows/ci.yml`, `.github/workflows/test.yml`).
- **Migrations check** — `.github/workflows/migrations.yml` applies consolidated schema on fresh Postgres; runs on push/PR to main/develop.
- **Deploy trigger** — Railway deploys on push to main (or configured branch).
- **Staging (optional)** — Create a second Railway service or project with `DATABASE_URL` pointing to a staging Neon branch. Deploy develop → staging; merge main → production.
- **Coverage** — CI runs `npm run test:coverage`; reports in `coverage/`. Add `CODECOV_TOKEN` secret and `lcov.info` will be uploaded. Badge: `[![codecov](https://codecov.io/gh/OWNER/REPO/graph/badge.svg)](https://codecov.io/gh/OWNER/REPO)`.

### Branch protection (recommended)

In GitHub → **Settings** → **Branches** → **Add rule** for `main`:

1. **Require a pull request** before merging (at least 1 approval).
2. **Require status checks** to pass: `lint`, `test`, `build`.
3. **Do not allow bypassing** (optional, for stricter policy).
4. **Include administrators** (optional).

This prevents direct pushes and ensures CI runs before merge.

**Verification checklist:**
- [ ] Branch protection rule exists for `main`
- [ ] Required status checks: `lint`, `test`, `build` (or your workflow job names)
- [ ] At least 1 approval required for PRs

---

## Stripe webhook (production)

1. **Stripe Dashboard** → Developers → Webhooks → Add endpoint.
2. **URL:** `https://<your-api-domain>/api/webhooks/stripe/webhook` (e.g. `https://api.puretask.com/api/webhooks/stripe/webhook`).
3. **Events:** Select events you handle (e.g. `payment_intent.succeeded`, `charge.refunded`, `account.updated`).
4. **Signing secret:** Copy to Railway `STRIPE_WEBHOOK_SECRET`.
5. **Verify:** Stripe sends a test event; backend returns 200. Resend an event from Dashboard to confirm idempotency (no double-processing).

**Verification checklist:**
- [ ] Webhook endpoint URL matches production API domain
- [ ] `STRIPE_WEBHOOK_SECRET` set in Railway (from Stripe webhook signing secret)
- [ ] Test event returns 200 in Stripe Dashboard
- [ ] Events list includes all required: `payment_intent.succeeded`, `charge.refunded`, `account.updated` (and others per your handlers)

---

## Workers and CRONS_ENQUEUE_ONLY

If `CRONS_ENQUEUE_ONLY=true` (scheduler enqueues only):

- The **scheduler** (`worker:scheduler`) enqueues jobs into `durable_jobs`.
- The **durable job worker** must run separately: `worker:durable-jobs` (one cycle) or `worker:durable-jobs:loop` (continuous).
- On Railway: add a second service or cron job that runs `npm run worker:durable-jobs:loop` (or a periodic `worker:durable-jobs`).
- Without the worker, enqueued jobs never execute.

## Rollback

When a deploy causes errors:

1. **Railway** → Project → Service → **Deployments**.
2. Find the **last known good** deployment → **Redeploy** (or Rollback).
3. Verify: `GET /health` and `GET /health/ready` → 200.
4. Do **not** run “migrate down” unless you have a tested, safe down migration.

Full steps: [docs/runbooks/rollback-deploy.md](../runbooks/rollback-deploy.md).

### Migration safety

- Run migrations check locally: `DATABASE_URL=... npm run db:setup:test` then `npm run test`.
- CI `migrations.yml` applies `000_CONSOLIDATED_SCHEMA.sql` on fresh DB; passes if tables exist.
- For additive migrations: apply forward; older code can run with new schema.
- For breaking changes: deploy in two phases (add column → deploy code that uses it → remove old column).

## Production verification checklist

Before going live or after deploy, verify:

| Item | How to verify |
|------|---------------|
| **Stripe webhook** | Stripe Dashboard → Webhooks → Send test event; confirm 200 response |
| **SENTRY_DSN** | Sentry project receives errors; trigger test error or wait for real one |
| **Branch protection** | GitHub → Settings → Branches; confirm rule exists and status checks required |
| **Health** | `GET /health` and `GET /health/ready` return 200 |
| **DB connectivity** | Health ready check includes DB ping |

## Launch readiness (Section 14)

- **Feature flags:** `admin_feature_flags` (gamification), env kill switches (`BOOKINGS_ENABLED`, `PAYOUTS_ENABLED`, etc.). See RUNBOOK § 3.2.
- **Rollout plan:** Staging → internal dogfood → city pilot → scale. See RUNBOOK § 5.
- **Incident runbook:** RUNBOOK § 3.1; SECURITY_INCIDENT_RESPONSE.md for secrets exposure.

---

## Pre-launch preparation (step-by-step)

**Time:** ~30 min local prep, ~2.5 h for first full deploy. Use this before first production deploy or when bringing a new environment up.

### 1. Apply database indexes (~5 min)

- Run: `psql $DATABASE_URL -f DB/migrations/030_performance_indexes.sql` (or run the file in Neon SQL Editor).
- Expect: multiple `CREATE INDEX`; NOTICE about 35+ indexes.

### 2. Restart backend (~1 min)

- Stop: Ctrl+C in the terminal running the backend.
- Start: `npm run dev` (local) or use your normal start command so new routes/config are loaded.

### 3. Test API (~2 min)

- Health: `GET /health` and `GET /health/ready` return 200.
- From frontend repo (if available): run API smoke tests (e.g. `npx ts-node tests/api/quick-api-test.ts` or equivalent) and confirm search/auth/jobs as needed.

### 4. Manual UI smoke test (~10 min)

- Open frontend (e.g. `http://localhost:3001`).
- Test: login, search/browse, navigation, mobile view (F12 → device toolbar). Check console for errors.

### 5. Production config (env vars)

- **Backend (e.g. Railway):** `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (new, long), Stripe **live** keys and `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL` / `APP_URL`, optional: `REDIS_URL`, `SENDGRID_*`, `SENTRY_DSN`.
- **Frontend (e.g. Vercel):** `NEXT_PUBLIC_API_URL` (production API URL), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ENVIRONMENT=production`.

### 6. Deploy order

1. Push backend → deploy backend (e.g. Railway). Verify: `curl https://<api-url>/health` → 200.
2. Set frontend `NEXT_PUBLIC_API_URL` to that API URL → push frontend → deploy (e.g. Vercel).
3. (Optional) Custom domain: add domain in Vercel/Railway, add DNS records at registrar, then update CORS origins in backend to include production domain and redeploy.

### 7. Post-deploy checks

- Health and ready: 200.
- Frontend: load site, login, search, key flows; confirm no CORS/404/500 in network tab.
- Stripe webhook: send test event from Stripe Dashboard; backend returns 200.

### Hosting reference

- **Backend:** Railway (Hobby/Pro). Deploy from GitHub; set env vars; use health URL for frontend.
- **Frontend:** Vercel (Free/Pro). Import repo; set `NEXT_PUBLIC_API_URL` and other public env; deploy.
- **Domain:** Optional; add in Vercel/Railway and point DNS.

Detailed troubleshooting (DB index failures, deploy failures, CORS, 404s): see TROUBLESHOOTING.md and Rollback above.
