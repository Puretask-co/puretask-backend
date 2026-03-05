# PureTask — Operations Runbook

**Purpose:** Deploy, rollback, incident response (Section 9).  
**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md).

---

## 1. Deploy

- **Prereqs:** Secrets in Railway (or target); no secrets in repo. Env validated at startup (`src/config/env.ts`).
- **DB:** Run migrations in order. Fresh DB: `npm run db:migrate` (or `psql $DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql`). Existing: apply `001`…`056` and `hardening/*` in order. See [DB/migrations/README.md](../DB/migrations/README.md).
- **App:** Build `npm run build`; start `npm start`. Workers: run per [package.json](../package.json) scripts.
- **Workers (CRONS_ENQUEUE_ONLY):** If `CRONS_ENQUEUE_ONLY=true`, the scheduler enqueues only; you must run `worker:durable-jobs` or `worker:durable-jobs:loop` as a separate process. Otherwise enqueued jobs never run.
- **CI:** Push to main/develop runs lint, tests, security scan, migrations check (`.github/workflows/`).

### 1.1 Production schema alignment (existing Neon DB)

If production was created from an older Neon schema or has FK/column mismatches, run the alignment patch. **Back up first.**

```bash
# 1. Set production DB URL (do not commit this)
export PRODUCTION_DATABASE_URL="postgresql://...your-production-url..."

# 2. Run patch (prompts for confirmation; use --yes to skip)
npm run db:patch:production

# Or non-interactive:
PRODUCTION_DATABASE_URL="..." npm run db:patch:production -- --yes
```

The patch (`DB/migrations/000_NEON_PATCH_test_db_align.sql`) fixes: payouts/cleaner_availability FKs → users(id), adds missing columns (amount_cents, amount_credits, cleaning_type, etc.), adds job_event_type values, updates is_cleaner_available for uuid/text. Idempotent—safe to run more than once.

**Verify schema after patch:**
```bash
PRODUCTION_DATABASE_URL="..." npm run db:verify:production
```

### 1.2 Critical-flow tests (integration / E2E)

- **Critical path E2E (create → accept → complete → approve):** `src/tests/integration/jobLifecycle.test.ts` — Full job flow; cancellation; dispute. Same flow in smoke: `src/tests/smoke/jobLifecycle.test.ts`. Run before release to confirm lifecycle and credits.
- `src/tests/smoke/*` — Smoke tests for jobs, messages, credits, events.
- Run: `npm run test:integration` and `npm run test:smoke`.

### 1.3 Worker schedule (scheduler vs durable worker)

| Mode | Scheduler (`worker:scheduler`) | Durable worker (`worker:durable-jobs`) |
|------|--------------------------------|----------------------------------------|
| `CRONS_ENQUEUE_ONLY=false` | Runs workers directly on cron schedule | Not needed |
| `CRONS_ENQUEUE_ONLY=true` | Enqueues jobs to `durable_jobs` table only | Must run separately; processes enqueued jobs |

**Production recommendation (Section 6):** Set `CRONS_ENQUEUE_ONLY=true` in production so crons only enqueue; run `npm run worker:durable-jobs:loop` (or equivalent) as a separate process. This avoids long-running work in the cron process and uses the durable job table for retries and dead-letter handling.

**Scheduled workers** (from `src/workers/scheduler.ts`): auto-cancel (*/5 min), retry-notifications (*/10), webhook-retry (*/5), lock-recovery (*/15), auto-expire (hourly), idempotency-cleanup (hourly), kpi-daily (1 AM), nightly-scores (2 AM), goal-checker (2 AM), subscription-jobs (2 AM), reliability-recalc (3 AM), cleaning-scores (3 AM), backup-daily (3 AM), credit-economy (4 AM), photo-cleanup (5 AM), onboarding-reminders (*/6 h), payout-retry (*/30), payout-reconciliation (6 AM), payout-weekly (Sun midnight), expire-boosts, weekly-summary, job-reminders, no-show-detection, governor-metrics. See `WORKER_SCHEDULES` in scheduler.ts for full list.

### 1.4 Idempotency keys TTL (audit R11)

Table `idempotency_keys` is cleaned by function `cleanup_old_idempotency_keys()` (deletes rows older than 24 hours). The function is defined in `000_MASTER_MIGRATION.sql`. **Scheduled:** worker `idempotency-cleanup` runs hourly via `WORKER_SCHEDULES` in `src/workers/scheduler.ts`; runner: `node dist/workers/scheduler.js idempotency-cleanup` or use internal cron when enabled.

