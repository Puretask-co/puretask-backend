# Comprehensive Gap Analysis & Production Readiness Checklist

**Date:** 2026-01-28  
**Reanalysis:** 2026-01-31  
**Purpose:** Identify missing features, incomplete implementations, best practice gaps, and production readiness concerns

---

## 📖 How to Read This Document

**What is a "gap"?**  
A gap is something that is missing, incomplete, or not yet done for production readiness—for example: no migration runner, failing tests, or no runbooks. This document lists gaps by area (Error Handling, Monitoring, API Docs, etc.) and marks what is done vs what is still needed.

**What do the symbols mean?**
- **✅** Done — Implemented or documented and in use.
- **⚠️** Needs attention — Partially done or needs follow-up.
- **❌** Missing — Not yet implemented.
- **🔧** Question to ask — Something you should decide or clarify with the team.

**What do CRITICAL, IMPORTANT, and NICE-TO-HAVE mean?**
- **🔴 CRITICAL** — Must be in place before production; without it you risk data loss, outages, or security issues.
- **🟡 IMPORTANT** — Should be done soon; improves reliability, debuggability, or compliance.
- **🟢 NICE-TO-HAVE** — Improves quality of life or future scaling; not blocking launch.

**How to use this doc:**  
Use the **Reanalysis Summary** table for a quick "done vs still needed" view. Use the **CRITICAL** and **IMPORTANT** sections to plan work. Use the **Production Readiness Checklist** at the end to tick off items before go-live.

**Where to find things in the codebase:**  
- Error handling: `src/lib/` (e.g. `circuitBreaker.ts`, `retry.ts`), route handlers using `asyncHandler` and `sendError`.  
- Monitoring: `src/instrument.ts` (Sentry), `src/lib/metrics.ts`, `src/index.ts` (health/ready).  
- API docs: `@swagger` blocks in `src/routes/*.ts`, Swagger UI served at `/api-docs`.  
- Migrations: `DB/migrations/*.sql`, `scripts/migrate-runner.js`.  
- Runbooks: `docs/runbooks/`.  
- Tests: `src/tests/`, Jest config in `package.json` / `jest.config.js`.

**In plain English:** This doc is a big checklist of "what we need before we go live." It lists everything by area (errors, monitoring, API docs, database, security, tests, CI/CD, etc.) and marks each item as done ✅ or still needed. Use the summary table at the top to see "what's left" at a glance, then use the detailed sections to plan work. A "gap" = something missing or not yet done for production.

---

## New here? Key terms (plain English)

**What it is:** A glossary of backend/DevOps terms used in this doc.  
**What it does:** Lets new readers understand Production, Sentry, Migration, CI/CD, etc.  
**How we use it:** Refer to this table when you see an unfamiliar term below.

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## 📌 Reanalysis Summary (2026-01-31)

*This table shows, for each area, what we have already completed and what is still left to do. It is the main "status at a glance" for production readiness.*

**What we completed vs what we still need:**

| Area | Completed | Still needed |
|------|-----------|--------------|
| **1. Error Handling & Recovery** | Standardized errors (AppError), asyncHandler, circuit breakers (Stripe/SendGrid/Twilio/N8N), retry with backoff, dead-letter handling in queue | Error alerting (PagerDuty/Opsgenie), optional DLQ dashboard |
| **2. Monitoring & Observability** | Sentry (error tracking), metrics (API/jobs/payments/payouts), UptimeRobot setup doc, health/ready endpoints | Distributed tracing, Grafana dashboard (optional), log aggregation (optional) |
| **3. API Documentation** | OpenAPI/Swagger spec, Swagger UI at `/api-docs`, @swagger on routes, exact endpoint list doc | Postman collection export, SDK generation (nice-to-have) |
| **4. Database Management** | Migrations exist, backup docs (Neon), backup:verify script, recovery runbook | **Migration runner** (node-pg-migrate or Knex) — still manual run |
| **5. Security Hardening** | Security audit done, Helmet + CSP/HSTS, no hardcoded secrets, npm audit 0 vulns, incident response doc | Penetration testing (external), API key rotation schedule |
| **6. Testing** | CI runs tests, unit/integration/smoke exist | Fix remaining failing tests, E2E for critical flows, load testing (k6) |
| **7. CI/CD** | GitHub Actions (lint, typecheck, test, build, security-scan) | Staging deploy automation, blue-green/canary, migration in CI |
| **8. Performance** | Performance testing doc, metrics recorded | Load test runs, caching strategy doc, CDN if needed |
| **9. Data Integrity & GDPR** | GDPR routes: export, delete, consent; DATABASE_RECOVERY runbook | Audit logging for all sensitive ops, data retention policy doc |
| **10. Documentation** | CONTRIBUTING, docs reorganized, ARCHITECTURE, API docs, exact endpoints, n8n router | Runbooks for common ops (e.g. “restore from backup”), ADRs, API changelog |

**Quick verdict:** Most **critical** and **important** gaps are addressed. Remaining: **migration runner**, **fix failing tests**, **runbooks**, optional hardening (alerting, tracing, pen test).

**Detailed explanation of each area in the table:**

| Area | What it covers | What "Completed" means | What "Still needed" means |
|------|----------------|------------------------|---------------------------|
| **1. Error Handling & Recovery** | How the app behaves when something fails (external APIs, DB, jobs). | You have a single error format (AppError), retries with backoff for Stripe/SendGrid/Twilio/N8N, circuit breakers so one failure does not cascade, and a queue that marks failed jobs as dead-letter. | You still need a way to be notified when errors spike (e.g. PagerDuty or Opsgenie); an optional dashboard to view dead-letter jobs is nice. |
| **2. Monitoring & Observability** | Knowing when the app is down, slow, or throwing errors, and being able to debug production. | Sentry captures errors and stack traces; metrics are recorded for API, jobs, payments, payouts; UptimeRobot is documented for uptime checks; health/ready endpoints exist. | Optional: distributed tracing (e.g. OpenTelemetry), a Grafana/Datadog dashboard, log aggregation; you still need to configure alerting (e.g. Sentry → Slack) so someone is notified. |
| **3. API Documentation** | A clear, machine-readable description of all endpoints so frontend and partners can integrate. | OpenAPI spec is generated from routes; Swagger UI is at `/api-docs`; versioning and request/response examples are in place. | You can export a Postman collection from OpenAPI; SDK generation (e.g. TypeScript client) is optional. |
| **4. Database Management** | Safe schema changes (migrations), backups, and recovery. | SQL migrations exist in `DB/migrations/`; Neon handles backups; backup:verify script and recovery runbook exist. | A migration runner (e.g. `npm run migrate:up`) that records which migrations ran is still needed so you do not run the same SQL twice; optional: pool monitoring, slow-query logging. |
| **5. Security Hardening** | Headers, secrets, injection prevention, and a plan for incidents. | Security audit is done; Helmet/CSP/HSTS are set; parameterized queries and sanitization are in place; npm audit shows 0 vulns; incident response doc exists. | Optional: penetration test by an external firm; a written schedule for rotating API keys (e.g. every 90 days). |
| **6. Testing** | Automated tests that run in CI and catch regressions. | CI runs tests on push/PR; unit, integration, and smoke tests exist. | Some tests still fail; fixing them and adding E2E for critical flows and load tests (k6) are the remaining work. |
| **7. CI/CD** | Automated lint, test, build, and optional deploy. | GitHub Actions run lint, typecheck, test, build, and security scan. | Staging deploy on push, blue-green/canary, and running migrations in CI are still to add. |
| **8. Performance** | How the app behaves under load and how to scale. | A performance-testing doc exists; metrics are recorded in code. | Running load tests (e.g. k6) and recording a baseline; optional: caching strategy doc, CDN. |
| **9. Data Integrity & GDPR** | User data export/deletion, consent, and retention. | GDPR routes for export, delete, and consent exist; DATABASE_RECOVERY runbook exists. | Audit logging for sensitive actions (e.g. delete user, payout) and a written data retention policy are still to add. |
| **10. Documentation** | Runbooks, onboarding, and discoverability of docs. | CONTRIBUTING, ARCHITECTURE, API docs, exact endpoints, and n8n router doc exist; docs are reorganized. | Runbooks for restore, incident, and rollback are added; optional: ADRs, API changelog. |

**Deeper explanation by area:**

