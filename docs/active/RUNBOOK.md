# PureTask — Operations Runbook

**Purpose:** Deploy, rollback, incident response (Section 9).  
**See also:** [ARCHITECTURE.md](./ARCHITECTURE.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md).

---

## Documentation scope (canonical)

- This file is the **canonical operations runbook**.
- Canonical operations guidance is in Sections **1–6**.
- Any planning/checklist/reference material in later sections is supporting context; if there is a conflict, follow Sections 1–6 plus `DEPLOYMENT.md` and `TROUBLESHOOTING.md`.

### Canonical extractions from Merge-classified specs (D1.1)

- **Job state transitions:** canonical transition map and terminal-state rules are now in `ARCHITECTURE.md` § 3.6.
- **Stripe webhook handling:** ingest→route→handle flow and idempotency model are now in `ARCHITECTURE.md` § 3.7.
- **Ledger invariants:** required ledger row semantics, idempotency, and wallet/ledger integrity checks are now in `ARCHITECTURE.md` § 3.8.
- **Assignment engine principles:** voluntary-acceptance wave model and policy controls are now in `ARCHITECTURE.md` § 3.9.
- Remaining Merge-classified docs are preserved for staged merge and traceability in `docs/archive/raw/docs_governance/docs_file_ledger_2026-04-19.csv`.

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
- **Payment/webhook issues:** [SECTION_04_STRIPE_WEBHOOKS.md](./sections/SECTION_04_STRIPE_WEBHOOKS.md). **Stripe webhook (dedupe, retries, crash safety):** (1) Dedupe: intake writes to `webhook_events` with `ON CONFLICT (provider, event_id) DO NOTHING`; `handleStripeEvent` uses `stripe_events_processed` (event_id + object_id) so duplicate deliveries are no-op. (2) Retries: on processing failure we set `webhook_events.processing_status = 'failed'` and call `queueWebhookForRetry`; worker `webhook-retry` (every 5 min) processes `webhook_failures` with exponential backoff. (3) Crash safety: event is stored before processing; if the process crashes after handling, retry will call `handleStripeEvent` again but stripe_events_processed makes it idempotent. Canonical Stripe event mapping, idempotency expectations, and handler flow are tracked in [STRIPE_WEBHOOK_ROUTER.md](./STRIPE_WEBHOOK_ROUTER.md) and [STATE_SYNC.md](./STATE_SYNC.md).

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

### 3.9 High-value extracted contracts (from specs)

- **Job lifecycle contract:** Allowed statuses and transitions, preconditions, and idempotency expectations are summarized in [JOB_STATUS_MACHINE.md](./JOB_STATUS_MACHINE.md). This is the practical reference used when validating route behavior and worker side effects.
- **Stripe webhook routing contract:** Canonical event-to-handler mapping and duplicate/replay behavior are in [STRIPE_WEBHOOK_ROUTER.md](./STRIPE_WEBHOOK_ROUTER.md), with object-level state guarantees in [STATE_SYNC.md](./STATE_SYNC.md).
- **Assignment policy contract:** Marketplace-safe assignment principles and long-wave visibility policy are tracked in [ASSIGNMENT_ENGINE.md](./ASSIGNMENT_ENGINE.md).
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

## 7. Cloud-agent skills catalog (backend + testing + Playwright)

Use this section as the canonical skill inventory for autonomous agents working in Cursor Cloud.

### 7.1 Global invocation order (all code changes)

1. **Environment readiness**
   - Ensure toolchain + DB: `node -v`, `npm -v`, `npm run db:check`.
2. **Implement**
   - Keep route/service boundaries and auth middleware conventions (`authCanonical`).
3. **Targeted testing**
   - Run the smallest high-signal suite(s) first.
4. **Quality gate**
   - `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`.
5. **Evidence**
   - Save command outputs/artifacts for review (logs, curl output, test summaries).

### 7.2 Skill cards