**Daily/weekly ops check:** Verify idempotency-cleanup is running (e.g. in logs: `idempotency_cleanup_completed` or `scheduled_worker_completed` for `idempotency-cleanup`). Optionally: `SELECT COUNT(*) FROM idempotency_keys` — should stay bounded (e.g. not growing without limit if cleanup runs). If count grows unbounded, run `SELECT cleanup_old_idempotency_keys();` manually and confirm the scheduler process is up.

---

## 2. Rollback

- **App:** Redeploy previous image/commit; restart process.
- **DB:** Prefer forward-only migrations. For risky changes, use rollback SQL or procedure documented in [PHASE_5_STATUS.md](./00-CRITICAL/PHASE_5_STATUS.md). Test rollback in dev first.
- **Secrets:** Rotate if exposed; see [PHASE_1_USER_RUNBOOK.md](./00-CRITICAL/PHASE_1_USER_RUNBOOK.md).

---

## 3. Incident response

- **Secrets exposure:** [SECURITY_INCIDENT_RESPONSE.md](./00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md) and [PHASE_1_USER_RUNBOOK.md](./00-CRITICAL/PHASE_1_USER_RUNBOOK.md) — rotate, invalidate, purge history, verify.
- **Outage:** Check health endpoint; logs (requestId); DB connectivity; rate limits; Stripe/webhook status.
- **Payment/webhook issues:** [SECTION_04_STRIPE_WEBHOOKS.md](./sections/SECTION_04_STRIPE_WEBHOOKS.md). **Stripe webhook (dedupe, retries, crash safety):** (1) Dedupe: intake writes to `webhook_events` with `ON CONFLICT (provider, event_id) DO NOTHING`; `handleStripeEvent` uses `stripe_events_processed` (event_id + object_id) so duplicate deliveries are no-op. (2) Retries: on processing failure we set `webhook_events.processing_status = 'failed'` and call `queueWebhookForRetry`; worker `webhook-retry` (every 5 min) processes `webhook_failures` with exponential backoff. (3) Crash safety: event is stored before processing; if the process crashes after handling, retry will call `handleStripeEvent` again but stripe_events_processed makes it idempotent.

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

- `BOOKINGS_ENABLED=false` — Disable booking creation (Section 14)
- `PAYOUTS_ENABLED=false` — Disable payouts (default in prod until opt-in)
- `CREDITS_ENABLED=false` — Disable credit purchases
- `REFUNDS_ENABLED=false` — Disable refunds
- `WORKERS_ENABLED=false` — Disable background workers

To disable all new payments in an emergency: set `BOOKINGS_ENABLED=false` (stops new bookings) and `PAYOUTS_ENABLED=false` (stops payout processing). Existing payment intents can still complete unless you also disable at Stripe.

### 3.3 Launch checklist (Section 14)

- **Feature flags:** `admin_feature_flags` (DB); env kill switches: `BOOKINGS_ENABLED`, `PAYOUTS_ENABLED`, `CREDITS_ENABLED`, `REFUNDS_ENABLED`, `WORKERS_ENABLED`. See § 3.2.
- **Staged rollout:** Internal → beta → limited geo → full. Document phases and success/rollback criteria in [SECTION_14_LAUNCH.md](./sections/SECTION_14_LAUNCH.md).
- **Incident runbook:** § 3.1 above; [SECURITY_INCIDENT_RESPONSE.md](./00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md) for secrets.
- **Support training:** Dispute playbooks, refund/credit flows, IC-safe language. RUNBOOK § 4 support macros.
- **Launch KPIs:** Error rate, p95 latency, webhook success, queue lag, payout success; bookings/day, dispute rate. See SECTION_14 § 14.7.
- **Post-launch audit:** After first week/month; checklist of Sections 1–13; kill switch usage; incident count. § 14.8.

### 3.4 Feature flags (Section 14)

Runtime feature toggles live in `admin_feature_flags` (DB) and are loaded by `RuntimeConfigLoader`. Use for A/B, regional rollouts, and gamification toggles. Admin: `GET/POST /admin/gamification/flags`. Env kill switches (above) are for emergency; feature flags are for gradual rollout.

### 3.5 Section 10 — Caching, workers, SMS/email, rate limits

- **Caching:** Allowed list and TTL: see [SECTION_10_COST_SCALE.md](./sections/SECTION_10_COST_SCALE.md) § 10.5. Do not cache balances, job state, payout eligibility.
- **Worker priority:** Critical (payments, payouts, dispute actions), standard (notifications), low (cleanup, analytics). See SECTION_10 § 10.6.
- **SMS/email control:** SMS for high-urgency only; email for transactional; batch where possible. See SECTION_10 § 10.7.
- **Rate limits:** Per-user and per-IP; strict on search, auth, booking. See SECTION_10 § 10.9 and `src/lib/security.ts` / Redis rate limiter.