- **1. Error Handling & Recovery** — When Stripe or SendGrid is slow or down, the app retries with increasing delays (exponential backoff) and, after too many failures, opens a "circuit" so it stops hammering the service. Failed queue jobs are marked as dead-letter so you can inspect or retry them. What’s left is **alerting**: a way to be paged or notified when error rate or dead-letter count spikes (e.g. Sentry alerts → Slack, or PagerDuty/Opsgenie).
- **2. Monitoring & Observability** — Sentry gives you stack traces and context for every error; metrics (in code) record HTTP requests, job runs, payments, and payouts; UptimeRobot (or similar) can ping `/health` and alert when the app is unreachable. **Alerting** still needs to be configured (e.g. Sentry “when event count &gt; X” → Slack) so someone is notified. Distributed tracing and a Grafana dashboard are optional for a single-service app.
- **3. API Documentation** — The OpenAPI spec is built from `@swagger` comments on routes and is served at `/api-docs/json`; Swagger UI at `/api-docs` lets you try endpoints. Frontend and partners can integrate from this. Postman: import from that URL or use `npm run docs:postman`. SDK generation (e.g. OpenAPI Generator) is optional.
- **4. Database Management** — Migrations live in `DB/migrations/`; Neon provides automated backups and the backup:verify script checks they’re usable. The **migration runner** (`scripts/migrate-runner.js`, `npm run migrate:up`) records which migrations have been applied in `schema_migrations` so you never run the same SQL twice; use it on dev/staging/prod when rolling out schema changes.
- **5. Security Hardening** — Helmet and CSP/HSTS are configured; queries are parameterized; sanitization and security audit docs exist; npm audit is clean; incident response is documented. Optional: external penetration test and a written API key rotation schedule (e.g. every 90 days).
- **6. Testing** — CI runs the full test suite on push/PR. Some tests still fail (env, mocks, or assertions); fixing them brings CI to green. E2E tests for critical flows (e.g. login → create job → pay) and load tests (k6) are the next step.
- **7. CI/CD** — Lint, typecheck, test, and build run in GitHub Actions. Deploy is still manual (e.g. Railway). Remaining: staging environment that deploys on push, and running migrations as part of deploy or a CI job.
- **8. Performance** — PERFORMANCE_TESTING.md describes how to run k6 and what to measure. You still need to run load tests once, record a baseline (p95, RPS, error rate), and optionally add a k6 job in CI.
- **9. Data Integrity & GDPR** — Routes for data export, account deletion, and consent exist; the recovery runbook covers DB restore. Remaining: audit logging for sensitive operations (who did what when) and a written data retention policy (how long you keep logs/backups/PII).
- **10. Documentation** — Docs are indexed in DOCUMENTATION_INDEX; runbooks for restore, incident, and rollback are in `docs/runbooks/`. Optional: ADRs (why Neon, why Sentry, etc.) and an API changelog for version/breaking changes.

---

## 🎯 Executive Summary

**What it is:** A one-paragraph view of where the project stands (strong, needs work, missing).  
**What it does:** Lets stakeholders or the team quickly understand production readiness.  
**How we use it:** Use to explain the state of the project or to decide where to focus next.

*The executive summary gives a one-paragraph view of where the project stands: what is strong, what needs work, and what is missing. Use it to explain the state of the project to stakeholders or to decide where to focus next.*

Your codebase is **feature-rich** but has several **critical gaps** for production readiness. This document identifies:
- ✅ What's working well
- ⚠️ What needs attention
- ❌ What's missing
- 🔧 What you should be asking about

---

## 📊 Current State Assessment

*This section describes what is already in good shape (strengths) and what still needs attention. Strengths are things you can rely on; "areas needing attention" are either done but could be improved or still partially missing.*

### ✅ Strengths

*These are aspects of the project that are already solid—for example, feature set, test coverage, architecture, security basics, documentation, and database design. For each strength we explain what it means, where it lives in the codebase, and how you can verify it.*

1. **Comprehensive Feature Set**: V1-V4 features implemented  
   *What it means:* The app already covers core flows (auth, jobs, payments, payouts, notifications, admin, cleaner/client portals). You are not missing major product areas; remaining work is mostly hardening and operations.  
   *Where it lives:* Routes in `src/routes/` (auth, jobs, payments, credits, events, stripe, admin, cleaner, client, tracking, etc.); services in `src/services/`; workers in `src/workers/`.  
   *How to verify:* Run the app, hit `/api-docs` to see all endpoints; check that login, job creation, payment, and payout flows work end-to-end.

2. **Good Test Coverage**: ~104 tests, 86% pass rate  
   *What it means:* There are unit, integration, and smoke tests that run in CI. The pass rate is high enough to catch many regressions; fixing the remaining failing tests will bring you to 100% and full confidence.  
   *Where it lives:* `src/tests/` (unit, integration, smoke); Jest config in `package.json`; CI in `.github/workflows/test.yml`.  
   *How to verify:* Run `npm test`; check CI on a push or PR. When all tests pass, you have full regression coverage for what’s tested.

3. **Solid Architecture**: Well-organized services, workers, routes  
   *What it means:* Code is split into routes (HTTP), services (business logic), workers (background jobs), and lib (shared utilities). This makes it easier to change one part without breaking others and to onboard new developers.  
   *Where it lives:* `src/routes/` (HTTP layer), `src/services/` (business logic), `src/workers/` (jobs), `src/lib/` (shared code), `src/middleware/` (auth, validation).  
   *How to verify:* Read `docs/active/02-MEDIUM/ARCHITECTURE.md`; trace a request (e.g. create job) from route → service → DB to see the flow.

4. **Security Basics**: Rate limiting, JWT auth, input validation  
   *What it means:* Auth is JWT-based; rate limiting and input validation reduce abuse and injection. Security headers (Helmet, CSP, HSTS) and parameterized queries are in place, so core security is covered.  
   *Where it lives:* `src/middleware/jwtAuth.ts`, `src/middleware/authCanonical.ts`; rate limiting and Helmet in `src/index.ts`; validation/sanitization in middleware and routes; queries use `$1`, `$2` (parameterized).  
   *How to verify:* Call an authenticated endpoint without a token (expect 401); call with invalid body (expect 400); run `npm audit` (expect 0 vulns).

5. **Documentation**: Extensive specs and docs  
   *What it means:* There are specs for admin, infra, job, UI; deployment and testing docs; and an organized active-docs set (DOCUMENTATION_INDEX). You can find most answers in the repo.  
   *Where it lives:* `docs/active/` (index in DOCUMENTATION_INDEX.md); API docs at `/api-docs`; CONTRIBUTING, ARCHITECTURE, runbooks in `docs/runbooks/`.  
   *How to verify:* Open `docs/active/DOCUMENTATION_INDEX.md` and follow links; open `/api-docs` in the browser when the app is running.

6. **Database Schema**: Well-designed with migrations  
   *What it means:* Tables and relationships are clear; migrations exist in `DB/migrations/`. The migration runner (`scripts/migrate-runner.js`) applies them in order and records what ran so you do not double-apply.  
   *Where it lives:* `DB/migrations/*.sql`, `DB/migrations/hardening/*.sql`; `scripts/migrate-runner.js`; `schema_migrations` table in the DB.  
   *How to verify:* Run `npm run migrate:status` (lists applied vs pending); run `npm run migrate:up` on a dev DB and confirm only new migrations run.

### ⚠️ Areas Needing Attention (as of reanalysis 2026-01-31)

*Each line below is one area. The ✅ means the main part is done; the text after describes what is optional or still needed. We also explain what “attention” means in practice and how to close the gap.*

1. **Production Monitoring**: ✅ Sentry + metrics + UptimeRobot doc — alerting (PagerDuty/Opsgenie) optional  
   *Current state:* Sentry captures errors; metrics are recorded for API, jobs, payments, payouts; UptimeRobot setup is documented in MONITORING_SETUP.md.  
   *What “attention” means:* Configure alerting so someone is notified when errors spike or the app goes down—e.g. in Sentry create an alert rule (“event count &gt; 50 in 1 hour”) and add a Slack webhook or PagerDuty; in UptimeRobot add alert contacts and attach them to your monitors.  
   *How to close the gap:* Follow the “Error alerting” section in MONITORING_SETUP.md and the “Turn on error alerting” steps in REMAINING_ISSUES_STEPS.md.

2. **Error Handling**: ✅ Standardized (AppError), circuit breakers, retry — alerting optional  
   *Current state:* Errors use a consistent format (AppError, sendError); external calls (Stripe, SendGrid, Twilio, N8N) use circuit breakers and retry with backoff; the queue has dead-letter handling.  
   *What “attention” means:* Optional: an alerting system (e.g. Sentry → PagerDuty) so you are paged when failure rate or dead-letter count exceeds a threshold.  
   *How to close the gap:* Same as monitoring alerting above; optionally add a dashboard or scheduled job to surface dead-letter jobs (see `getDeadLetterJobs` in the queue).

3. **API Documentation**: ✅ OpenAPI/Swagger at `/api-docs` — Postman/SDK optional  
   *Current state:* The API is documented in OpenAPI form and exposed via Swagger UI at `/api-docs`; request/response examples are in `@swagger` on routes.  
   *What “attention” means:* Optional: export a Postman collection (e.g. from `/api-docs/json` or `npm run docs:postman`) for manual testing; optionally generate SDKs (e.g. TypeScript client) from the spec.  
   *How to close the gap:* Import the OpenAPI URL into Postman; for SDKs use OpenAPI Generator or similar and document in CONTRIBUTING.

4. **Deployment Automation**: Manual deploy; CI runs lint/test/build — staging + migration runner still needed  
   *Current state:* CI runs lint, typecheck, test, and build on push/PR. Deploy is still manual (e.g. Railway). The migration runner exists (`npm run migrate:up`).  
   *What “attention” means:* (1) Run migrations as part of deploy or a CI step (e.g. against staging DB). (2) Optional: a staging environment that auto-deploys on push to a branch.  
   *How to close the gap:* Document “run migrations” in your deploy runbook; add a CI job or deploy script that runs `npm run migrate:up` against staging (see CI_CD_SETUP.md). Optionally connect a staging branch to Railway.

