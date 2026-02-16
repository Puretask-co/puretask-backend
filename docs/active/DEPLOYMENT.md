# Deployment

**What it is:** How we deploy to Railway and manage production (environments, DB, CI/CD, rollback).  
**What it does:** Documents deploy flow so we can ship and roll back safely.  
**How we use it:** Follow when deploying; use rollback section when reverting.

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

- **GitHub Actions** — Lint, test, build on push/PR (`.github/workflows/ci.yml`).
- **Deploy trigger** — Railway deploys on push to main (or configured branch).

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

## Production verification checklist

Before going live or after deploy, verify:

| Item | How to verify |
|------|---------------|
| **Stripe webhook** | Stripe Dashboard → Webhooks → Send test event; confirm 200 response |
| **SENTRY_DSN** | Sentry project receives errors; trigger test error or wait for real one |
| **Branch protection** | GitHub → Settings → Branches; confirm rule exists and status checks required |
| **Health** | `GET /health` and `GET /health/ready` return 200 |
| **DB connectivity** | Health ready check includes DB ping |
