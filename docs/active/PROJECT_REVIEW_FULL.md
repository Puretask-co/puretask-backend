# PureTask Backend — Full Project Review

**Purpose:** Comprehensive review of every system, worker, feature, cron job, user-facing and admin-facing functionality, and tests. What is accomplished, what remains, and detailed descriptions.

**Last updated:** 2026-02-02

**Recent progress:** credit_ledger schema (amount/direction → delta_credits) fixed in tests, admin/clients, kpiService, gdprService. QUEUE_NAMES: only HANDLED_QUEUE_NAMES processed; reserved queues documented. COST_MAP.md added. Verification checklists in DEPLOYMENT.md.

---

## Executive Summary

| Category | Accomplished | Remaining | Notes |
|----------|--------------|-----------|-------|
| **Core API** | ~350+ endpoints, 45+ route modules | DTOs, full Zod validation, cursor pagination | MVP-complete |
| **Workers** | 20 active workers, scheduler, durable jobs | Some integration tests fail; queue depth metrics | Operational |
| **Auth & Security** | Canonical auth, route protection, error sanitization | Ownership audit, CSRF if needed | Production-ready |
| **Tests** | Contract, auth, state-machine, many unit tests | Fix failing integration/smoke tests | ~15–20 tests failing |
| **Documentation** | RUNBOOK, DEPLOYMENT, ARCHITECTURE, checklists | Cost map, performance dashboards | Good coverage |
| **Legal** | TOS draft, IC safeguards, Cleaner/Privacy drafts | Legal review, publish | Drafts exist |

---

## PART 1: WHAT WE HAVE ACCOMPLISHED

### 1.1 Core Systems

| System | Status | Description |
|--------|--------|-------------|
| **Job Lifecycle** | ✅ Complete | Full state machine: requested → accepted → on_my_way → in_progress → awaiting_approval → completed. Transitions enforced; BAD_TRANSITION for invalid moves. |
| **Credits & Escrow** | ✅ Complete | Credits purchased via Stripe; escrow on job creation; release on approval; refund on cancellation. Ledger idempotency. |
| **Messaging** | ✅ Complete | Job chat; unread count (safe fallback); file attachments. |
| **Payments** | ✅ Complete | Stripe Payment Intents; Connect for cleaner payouts; webhook idempotency; chargeback/refund processors. |
| **Photos** | ✅ Complete | Before/after uploads; retention policy (90 days); photo-cleanup worker. |
| **Tracking** | ✅ Complete | GPS check-in/check-out; on-time calculation; job reminders. |
| **Search & Matching** | ✅ Complete | Cleaner search; top-3 selection; boost multiplier; matching ranker. |
| **Pricing** | ✅ Complete | Dynamic pricing; holiday adjustments; pricing snapshot on job. |

### 1.2 Auth & Users

| Feature | Status | Description |
|---------|--------|-------------|
| **JWT Auth** | ✅ Complete | Login, register, refresh, logout. Canonical middleware (authCanonical). |
| **Roles** | ✅ Complete | client, cleaner, admin, super_admin. requireRole, requireAdmin, requireCleaner, requireClient. |
| **OAuth** | ✅ Complete | Google, Facebook via Passport. |
| **2FA** | ✅ Complete | TOTP via Speakeasy; twoFactorService. |
| **Password Reset** | ✅ Complete | Email-based reset; passwordResetService. |
| **Email Verification** | ✅ Complete | Verification flow; emailVerificationService. |
| **Session Management** | ✅ Complete | Session tracking; sessionManagementService. |

### 1.3 Admin Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Admin Dashboard** | ✅ Complete | Comprehensive admin router; KPIs, analytics. |
| **Client Management** | ✅ Complete | admin/clients; list, view, manage. |
| **Cleaner Management** | ✅ Complete | admin/cleaners; list, view, level tuning. |
| **Booking Management** | ✅ Complete | admin/bookings; list, view, actions. |
| **Finance** | ✅ Complete | admin/finance; payouts, refunds, ledger. |
| **Risk & Disputes** | ✅ Complete | admin/risk; risk flags, dispute queue (some routes may 404 in test). |
| **Analytics** | ✅ Complete | admin/analytics; dashboards, reports. |
| **Gamification Control** | ✅ Complete | admin/gamificationControl; config, budget, governor, badges, seasons. |
| **Settings & System** | ✅ Complete | admin/settings; admin/system; webhooks. |
| **Messages** | ✅ Complete | admin/messages; view/support messaging. |

