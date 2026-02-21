# PureTask Project Audit — Questions & Answers

**Purpose:** Single audit document answering 14 question groups about project completeness, counts, integrations, and setup.  
**Last updated:** February 2025.

---

## 1. What's Complete and What's Not Complete?

### Design & policy (complete)

| Section | Status |
|---------|--------|
| 1 — Secrets & Incident Response | ✅ Complete (design) |
| 2 — Auth Consistency & Route Protection | ✅ Complete (design + implementation) |
| 3 — Guardrails, CI & Repo Hygiene | ✅ Complete (design) |
| 4 — Stripe, Webhooks & Integrations | ✅ Complete (design) |
| 5 — Database & Migration Hygiene | ✅ Complete (design) |
| 6 — Workers, Crons & Background Jobs | ✅ Complete (design) |
| 7 — API Design & Client Safety | ✅ Complete (design) |
| 8 — Security Hardening | ✅ Complete (design) |
| 9 — Maintainability & Velocity | ✅ Complete (design) |
| 10 — Cost, Scale & Performance | ✅ Complete (design) |
| 11 — Admin Ops & Support | ✅ Complete (design) |
| 12 — Trust, Quality & Dispute Evidence | ✅ Complete (design) |

### Remaining (not done)

| Section | Status |
|---------|--------|
| 13 — Legal, Policy & Compliance | ⏳ Not done |
| 14 — Launch Readiness & Rollout | ⏳ Not done |
| **Implementation phase** | ⏳ Many checklist items remain (CI setup, cost map, dashboards, etc.) |

### Implementation gaps (partial)

- Cost map with unit economics
- Performance budgets enforced via alerts
- Caching allowed list + TTL policy doc
- Worker priority/backpressure doc
- Notification channel policy table
- Storage/bandwidth policy doc
- Performance and cost dashboards

**Reference:** `docs/active/MASTER_CHECKLIST.md`, `docs/active/sections/SECTION_10_COST_SCALE.md`.

---

## 2. Inventory Counts

### Pages

**Backend only.** This repo is the API; pages live in the frontend (separate repo). No page count here.

### Components

**Backend only.** No React/Vue components. Closest equivalents: route modules, middleware, workers.

### Services

**~95 service files** in `src/services/` (excl. `__tests__`). Includes:

- Core: `jobsService`, `creditsService`, `payoutsService`, `paymentService`, `authService`, etc.
- Notifications: `notificationService`, `eventBasedNotificationService`, providers (SendGrid, Twilio, OneSignal)
- AI: `aiService`, `aiCommunication`, `aiScheduling`
- Admin: `adminService`, `adminRepairService`, `adminAuditService`, etc.
- Gamification: `gamificationRewardService`, `cleanerLevelService`, etc.

### Migrations

**~85 SQL migration files** in `DB/migrations/`, including:

- `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` (main schema)
- `001_init.sql` through `056_marketplace_health_governor.sql`
- NEON patches, hardening (901–907), `_appendix_043_to_906.sql`

### Endpoints (approximate)

**~350+ route handlers** across all routers. Main route modules:

| Router | Approx. endpoints |
|--------|-------------------|
| admin (incl. sub-routers) | ~100+ |
| gamification | ~28 |
| cleaner | ~23 |
| cleanerEnhanced | ~20 |
| client | ~19 |
| clientEnhanced | ~19 |
| authEnhanced | ~26 |
| v2 | ~26 |
| premium | ~12 |
| jobs | ~11 |
| analytics | ~11 |
| cleaner-ai-settings | ~15 |
| Others | ~100+ |

Canonical paths: `/`, `/api/v1/*`, `/api/webhooks/*` (Stripe).

### Files

- **src:** ~363 `.ts` files (routes, services, lib, workers, tests)
- **DB:** ~85 migrations + README
- **docs:** Hundreds of markdown files (active, archive, sections)
- **mcp:** 12 files (4 servers + shared)
- **postman:** 1 collection file

### Documents

- **docs/active:** Primary runbooks, checklists, sections
- **docs/archive:** Historical docs
- **docs/sections:** SECTION_01 through SECTION_14
- **docs/founder:** Founder references (FOUNDER_*.md)

### Indexes (database)

Created in migrations. Examples: `idx_jobs_status`, `idx_jobs_client_id`, `idx_messages_job`, `idx_cleaner_profiles_tier`, `idx_webhook_events_provider_event_id`, `idx_durable_jobs_status`, etc. Exact count in schema/migrations.

### Environment variables

**Required (5):** `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`

**Notification (15+):** SendGrid (API key, from email, 12 template IDs), Twilio (SID, token, from number), OneSignal (app ID, API key), SMS templates (2)