5. **Data Backup/Recovery**: ✅ Neon backups + backup:verify script + recovery runbook  
   *Current state:* Neon provides automated backups; `npm run backup:verify` checks backup usability; BACKUP_RESTORE_PROCEDURE and DATABASE_RECOVERY describe restore; docs/runbooks/restore-from-backup.md gives step-by-step.  
   *What “attention” means:* Periodically test restore (e.g. restore to a Neon branch and smoke-test) so the procedure is validated.  
   *How to close the gap:* Schedule a quarterly restore drill; document the result and any updates to the runbook.

6. **Performance Testing**: Doc exists (PERFORMANCE_TESTING.md); load test runs still to do  
   *Current state:* PERFORMANCE_TESTING.md describes how to run k6 and what to measure (p95, RPS, error rate).  
   *What “attention” means:* Run load tests at least once (e.g. against staging), record a baseline, and optionally add a k6 job in CI that fails if error rate or latency exceeds a threshold.  
   *How to close the gap:* Install k6, run the scenario from the doc, save results to a file or doc; optionally add `npm run test:load` and a CI step (see REMAINING_ISSUES_STEPS.md).

---

## 🔴 CRITICAL GAPS (Must Fix Before Production)

**What it is:** Gaps that must be fixed before production (error handling, monitoring, API docs, DB, security).  
**What it does:** Lists current state, missing items (with checkboxes), and questions to ask for each area.  
**How we use it:** Work through each subsection; tick items when done; use ADDRESS_REMAINING_GAPS for steps.

*Critical gaps are items that should be fixed before going to production. Each subsection describes the current state, what is missing (with checkboxes), and questions to ask. Items marked [x] are done; items marked [ ] are still to do.*

### 1. **Error Handling & Recovery**

*Error handling and recovery means: how the app responds when something fails (e.g. Stripe down, DB timeout), whether errors are reported in a consistent format, and whether external calls use retries and circuit breakers so one failure does not cascade.*

**Current State:**
- Some routes use `asyncHandler`, others use try-catch
- Inconsistent error response formats
- No centralized error recovery mechanism
- Missing error boundaries for critical operations

**What's Missing:**
- [x] Standardized error response format across all endpoints (AppError, sendError)
- [x] Error recovery/retry logic for external services (Stripe, SendGrid, Twilio) — retryWithBackoff
- [x] Circuit breakers for external API calls — circuitBreaker.ts (Stripe, SendGrid, Twilio, N8N)
- [x] Dead letter handling for failed jobs — queue.ts (dead_letter_reason, dead_letter_at, getDeadLetterJobs)
- [ ] Error alerting system (PagerDuty, Opsgenie, etc.)

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **Standardized error format** — Every endpoint returns errors in the same shape (e.g. `{ error: { code, message } }`) so the frontend and clients can handle them consistently. *Why it matters:* One place to parse errors and show user-friendly messages. *Where:* `AppError` / `sendError` in route handlers; global error handler in `src/index.ts`. *Verify:* Call an endpoint that returns 4xx/5xx and check the response body shape.
- **Retry with backoff** — When Stripe, SendGrid, or Twilio fails temporarily, the app retries with increasing delays instead of failing immediately. *Why it matters:* Transient network or rate-limit issues often resolve on retry. *Where:* `src/lib/retry.ts`; used in Stripe wrapper, SendGrid, Twilio, N8N. *Verify:* Temporarily break the external service and see retries in logs; or read the retry logic in code.
- **Circuit breakers** — After too many failures to an external service, the app stops calling it for a short period so one outage does not cascade; it then tries again (half-open) and resumes if the service is back. *Why it matters:* Prevents hammering a down service and keeps the app responsive. *Where:* `src/lib/circuitBreaker.ts`; wrapped around Stripe, SendGrid, Twilio, N8N. *Verify:* Simulate repeated failures and confirm the circuit opens (no further calls for a period).
- **Dead letter handling** — Jobs that fail after max retries are marked as dead-letter so you can inspect and retry or discard them; the queue exposes `dead_letter_reason` and `getDeadLetterJobs`. *Why it matters:* Failed jobs don’t block the queue; you can fix data or code and retry. *Where:* `src/lib/queue.ts` (or job queue implementation); columns `dead_letter_reason`, `dead_letter_at`. *Verify:* Force a job to fail repeatedly and confirm it appears in dead-letter list.
- **Error alerting** — A system (e.g. PagerDuty or Opsgenie, or Sentry → Slack) that notifies someone when error rate or downtime exceeds a threshold so you can respond quickly. *Why it matters:* Without alerting, you may not notice outages until users complain. *Where:* Configure in Sentry (Alerts → webhook) and UptimeRobot (Alert Contacts). *Verify:* Trigger a test error or pause the app and confirm an alert is received.

**Questions to Ask (and why we ask them):**
- "What happens when Stripe API is down during payment processing?" — *Ensures you’ve thought through retry, circuit breaker, and user-facing message (e.g. “payment delayed, try again”).*
- "How do we handle partial failures in multi-step operations?" — *Ensures you use transactions or compensating actions so you don’t leave data half-updated.*
- "What's our rollback strategy for failed database transactions?" — *Ensures you use DB transactions and, for migrations, have a documented rollback or fix-forward plan.*

---

### 2. **Monitoring & Observability**

*Monitoring and observability means: knowing when the app is down or slow, seeing errors and metrics in one place, and being able to debug production issues. It includes error tracking (e.g. Sentry), uptime checks (e.g. UptimeRobot), and optional dashboards or log aggregation.*

**Current State:**
- Basic logging with `logger.ts`
- No APM (Application Performance Monitoring)
- No distributed tracing
- No real-time alerting
- No metrics dashboard

**What's Missing:**
- [x] APM / error tracking (Sentry — configured, init once, Express error handler)
- [ ] Distributed tracing (OpenTelemetry, Jaeger)
- [ ] Real-time metrics dashboard (Grafana, Datadog) — optional; metrics recorded in code
- [ ] Alerting system (PagerDuty, Opsgenie)
- [ ] Log aggregation (Datadog Logs, ELK Stack)
- [x] Uptime monitoring (UptimeRobot — doc in MONITORING_SETUP.md)
- [x] Error tracking (Sentry)

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **Sentry (APM / error tracking)** — Captures unhandled errors and stack traces, and can show performance spans. You have it configured with init-once and Express error handler. *Why it matters:* You see every error with context (user, request, stack) so you can fix bugs quickly. *Where:* `src/instrument.ts` (init), `src/index.ts` (setupExpressErrorHandler). *Verify:* Trigger an error in the app and confirm it appears in Sentry.
- **Distributed tracing** — Lets you follow a single request across services (e.g. API → DB → Stripe) so you can see where latency or errors occur; optional for a single-service app. *Why it matters:* In multi-service setups, tracing pinpoints which service is slow. *Where:* Not implemented; would use OpenTelemetry or Jaeger. *Verify:* N/A until implemented.
- **Metrics dashboard** — A UI (e.g. Grafana) to graph latency, error rate, throughput; optional because metrics are already recorded in code and can be exported later. *Why it matters:* Helps spot trends and regressions over time. *Where:* Metrics recorded in `src/lib/metrics.ts` and `src/index.ts`; no dashboard yet. *Verify:* Add a dashboard that consumes your metrics (e.g. Prometheus + Grafana) when you need it.
- **Alerting** — A way to be notified (e.g. PagerDuty, Opsgenie, or Sentry → Slack) when errors spike or the app goes down so someone can respond. *Why it matters:* Without alerting, outages can go unnoticed. *Where:* Configure in Sentry (Alerts) and UptimeRobot (Alert Contacts). *Verify:* Trigger a test error or downtime and confirm notification.
- **Log aggregation** — Central storage and search for logs (e.g. Datadog, ELK); optional if you rely on host logs or Sentry. *Why it matters:* Easier to search and correlate logs across instances. *Where:* Not implemented; would integrate with Datadog/ELK/CloudWatch. *Verify:* N/A until implemented.
- **UptimeRobot** — External checks that hit your health endpoint and alert when the app is unreachable; setup is documented in MONITORING_SETUP. *Why it matters:* Detects outages even when your host is down (external vantage point). *Where:* MONITORING_SETUP.md. *Verify:* Add a monitor in UptimeRobot pointing at `/health`; pause the app and confirm alert.
- **Error tracking (Sentry)** — Same as APM above; listed separately to match the original checklist.

**Questions to Ask (and why we ask them):**
- "How do we know if the system is slow before users complain?" — *Drives setting latency thresholds and alerting (e.g. p95 &gt; 500ms) or a dashboard.*
- "What metrics should we track for business health?" — *Drives recording and alerting on business KPIs (e.g. payment success rate, job completion rate).*
- "How do we debug production issues quickly?" — *Drives having Sentry, logs, and runbooks so on-call can triage and fix.*

---

### 3. **API Documentation**

*API documentation means: a clear, up-to-date description of all endpoints, request/response shapes, and how to authenticate. OpenAPI/Swagger provides a machine-readable spec and an interactive UI so frontend and partners can integrate without guessing.*

**Current State:**
- No OpenAPI/Swagger specification
- API endpoints documented in markdown only
- No interactive API explorer
- No versioning strategy documented