| Skill | Use when | Required context | Command/checklist | Output/evidence |
|-------|----------|------------------|-------------------|-----------------|
| `env-bootstrap-cursor-cloud` | Fresh VM or broken local env | OS package manager access, repo root | Ensure apt HTTPS mirrors → install postgres/server client → start cluster → ensure `puretask` DB/user → `npm install` → `.env` bootstrap if missing → `npm run db:check` | Working DB check + bootable backend |
| `backend-feature-change` | Any route/service behavior change | Route path, role/auth requirement, service touched | Keep routes thin; do business logic in services; preserve requestId/error contracts; avoid direct DB access in routes | Code diff + route/service alignment notes |
| `db-migration-change` | SQL schema edits/new migration | Target DB URL, migration file order | Validate idempotency (`IF NOT EXISTS` where needed), run migration on clean/local DB, run affected integration tests | Migration success logs + regression test pass |
| `quality-gate-core` | Before commit/PR | None | `npm run lint` → `npm run format:check` → `npm run typecheck` → `npm run build` | Green quality/build logs |
| `security-secrets-guard` | Env/dependency/integration edits | Security baseline and CI policy | `npm run security:scan`; avoid secret files in git; avoid direct SendGrid/Twilio imports in production paths unless approved architecture exception | Scan output + policy compliance note |
| `release-readiness-backend` | Release candidate or risky refactor | ENV matrix, critical flows list | Run integration + smoke + quality gate; verify `/health`, `/health/ready`; verify key business route(s) | End-to-end verification transcript |

### 7.3 Testing skills (all supported test types)

#### `test-unit-vitest`
- **Trigger:** Service/lib/pure logic changes.
- **Inputs:** Files touched + related existing unit tests.
- **Run:** `npm run test -- --run <target-path-or-glob>`
- **Must verify:** logic branches, validation, idempotent helpers.
- **Evidence:** vitest pass output (targeted path).

#### `test-integration-vitest`
- **Trigger:** Route + DB changes, auth flow changes, payment/credits/jobs updates.
- **Inputs:** `DATABASE_URL` or `TEST_DATABASE_URL`, migrated schema.
- **Run:** `npm run test:integration`
- **Must verify:** API + DB interaction, transaction behavior, auth guards.
- **Evidence:** integration suite summary + failing case reruns resolved.

#### `test-smoke-vitest`
- **Trigger:** Release readiness, broad regressions, hotfix validation.
- **Inputs:** Running DB + seeded baseline as needed.
- **Run:** `npm run test:smoke`
- **Must verify:** core routes are alive and critical path still works.
- **Evidence:** smoke suite pass output.

#### `test-contract-and-response-shape`
- **Trigger:** API response shape/error handling changes.
- **Inputs:** Contract tests under `src/tests/contract`.
- **Run:** `npm run test -- --run src/tests/contract`
- **Must verify:** status codes, error schema, compatibility expectations.
- **Evidence:** contract tests pass.

#### `test-jest-live-api` (root `tests/` path)
- **Trigger:** Cleaner AI API behavior or scripts that rely on running server.
- **Inputs:** Running backend instance + test user credentials as required.
- **Run:** `bash tests/run-tests.sh` (or direct Jest command for specific file).
- **Must verify:** end-to-end HTTP behavior against live app process.
- **Evidence:** Jest run log with target API URL and pass/fail summary.

#### `test-load-k6`
- **Trigger:** Throughput/latency/capacity tasks.
- **Inputs:** stable target API URL + env safe for load testing.
- **Run:** `npm run test:load` / `npm run test:load:jobs`
- **Must verify:** no critical error spikes, acceptable latency under configured profile.
- **Evidence:** k6 summary (error rate, p95, throughput).

#### `test-performance-benchmark`
- **Trigger:** algorithm/query performance optimization claims.
- **Inputs:** reproducible benchmark scenario.
- **Run:** `npm run test:performance`
- **Must verify:** before/after measurable improvement.
- **Evidence:** benchmark output comparison.

### 7.4 Playwright skills (status + adoption workflow)

Current repo status: `tests/e2e/*.spec.ts` exists, but full Playwright wiring is partial and must be standardized before treating as required CI gate.