### 3.7 Admin RBAC and audit reason (Section 11)

- **Roles:** `requireAdmin` (admin, super_admin), `requireSupportRole`, `requireFinanceRole`, `requireDisputeResolveRole` in `src/middleware/authCanonical.ts`. Use the most restrictive role per route.
- **Audit reason:** Sensitive admin actions (force-complete, force-cancel, reassign, refund approve, payout actions, dead-letter retry) require `X-Audit-Reason` header or body `auditReason`/`reason` (min 3 chars). Middleware: `requireAuditReason` from `src/middleware/requireAuditReason.ts`. All such actions are logged to `admin_audit_log`.
- **Ops summary:** `GET /admin/ops/summary` returns `{ openDisputes, payoutsPending, openFraudAlerts }` for dashboard at a glance.
- **Refund/credit flows:** Refunds go through `processStripeRefund` / refund processor; credit adjustments via `adjustCredits` with audit reason. Ledger and audit log updated.
- **Payout holds/releases:** `POST /admin/payouts/:payoutId/hold`, `POST /admin/payouts/hold/:adjustmentId/release`; idempotent; require audit reason.
- **IC-safe language (Section 11):** Use “platform status adjustment,” “risk indicators,” “participation conditions”; avoid “required procedures,” “performance correction,” “mandatory re-cleans,” “override completion,” “warnings” in admin UI and API messages. Audit copy per SECTION_11.
- **Dispute resolution UI (backend):** Dispute list/detail: `GET /admin/disputes`, `GET /admin/disputes/:disputeId`. Case management: `PATCH /admin/disputes/:disputeId` (body: `assignee_id?`, `case_notes?`; requires audit reason). Case notes in dispute `metadata.case_notes`; assignee in `metadata.assignee_id`. Frontend: build dispute resolution UI and case assignment on these endpoints.
- **Webhook viewer (backend):** `GET /admin/webhooks/events` (query: `limit`, `offset`, `processing_status?`, `provider?`). Returns `{ events, total }` from `webhook_events` (no raw payload in list). Frontend webhook viewer can be built on this API.

### 3.8 Section 12 — Outcomes and evidence

- **Service outcomes:** Define per job type what was purchased (outcome), not how work is done. Store in config or DB; use for dispute resolution and client/cleaner transparency. See [SECTION_12_TRUST_IC_SAFE.md](./sections/SECTION_12_TRUST_IC_SAFE.md) § 12.2.
- **Evidence (optional but conditional):** Photos/checklists optional for basic completion; required for certain protections (payout protection, dispute priority). Document in product/legal; link evidence to dispute eligibility and explainable auto-resolution. § 12.3–12.4.
- **Review window:** Env `REVIEW_WINDOW_HOURS` (optional; defaults to `DISPUTE_WINDOW_HOURS` or 48 in auto-expire worker). After this many hours in `awaiting_approval`, the `auto-expire` worker auto-approves the job and releases escrow. See `src/workers/v1-core/autoExpireAwaitingApproval.ts` and `src/config/env.ts`. § 12.6.
- **Structured feedback:** Dispute category optional on dispute creation: `createDispute({ ..., category })` and `POST /tracking/:jobId/dispute` body `category` (enum: missed_area, quality_issue, damages_claim, no_show, other). Stored in `disputes.reason_code`. See `disputesService.DISPUTE_CATEGORIES`. § 12.6.
- **Auto-resolution:** Criteria (e.g. evidence present, category, timing) documented in SECTION_12; implement or stub in dispute flow; must be explainable (why outcome was chosen). § 12.7.
- **Reliability signals:** Implemented (scores, access-based); used for visibility, payout timing, platform protections. See SECTION_12 § 12.8; do not frame as employment performance. § 12.8.
- **Transparency:** “How decisions work” — cleaners: how reliability is calculated, how to regain protections; clients: what was included, how disputes are reviewed. Document in RUNBOOK or static policy page; optional GET `/policies/decisions` or link from app. § 12.11.
- **IC-language audit:** [IC_LANGUAGE_AUDIT.md](./IC_LANGUAGE_AUDIT.md) — phrases to avoid, preferred phrasing, where audited, remaining app copy to audit. Use for all new copy and pre-release pass.

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

**Canonical gamification spec:** Rules, event stream, and metrics are defined in the uploaded bundle. **Lead doc:** [gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md](gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md). **Full index:** [gamification_bundle/README.md](gamification_bundle/README.md) (event contract, metrics contract, spec-enforcement matrix). Contract JSON: `src/config/cleanerLevels/contracts/`.