**What's Missing:**
- [x] OpenAPI 3.0 specification (swagger-jsdoc from routes, `/api-docs/json`)
- [x] Swagger UI for interactive API exploration (`/api-docs`)
- [x] API versioning (v2 routes exist; strategy documented)
- [x] Request/response examples (in @swagger on routes)
- [ ] SDK generation (TypeScript, Python, etc.) — nice-to-have
- [ ] Postman collection (can export from OpenAPI)

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **OpenAPI spec** — A machine-readable description of all endpoints, parameters, and response shapes; generated from `@swagger` comments on routes and available at `/api-docs/json`. *Why it matters:* Frontend and tools can generate clients and validate requests. *Where:* Built by swagger-jsdoc from route files; served at `/api-docs/json`. *Verify:* Open the URL in a browser or curl; confirm all routes and schemas are present.
- **Swagger UI** — A web UI at `/api-docs` where you can try endpoints and see request/response schemas. *Why it matters:* Developers can explore and test the API without writing code. *Where:* Served by the same app at `/api-docs`. *Verify:* Open `/api-docs` in a browser and execute a few requests.
- **API versioning** — v2 routes exist and the strategy (e.g. when to use v1 vs v2) is documented so you can evolve the API without breaking clients. *Why it matters:* Lets you add breaking changes under a new version while keeping old clients working. *Where:* v2 route prefixes and docs (e.g. API_SPEC_COMPARISON, ARCHITECTURE). *Verify:* Call both v1 and v2 variants of an endpoint and confirm behavior.
- **Request/response examples** — Each route’s `@swagger` block includes example bodies and responses so frontend and partners know what to send and expect. *Why it matters:* Reduces integration errors and support questions. *Where:* Inside `@swagger` in `src/routes/*.ts`. *Verify:* Check Swagger UI for example request/response on key endpoints.
- **SDK generation** — Tools can generate client libraries (e.g. TypeScript) from the OpenAPI spec; nice-to-have for frontend or external integrators. *Why it matters:* Type-safe, auto-generated clients reduce bugs. *Where:* Not done; would use OpenAPI Generator or similar. *Verify:* Generate a client and use it in a small script or frontend.
- **Postman collection** — A file you can import into Postman to call the API; you can export it from OpenAPI or use `npm run docs:postman`. *Why it matters:* Easy manual testing and sharing with QA or partners. *Where:* `npm run docs:postman` generates `postman/PureTask-API.postman_collection.json`; or import from `/api-docs/json`. *Verify:* Import into Postman and run a few requests.

**Questions to Ask (and why we ask them):**
- "How do frontend developers know what endpoints exist?" — *Confirms they use `/api-docs` and OpenAPI spec; drives keeping docs up to date.*
- "How do we ensure API contracts don't break?" — *Drives testing (e.g. contract tests or E2E) and versioning strategy.*
- "How do we document API changes?" — *Drives having an API changelog or release notes when you change request/response shapes.*

---

### 4. **Database Management**

*Database management means: how you change the schema safely (migrations), how you back up and restore data, and how you verify that the database is healthy. A migration runner runs pending migrations in order and records what has been applied so you do not run the same migration twice.*

**Current State:**
- Migrations exist but no migration runner
- No database backup automation
- No connection pooling monitoring
- No query performance monitoring

**What's Missing:**
- [ ] **Migration runner** (node-pg-migrate or Knex) — still run SQL manually
- [x] Automated database backups (Neon) + verification script (`npm run backup:verify`)
- [ ] Database connection pool monitoring
- [ ] Slow query logging and analysis
- [ ] Database performance metrics
- [ ] Point-in-time recovery testing (doc exists in BACKUP_RESTORE_PROCEDURE)
- [x] Database health checks (health/ready endpoints)

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **Migration runner** — A single command (e.g. `npm run migrate:up`) that runs pending SQL files in order and records which ran in a table (e.g. `schema_migrations`) so you never run the same migration twice. *Why it matters:* Prevents double-applying or skipping migrations; makes deploy and CI repeatable. *Where:* `scripts/migrate-runner.js`; `npm run migrate:status`, `migrate:up` in package.json; `schema_migrations` table. *Verify:* Run `migrate:status` (see applied vs pending); run `migrate:up` twice and confirm the second run does nothing.
- **Automated backups** — Neon backs up the DB; the backup:verify script checks that backups are usable. *Why it matters:* You can restore after data loss or corruption. *Where:* Neon Console; `npm run backup:verify` (see package.json and backup script). *Verify:* Run backup:verify; optionally restore to a Neon branch and smoke-test.
- **Connection pool monitoring** — Observing how many connections are in use vs available; optional until you scale. *Why it matters:* Prevents exhausting connections under load. *Where:* Not implemented; would add metrics or use DB dashboard. *Verify:* N/A until implemented.
- **Slow query logging** — Logging or alerting on queries that exceed a threshold so you can optimize; optional. *Why it matters:* Surfaces bottlenecks. *Where:* Not implemented; would use DB or APM. *Verify:* N/A until implemented.
- **Database performance metrics** — Latency and throughput for DB calls; optional if you rely on app-level metrics. *Why it matters:* Helps identify DB as the source of latency. *Where:* App-level metrics exist; DB-specific metrics optional. *Verify:* N/A until implemented.
- **Point-in-time recovery testing** — Periodically restoring from a backup to verify the procedure works; the doc exists in BACKUP_RESTORE_PROCEDURE. *Why it matters:* Ensures the restore procedure works when you need it. *Where:* BACKUP_RESTORE_PROCEDURE.md; docs/runbooks/restore-from-backup.md. *Verify:* Run a restore drill (e.g. to a Neon branch) and document the result.
- **Database health checks** — The health/ready endpoints check DB connectivity so load balancers and monitors know the app can serve traffic. *Why it matters:* Unhealthy instances can be removed from rotation. *Where:* `/health`, `/health/ready` in `src/index.ts`. *Verify:* Call `/health/ready`; break DB and confirm the endpoint fails.

**Questions to Ask (and why we ask them):**
- "How do we rollback a bad migration?" — *Drives having down-migrations or a documented fix-forward plan; avoid running destructive SQL without a backup.*
- "How do we restore from backup if database is corrupted?" — *Confirms runbook and backup:verify are in place and tested.*
- "What's our database scaling strategy?" — *Drives planning for read replicas, connection pooling, or Neon scaling when traffic grows.*

---

### 5. **Security Hardening**

*Security hardening means: headers (e.g. CSP, HSTS), no hardcoded secrets, protection against common attacks (e.g. SQL injection, XSS), and a plan for incidents (e.g. secret rotation, incident response). Optional: penetration testing and a formal rotation schedule.*

**Current State:**
- Basic JWT auth ✅
- Rate limiting ✅
- Input validation ✅
- CORS configured ✅

**What's Missing:**
- [x] Security headers audit (Helmet, CSP, HSTS — SECURITY_AUDIT_SUMMARY.md)
- [x] SQL injection prevention (parameterized queries)
- [x] XSS prevention (sanitizeBody, headers)
- [ ] CSRF protection for state-changing operations (API-first; assess if needed)
- [x] Security scanning (npm audit 0 vulns; GitHub security-scan workflow)
- [ ] Penetration testing (external)
- [x] Secrets management audit (no hardcoded secrets; .env.example)
- [ ] API key rotation strategy
- [x] Security incident response plan (SECURITY_INCIDENT_RESPONSE.md)

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **Security headers** — Helmet sets HSTS, X-Frame-Options, X-Content-Type-Options, etc.; CSP is configured. The audit is in SECURITY_AUDIT_SUMMARY. *Why it matters:* Reduces XSS, clickjacking, and protocol downgrade risks. *Where:* `src/index.ts` (Helmet middleware); SECURITY_AUDIT_SUMMARY.md. *Verify:* Curl response headers; run the audit checklist.
- **SQL injection prevention** — All queries use parameterized calls (e.g. `$1`, `$2`) so user input cannot change the query structure. *Why it matters:* Prevents attackers from running arbitrary SQL. *Where:* All DB calls in services and routes use parameters. *Verify:* Grep for raw string concatenation in SQL; use only parameterized APIs.
- **XSS prevention** — Request bodies are sanitized (sanitizeBody) and headers restrict script execution. *Why it matters:* Prevents injected scripts from running in browsers. *Where:* sanitizeBody middleware; CSP headers. *Verify:* Try sending script tags in request body; confirm they are sanitized or rejected.
- **CSRF** — For API-only apps using JWT or API keys, CSRF is often unnecessary; assess if you have cookie-based session endpoints that change state. *Why it matters:* Cookie-based auth can be vulnerable to cross-site requests; JWT in headers is not. *Where:* Assess auth mechanism; add CSRF tokens only if using cookies for state-changing ops. *Verify:* Document decision in security docs.
- **Security scanning** — `npm audit` shows 0 vulns; the GitHub workflow runs secret scanning and build checks. *Why it matters:* Catches known vulnerable dependencies and accidental secret commits. *Where:* `npm audit`; `.github/workflows/security-scan.yml` (or similar). *Verify:* Run `npm audit`; push and confirm CI runs.
- **Penetration testing** — An external firm tests for vulnerabilities (auth, payments, API abuse); optional but recommended before handling sensitive data at scale. *Why it matters:* Finds issues automated tools miss. *Where:* Not done; engage a firm and scope auth, payments, API. *Verify:* Receive and remediate report.
- **Secrets management** — No secrets in code; .env.example documents required vars; use env vars in production. *Why it matters:* Prevents secrets from leaking via repo or logs. *Where:* .env.example; all config from process.env. *Verify:* Grep for API keys and passwords in code; confirm they’re not committed.
- **API key rotation** — A written schedule (e.g. rotate Stripe/JWT/DB every 90 days) and process so you rotate keys periodically or after exposure. *Why it matters:* Limits blast radius if a key is leaked. *Where:* Document in SECURITY_GUARDRAILS or runbook; use SECURITY_INCIDENT_RESPONSE if exposed. *Verify:* Document schedule and run a rotation drill.
- **Incident response plan** — SECURITY_INCIDENT_RESPONSE describes what to do when a secret is exposed (rotate, notify, document). *Why it matters:* Reduces panic and ensures consistent response. *Where:* SECURITY_INCIDENT_RESPONSE.md. *Verify:* Read and optionally run a tabletop exercise.