**Optional (50+):** N8N (`N8N_WEBHOOK_URL`, `N8N_API_KEY`, `N8N_MCP_SERVER_URL`), Redis, feature flags, payouts, credits, AI (OpenAI), OAuth (Google, Facebook), alerts, etc.

**Reference:** `src/config/env.ts`, `ENV_VARS_CHECKLIST.md`.

### Notifications (types)

**24 notification types** in `NotificationType`:

- Job lifecycle: `job.created`, `job.accepted`, `job.on_my_way`, `job.started`, `job.completed`, `job.awaiting_approval`, `job.approved`, `job.disputed`, `job.cancelled`, `job.reminder_24h`, `job.reminder_2h`, `job.no_show_warning`
- Payments: `credits.purchased`, `credits.low`, `payout.processed`, `payout.failed`, `payment.failed`
- Account: `welcome`, `password.reset`
- Subscriptions: `subscription.renewal_reminder`

**Reference:** `src/services/notifications/types.ts`.

---

## 3. What is Postman?

**Postman** is an API client for testing HTTP APIs. You can:

- Send requests (GET, POST, PUT, etc.) to your API
- Save requests in collections
- Use variables for base URL, tokens
- Run collections for regression testing

**PureTask usage:** `postman/PureTask-API.postman_collection.json` is a Postman collection for the PureTask API. Import it in Postman (File → Import) to test endpoints locally or against staging/production.

**When to use:** Manual API testing, sharing API examples with the team, exploratory testing. For automated tests, use Vitest (smoke, integration).

---

## 4. Do All Workers Operate Correctly and Communicate With One Another?

### Worker architecture

- **Scheduler** (`src/workers/scheduler.ts`): Runs workers on a cron schedule (or enqueues to `durable_jobs` when `CRONS_ENQUEUE_ONLY=true`).
- **Durable job worker** (`src/workers/runDurableJobWorker.ts`): Processes jobs from `durable_jobs` with `FOR UPDATE SKIP LOCKED`.
- **Queue processor** (`src/workers/v2-operations/queueProcessor.ts`): Processes `job_queue` (calendar sync, AI checklist, AI dispute).
- **Individual workers:** Each has a `runX` function invoked by the scheduler or durable job worker.

### Communication

- **Shared state:** DB tables (`durable_jobs`, `job_queue`, `webhook_failures`, `worker_runs`).
- **No direct worker-to-worker RPC.** Workers coordinate via:
  - Enqueue to `durable_jobs` or `job_queue`
  - Writing to shared tables (events, credits, payouts)
  - Events → `publishEvent` → `job_events` + n8n forward

### Worker status

| Worker | Status |
|--------|--------|
| auto-cancel | ✅ Enabled |
| retry-notifications | ✅ Enabled |
| webhook-retry | ✅ Enabled |
| lock-recovery | ✅ Enabled |
| auto-expire | ✅ Enabled |
| kpi-daily | ✅ Enabled |
| nightly-scores | ✅ Enabled |
| subscription-jobs | ✅ Enabled |
| reliability-recalc | ✅ Enabled |
| backup-daily | ✅ Enabled |
| credit-economy | ✅ Enabled |
| photo-cleanup | ✅ Enabled |
| onboarding-reminders | ✅ Enabled |
| payout-retry | Conditional (PAYOUTS_ENABLED) |
| payout-reconciliation | Conditional (PAYOUTS_ENABLED) |
| payout-weekly | Conditional (PAYOUTS_ENABLED) |
| expire-boosts | ✅ Enabled |
| weekly-summary | ✅ Enabled |
| job-reminders | ✅ Enabled |
| no-show-detection | ✅ Enabled |
| governor-metrics | ✅ Enabled |
| goalChecker, cleaningScores | Disabled (in `disabled/`) |

### Potential issues

- `queueProcessor` registers only 3 of 7 `QUEUE_NAMES` (CALENDAR_SYNC, AI_CHECKLIST, AI_DISPUTE). Others (WEEKLY_REPORT, SUBSCRIPTION_JOB, NOTIFICATION, WEBHOOK_RETRY) have no handler there.
- `webhook-retry` uses `webhookRetryService` / `webhook_failures`, not `job_queue`.
- No shared metrics or dashboards for queue depth, processing latency, dead-letter count.

**Reference:** `src/workers/scheduler.ts`, `src/workers/index.ts`, `src/workers/workerHandlers.ts`, `src/lib/queue.ts`, `docs/active/founder/FOUNDER_QUEUE.md`.

---