**Key constants (quick reference):** Meaningful action window 15 min | Message: 25 chars OR template OR reply within 24 h | On-time: ±15 min, GPS 250 m | Short notice good-faith &lt; 18 h | Good-faith limit 6 per 7 days | Distance good-faith: 10 mi radius, penalty-free ≥ 11 mi. Full table: ARCHITECTURE §3.5.

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

### 4.4 New data switch and event contract

- **Event contract:** Incoming events (e.g. `POST /cleaner/events`) can be validated against `event_contract_v1.json` by setting `STRICT_EVENT_CONTRACT=true`. When set, only contract-allowed `event_type` values and valid `source` are accepted; invalid events return 400 with `EVENT_CONTRACT_VIOLATION`. See `docs/active/BUNDLE_SWITCH_GAP_ANALYSIS.md`.
- **Production with STRICT_EVENT_CONTRACT:** Ensure `event_contract_v1.json` is available at runtime (loader tries `__dirname`, then `src/.../contracts/` and `dist/.../contracts/` under `process.cwd()`). Copy `src/config/cleanerLevels/contracts/*.json` into your deploy (e.g. into the same path under `dist/`) or run with working directory so one of those paths exists. See DEPLOYMENT for build notes.
- **Migration 057 (pt_safety_reports):** Run `057_pt_safety_reports.sql` only if you need event-style safety reports for the gamification/event pipeline. Optional; file is in `DB/migrations/`. See SETUP “Fresh DB path” and BUNDLE_SWITCH_GAP_ANALYSIS §5.2.
- **Suggestions (from gap analysis):** Prefer fresh DB + consolidated migration when possible; gamification worker logs `gamification_worker_run` / `gamification_worker_complete`; keep DECISIONS.md updated. Integration test skips are documented in TROUBLESHOOTING.

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

## 6. API behaviour (idempotency & messaging)

- **Idempotency-Key:** POST `/credits/checkout`, POST `/api/credits/checkout`, POST `/jobs`, POST `/payments/*`, and selected tracking routes read the `Idempotency-Key` header. Duplicate keys return the stored response (same status and body); no double charge or duplicate booking. Keys are stored in `idempotency_keys` (24h TTL). See `src/lib/idempotency.ts`.
- **Socket rooms (job-scoped messaging):** Frontend emits `join_booking` / `leave_booking` with `{ bookingId: jobId }` (or plain string). Backend (`src/index.ts`) joins/leaves room `booking:${bookingId}` so messages can be scoped by job.

### 6.1 Backend audit vs frontend contract (canonical)

Run in **puretask-backend** to re-verify. Summary:

| Audit item | Backend status |
|------------|----------------|
| **1. API contract** | `apiRouter` mounts `/jobs`, `/payments`, `/credits`, `/messages`, `/notifications`. Same routes at `/` and `/api/v1`. GET `/jobs/:jobId/details` exists. Trust adapter: `/api/credits/balance`, `/api/credits/ledger`, POST `/api/credits/checkout` with idempotency. |
| **2. Job lifecycle** | `applyStatusTransition` + POST `/:jobId/transition`; `requireIdempotency` on POST `/jobs` and POST `/:jobId/transition`. Illegal transitions rejected in service. |
| **3. Credit ledger** | `credit_ledger`, escrow/release/refund in `creditsService`; GET `/credits/balance`, `/credits/ledger`; GET `/api/credits/balance`, `/api/credits/ledger` (Trust shape). Integration tests cover credits flows. |
| **4. Payment + idempotency** | `requireIdempotency` on payments routes. `wallet_topup` / `job_charge` / `purpose` in `paymentService` and `payment_intents`. |
| **5. Messaging** | Socket: `join_booking` / `leave_booking` (accept string or `{ bookingId }`). `markMessagesAsRead`, `getUnreadCount`; GET `/messages/unread` and GET `/messages/unread-count` (alias); POST `/messages/job/:jobId/read`. |
| **6. Workers** | `WORKER_SCHEDULES` in `src/workers/scheduler.ts`; `CRONS_ENQUEUE_ONLY`; `package.json` scripts `worker:scheduler`, `worker:durable-jobs`, etc. |
| **7. Observability** | Sentry in `instrument.ts` + `setupExpressErrorHandler`. `helmet`, `securityHeaders`, `endpointRateLimiter` (or Redis). Error responses include `requestId` when set (requestContextMiddleware). |

---

## 7. Contacts and links

- **Checklists:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
- **Phase status:** [00-CRITICAL/PHASE_*_STATUS.md](./00-CRITICAL/)
- **Backup/restore:** [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)

**Last updated:** 2026-02-02