**Questions to Ask (and why we ask them):**
- "How do we detect and respond to security breaches?" — *Drives monitoring, alerting, and the incident response runbook.*
- "What's our secret rotation schedule?" — *Drives documenting and executing rotation (e.g. every 90 days).*
- "How do we handle compromised API keys?" — *Drives immediate rotation and notification steps in SECURITY_INCIDENT_RESPONSE.*

---

## 🟡 IMPORTANT GAPS (Should Fix Soon)

**What it is:** Gaps that should be fixed soon (testing, CI/CD, performance, data integrity, documentation).  
**What it does:** Lists what's missing in each area and how to close the gap.  
**How we use it:** Plan work after CRITICAL gaps; use REMAINING_ISSUES_STEPS and ADDRESS_REMAINING_GAPS for steps.

*Important gaps are items that should be fixed soon after launch or before scaling. They improve confidence (tests), deploy quality (CI/CD), performance (load testing), compliance (GDPR), and documentation (runbooks).*

### 6. **Testing Infrastructure**

*Testing infrastructure means: automated tests that run in CI, a high pass rate so you can trust the build, and optional E2E or load tests. Fixing failing tests and adding E2E for critical flows reduces regressions and speeds up releases.*

**Current State:**
- ~104 tests exist
- 86% pass rate (some failing)
- Unit, integration, smoke tests
- No E2E tests for critical flows

**What's Missing:**
- [ ] Fix failing tests (~15 tests) — still needed
- [ ] E2E tests for critical user journeys
- [ ] Load testing (k6, Artillery) — doc in PERFORMANCE_TESTING.md
- [ ] Chaos engineering tests
- [ ] Test coverage reporting (aim for 80%+)
- [ ] Visual regression testing (frontend)
- [ ] Accessibility testing

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **Fix failing tests** — Some tests (e.g. ~15) fail due to env, mocks, or assertions; fixing them brings CI to green and restores confidence in the build. *Why it matters:* Red CI blocks confidence in merges and deploys. *Where:* `src/tests/`; run `npm test` and fix failures (env, mocks, assertions). *Verify:* `npm test` exits 0; CI is green on push.
- **E2E tests** — End-to-end tests (e.g. Playwright) that run full user flows (login → create job → pay) so you catch integration bugs before release. *Why it matters:* Catches bugs that unit/integration tests miss (full stack). *Where:* Not implemented; would add Playwright or Cypress and run against staging. *Verify:* Run E2E suite and confirm critical flows pass.
- **Load testing** — Running k6 or Artillery against the API to measure latency and throughput under load; PERFORMANCE_TESTING.md describes how. *Why it matters:* Establishes baseline and finds bottlenecks before users do. *Where:* PERFORMANCE_TESTING.md; k6 scripts (if present). *Verify:* Run k6, record p95/RPS/error rate, save baseline.
- **Chaos engineering** — Intentionally failing parts of the system (e.g. DB, Stripe) to verify resilience; optional. *Why it matters:* Validates circuit breakers and retries in practice. *Where:* Not implemented; would use Chaos Monkey or Gremlin. *Verify:* N/A until implemented.
- **Test coverage reporting** — A report (e.g. Jest coverage) showing which lines are covered so you can target untested code; aim for 80%+ on critical paths. *Why it matters:* Surfaces untested code and regressions. *Where:* Jest `--coverage`; optionally in CI. *Verify:* Run `npm test -- --coverage` and review report.
- **Visual regression** — Automated screenshots of the frontend to catch UI changes; frontend concern. *Why it matters:* Catches unintended UI changes. *Where:* Frontend repo; optional. *Verify:* N/A for backend.
- **Accessibility testing** — Automated checks (e.g. axe) for a11y; frontend concern. *Why it matters:* Ensures UI is usable by assistive tech. *Where:* Frontend repo; optional. *Verify:* N/A for backend.

**Questions to Ask (and why we ask them):**
- "What's our test coverage target?" — *Drives setting a goal (e.g. 80% on critical paths) and adding coverage where needed.*
- "How do we test payment flows safely?" — *Drives using Stripe test mode, mocks, or sandbox so real money is never charged.*
- "How do we test failure scenarios?" — *Drives mocks for Stripe/SendGrid/Twilio and tests that assert retry/circuit behavior.*

---

### 7. **Deployment & CI/CD**

*CI/CD means: every push runs lint, typecheck, and tests; optionally, a branch deploys to staging or production. Staging deploy and migration-in-CI mean you can test schema and code changes together before production.*

**Current State:**
- Manual deployment process
- No CI/CD pipeline
- No automated testing in CI
- No deployment rollback automation

**What's Missing:**
- [x] CI/CD pipeline (GitHub Actions — ci.yml, test.yml, security-scan.yml)
- [x] Automated testing in CI (lint, typecheck, test on push/PR)
- [ ] Automated deployment to staging
- [ ] Blue-green or canary deployment strategy
- [ ] Automated rollback on failure
- [x] Deployment health checks (health, ready endpoints)
- [ ] Database migration automation in CI
- [ ] Environment promotion (dev → staging → prod)

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **CI/CD pipeline** — GitHub Actions run lint, typecheck, test, build, and security scan on push/PR so broken code does not merge. *Why it matters:* Prevents broken code from reaching production. *Where:* `.github/workflows/` (ci.yml, test.yml, security-scan.yml). *Verify:* Push a branch and confirm all jobs pass.
- **Automated testing in CI** — Every push runs tests so regressions are caught before deploy. *Why it matters:* Catches bugs before merge and deploy. *Where:* Same workflows; `npm test` in CI. *Verify:* Push a failing test and confirm CI fails.
- **Automated deployment to staging** — A branch (e.g. `staging`) deploys to a staging environment on push so you can test code and schema together. *Why it matters:* Validates deploy and schema before production. *Where:* Not implemented; would connect Railway (or host) to staging branch. *Verify:* Push to staging branch and confirm staging app updates.
- **Blue-green or canary** — Deploy new code alongside old, then switch traffic or roll out gradually to reduce risk of a bad deploy. *Why it matters:* Reduces blast radius of a bad deploy. *Where:* Host-dependent (e.g. Railway, AWS). *Verify:* N/A until implemented.
- **Automated rollback** — A way to revert to the previous deploy (e.g. Railway “Redeploy previous”) when errors spike after a release. *Why it matters:* Lets you recover quickly from a bad deploy. *Where:* docs/runbooks/rollback-deploy.md; host UI or CLI. *Verify:* Follow runbook once in staging.
- **Deployment health checks** — The health/ready endpoints let load balancers and monitors know the app is up and DB is reachable. *Why it matters:* Unhealthy instances are removed from rotation. *Where:* `/health`, `/health/ready` in `src/index.ts`. *Verify:* Call endpoints; break DB and confirm ready fails.
- **Database migration automation in CI** — A CI job or deploy step that runs `npm run migrate:up` against staging (or prod) so schema and code stay in sync. *Why it matters:* Prevents “column does not exist” in production. *Where:* Document in CI_CD_SETUP.md; add job or deploy script. *Verify:* Run migrate:up in CI or deploy and confirm schema is updated.
- **Environment promotion** — A clear path from dev → staging → prod (e.g. branch or manual promote) so you test in staging before production. *Why it matters:* Ensures code is tested before prod. *Where:* Document in CI_CD_SETUP or runbook. *Verify:* Document and follow the path once.

**Questions to Ask (and why we ask them):**
- "How do we deploy without downtime?" — *Drives blue-green or rolling deploy so users don’t see downtime.*
- "How do we test deployments before production?" — *Drives staging and migration-in-CI so schema and code are validated together.*
- "What's our rollback procedure?" — *Confirms runbook and host steps (e.g. Redeploy previous) are documented and tested.*

---

### 8. **Performance & Scalability**

*Performance and scalability means: knowing how the app behaves under load (e.g. k6), having a baseline for latency and throughput, and optional caching or CDN. Load testing helps you find bottlenecks before users do.*

**Current State:**
- No performance benchmarks
- No load testing
- No caching strategy documented
- No CDN configuration