## 5. What Cron Jobs Do We Have?

From `WORKER_SCHEDULES` in `src/workers/scheduler.ts`:

| Worker | Cron | Frequency |
|--------|------|-----------|
| auto-cancel | `*/5 * * * *` | Every 5 min |
| retry-notifications | `*/10 * * * *` | Every 10 min |
| webhook-retry | `*/5 * * * *` | Every 5 min |
| lock-recovery | `*/15 * * * *` | Every 15 min |
| auto-expire | `0 * * * *` | Every hour |
| governor-metrics | `0 * * * *` | Every hour |
| job-reminders | `*/30 * * * *` | Every 30 min |
| no-show-detection | `*/15 * * * *` | Every 15 min |
| payout-retry | `*/30 * * * *` | Every 30 min |
| kpi-daily | `0 1 * * *` | Daily 1 AM |
| nightly-scores | `0 2 * * *` | Daily 2 AM |
| subscription-jobs | `0 2 * * *` | Daily 2 AM |
| reliability-recalc | `0 3 * * *` | Daily 3 AM |
| backup-daily | `0 3 * * *` | Daily 3 AM |
| credit-economy | `0 4 * * *` | Daily 4 AM |
| weekly-summary | `0 4 * * 1` | Monday 4 AM |
| photo-cleanup | `0 5 * * *` | Daily 5 AM |
| payout-reconciliation | `0 6 * * *` | Daily 6 AM |
| onboarding-reminders | `0 */6 * * *` | Every 6 hours |
| expire-boosts | `0 0 * * *` | Daily midnight |
| payout-weekly | `0 0 * * 0` | Sunday midnight |

**How they run:** Via `scheduler.ts` (node process) or Railway cron triggering the scheduler. When `CRONS_ENQUEUE_ONLY=true`, scheduler enqueues to `durable_jobs`; the durable job worker processes them.

**Reference:** `src/workers/scheduler.ts`.

---

## 6. What Systems, Features, and Functions Does PureTask Have?

### Core marketplace

- Job creation, assignment, lifecycle (requested → accepted → on_my_way → in_progress → awaiting_approval → completed)
- Credits (escrow, release, purchase, refund)
- Stripe Connect (cleaner payouts)
- Messaging (job chat)
- Job photos (before/after)
- GPS tracking, check-in/check-out

### Auth & users

- JWT auth, registration, login, refresh
- Role-based access (client, cleaner, admin)
- OAuth (Google, Facebook)
- 2FA, password reset, email verification
- Session management

### Admin

- Admin dashboard, KPIs
- Client/cleaner management
- Booking management, disputes
- Finance, analytics, risk
- Settings, webhooks, system

### Notifications

- Email (SendGrid), SMS (Twilio), Push (OneSignal)
- Event-based flow via n8n
- Job reminders, onboarding reminders

### AI

- AI Assistant (cleaner communication automation)
- AI scheduling (suggest slots)
- AI dispute suggestions
- Quick replies, saved messages

### Gamification

- Cleaner levels, badges, challenges
- Governor metrics, marketplace health

### Integrations

- Stripe (payments, Connect)
- n8n (event forwarding, workflows)
- Google Calendar
- Checkr (background checks)

### Infrastructure

- Durable jobs, job queue
- Webhook retry, lock recovery
- Rate limiting (in-memory + Redis)
- Sentry (errors, performance)

**Reference:** `src/index.ts` (routes), `src/services/`, `docs/active/`.

---

## 7. What Do We Use n8n For, and Is It Connected Correctly?

### Uses

- **Event forwarding:** `publishEvent` sends events to n8n webhook (`N8N_WEBHOOK_URL`).
- **Notifications:** n8n can send email, SMS, push via SendGrid/Twilio/OneSignal (Universal Sender pattern).
- **Automation:** Reminders, dispute alerts, weekly summaries, etc.
- **MCP:** Optional `N8N_MCP_SERVER_URL` for AI assistants to interact with n8n.

### Connection

- **Outbound:** Backend POSTs to `N8N_WEBHOOK_URL` with HMAC signature (`x-n8n-signature`).
- **Secret:** `N8N_WEBHOOK_SECRET` used for HMAC.
- **Inbound:** `POST /events` and `POST /n8n/events` accept n8n callbacks; `verifyN8nSignature` middleware validates signature.

### Setup checklist

- [ ] `N8N_WEBHOOK_URL` set to n8n workflow webhook URL
- [ ] `N8N_WEBHOOK_SECRET` matches n8n HMAC secret
- [ ] `USE_EVENT_BASED_NOTIFICATIONS=true` if using n8n for notifications
- [ ] n8n workflow subscribed to PureTask event payloads

