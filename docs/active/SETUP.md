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

Copy from `docs/architecture/ENV_EXAMPLE.md` or create `.env` in repo root with at least:

```bash
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
JWT_SECRET=your-strong-random-secret-at-least-64-chars
JWT_EXPIRES_IN=30d
```

Optional for local: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `TWILIO_*`. See ENV_EXAMPLE for the full list.

## Install

1. **Clone** the repo (if not already).
2. **Install deps:** `npm install` (or `pnpm install`).
3. **DB migrations:** run your migration command (e.g. `npm run db:migrate` or `npx knex migrate:latest` — see `package.json` scripts).
4. **Seed** (if applicable): `npm run db:seed` or equivalent.

## Run locally

- **Backend:** `npm run dev` or `npm start` (typically port 4000).
- **Health:** `curl http://localhost:4000/health` and `curl http://localhost:4000/health/ready`.

Frontend, n8n, and workers are separate; see ARCHITECTURE and RUNBOOK for how they connect.

## Common setup problems

- **Port in use** — Change `PORT` in `.env` or stop the process using the port.
- **Missing env vars** — Ensure `DATABASE_URL` and `JWT_SECRET` are set; see ENV_EXAMPLE.
- **DB connection errors** — Check Neon dashboard, SSL (`?sslmode=require`), and firewall.

For deployment to Railway, see [DEPLOYMENT.md](./DEPLOYMENT.md).