### 1.4 User-Facing (Client & Cleaner)

| Feature | Status | Description |
|---------|--------|-------------|
| **Client Routes** | ✅ Complete | Profile, jobs, credits, payments, invoices, search. |
| **Cleaner Routes** | ✅ Complete | Profile, availability, jobs, earnings, onboarding. |
| **Cleaner Portal** | ✅ Complete | Invoices, payouts, team, calendar, goals. |
| **V2 Features** | ✅ Complete | Properties, teams, calendar, goals, backward-compatible. |
| **Premium/Subscriptions** | ✅ Complete | Subscription jobs; premiumService. |
| **Manager Dashboard** | ✅ Complete | Manager reports; managerDashboardService. |
| **Assignment** | ✅ Complete | Job assignment flow; top-3 offers. |
| **Cancellation** | ✅ Complete | Cancellation flow; refund logic. |
| **Reschedule** | ✅ Complete | Reschedule jobs. |
| **AI Assistant** | ✅ Complete | AI settings, scheduling, communication; cleaner-ai-settings, ai routes. |
| **Gamification** | ✅ Complete | Levels, badges, rewards, seasons, next-best-action, governor. |
| **Holidays** | ✅ Complete | Holiday data; pricing adjustments. |
| **User Data (GDPR)** | ✅ Complete | Export, delete, consent; gdprService, userData routes. |

### 1.5 Integrations

| Integration | Status | Description |
|-------------|--------|-------------|
| **Stripe** | ✅ Complete | Payments, Connect, webhooks, idempotency. |
| **n8n** | ✅ Complete | Event forwarding; HMAC verification; N8N_WEBHOOK_URL. |
| **SendGrid** | ✅ Complete | Email; 12+ templates; notificationService. |
| **Twilio** | ✅ Complete | SMS; notificationService. |
| **OneSignal** | ✅ Complete | Push notifications. |
| **Google Calendar** | ✅ Complete | Calendar sync; calendarService. |
| **Checkr** | ✅ Complete | Background checks; backgroundCheckService. |

### 1.6 Infrastructure & DevOps

| Component | Status | Description |
|-----------|--------|-------------|
| **Health Checks** | ✅ Complete | /health, /health/ready, /health/live. |
| **Status** | ✅ Complete | /status; operational metrics. |
| **Rate Limiting** | ✅ Complete | In-memory or Redis; per-endpoint. |
| **CORS** | ✅ Complete | Allowlist: app.puretask.com, admin.puretask.com, localhost. |
| **Security Headers** | ✅ Complete | Helmet, CSP, HSTS, etc. |
| **Request Tracing** | ✅ Complete | requestId, correlationId; AsyncLocalStorage. |
| **Slow Query Logging** | ✅ Complete | db/client logs when duration >= SLOW_QUERY_MS. |
| **Log Redaction** | ✅ Complete | PII redacted in logs. |
| **Sentry** | ✅ Complete | Init in instrument.ts; error handler; optional in prod. |
| **CI/CD** | ✅ Complete | GitHub Actions: lint, test, build, security-scan. |
| **Pre-commit** | ✅ Complete | Block .env; run lint. |

### 1.7 Workers (Cron Jobs)