#### `playwright-bootstrap`
- **Trigger:** Team decides to operationalize browser E2E in this repo.
- **Checklist:**
  1. Add dependency: `npm install -D @playwright/test`
  2. Install browsers: `npx playwright install`
  3. Add `playwright.config.ts` with explicit `baseURL` and artifacts.
  4. Add scripts: `test:e2e`, `test:e2e:headed`, `test:e2e:ui`.
  5. Align ports/URLs explicitly (`API 4000`, frontend URL env-driven).
  6. Add CI workflow for Playwright artifacts on failure.
- **Output:** runnable E2E harness and CI job.

#### `playwright-e2e-execution`
- **Trigger:** UI-critical changes (auth UX, booking lifecycle UX, admin workflows).
- **Inputs:** running UI app + backend + test account fixtures.
- **Run:** `npm run test:e2e` (after bootstrap), with traces/screenshots on failure.
- **Must verify:** complete user flow from UI action to backend side effects.
- **Evidence:** pass summary + trace/report artifacts.

### 7.5 Pitfalls agents must explicitly guard against

1. **Dual test runners:** `vitest` does not automatically cover root `tests/*.test.ts` Jest files.
2. **Migration source mismatch:** local scripts may use different consolidated SQL files depending on command path; always state exact file used in test evidence.
3. **Port drift:** API defaults to `4000`, some scripts historically assume `3000`; set explicit URLs in commands.
4. **Policy checks in CI:** avoid unauthorized auth middleware imports and direct provider usage patterns blocked by policy workflows.
5. **Docs governance:** new markdown must remain under `docs/active/` or `docs/archive/`.

### 7.6 Full-stack deterministic E2E seed/reset skills

#### `seed-fullstack-e2e-users`
- **Trigger:** Before Playwright or contract verification that depends on deterministic test users.
- **Run (backend repo):**
  - `npm run seed:e2e:users`
- **Default deterministic accounts:**
  - `client@test.com` / `TestPass123!`
  - `cleaner@test.com` / `TestPass123!`
  - `admin@test.com` / `TestPass123!`
- **Evidence:** script prints ensured users and completes successfully.

#### `reset-fullstack-e2e-users`
- **Trigger:** Test cleanup, rerun from clean auth identities, or flaky auth state.
- **Run (backend repo):**
  - `npm run reset:e2e:users`
- **Evidence:** script reports number of deleted deterministic users.

#### `frontend-backend-contract-gate`
- **Trigger:** Frontend PRs touching API services/hooks or backend PRs changing response contracts.
- **Run (frontend repo):**
  - `npm run test:api`
- **Expected env:** `API_BASE`, `TEST_EMAIL`, `TEST_PASSWORD`.
- **Evidence:** verification report + failing endpoint details.

---

## 8. Contacts and links

- **Checklists:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
- **Phase status:** [00-CRITICAL/PHASE_*_STATUS.md](./00-CRITICAL/)
- **Backup/restore:** [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)

## 9. Live execution board (backend + frontend)

Use this checklist as the canonical execution tracker for full-stack hardening work.

Execution source: `docs/active/FORWARD_EXECUTION_GUIDE.md`.

### 9.1 Execution order (current)

1. P1.1 (frontend docs drift cleanup)
2. P1.2 (expand automated journey coverage)
3. P1.3 (resolve highest-impact skipped test suites)
4. P2.1 + P2.2 (backend architecture debt + security/quality gate tightening)

### 9.2 P0 — Release safety and mandatory full-stack correctness

- [x] **P0.1 Canonical contract alignment (backend endpoints vs frontend expectations)**
  - **Owner:** `@owner-backend` + `@owner-frontend`
  - **Touches:**
    - Backend: `docs/active/BACKEND_ENDPOINTS.md`
    - Frontend: `docs/BACKEND_ENDPOINTS.md`, `docs/FRONTEND_VS_BACKEND_REMAINING_WORK.md`
    - Frontend verifier: `scripts/run-api-verification.js`, `package.json`, `tests/e2e/auth/login.spec.ts`
  - **Verification commands/checks:**
    - Backend running on `:4000`
    - `npm run seed:e2e:users` (backend)
    - `npm run test:api` (frontend)
    - `npm run verify:fullstack` (frontend)
  - **Result notes (2026-04-19):**
    - Canonical + mirror contract docs synchronized.
    - Frontend unresolved-gap tracker updated to current integration reality.
    - Contract gate outputs refreshed in `puretask-frontend/docs/TEST_RESULTS.md` and `puretask-frontend/api-verification-summary.json`.