**What's Missing:**
- [ ] Performance benchmarks (response times, throughput) — doc: PERFORMANCE_TESTING.md
- [ ] Load testing (k6 etc. — doc exists)
- [ ] Caching strategy doc (Redis used for rate limit; expand if needed)
- [ ] CDN for static assets (if applicable)
- [ ] Database query optimization
- [ ] Connection pooling optimization
- [ ] Horizontal scaling strategy
- [ ] Auto-scaling configuration

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **Performance benchmarks** — Recorded targets (e.g. p95 &lt; 500ms, RPS &gt; 100); PERFORMANCE_TESTING.md describes how to measure. *Why it matters:* Gives you a target and a way to detect regressions. *Where:* PERFORMANCE_TESTING.md; metrics in code. *Verify:* Run k6, record p95/RPS, compare to targets.
- **Load testing** — Running k6 or similar against the API to measure latency and throughput under load; doc exists. *Why it matters:* Finds bottlenecks before users do. *Where:* PERFORMANCE_TESTING.md; k6 scripts. *Verify:* Run load test once and record baseline.
- **Caching strategy** — A written plan for what to cache (e.g. Redis for rate limit is in place; expand for frequently read data if needed). *Why it matters:* Reduces DB load and latency for hot data. *Where:* Redis used for rate limit; document in a doc if you add more caching. *Verify:* Document what you cache and TTLs.
- **CDN** — A CDN for static assets (e.g. images) if the API or frontend serves them; optional. *Why it matters:* Reduces latency and load on origin. *Where:* Not implemented; would use CloudFront, Cloudflare, etc. *Verify:* N/A until you serve static assets.
- **Database query optimization** — Identifying and fixing slow queries (e.g. indexes, N+1) so the DB does not become a bottleneck. *Why it matters:* Prevents DB from slowing the app under load. *Where:* Add indexes or fix N+1 in services; optional slow-query logging. *Verify:* Run load test and profile DB; add indexes where needed.
- **Connection pooling** — Tuning pool size and timeouts so the app does not exhaust DB connections under load. *Why it matters:* Prevents “too many connections” under load. *Where:* DB client config (e.g. pg pool). *Verify:* Run load test and monitor connection count.
- **Horizontal scaling** — A plan to run multiple app instances behind a load balancer when traffic grows. *Why it matters:* Lets you scale out instead of up. *Where:* Document in ARCHITECTURE or runbook; host (Railway, AWS) supports multiple instances. *Verify:* Run multiple instances and confirm load is distributed.
- **Auto-scaling** — Host-level scaling (e.g. Railway, AWS) so instances scale up/down with load; optional. *Why it matters:* Handles traffic spikes without manual intervention. *Where:* Host config. *Verify:* N/A until configured.

**Questions to Ask (and why we ask them):**
- "What's our target response time?" — *Drives setting p95/p99 targets and alerting when they’re exceeded.*
- "How many concurrent users can we handle?" — *Drives load testing and capacity planning.*
- "What happens during traffic spikes?" — *Drives load testing, scaling, and circuit breakers so the app degrades gracefully.*

---

### 9. **Data Integrity & Compliance**

*Data integrity and compliance means: GDPR-style export and deletion, consent tracking, audit logs for sensitive actions, and documented retention policies. This helps you respond to user requests and regulators.*

**Current State:**
- Database constraints exist
- No data integrity checks
- No GDPR compliance features
- No audit logging for sensitive operations

**What's Missing:**
- [ ] Automated data integrity checks
- [x] GDPR compliance features — /user/data/export, /user/data (delete), /user/consent (see userData.ts)
- [ ] Audit logging for all sensitive operations
- [ ] Data retention policies (doc)
- [ ] Privacy policy implementation (legal/product)
- [ ] Terms of service tracking
- [x] User consent management (consent record, GET /user/consent/:type)

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **Automated data integrity checks** — Scripts or jobs that verify referential integrity, constraints, or invariants (e.g. credit balance matches ledger); optional. *Why it matters:* Catches data corruption or bugs. *Where:* Not implemented; would add a scheduled job or script. *Verify:* N/A until implemented.
- **GDPR compliance** — Routes for data export, account deletion, and consent (userData.ts) so you can respond to user and regulator requests. *Why it matters:* Required for EU users and many B2B contracts. *Where:* `src/routes/userData.ts` (or similar); export, delete, consent endpoints. *Verify:* Call export/delete/consent endpoints and confirm behavior.
- **Audit logging** — Logging sensitive actions (e.g. delete user, payout, admin override) to a table or log stream so you can answer “who did what when” for compliance or incidents.- **Data retention policies** — A written policy (e.g. how long you keep logs, backups, PII) and when you delete or anonymize; document in GDPR_COMPLIANCE or a policy doc. *Why it matters:* Compliance and storage cost. *Where:* Document in GDPR_COMPLIANCE.md or policy doc. *Verify:* Read and enforce policy (e.g. scheduled cleanup).
- **Privacy policy** — Legal/product document describing how you collect and use data; usually owned by legal. *Why it matters:* Required for transparency and compliance. *Where:* Legal/product; link from app. *Verify:* N/A for backend doc.
- **Terms of service tracking** — Recording when users accept terms and which version; optional for compliance. *Why it matters:* Proves consent for terms. *Where:* Optional table and endpoint. *Verify:* N/A until implemented.
- **User consent management** — Recording and retrieving consent (e.g. marketing, analytics) via consent record and GET /user/consent/:type. *Why it matters:* GDPR and marketing compliance. *Where:* Consent record and GET /user/consent/:type (userData or consent route). *Verify:* Set and get consent via API and confirm stored correctly.

**Questions to Ask (and why we ask them):**
- "How do users export their data?" — *Confirms export endpoint exists and returns all required data.*
- "How do we handle GDPR deletion requests?" — *Confirms delete endpoint and process (e.g. 30-day grace, then purge).*
- "What data do we need to retain for legal compliance?" — *Drives retention policy and cleanup jobs.*

---

### 10. **Documentation & Onboarding**

*Documentation and onboarding means: runbooks for common operations (restore, incident, rollback), a clear CONTRIBUTING and ARCHITECTURE, and optional ADRs or API changelog so new developers and on-call can get up to speed quickly.*

**Current State:**
- Extensive technical docs ✅
- No developer onboarding guide
- No runbook for common operations
- README is outdated

**What's Missing:**
- [ ] Developer onboarding guide (CONTRIBUTING + ARCHITECTURE cover basics)
- [ ] Runbook for common operations (e.g. restore from backup, incident response)
- [ ] Architecture decision records (ADRs)
- [ ] API changelog
- [ ] Troubleshooting guide (SERVER_STARTUP_ANALYSIS exists)
- [x] Updated README / docs (docs/active reorganized, DOCUMENTATION_INDEX)
- [x] Contributing guidelines (CONTRIBUTING.md)

**Explanation of each item (what it is, why it matters, where it lives, how to verify):**

- **Developer onboarding guide** — A single doc (or short list) that walks a new dev through clone, env, migrate, test, run; CONTRIBUTING and ARCHITECTURE cover much of this. *Why it matters:* Reduces onboarding time and support questions. *Where:* CONTRIBUTING.md, ARCHITECTURE.md; optional “Day 1” doc. *Verify:* Have a new dev follow the steps and fix any gaps.
- **Runbooks** — Step-by-step instructions for common ops: restore from backup, handle an incident, rollback a deploy; docs/runbooks/ has been added. *Why it matters:* Anyone can perform ops without guessing. *Where:* docs/runbooks/restore-from-backup.md, handle-incident.md, rollback-deploy.md. *Verify:* Follow each runbook in staging (or tabletop) and update if needed.
- **ADRs** — Short “Architecture Decision Records” (e.g. “Why Neon”, “Why Sentry”) so future readers know why choices were made. *Why it matters:* Preserves context when people leave or forget. *Where:* Optional docs/adr/ or section in ARCHITECTURE. *Verify:* Add an ADR for the next major decision.
- **API changelog** — A doc or CHANGELOG section that lists API changes and breaking changes per version so frontend and partners can adapt. *Why it matters:* Prevents integration breakage when you change the API. *Where:* CHANGELOG.md or docs/api-changelog.md. *Verify:* Update when you ship a breaking or notable change.
- **Troubleshooting guide** — SERVER_STARTUP_ANALYSIS exists for server startup issues; expand if you want a single troubleshooting hub. *Why it matters:* Speeds up debugging common issues. *Where:* SERVER_STARTUP_ANALYSIS or docs/troubleshooting.md. *Verify:* Link from DOCUMENTATION_INDEX and add entries for common failures.
- **Updated README / docs** — Docs are reorganized under docs/active with DOCUMENTATION_INDEX so everything is discoverable. *Why it matters:* Reduces “where do I find X?” questions. *Where:* docs/active/DOCUMENTATION_INDEX.md; docs/active/README.md. *Verify:* Open index and confirm all key docs are linked.
- **Contributing guidelines** — CONTRIBUTING.md describes how to contribute, branch, and submit changes. *Why it matters:* Keeps contributions consistent. *Where:* CONTRIBUTING.md. *Verify:* Read and follow once when submitting a PR.

**Questions to Ask (and why we ask them):**
- "How do new developers get started?" — *Confirms clone, env, migrate, test, run are documented and work.*
- "What's the process for adding new features?" — *Confirms branch, PR, review, and deploy are documented.*
- "How do we document architectural decisions?" — *Drives ADRs or a section in ARCHITECTURE for major choices.*

---

## 🟢 NICE-TO-HAVE GAPS (Future Enhancements)

*Nice-to-have gaps are improvements that are not blocking launch: feature TODOs in code, developer experience (Docker, pre-commit, strict mode), and optional tooling. Tackle them when you have capacity or when users request them.*

### 11. **Feature Completeness**

*Feature completeness means: closing TODOs in the codebase (e.g. short-link service, timezone handling, payment method management) and optional notifications or integrations. Prioritize by user impact.*

