# PureTask — Operations Runbook

**Purpose:** Deploy, rollback, incident response (Section 9).  
**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md).

---

## 1. Deploy

- **Prereqs:** Secrets in Railway (or target); no secrets in repo. Env validated at startup (`src/config/env.ts`).
- **DB:** Run migrations in order. Fresh DB: `npm run db:migrate` (or `psql $DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql`). Existing: apply `001`…`042` and `hardening/*` in order. See [DB/migrations/README.md](../DB/migrations/README.md).
- **App:** Build `npm run build`; start `npm start`. Workers: run per [package.json](../package.json) scripts (e.g. `worker:scheduler`, `worker:durable-jobs`).
- **CI:** Push to main/develop runs lint, tests, security scan, migrations check (`.github/workflows/`).

---

## 2. Rollback

- **App:** Redeploy previous image/commit; restart process.
- **DB:** Prefer forward-only migrations. For risky changes, use rollback SQL or procedure documented in [PHASE_5_STATUS.md](./00-CRITICAL/PHASE_5_STATUS.md). Test rollback in dev first.
- **Secrets:** Rotate if exposed; see [PHASE_1_USER_RUNBOOK.md](./00-CRITICAL/PHASE_1_USER_RUNBOOK.md).

---

## 3. Incident response

- **Secrets exposure:** [SECURITY_INCIDENT_RESPONSE.md](./00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md) and [PHASE_1_USER_RUNBOOK.md](./00-CRITICAL/PHASE_1_USER_RUNBOOK.md) — rotate, invalidate, purge history, verify.
- **Outage:** Check health endpoint; logs (requestId); DB connectivity; rate limits; Stripe/webhook status.
- **Payment/webhook issues:** [SECTION_04_STRIPE_WEBHOOKS.md](./sections/SECTION_04_STRIPE_WEBHOOKS.md); idempotency via `webhook_events`; no double-processing.

### 3.1 Incident runbook (Section 14)

| Incident | Steps |
|----------|-------|
| **Payment failure spike** | 1. Check Stripe dashboard; 2. Check webhook_events for failed; 3. If needed: set PAYOUTS_ENABLED=false to halt payouts; 4. Investigate; 5. Re-enable when fixed. |
| **Booking creation blocked** | Check BOOKINGS_ENABLED; set to true if disabled for maintenance. |
| **Dead-letter jobs** | 1. GET /admin/jobs/dead (admin auth); 2. Review error_message; 3. Retry via POST /admin/jobs/dead/:jobId/retry with X-Audit-Reason; 4. If persistent, fix handler and redeploy. |
| **Webhook replay / duplicate** | webhook_events enforces idempotency; same event_id returns 200, no reprocess. No action needed. |
| **Rate limit exhaustion** | Check Redis; increase limits or scale horizontally; verify no abuse. |
| **DB connection exhaustion** | Check pool size (env); scale DB or reduce connections; restart app. |

### 3.2 Kill switches (env)

- `BOOKINGS_ENABLED=false` — Disable booking creation
- `PAYOUTS_ENABLED=false` — Disable payouts (default in prod until opt-in)
- `CREDITS_ENABLED=false` — Disable credit purchases
- `REFUNDS_ENABLED=false` — Disable refunds
- `WORKERS_ENABLED=false` — Disable background workers

---

## 4. Contacts and links

- **Checklists:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
- **Phase status:** [00-CRITICAL/PHASE_*_STATUS.md](./00-CRITICAL/)
- **Backup/restore:** [BACKUP_RESTORE.md](./sections/BACKUP_RESTORE.md)

**Last updated:** 2026-01-31