- [x] **P0.2 Migration path determinism (avoid env mismatch)**
  - **Owner:** `@owner-backend-platform`
  - **Touches:**
    - Backend workflows: `.github/workflows/migrations.yml`, `.github/workflows/ci.yml`
    - Backend scripts/docs: `scripts/setup-test-db.js`, `docs/active/MASTER_MIGRATIONS.md`, `docs/active/SETUP.md`, `docs/active/TROUBLESHOOTING.md`
  - **Verification commands/checks:**
    - `npm run db:validate:migrations`
    - `STRICT_MIGRATION_PATH=1 npm run db:setup:test`
    - `npm run test:ci`
  - **Result notes (2026-04-19):**
    - CI migration checks now enforce deterministic setup (`STRICT_MIGRATION_PATH=1`) and run migration validation before setup.
    - `db:setup:test` strict mode fails on drift instead of silently falling back/skipping unify migrations.
    - Unify migrations `059–061` were aligned with canonical `users.id` TEXT FKs; `000_MASTER_MIGRATION.sql` regenerated from corrected sources.

- [x] **P0.3 Release orchestration hard gate**
  - **Owner:** `@owner-devops`
  - **Touches:**
    - Backend: `.github/workflows/release-orchestration.yml`, `.github/workflows/release.yml`
    - Frontend: `.github/workflows/release.yml`
  - **Verification commands/checks:**
    - Trigger orchestration with explicit refs and environment.
    - Confirm release dispatches only execute after validate job success.
  - **Result notes (2026-04-19):**
    - Orchestration defaults and checkout targets normalized to canonical repositories (`Puretask-co/puretask-backend`, `Puretask-co/puretask-frontend`).
    - `validate` job now enforces backend deterministic migration + test gate (`db:validate:migrations`, strict `db:setup:test`, `test:ci`) before any deploy dispatch.
    - Validated release manifest artifact is generated and consumed by deploy job, ensuring traceable backend/frontend refs for each coordinated release.
    - Dispatch payload now includes `backend_ref`, `frontend_ref`, and `orchestration_run_id` for both backend and frontend release workflows.
    - Added frontend `.github/workflows/release.yml` workflow with explicit dispatch inputs and release trace output.

### 9.3 P1 — Confidence and maintainability

- [ ] **P1.1 Frontend docs drift cleanup (must match real scripts/workflows)**
  - **Owner:** `@owner-frontend-platform`
  - **Touches:**
    - `README.md`, `docs/DEPLOYMENT.md`, `LAUNCH_CHECKLIST.md`, `docs/ENV_SETUP.md` (frontend repo)
  - **Verification commands/checks:**
    - `npm run build`
    - `npm run start`
    - `npm run test:api`

- [ ] **P1.2 Expand automated journey coverage beyond minimum smoke**
  - **Owner:** `@owner-qa` + `@owner-frontend`
  - **Touches:**
    - Frontend workflows: `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`
    - Frontend tests: `tests/e2e/**`
  - **Verification commands/checks:**
    - `npm run test:e2e:smoke`
    - `npm run test:e2e`

- [ ] **P1.3 Resolve highest-impact skipped test suites**
  - **Owner:** `@owner-frontend`
  - **Touches:**
    - Frontend tests listed in `docs/SKIPPED_TESTS.md`
  - **Verification commands/checks:**
    - `npm run test`
    - `npm run test:coverage`

### 9.4 P2 — Scale-quality and operational polish

- [ ] **P2.1 Backend architecture debt reduction (route→service boundaries)**
  - **Owner:** `@owner-backend`
  - **Touches:**
    - Backend routes/services with direct DB access concentration
  - **Verification commands/checks:**
    - `npm run lint`
    - `npm run test:integration`

- [ ] **P2.2 Security/quality gate tightening**
  - **Owner:** `@owner-security`
  - **Touches:**
    - Backend workflow gates (format/audit/scan policy)
    - Frontend workflow policy where applicable
  - **Verification commands/checks:**
    - `npm run security:scan`
    - `npm audit --audit-level=critical`
    - `npm run lint && npm run test` (frontend)