**TODOs Found in Code (what each is and why it matters):**

- **Short link service for SMS** — Mentioned in `noShowDetection.ts`, `jobReminders.ts`. *What it is:* A service that shortens URLs in SMS so links fit and are trackable. *Why it matters:* Long URLs can be truncated or look suspicious; short links improve deliverability and analytics. *Where:* Not implemented; would add a short-link provider (e.g. Bitly API) or self-hosted.
- **Timezone handling** — Currently hardcoded "local time". *What it is:* Store and display times in user timezone or UTC with conversion. *Why it matters:* Users in different timezones see correct times for jobs and reminders. *Where:* Search for "local time" or date formatting; add timezone field or conversion.
- **Payment method management** — Stripe API calls commented as TODO. *What it is:* Let users add, list, and remove payment methods (cards) via Stripe Customer API. *Why it matters:* Required for subscription or saved-card flows. *Where:* Stripe integration; add routes for payment methods.
- **Subscription dunning flag/notification** — *What it is:* When a subscription payment fails, flag the account and send a dunning email (e.g. "update your card"). *Why it matters:* Reduces churn from failed payments. *Where:* Stripe webhooks or a scheduled job; notification provider.
- **Calendar sync notifications** — *What it is:* Notify users when calendar sync succeeds or fails (e.g. Google Calendar). *Why it matters:* Users know their calendar is in sync. *Where:* Calendar integration + notification service.
- **Background check result notifications** — *What it is:* Notify admin or cleaner when a background check completes (pass/fail). *Why it matters:* Speeds up onboarding and compliance. *Where:* Background check integration + notification.
- **Invoice notifications** — *What it is:* Email or in-app notification when an invoice is created or paid. *Why it matters:* Keeps clients and admins informed. *Where:* Invoice creation flow + notification.
- **Team invitation notifications** — *What it is:* Notify the invitee when they are invited to a team (email with link). *Why it matters:* Invitees need to know to accept. *Where:* Team invitation flow + notification.

**Questions to Ask (and why we ask them):**
- "Which TODOs are blocking production?" — *Prioritize only what blocks launch; defer the rest.*
- "What's the priority order for these features?" — *Order by user impact and business value.*
- "Are there any features users are requesting?" — *Align roadmap with user feedback.*

---

### 12. **Developer Experience**

*Developer experience means: how quickly a new developer can clone, install, run migrations, and run tests (e.g. Docker Compose, pre-commit hooks, ESLint/Prettier, VS Code settings). It reduces onboarding time and keeps code style consistent.*

**What's Missing (what each is and why it matters):**

- **Local development environment setup script** — A single script (e.g. `scripts/setup.sh` or `npm run setup`) that installs deps, creates `.env` from example, runs migrations, and optionally seeds DB. *Why it matters:* New devs get running in minutes instead of hours. *Where:* Not implemented; would add script and document in CONTRIBUTING.
- **Docker Compose for local development** — A `docker-compose.yml` that runs the app, DB, Redis (if needed) so devs don't install PostgreSQL/Redis locally. *Why it matters:* Consistent env across machines; easier onboarding. *Where:* Not implemented; would add compose file and document.
- **Pre-commit hooks for code quality** — Hooks (e.g. Husky + lint-staged) that run lint and tests before commit so bad code doesn't get committed. *Why it matters:* Catches issues before push and CI. *Where:* Not implemented; would add Husky and lint-staged.
- **Code formatting (Prettier)** — Prettier formats code on save or pre-commit so style is consistent. *Why it matters:* No style debates; consistent diffs. *Where:* ESLint may have formatting rules; Prettier can be added and run in CI.
- **Linting rules (ESLint)** — ESLint is in place; ensure rules are consistent and overrides for tests/config are documented. *Why it matters:* Catches bugs and enforces patterns. *Where:* `.eslintrc.json`; run `npm run lint`. *Verify:* Lint passes; relax rules only where intentional.
- **TypeScript strict mode** — Enable `strict: true` (or stricter options) in tsconfig so type errors are caught at compile time. *Why it matters:* Fewer runtime type errors. *Where:* `tsconfig.json`; enable gradually and fix errors.
- **VS Code workspace settings** — `.vscode/settings.json` and optionally `.vscode/extensions.json` so format-on-save and recommended extensions are consistent. *Why it matters:* Same experience for everyone using VS Code. *Where:* Not implemented; would add .vscode/.
- **Debugging configuration** — `.vscode/launch.json` (or similar) so you can attach a debugger to the running app or tests. *Why it matters:* Easier to debug breakpoints and inspect state. *Where:* Not implemented; would add launch config.

**Questions to Ask (and why we ask them):**
- "How do we ensure code quality?" — *Drives lint, format, tests, and code review process.*
- "What's our code review process?" — *Confirms PR review checklist and who approves.*
- "How do we debug production issues locally?" — *Drives same env (e.g. Docker), logs, and optional replay.*

---

## 📋 Production Readiness Checklist

**What it is:** A tickable checklist of infrastructure, security, operations, and code-quality items before go-live.  
**What it does:** Ensures nothing critical is missed before production.  
**How we use it:** Tick off each item before launch; use with runbooks and MONITORING_SETUP.

*Use this checklist before going live. Tick each item when it is done. Infrastructure = hosting, DB, SSL, monitoring. Security = audit, secrets, headers. Operations = runbooks, on-call, backup tested. Code quality = tests pass, no critical vulns, docs and API docs in place.*

