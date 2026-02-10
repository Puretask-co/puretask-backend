# PureTask — Operations Runbook

**Purpose:** Deploy, rollback, incident response (Section 9).  
**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md).

---

## 1. Deploy

- **Prereqs:** Secrets in Railway (or target); no secrets in repo. Env validated at startup (`src/config/env.ts`).
- **DB:** Run migrations in order. Fresh DB: `npm run db:migrate` (or `psql $DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql`). Existing: apply `001`…`056` and `hardening/*` in order. See [DB/migrations/README.md](../DB/migrations/README.md).
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

## 4. Gamification support and debug (Step 17)

### 4.1 Progress debug endpoint

`GET /admin/gamification/cleaners/:id/progress-debug?job_id=...&limit=200` (admin auth)

Returns status, recent goals/rewards/achievements, recent events, and diagnostics explaining:
- **Meaningful login:** Session + action within 15 min
- **Meaningful message:** Template/char count/client reply
- **Photos:** Before/after within clock window
- **On-time:** ±15 min and GPS within 250m
- **Last decline:** Good-faith vs not

### 4.2 Support macros (copy-paste for agents)

**“Why is my progress paused?”**  
Progress is paused when a maintenance rule isn’t met. Open the Maintenance tab, fix the listed items (e.g. acceptance rate, disputes, on-time). Progress resumes automatically once back in compliance.

**“Why didn’t my message count?”**  
Messages count if: (1) you used a Quick Template, (2) the message is 25+ characters, or (3) the client replied within 24 hours. Short replies like “ok” or “hi” don’t count.

**“Why didn’t my login/streak count?”**  
A login day counts when you take at least one meaningful action within 15 minutes of opening the app (open job request, accept/decline, send message, upload photos, update availability). Opening and closing the app doesn’t count.

**“Why didn’t my photos count?”**  
Photos must include at least 1 before + 1 after, with timestamps between clock-in and clock-out.

**“Why does my on-time % look wrong?”**  
You’re on-time if you clock in 15 min before to 15 min after the scheduled start, within 250m of the job. GPS outside 250m at clock-in = not on-time.

**“Cash bonuses are missing”**  
Cash bonuses can be paused if the region budget cap is reached, cash rewards are disabled, or emergency rewards pause is active. Goal completion still counts; cash returns when budgets reopen.

### 4.3 In-app explainers (cleaner-facing)

- **Progress paused:** Fix the maintenance items below to resume earning rewards.
- **Meaningful login:** A login day counts when you take one meaningful action within 15 minutes of opening the app.
- **Meaningful message:** Counts if you use a Quick Template, write 25+ characters, or the client replies.
- **Photos:** Count when you upload 1 before + 1 after between clock-in and clock-out.
- **Visibility rewards:** Improve where you appear in the list; never guarantee jobs.

---

## 5. Gamification launch rollout (Step 18–19)

### Phase 0 — Preflight (1–2 days)

- Deploy to staging
- Seed configs: goals, rewards, seasons, badges JSON
- Run DB migrations: `056_marketplace_health_governor.sql`
- Verify: `GET /api/v1/governor/state`, progression, next-best-action, admin progress-debug
- Run unit + integration tests, k6 smoke: `k6 run tests/load/gamification_smoke.js`
- Gates: No crashes; next-best-action returns sensible output; no reward double-granting

### Phase 1 — Internal dogfood (3–7 days)

- Enable for internal team + friendly cleaners
- Observe: Do they understand what counts? Support macros cover questions?
- Gates: ≥90% support questions covered; no major confusion on photos/on-time/messaging

### Phase 2 — City / cohort pilot (2–4 weeks)

- Limit to one region; set cash caps low
- Track: leveling velocity, reward burn, median fill time, cancel/dispute rate
- Gates: Cash burn within tolerance; disputes do not increase; fill time does not worsen

### Phase 3 — Scale within region (2–6 weeks)

- Increase user count; enable seasonal boosts; run governor metrics scheduler hourly
- Gates: Governor outputs stable; no “rich get richer” runaway

### Phase 4 — Multi-region

- Per-city runbook: seed region config, 1-week pilot, governor enabled, region-local cash caps

---

## 6. Contacts and links

- **Checklists:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
- **Phase status:** [00-CRITICAL/PHASE_*_STATUS.md](./00-CRITICAL/)
- **Backup/restore:** [BACKUP_RESTORE.md](./sections/BACKUP_RESTORE.md)

**Last updated:** 2026-02-02
