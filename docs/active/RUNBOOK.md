# Runbook

**What it is:** Ops commands, health checks, restart steps, and incident playbooks.
**What it does:** Lets anyone run common operations and respond to incidents without guessing.
**How we use it:** Use for daily ops; follow playbooks when something goes wrong.

---

## Services

- **Backend API** â€” Express app (e.g. port 4000 locally; Railway in prod).
- **Frontend** â€” Separate repo/service; connects to backend API.
- **n8n** â€” Automation; receives webhooks from backend, sends notifications.
- **Database** â€” Neon Postgres; connection via `DATABASE_URL`.

## Common commands

- **Install / build:** `npm install`, `npm run build`
- **Test:** `npm test`
- **Migrations:** See `package.json` (e.g. `npm run db:migrate` or `npx knex migrate:latest`)
- **Lint/format:** `npm run lint`, `npm run format` (if defined)

## Health checks

- **Backend:** `GET /health` -> 200; `GET /health/ready` -> 200 (DB/readiness).
- **DB:** Ready check is included in `/health/ready`.
- **Workers:** If you have background workers, check their status per your worker docs.

## Restart procedures

- **Local:** Stop the process (Ctrl+C), then `npm run dev` (or `npm start`).
- **Railway:** Redeploy from Dashboard (Deployments -> Redeploy) or push a commit; optional: restart from service settings.

## Incident playbooks

- **Payments stuck / errors after deploy** â€” Consider [rollback](../runbooks/rollback-deploy.md); check Sentry and Stripe dashboard.
- **Booking state mismatch** â€” Check job state machine and DB; see ARCHITECTURE and state docs.
- **Notification failures** â€” Check SendGrid/Twilio/n8n status, webhook URLs, and env vars; see TROUBLESHOOTING.
- **Webhook failures** â€” Verify signature secrets (`STRIPE_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`); check logs and retries.

Full incident flow: [handle-incident.md](../runbooks/handle-incident.md).
Rollback: [rollback-deploy.md](../runbooks/rollback-deploy.md).