### Infrastructure
- [ ] **Production environment configured (Railway etc.)** — App runs on a host with env vars, DB, and SSL. *Meaning:* You can deploy and the app serves traffic; host is chosen and documented.
- [ ] **Staging environment configured** — A separate environment (e.g. staging.puretask.com) with its own DB so you test before production. *Meaning:* Staging URL exists and deploy process is documented.
- [x] **Database backups automated and tested (Neon + backup:verify)** — Neon backs up the DB; `npm run backup:verify` confirms backups are usable. *Meaning:* You can restore from backup if needed.
- [ ] **SSL certificates configured (at host)** — HTTPS is enabled so traffic is encrypted. *Meaning:* Host provides or you attach a cert (e.g. Let's Encrypt); no HTTP in production.
- [ ] **Domain and DNS configured** — Your API has a stable hostname (e.g. api.puretask.com) and DNS points to the host. *Meaning:* Clients use the same URL; DNS is documented.
- [ ] **CDN configured (if needed)** — If you serve static assets, a CDN caches them. *Meaning:* Optional; only if you serve images or static files from this app.
- [x] **Monitoring and alerting set up (Sentry, metrics, UptimeRobot doc)** — Errors and uptime are monitored; alerting is documented (configure Sentry/UptimeRobot alerts so someone is notified). *Meaning:* You know when the app is down or errors spike.
- [ ] **Log aggregation configured (optional)** — Logs are centralized (e.g. Datadog, ELK) for search. *Meaning:* Optional; host logs or Sentry may be enough at first.

### Security
- [x] **Security audit completed (SECURITY_AUDIT_SUMMARY.md)** — Headers, secrets, and injection prevention have been audited and documented. *Meaning:* You've verified security basics and have a checklist.
- [ ] **Penetration testing done (external)** — An external firm tested auth, payments, and API for vulnerabilities. *Meaning:* Optional but recommended before handling sensitive data at scale.
- [x] **Secrets management in place (env vars, no hardcoded)** — No secrets in code; .env.example documents required vars. *Meaning:* All secrets come from environment; none committed.
- [ ] **API keys rotated (schedule)** — You have a written schedule (e.g. every 90 days) and have rotated at least once or documented first rotation. *Meaning:* Reduces risk if a key is ever exposed.
- [x] **Security headers configured (Helmet, CSP, HSTS)** — Response headers restrict framing, content type, and enforce HTTPS. *Meaning:* Helmet (and CSP if set) are applied to all responses.
- [x] **Rate limiting tuned for production** — Rate limits are set so abuse is limited but normal traffic is not blocked. *Meaning:* Limits are documented and tested under expected load.
- [ ] **DDoS protection configured (at host/CDN)** — Host or CDN mitigates volumetric attacks. *Meaning:* Often provided by host (Railway, AWS); document what you have.

### Operations
- [ ] **Runbooks created (e.g. restore, incident)** — docs/runbooks/ has restore-from-backup, handle-incident, rollback-deploy so anyone can run them. *Meaning:* Step-by-step instructions exist and are linked from DOCUMENTATION_INDEX.
- [ ] **On-call rotation established** — Someone is designated to respond to alerts (e.g. PagerDuty or a shared calendar). *Meaning:* When an alert fires, someone knows they're responsible.
- [x] **Incident response plan documented (SECURITY_INCIDENT_RESPONSE.md)** — What to do when a secret is exposed or a breach is suspected. *Meaning:* Document exists and is linked; team knows where to look.
- [ ] **Backup and recovery tested (procedure doc exists)** — You've run a restore drill (e.g. to a Neon branch) and updated the doc if needed. *Meaning:* Procedure is validated, not just written.
- [ ] **Deployment process documented** — How to deploy (e.g. Railway dashboard, CLI, or CI) is written and linked. *Meaning:* New team members can deploy following the doc.
- [ ] **Rollback procedure tested** — You've rolled back once (e.g. Redeploy previous on Railway) and documented the steps. *Meaning:* Rollback is validated, not just written.
- [x] **Health checks configured (/health, /health/ready)** — Load balancer or monitor can call these endpoints to check app and DB. *Meaning:* Endpoints exist and are used by your host or UptimeRobot.

### Code Quality
- [ ] **All tests passing (fix remaining failures)** — `npm test` exits 0 so CI is green. *Meaning:* No failing tests; fix env/mocks/assertions per REMAINING_ISSUES_STEPS.md.
- [ ] **Code coverage > 80%** — Jest coverage report shows at least 80% line coverage on critical paths. *Meaning:* Run `npm test -- --coverage` and review; add tests where coverage is low.
- [x] **No critical security vulnerabilities (npm audit 0)** — `npm audit` reports 0 critical/high vulns. *Meaning:* Dependencies are patched or accepted risk is documented.
- [ ] **Performance benchmarks met** — Load test (e.g. k6) shows p95 and RPS meet your targets. *Meaning:* You've run load tests and recorded a baseline; see PERFORMANCE_TESTING.md.
- [x] **Documentation complete (docs/active reorganized)** — DOCUMENTATION_INDEX and runbooks exist; key docs are linked. *Meaning:* New devs and on-call can find what they need.
- [x] **API documentation published (/api-docs, OpenAPI)** — Swagger UI and OpenAPI spec are available so frontend and partners can integrate. *Meaning:* `/api-docs` and `/api-docs/json` work when the app is running.

---

## 🎯 Questions You Should Be Asking

*These questions help you and the team decide what to build next, how to scale, and how to respond to incidents. Use them in planning or post-incident reviews.*

### About Architecture
1. **"What's our scaling strategy if we get 10x users?"** — *Why we ask:* Ensures you've thought about horizontal scaling, DB connection pooling, and optional auto-scaling before traffic grows.
2. **"How do we handle database migrations in production?"** — *Why we ask:* Confirms you use the migration runner, run migrations in a controlled way (e.g. during deploy or maintenance), and have a rollback or fix-forward plan.
3. **"What's our disaster recovery plan?"** — *Why we ask:* Ensures backups, restore procedure, and runbooks are in place and tested so you can recover from data loss or corruption.
4. **"How do we ensure zero-downtime deployments?"** — *Why we ask:* Drives blue-green or rolling deploys and health checks so users don't see errors during deploy.

### About Security
1. **"How do we detect and respond to security incidents?"** — *Why we ask:* Confirms monitoring, alerting, and SECURITY_INCIDENT_RESPONSE are in place so you can react when a breach or exposure is suspected.
2. **"What's our secret rotation schedule?"** — *Why we ask:* Drives documenting and executing rotation (e.g. every 90 days) so a leaked key has limited lifetime.
3. **"How do we handle compromised accounts?"** — *Why we ask:* Ensures you have a process (e.g. disable account, force re-auth, notify user) when an account is hijacked.
4. **"What security compliance do we need (SOC 2, PCI DSS)?"** — *Why we ask:* Determines whether you need formal audits, pen tests, or specific controls (e.g. for payment data).

### About Operations
1. **"What metrics indicate system health?"** — *Why we ask:* Drives defining and alerting on key metrics (e.g. error rate, p95 latency, DB connections) so you know when something is wrong.
2. **"How do we debug production issues?"** — *Why we ask:* Confirms you have Sentry, logs, runbooks, and optionally a way to replay or reproduce issues locally.
3. **"What's our on-call process?"** — *Why we ask:* Ensures someone is designated to respond to alerts and escalation is documented.
4. **"How do we handle peak traffic?"** — *Why we ask:* Drives load testing, scaling strategy, and circuit breakers so the app degrades gracefully under load.

### About Business
1. **"What features are users requesting?"** — *Why we ask:* Aligns roadmap with user feedback so you build what matters.
2. **"What's blocking user growth?"** — *Why we ask:* Surfaces product, performance, or reliability gaps that limit adoption.
3. **"What's our data retention policy?"** — *Why we ask:* Drives compliance (GDPR, etc.) and storage cost; document how long you keep logs, backups, and PII.
4. **"How do we handle customer support?"** — *Why we ask:* Ensures support has access to runbooks, status page, and escalation path when users report issues.

---

## 🚀 Recommended Next Steps

**What it is:** A phased plan (Phase 1 Critical, Phase 2 Important, Phase 3 Enhancement) with timeframes.  
**What it does:** Tells you what to do first and in what order.  
**How we use it:** Use with ADDRESS_REMAINING_GAPS and REMAINING_ISSUES_STEPS; work Phase 1 then Phase 2.

*These phases suggest an order of work: fix tests and typecheck first (Phase 1), then security and performance (Phase 2), then load testing and runbooks (Phase 3). The "Remaining high-impact items" list at the end is the short list to tackle next.*

### Phase 1: Critical (Week 1-2)
1. [ ] Fix failing tests (~15 tests)
2. [x] Set up monitoring and alerting (Sentry, metrics, UptimeRobot)
3. [x] Create API documentation (OpenAPI, Swagger UI)
4. [x] Implement error recovery mechanisms (circuit breakers, retry)
5. [x] Set up CI/CD pipeline (GitHub Actions)

### Phase 2: Important (Week 3-4)
1. [x] Security audit and hardening
2. [ ] Performance testing and optimization (run k6; doc exists)
3. [x] Database backup automation (Neon + verify script)
4. [ ] Deployment automation (staging, migrations in CI)
5. [x] Documentation updates (docs/active, DOCUMENTATION_INDEX)

### Phase 3: Enhancement (Month 2)
1. [ ] Load testing (k6; PERFORMANCE_TESTING.md)
2. [x] GDPR compliance features (export, delete, consent)
3. [ ] Developer onboarding guide (CONTRIBUTING + ARCHITECTURE cover basics)
4. [ ] Runbooks for operations (restore, incident)
5. [ ] Complete TODOs (short-link, timezone, etc.)

### Remaining high-impact items
- **Migration runner** — add node-pg-migrate or Knex so migrations run in a single command.
- **Fix failing tests** — get to 100% pass rate.
- **Runbooks** — e.g. “Restore from backup”, “Handle incident”, “Rollback deploy”.

**→ Step-by-step guide:** [ADDRESS_REMAINING_GAPS.md](ADDRESS_REMAINING_GAPS.md)

---

## 📚 Resources & Best Practices

**What it is:** Links and references for monitoring, testing, CI/CD, and documentation.  
**What it does:** Points to external best practices and internal docs.  
**How we use it:** Use when implementing or improving monitoring, tests, CI/CD, or docs.

*This section lists external tools and practices you can use for monitoring, testing, CI/CD, and documentation. They are references, not requirements.*

### Monitoring
- **APM (Datadog, New Relic, Sentry)** — *When to use:* Sentry is already in place for errors; add Datadog or New Relic if you want full APM (traces, custom metrics, dashboards) and are willing to pay. Use when you need deeper performance visibility than Sentry alone.
- **Logs (Datadog Logs, ELK Stack, CloudWatch)** — *When to use:* When you have multiple instances or need to search logs across deploys; optional if you rely on host logs and Sentry. Use when debugging requires correlating logs from many requests or servers.
- **Metrics (Prometheus + Grafana)** — *When to use:* When you want custom dashboards and alerting on metrics (latency, throughput, business KPIs). You already record metrics in code; add Prometheus/Grafana when you need to graph and alert on them.
- **Alerting (PagerDuty, Opsgenie)** — *When to use:* When you need on-call rotation and escalation (e.g. wake someone at 2am). Start with Sentry → Slack or email; add PagerDuty/Opsgenie when you have formal on-call.

### Testing
- **E2E (Playwright, Cypress)** — *When to use:* When you want to test full user flows (login → create job → pay) in a browser. Add after unit/integration tests are green; run against staging before release.
- **Load Testing (k6, Artillery, Locust)** — *When to use:* When you need a performance baseline or to find bottlenecks. Use k6 (doc in PERFORMANCE_TESTING.md) when you're ready to run load tests; run at least once before launch.
- **Chaos Engineering (Chaos Monkey, Gremlin)** — *When to use:* When you want to validate resilience (e.g. kill DB or Stripe in staging). Optional; use after circuit breakers and retries are in place.

### CI/CD
- **GitHub Actions** — *When to use:* You're already using it for lint, test, build. Use for any additional jobs (e.g. deploy to staging, run migrations). Free for public repos; paid for private.
- **GitLab CI** — *When to use:* If you move to GitLab, use built-in CI for the same workflows (lint, test, deploy).
- **CircleCI** — *When to use:* Alternative to GitHub Actions if you prefer Circle's UX or need specific integrations.

### Documentation
- **API Docs (Swagger/OpenAPI)** — *When to use:* You have this at `/api-docs`. Keep `@swagger` on routes up to date when you change endpoints; use for frontend and partner integration.
- **Architecture (C4 Model, ADRs)** — *When to use:* C4 for diagrams (context, containers, components); ADRs when you make a significant choice (e.g. "Why Neon") so future readers know the reasoning.
- **Runbooks (Notion, Confluence)** — *When to use:* You have runbooks in the repo (docs/runbooks/). If the team prefers Notion/Confluence, copy them there and link from the repo so both stay in sync.

---

**Last Updated:** 2026-01-28  
**Reanalysis:** 2026-01-31 (completed vs still-needed items updated)  
**Next Review:** After migration runner and failing tests are addressed