**Reference:** `src/lib/n8nClient.ts`, `src/lib/events.ts`, `src/routes/events.ts`, `docs/N8N_MCP_INTEGRATION.md`, `docs/N8N_WEBHOOK_SECRET.md`.

---

## 8. What Webhooks Do We Have/Use? Watch For PureTask?

### Inbound (we receive)

| Webhook | Path | Auth | Purpose |
|---------|------|------|---------|
| Stripe | `/stripe/webhook`, `/api/webhooks/stripe/webhook` | Signature (whsec_) | Payment events, Connect events |
| n8n | `/events`, `/n8n/events` | HMAC (`x-n8n-signature`) | n8n callbacks into PureTask |
| Checkr | (via backgroundCheckService) | — | Background check status |

### Outbound (we send)

| Target | Purpose |
|--------|---------|
| n8n | Event forwarding (job.*, credits.*, etc.) |
| Slack | Alerts (ALERT_SLACK_WEBHOOK_URL) |
| Stripe | API calls (not webhooks) |

### Watch for PureTask

- **Stripe:** Configure webhook in Stripe Dashboard to your `/stripe/webhook` (or `/api/webhooks/stripe/webhook`) URL. Use `STRIPE_WEBHOOK_SECRET` for verification.
- **n8n:** Configure PureTask to POST to your n8n webhook. Use `N8N_WEBHOOK_SECRET` for inbound verification if n8n calls back.

**Reference:** `src/routes/stripe.ts`, `src/routes/events.ts`, `src/services/webhookRetryService.ts`, `DB/migrations/042_webhook_events.sql`.

---

## 9. Cursorignore, Auth Setup, Test Headers vs JWT

### Cursorignore

**File:** `.cursorignore`  
**Included:** `docs/archive/**`, `**/*_FIX*.md`, `**/*COMPLETE*.md`, `node_modules/**`, `dist/**`, `coverage/**`, `.env.local`, `.env.*.local`, `.git/**`, `**/docs/archive/**`, `**/*DAY_*.md`, build/cache dirs, IDE files, OS files.

**Should also consider:** `.env` (if not already covered by `.gitignore` — `.env` is usually gitignored; `.cursorignore` focuses on Cursor context). Large generated files, binary assets. Current setup is reasonable.

### Auth setup

- **Canonical auth:** `authCanonical` — `requireAuth`, `requireRole`, `requireAdmin`, etc.
- **All protected routes** use `requireAuth` (or equivalent) from `authCanonical`.
- **Webhooks** do not use JWT; they use signature verification only.

### Test headers vs JWT

- **Tests use JWT:** `Authorization: Bearer ${token}` with tokens from `createTestClient()`, `createTestCleaner()`, `createTestAdmin()`, or auth/login.
- **No test headers:** No `X-Test-User-Id` or bypass headers in production code.
- **Recommendation:** Continue using JWT in tests. It exercises the real auth path. Test headers would bypass auth and hide bugs.

**Reference:** `.cursorignore`, `src/middleware/authCanonical.ts`, `src/tests/helpers/testUtils.ts`, `docs/active/ROUTE_PROTECTION_TABLE.md`.

---

## 10. Does PureTask Have an MCP Server?

**Yes.** PureTask includes **four local MCP servers** in the `mcp/` folder:

| Server | Port (default) | Purpose |
|--------|----------------|---------|
| Docs | 7091 | Read allowlisted docs (redacted) |
| Ops | 7092 | Limited actions: runAudit, health, statusSummary, tailLog, pingN8n |
| Logs/Health | 7093 | Health, status-summary, logs/tail |
| Config | 7094 | env-vars, feature-flags, events, templates |

**Auth:** Bearer token (`MCP_TOKEN`).  
**Note:** These are **local/dev** servers for Cursor/IDE integration. They are not the main API. `N8N_MCP_SERVER_URL` refers to **n8n's** MCP server (n8n cloud), not PureTask's.

**Reference:** `mcp/README.md`, `mcp/configServer.ts`, `mcp/docsServer.ts`, etc.

---

## 11. Notifications — Total, Groups, Status

### Total notification types

**24** (see Section 2).

### Groups

| Group | Types |
|-------|-------|
| Job lifecycle | job.created, accepted, on_my_way, started, completed, awaiting_approval, approved, disputed, cancelled, reminder_24h, reminder_2h, no_show_warning |
| Payments | credits.purchased, credits.low, payout.processed, payout.failed, payment.failed |
| Account | welcome, password.reset |
| Subscriptions | subscription.renewal_reminder |

### How many should we have?