## 10. Docs governance migration tracker (canonical)

Use this checklist to track the documentation model migration (canonical vs reference) and avoid future drift.

- [x] **D0.1 Adopt two-tier docs governance model**
  - **Owner:** `@owner-platform`
  - **Touches:**
    - `.cursor/rules/documentation.mdc`
    - `docs/active/DECISIONS.md`
  - **Verification commands/checks:**
    - Confirm rules file defines Tier 1 canonical + Tier 2 reference model.
    - Confirm `DECISIONS.md` records the decision and marks prior canonical-only stance as superseded.

- [x] **D0.2 Align docs entrypoint with governance model**
  - **Owner:** `@owner-platform`
  - **Touches:**
    - `docs/active/README.md`
  - **Verification commands/checks:**
    - Validate Tier 1 list maps to canonical docs only.
    - Validate Tier 2 section links to existing reference docs.

- [x] **D0.3 Add scope guardrails to core canonical docs**
  - **Owner:** `@owner-platform`
  - **Touches:**
    - `docs/active/SETUP.md`
    - `docs/active/ARCHITECTURE.md`
    - `docs/active/RUNBOOK.md`
  - **Verification commands/checks:**
    - Confirm each file states canonical scope and where non-scope content belongs.

- [x] **D1.1 Full docs inventory and classification**
  - **Owner:** `@owner-platform`
  - **Touches:**
    - `docs/active/**`
    - `docs/archive/raw/**` (for moved/superseded files)
  - **Verification commands/checks:**
    - `git ls-files "*.md" > /workspace/md_inventory.txt`
    - `git ls-files "*.txt" > /workspace/txt_inventory.txt`
    - `wc -l /workspace/md_inventory.txt /workspace/txt_inventory.txt`
    - `node -e 'const fs=require("fs");const path=require("path");const {execSync}=require("child_process");const root="/workspace";const canonical=new Set(["docs/active/README.md","docs/active/SETUP.md","docs/active/ARCHITECTURE.md","docs/active/RUNBOOK.md","docs/active/DEPLOYMENT.md","docs/active/TROUBLESHOOTING.md","docs/active/DECISIONS.md"]);const list=(pat)=>execSync("git ls-files \\""+pat+"\\"",{cwd:root,encoding:"utf8"}).trim().split("\\n").filter(Boolean);const files=[...list("*.md"),...list("*.txt")].sort();const rows=[["path","kind","classification","action","target","rationale"]];const summary={};const moveList=[];for(const f of files){const kind=f.endsWith(".md")?"md":"txt";let classification="Keep Reference",action="keep",target="",rationale="retain as supporting reference";if(canonical.has(f)){classification="Keep Canonical";rationale="tier-1 canonical source of truth";}else if(f.startsWith("docs/active/")){classification="Keep Reference";rationale="tier-2 active reference documentation";}else if(f.startsWith("docs/archive/")||f.startsWith("docs/_archive/")){classification="Archive";action="keep_archived";rationale="already archived history";}else if(kind==="txt"){classification="Archive";action="move_to_archive";target="docs/archive/raw/intake_txt/"+path.basename(f);rationale="intake/transient text outside canonical docs";moveList.push([f,target]);}else if(f.startsWith("docs/specs/")||f.startsWith("docs/blueprint/")||f.startsWith("docs/versions/")||f.startsWith("docs/runbooks/")){classification="Merge";action="merge_then_archive";target="docs/active/(canonical targets)";rationale="structured spec content to merge into canonical docs before archiving";}else if(f.startsWith("docs/admin/")||f.startsWith("docs/ai-assistant/")||f.startsWith("docs/architecture/")||f.startsWith("docs/_active/")||f.startsWith("docs/_future/")||f.startsWith("docs/_md_inventory/")||(/^docs\\/[A-Z0-9_\\-]+\\.md$/.test(f))||(/^docs\\/[A-Za-z0-9_\\-]+\\.md$/.test(f)&&!f.startsWith("docs/active/")&&!f.startsWith("docs/archive/")&&!f.startsWith("docs/_archive/")&&!f.startsWith("docs/specs/")&&!f.startsWith("docs/blueprint/")&&!f.startsWith("docs/versions/")&&!f.startsWith("docs/runbooks/"))){classification="Archive";action="archive_legacy_docs";target="docs/archive/raw/legacy_docs/"+f.replace(/^docs\\//,"");rationale="legacy docs outside canonical/reference structure";moveList.push([f,target]);}rows.push([f,kind,classification,action,target,rationale]);summary[classification]=(summary[classification]||0)+1;}const esc=(s)=>{s=String(s||"");return /[",\\n]/.test(s)?"\\""+s.replace(/\\"/g,"\\"\\"")+"\\"":s;};const csv=rows.map(r=>r.map(esc).join(",")).join("\\n")+"\\n";const dir="/workspace/docs/archive/raw/docs_governance";fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+"/docs_file_ledger_2026-04-19.csv",csv);fs.writeFileSync(dir+"/docs_file_ledger_summary_2026-04-19.txt",["TOTAL "+files.length,...Object.entries(summary).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>k+" "+v)].join("\\n")+"\\n");fs.writeFileSync(dir+"/docs_file_moves_2026-04-19.tsv",moveList.map(([a,b])=>a+"\\t"+b).join("\\n")+"\\n");'`
    - `while IFS=$'\t' read -r src dest; do mkdir -p "$(dirname "/workspace/$dest")" && git mv "$src" "$dest"; done < /workspace/docs/archive/raw/docs_governance/docs_file_moves_2026-04-19.tsv`
    - Artifacts: `docs/archive/raw/docs_governance/docs_file_ledger_2026-04-19.csv`, `docs/archive/raw/docs_governance/docs_file_ledger_summary_2026-04-19.txt`, `docs/archive/raw/docs_governance/docs_file_moves_2026-04-19.tsv`