| Worker | Schedule | Status | Description |
|--------|----------|--------|-------------|
| auto-cancel | */5 min | ✅ Active | Auto-cancel stale bookings. |
| retry-notifications | */10 min | ✅ Active | Retry failed email/SMS. |
| webhook-retry | */5 min | ✅ Active | Retry failed Stripe/n8n webhooks. |
| lock-recovery | */15 min | ✅ Active | Recover expired durable job locks. |
| auto-expire | hourly | ✅ Active | Auto-approve jobs stuck in awaiting_approval. |
| governor-metrics | hourly | ✅ Active | Compute marketplace metrics per region. |
| job-reminders | */30 min | ✅ Active | 24h and 2h reminders. |
| no-show-detection | */15 min | ✅ Active | Detect and warn about no-shows. |
| payout-retry | */30 min | Conditional | Retry failed Stripe payouts (PAYOUTS_ENABLED). |
| kpi-daily | 1 AM | ✅ Active | Daily KPI snapshot. |
| nightly-scores | 2 AM | ✅ Active | Client risk + cleaner reliability. |
| subscription-jobs | 2 AM | ✅ Active | Create subscription jobs. |
| reliability-recalc | 3 AM | ✅ Active | Recalculate cleaner reliability. |
| backup-daily | 3 AM | ✅ Active | Daily backup. |
| credit-economy | 4 AM | ✅ Active | Credit decay, tier lock. |
| weekly-summary | Mon 4 AM | ✅ Active | Weekly summary. |
| photo-cleanup | 5 AM | ✅ Active | Delete photos > 90 days. |
| payout-reconciliation | 6 AM | Conditional | Payout/earnings mismatch flags. |
| onboarding-reminders | */6 h | ✅ Active | Remind incomplete onboarding. |
| expire-boosts | midnight | ✅ Active | Expire boost rewards. |
| payout-weekly | Sun midnight | Conditional | Weekly payout processing. |

**Recently activated:** cleaning-scores (was in scheduler but not scheduled; now daily 3 AM), goal-checker (V2 cleaner goals; daily 2 AM). Disabled/ and _deprecated/ contain old copies.

### 1.8 Database & Migrations

| Item | Status | Description |
|------|--------|-------------|
| **Schema** | ✅ Complete | Consolidated schema; 85+ migrations. |
| **Indexes** | ✅ Complete | Jobs, messages, webhooks, durable_jobs, etc. |
| **Idempotency** | ✅ Complete | webhook_events, credit_ledger constraints. |
| **Durable Jobs** | ✅ Complete | durable_jobs table; FOR UPDATE SKIP LOCKED. |
| **Schema Verify** | ✅ Complete | db:verify:production script. |
| **Backup/Restore** | ✅ Documented | BACKUP_RESTORE.md; Neon PITR. |

### 1.9 Documentation

| Doc | Status | Description |
|-----|--------|-------------|
| SETUP.md | ✅ | Local setup, env, test commands. |
| ARCHITECTURE.md | ✅ | Stack, layering, flows, gamification. |
| RUNBOOK.md | ✅ | Deploy, rollback, incident, worker schedule. |
| DEPLOYMENT.md | ✅ | Railway, branch protection, Stripe webhook, workers. |
| ROUTE_PROTECTION_TABLE.md | ✅ | All routes and auth. |
| ENV_VARS_CHECKLIST.md | ✅ | Required and optional vars. |
| CONTRIBUTING.md | ✅ | How to add route, service, worker. |
| PRODUCTION_100_PERCENT_CHECKLIST.md | ✅ | Full checklist with status. |
| PROJECT_AUDIT_QUESTIONS_ANSWERS.md | ✅ | 14 question groups answered. |
| Legal drafts | ✅ | TOS_CONSOLIDATED, CLEANER_AGREEMENT, PRIVACY_POLICY (drafts). |

---

## PART 2: WHAT WE STILL NEED TO DO

### 2.1 High Priority

| Item | Area | Status |
|------|------|--------|
| Fix failing integration tests | Testing | ✅ credit_ledger schema fixed (delta_credits). Other suites: timeouts, 404 risk routes, matching. |
| Fix schema for tests | Database | ✅ credit_ledger migrated to delta_credits in credits.test, disputeFlow, admin/clients, kpiService, gdprService. |
| Verify Stripe webhook URL | Stripe | Checklist in DEPLOYMENT.md. Manual verification. |
| Set SENTRY_DSN in prod | Monitoring | Checklist in DEPLOYMENT.md. Manual verification. |
| Branch protection | CI | Checklist in DEPLOYMENT.md. Manual verification. |

### 2.2 Medium Priority

| Item | Area | Status |
|------|------|--------|
| Register all QUEUE_NAMES | Workers | ✅ HANDLED_QUEUE_NAMES; only active queues processed. Reserved queues documented in queue.ts. |
| Ownership audit | Security | Documented in ROUTE_PROTECTION_TABLE (ownership pattern). Key services enforce; full audit pending. |
| Cursor pagination | API | Pattern documented in CONTRIBUTING. Candidates: /jobs, /admin/clients, /admin/cleaners, /admin/bookings. |
| Zod everywhere | API | validateBody added to job creation; many routes already use Zod. Continue rollout per CONTRIBUTING. |
| Legal review | Legal | Pending. Send TOS, Privacy, Cleaner Agreement to counsel. |
| Cost map | Cost | ✅ COST_MAP.md created (Stripe, SendGrid, Twilio, etc.). |