Current set covers core flows. Additional candidates: `subscription.expired`, `job.rescheduled`, `dispute.resolved`, `cleaner.verified`, etc. Add as product needs arise.

### Wired and working?

- **Templates:** All 24 have entries in `TEMPLATES` (`src/services/notifications/templates.ts`).
- **Channels:** Email (SendGrid), SMS (Twilio), Push (OneSignal) — each provider checks `isConfigured()`.
- **Routing:** `notificationService` and `eventBasedNotificationService` route by type and channel.
- **Dedupe:** Time-windowed or "ever" per type.
- **Retry:** `retryFailedNotifications` worker retries failed sends.

**Potential gaps:** Event-to-notification mapping in `eventBasedNotificationService`; some types may not be triggered from `publishEvent` paths. Verify each type is emitted where intended.

**Reference:** `src/services/notifications/`, `src/lib/events.ts`, `docs/active/founder/FOUNDER_NOTIFICATIONS.md`.

---

## 12. AI Assistant — Capabilities, Control, UI

### What it does

- **AI communication:** Automated replies, scheduling assistance for cleaners.
- **AI scheduling:** Suggests time slots (`/ai/suggest-slots`).
- **Settings:** `communication_settings`, `ai_onboarding_completed`, `ai_features_active_count` on `cleaner_profiles`.

### Capabilities

- Get/update AI settings
- Suggest booking slots
- Checklist generation (queued)
- Dispute suggestions (queued)
- Quick replies, saved messages
- AI templates (cleaner_ai_templates)

### User control

- Cleaners control `communication_settings` (e.g. `ai_scheduling_enabled`) via `/ai/settings` and `/cleaner/ai/*`.
- Admin can tune level/config via admin routes.

### UI for settings

- **Backend:** `/ai/settings` (GET/PUT), `/cleaner/ai/*` routes exist.
- **Frontend:** Implemented in the separate frontend repo. Backend exposes the APIs; frontend must render the UI.

### Does it work correctly?

- Services and routes exist; integration tests cover parts of the flow.
- Full E2E depends on OpenAI key, n8n, and frontend. Verify in staging.

**Reference:** `src/routes/ai.ts`, `src/routes/cleaner-ai-settings.ts`, `src/services/aiService.ts`, `src/services/aiCommunication.ts`, `src/services/aiScheduling.ts`.

---

## 13. What Is Sentry? How Should We Use It for PureTask?

### What Sentry is

Sentry is an error and performance monitoring service. It captures:

- Unhandled errors and rejected promises
- Express errors (via `setupExpressErrorHandler`)
- Sampled performance traces (10% in prod)
- Sampled profiling (5% in prod)

### How we use it

- **Init:** `src/instrument.ts` — `Sentry.init()` when `SENTRY_DSN` is set. Loaded first in `index.ts`.
- **Error handler:** `Sentry.setupExpressErrorHandler(app)` after all routes.
- **No double capture:** Custom error middleware does not call `Sentry.captureException` again.

### How to use it for PureTask

1. Set `SENTRY_DSN` in production (and optionally staging).
2. Use Sentry dashboard for errors, performance, alerts.
3. Add `Sentry.captureException(err)` or `Sentry.captureMessage()` for manual reporting when needed.
4. Keep `sendDefaultPii: false` to avoid sending user data.

**Reference:** `src/instrument.ts`, `docs/active/founder/FOUNDER_SENTRY.md`.

---

## 14. What Is Railway? Should We Use It? Are We Using It Correctly?

### What Railway is

Railway is a cloud platform for deploying apps (Node, Docker, etc.) with built-in database, env vars, and CI/CD.

### Should we use it?

Yes, for a simple deployment story. It supports:

- GitHub deploy on push
- PostgreSQL (or Neon) for DB
- Env vars, health checks
- Rollback

### Are we using it correctly?

- **Deploy:** Build `npm run build`, start `node -r ./dist/instrument.js ./dist/index.js`.
- **Variables:** Required vars set per `ENV_VARS_CHECKLIST.md`.
- **`.railwayignore`:** Excludes `node_modules/`, `.git/`, tests, docs, `mcp/`, etc. — appropriate.
- **Trust proxy:** `app.set("trust proxy", 1)` for rate limiting behind Railway’s proxy.

**Reference:** `docs/active/DEPLOYMENT.md`, `.railwayignore`, `package.json` scripts.

---

**See also:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md), [ENV_VARS_CHECKLIST.md](../ENV_VARS_CHECKLIST.md), [ROUTE_PROTECTION_TABLE.md](./ROUTE_PROTECTION_TABLE.md).
