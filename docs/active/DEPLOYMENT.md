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
4. **Build/start** — Usually: build `npm run build`, start `node -r ./dist/instrument.js ./dist/index.js` (see `package.json` scripts).

Railway auto-deploys on push to the linked branch unless disabled.

## Database

- **Neon** — Use the connection string from Neon dashboard; ensure SSL (`sslmode=require`).
- **Migrations in prod** — Run migrations as part of deploy or via a one-off job; avoid breaking schema changes in a single deploy.

## CI/CD

- **GitHub Actions** (if configured) — Lint, test, build on push/PR.
- **Deploy trigger** — Railway deploys on push to main (or configured branch).

## Rollback

When a deploy causes errors:

1. **Railway** → Project → Service → **Deployments**.
2. Find the **last known good** deployment → **Redeploy** (or Rollback).
3. Verify: `GET /health` and `GET /health/ready` → 200.
4. Do **not** run “migrate down” unless you have a tested, safe down migration.

Full steps: [docs/runbooks/rollback-deploy.md](../runbooks/rollback-deploy.md).