### 2.3 Lower Priority

| Item | Area | Description |
|------|------|-------------|
| Admin RBAC | Admin | support_agent, support_lead, ops_finance roles. |
| Ops dashboard | Admin | Disputes, webhooks, risk in one view. |
| DTOs for all endpoints | API | Formal request/response types. |
| Load test | Testing | k6 on critical paths. |
| E2E tests | Testing | Login, booking, payment against staging. |

---

## PART 3: DETAILED DESCRIPTIONS

### 3.1 Route Modules (45+)

| Router | Mount | Purpose |
|--------|-------|---------|
| health | /health | Health, ready, live checks. |
| status | /status | Operational metrics. |
| auth | /auth | Login, register, logout, refresh. |
| authEnhanced | /auth | OAuth, 2FA, password reset. |
| jobs | /jobs | CRUD jobs; create, list, get, patch, complete, cancel. |
| assignment | /assignment | Job assignment, offers. |
| admin | /admin | Full admin; sub-routers: analytics, bookings, cleaners, clients, finance, gamificationControl, jobs, messages, risk, settings, system, webhooks. |
| stripe | /stripe | Payment intents, Connect, webhook. |
| credits | /credits | Purchase, balance, history. |
| messages | /messages | Job chat. |
| analytics | /analytics | Admin analytics. |
| search | /search | Cleaner search. |
| cleaner | /cleaner | Profile, availability, jobs, earnings. |
| cleanerOnboarding | /cleaner/onboarding | Onboarding, ID verification. |
| cleanerPortal | /cleaner/portal | Invoices, payouts, team. |
| gamification | /gamification | Levels, rewards, badges. |
| manager | /manager | Manager dashboard. |
| v2 | /v2 | Properties, teams, calendar, goals. |
| premium | /premium | Subscriptions. |
| ai | /ai | AI scheduling, communication. |
| userData | /user | GDPR export, delete, consent. |
| ... | ... | Plus: tracking, alerts, pricing, holidays, cancellation, reschedule, etc. |

### 3.2 Services (95+)

**Core:** jobsService, creditsService, payoutsService, paymentService, authService, availabilityService, pricingService.

**Notifications:** notificationService, eventBasedNotificationService, SendGrid/Twilio/OneSignal providers.

**AI:** aiService, aiCommunication, aiScheduling.

**Admin:** adminService, adminRepairService, adminAuditService, adminConfigService.

**Gamification:** cleanerLevelService, gamificationRewardService, badgeService, seasonService.

### 3.3 Test Suites

| Suite | Status | Notes |
|-------|--------|-------|
| stateMachine | ✅ 65 pass | Job transitions. |
| errorFormat (contract) | ✅ 3 pass | Error shape, no stack. |
| protected-route-auth | ✅ 6 pass | 401/403/200. |
| v4Features | ⚠️ 5 fail | Analytics, risk 404, boost. |
| v1CoreFeatures | ⚠️ 4 fail | Matching, tier payout. |
| v2Features | ⚠️ 4 fail | reliability 500; worker imports. |
| jobLifecycle | ⚠️ 9 fail | Create 400, accept 403. |
| credits | ⚠️ Schema fixed | Tests need DB; delta_credits migration complete. |

---

### 3.4 Next steps (lower priority)

| Item | Guidance |
|------|----------|
| **Admin RBAC** | Add `support_agent`, `support_lead`, `ops_finance` roles; gate routes by role in `requireAdmin` or new middleware. |
| **Ops dashboard** | Single admin view: disputes queue, webhook status, risk flags. Could be frontend-only aggregating existing endpoints. |
| **DTOs** | Formal Zod schemas for request/response; use `validateBody`/`validateQuery` consistently. See `src/lib/validation.ts`. |

---

**See also:** [PRODUCTION_100_PERCENT_CHECKLIST.md](./PRODUCTION_100_PERCENT_CHECKLIST.md), [PROJECT_AUDIT_QUESTIONS_ANSWERS.md](./PROJECT_AUDIT_QUESTIONS_ANSWERS.md).