- [x] **D1.2 Resolve stale links and missing references in docs/active**
  - **Owner:** `@owner-platform`
  - **Touches:**
    - `docs/active/README.md`
    - Any docs with dead internal links
  - **Verification commands/checks:**
    - `node -e 'const fs=require("fs");const path=require("path");const {execSync}=require("child_process");const root="/workspace";const files=execSync("git ls-files \\"docs/active/**/*.md\\"",{cwd:root,encoding:"utf8"}).trim().split("\\n").filter(Boolean);const miss=[];const re=/\\[[^\\]]*\\]\\(([^)]+)\\)/g;for(const rel of files){const abs=path.join(root,rel);const txt=fs.readFileSync(abs,"utf8");let m;while((m=re.exec(txt))){const raw=m[1].trim();if(!raw||raw.startsWith("http://")||raw.startsWith("https://")||raw.startsWith("#")||raw.startsWith("mailto:")) continue;const clean=raw.split("#")[0].split("?")[0];if(!clean) continue;const target=path.resolve(path.dirname(abs),clean);if(!fs.existsSync(target)) miss.push(rel+" -> "+raw);}}fs.writeFileSync("/workspace/docs/archive/raw/docs_governance/docs_active_link_check_2026-04-19.txt",["TOTAL_FILES "+files.length,"MISSING "+miss.length,...miss].join("\\n")+"\\n");console.log("TOTAL_FILES "+files.length);console.log("MISSING "+miss.length);'`
    - Report artifact: `docs/archive/raw/docs_governance/docs_active_link_check_2026-04-19.txt`
    - Validate `MISSING 0` in report.

- [x] **D2.1 Ongoing docs hygiene cadence**
  - **Owner:** `@owner-platform`
  - **Touches:**
    - `docs/active/README.md` (or governance section)
  - **Verification commands/checks:**
    - `node -e '/* full docs inventory + ledger regeneration */'`
    - `node -e '/* docs/active internal link checker */'`
    - Log artifact present: `docs/archive/raw/docs_governance/docs_hygiene_log_2026-04.md`
    - Confirm monthly log includes inventory totals and `MISSING 0`.

### Current cross-repo execution source of truth

- Forward planning and sequencing across backend + frontend is tracked in `docs/active/FORWARD_EXECUTION_GUIDE.md`.

**Last updated:** 2026-04-19
