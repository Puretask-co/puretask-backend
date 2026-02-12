# Guide: Addressing Remaining Issues

**Date:** 2026-01-31  
**Purpose:** Step-by-step guide to address remaining gaps from the Comprehensive Gap Analysis (reanalysis 2026-01-31).  
**Related:** [COMPREHENSIVE_GAP_ANALYSIS.md](COMPREHENSIVE_GAP_ANALYSIS.md), [PRODUCTION_READINESS_ROADMAP.md](../00-CRITICAL/PRODUCTION_READINESS_ROADMAP.md)

---

## What This Guide Is

**What it is:** A step-by-step guide to address each remaining production-readiness gap (migration runner, tests, runbooks, alerting, staging, load test, Postman).  
**What it does:** Gives goal, current state, steps, and how to verify for each item.  
**How we use it:** Work through Priority Overview and the sections below in order; tick items when done; use with COMPREHENSIVE_GAP_ANALYSIS and REMAINING_ISSUES_STEPS.

This guide explains **how to address each remaining production-readiness gap**: migration runner, failing tests, runbooks, error alerting, staging/CI, load testing, and Postman. For each item it gives **goal**, **current state**, **steps**, and **how to verify**. Use it together with [COMPREHENSIVE_GAP_ANALYSIS.md](COMPREHENSIVE_GAP_ANALYSIS.md) (full gap list) and [REMAINING_ISSUES_STEPS.md](REMAINING_ISSUES_STEPS.md) (short "how to complete" steps).

**In plain English:** We're almost production-ready; a few things are still left (e.g. run DB schema updates with one command, fix failing tests, add step-by-step runbooks for "restore from backup" and "rollback deploy"). This doc tells you exactly how to do each of those things, in order of importance.

---

## New here? Key terms (plain English)

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

## Priority Overview

**What it is:** A table of remaining gaps with priority (HIGH/MEDIUM/LOW), effort, and impact.  
**What it does:** Shows what to do first (migration runner, tests, runbooks) and what can wait (alerting, staging, load test, Postman, optional).  
**How we use it:** Work through HIGH first, then MEDIUM; use the sections below for steps and verification.

*Priority indicates how soon to do each item and how much impact it has. HIGH = do first (safety and confidence). MEDIUM = do next (alerting, staging, load test, Postman). LOW = optional (pen test, rotation schedule, ADRs). Effort is a rough estimate in hours; impact describes the benefit.*

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **HIGH** | 1. Migration runner | 4–8 hrs | Deploy safety, rollback |
| **HIGH** | 2. Fix failing tests | 2–6 hrs | Confidence, CI green |
| **HIGH** | 3. Runbooks | 2–4 hrs | Ops, incidents |
| **MEDIUM** | 4. Error alerting | 2–4 hrs | Incident response |
| **MEDIUM** | 5. Staging + migration in CI | 4–8 hrs | Deploy quality |
| **MEDIUM** | 6. Load testing (run k6) | 2–4 hrs | Performance baseline |
| **MEDIUM** | 7. Postman collection | 1–2 hrs | API testing |
| **LOW** | 8–12. Optional hardening | Various | Nice-to-have |

---

## HIGH PRIORITY

**What it is:** Items that affect deploy safety (migration runner), confidence (tests), and incident response (runbooks).  
**What it does:** Ensures we can run migrations safely, trust CI, and follow runbooks during incidents.  
**How we use it:** Complete items 1–3 in order; use the steps and verification bullets below for each.

*High-priority items are those that directly affect deploy safety (migration runner), confidence in the codebase (tests), and ability to respond to incidents (runbooks).*

### 1. Migration Runner

**What it is:** A single command (e.g. `npm run migrate:up`) that runs pending migrations and records them in a table.  
**What it does:** Makes schema changes repeatable and safe; avoids "column does not exist" in production.  
**How we use it:** Use the existing runner in `scripts/migrate-runner.js`; run `migrate:status` and `migrate:up`; run migrations before or after deploy (see CI_CD_SETUP).

**Goal:** Run database migrations with a single command (e.g. `npm run migrate:up`) and track which migrations have been applied, so you can roll out schema changes safely and optionally run migrations in CI.

**Current state:** Migrations live in `DB/migrations/` and are run manually (e.g. `psql $DATABASE_URL < DB/migrations/001_init.sql`). Scripts like `scripts/run-migration.js` and `scripts/verify-migration.js` exist but there is no unified runner that records applied migrations.

**Why this matters:** Without a runner, you risk running the same migration twice (e.g. adding a column that already exists) or forgetting to run a new migration in production, which leads to "column does not exist" errors. A runner that records applied migrations in a table makes every deploy repeatable and safe.

**Steps (with detail):**

1. **Choose a runner**
   - **node-pg-migrate**: Popular, file-based migrations (up/down), stores applied migrations in a table. You run `npx node-pg-migrate up` and it runs only pending migrations. Good for teams that want a standard tool.
   - **Knex migrations**: Same idea; good if you already use or plan to use Knex for queries. Migrations are JavaScript/TypeScript that call Knex schema APIs.
   - **Recommendation:** Use the existing **adapter approach** in this repo: `scripts/migrate-runner.js` already reads `DB/migrations/*.sql` and `DB/migrations/hardening/*.sql`, checks `schema_migrations`, and runs only pending files. No extra install needed; just run `npm run migrate:up` when `DATABASE_URL` is set.

2. **Install and init (only if you were adding node-pg-migrate from scratch)**
   ```bash
   npm install node-pg-migrate pg --save
   npx node-pg-migrate init
   ```
   This creates a `migrations` folder and a config. In this project the custom runner is already in place, so you can skip this and use `npm run migrate:status` and `npm run migrate:up`.

3. **Adapter approach (already implemented)**  
   The runner in `scripts/migrate-runner.js`:
   - Reads `DB/migrations/*.sql` and `DB/migrations/hardening/*.sql` in order (by filename).
   - Creates `schema_migrations` if it does not exist.
   - Tracks applied migrations in `schema_migrations (name, applied_at)`.
   - On `migrate:up`: runs only not-yet-applied files and inserts each name into `schema_migrations` after success.
   - `migrate:status`: prints applied and pending migration names without running anything.

   **What each script does:**
   - `npm run migrate:status` — Connects to DB (or skips if no `DATABASE_URL`), reads `schema_migrations`, lists migration files from disk; prints which are applied and which are pending. Safe to run anytime.
   - `npm run migrate:up` — Runs each pending migration in order inside a transaction; on success inserts the migration name into `schema_migrations`. If a migration fails, the transaction is rolled back and no further migrations run.
   - `npm run migrate:create-schema` — Creates only the `schema_migrations` table; useful for a fresh DB before first `migrate:up`.

4. **Schema migrations table**
   The runner creates it automatically when you run `migrate:up` if it does not exist. Definition:
   ```sql
   CREATE TABLE IF NOT EXISTS schema_migrations (
     name TEXT PRIMARY KEY,
     applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```
   You can also create it manually once with `npm run migrate:create-schema` (or equivalent) if you prefer.

5. **Verification**
   - Run `npm run migrate:status` (with `DATABASE_URL` set) → you should see "Applied" and "Pending" sections; if the DB is empty of migrations, all files are Pending.
   - Run `npm run migrate:up` on a dev DB → only pending migrations run; `schema_migrations` gets one row per applied file.
   - Re-run `npm run migrate:up` → "No pending migrations" or similar; no SQL runs (idempotent).
   - Intentionally break a migration (e.g. invalid SQL) and run `migrate:up` → the failing migration does not get recorded; you can fix the file and run again.

**Docs to update:** [DATABASE_RECOVERY.md](../01-HIGH/DATABASE_RECOVERY.md), [CI_CD_SETUP.md](../01-HIGH/CI_CD_SETUP.md) — add a "Run migrations" step (e.g. "Before or after deploy, run `npm run migrate:up` against the target DB") and an optional CI job that runs migrations against staging.

---

### 2. Fix Failing Tests

**What it is:** Getting all tests to pass so CI is green and regressions are caught.  
**What it does:** Restores confidence in the codebase and unblocks PRs.  
**How we use it:** Run `npm test`, fix failures by category (env, DB, mocks, assertions); re-run until 100% pass; see REMAINING_ISSUES_STEPS for detailed steps.

*Failing tests mean CI can be red and you cannot trust that new code is safe. Fixing them restores confidence and lets you catch regressions before deploy.*

**Goal:** Get to 100% test pass rate so CI is green and regressions are caught.

**Why this matters:** When tests fail, you either ignore CI (risky) or block every PR until someone fixes them. Fixing failures unblocks the team and restores the value of the test suite—every green run gives confidence that the codebase is in a known-good state.

**Steps (with detail):**

1. **Identify failures**
   ```bash
   npm test 2>&1 | tee test-output.txt
   ```
   Open `test-output.txt` and note:
   - **File and test name** — e.g. `src/tests/integration/v4Features.test.ts` and the description string (e.g. "should create a job").
   - **Error message** — e.g. "Expected 200, received 500", "Cannot read property 'id' of undefined", "connect ECONNREFUSED", or "Timeout".
   - **Stack trace** — points to the line in your code or test that failed.

2. **Fix by category**
   - **Environment:** Missing env vars (e.g. `DATABASE_URL`, `JWT_SECRET`) cause "undefined" or connection errors. Fix: create `.env.test` with test-only values (or use a test DB URL) and load it in Jest `setupFilesAfterEnv` or in a `setup.ts` that runs before tests. Ensure CI has the same vars (e.g. GitHub Actions secrets).
   - **Database:** "relation does not exist" or "column does not exist" means the test DB schema is out of date. Fix: run `npm run migrate:up` against the test DB once (or run migrations in CI before tests; see [CI_CD_SETUP.md](../01-HIGH/CI_CD_SETUP.md)). Use a separate test DB so you don't affect dev data.
   - **Mocks:** Stripe/SendGrid/Twilio errors or "real" API calls in tests mean the module isn't mocked. Fix: add `jest.mock('stripe')`, `jest.mock('@sendgrid/mail')`, etc. at the top of the test file (or in a shared setup), and ensure the mock returns the shape the code expects. Check `src/tests/mocks/` for existing mocks and reuse or extend them.
   - **Assertions:** "Expected 200, received 404" or "Expected body to have property X" means the API or response shape changed. Fix: open the real endpoint in Swagger or [API_EXACT_ENDPOINTS.md](API_EXACT_ENDPOINTS.md), then update the test to match (status code, body shape, headers). Avoid changing the API just to make a test pass unless the API was wrong.
   - **Timing/async:** Flaky tests that sometimes pass and sometimes fail are usually due to async operations (e.g. waiting for a job to run). Fix: use `waitFor` or `await` on the specific condition; avoid arbitrary `setTimeout`. Prefer deterministic data (fixed IDs, dates) so order and timing don't vary.

3. **Run subsets**
   ```bash
   npm test -- src/tests/integration/v4Features.test.ts
   npm test -- src/tests/unit
   ```
   Running a single file or directory speeds up the fix–run cycle. Once the subset passes, run the full suite to ensure you didn't break another test.

4. **Verification**
   - Run `npm test` → exit code 0 and "Tests: X passed" (or similar).
   - Push to a branch and open a PR → CI (e.g. `.github/workflows/test.yml`) runs and is green. If CI uses a different env (e.g. no `DATABASE_URL`), fix CI config or provide test secrets.

**Docs:** [PRODUCTION_READINESS_ROADMAP.md](../00-CRITICAL/PRODUCTION_READINESS_ROADMAP.md) (Fix Failing Tests section), [REMAINING_ISSUES_STEPS.md](REMAINING_ISSUES_STEPS.md) (step-by-step for tests and typecheck).

---

### 3. Runbooks

**What it is:** Step-by-step docs for restore-from-backup, handle-incident, and rollback-deploy.  
**What it does:** Lets anyone (or on-call) perform critical ops without guessing.  
**How we use it:** Keep runbooks in `docs/runbooks/`; follow them during incidents; update when procedures change.

*Runbooks are step-by-step instructions for common operations (restore from backup, handle an incident, rollback a deploy). They let anyone on the team perform these tasks without guessing.*

**Goal:** Short, actionable runbooks so anyone can perform common operations (restore, incident, rollback) without guessing.

**Create these in `docs/runbooks/` (or `docs/active/01-HIGH/runbooks/`):**

#### 3.1 Restore from backup

- **What this runbook is for:** Use it when you need to restore the database from a backup—e.g. data loss, a bad migration that can't be fixed forward, or corruption. It answers: when to restore, who can do it, and the exact steps so anyone (or on-call) can execute without guessing.
- **When to restore:** (1) Data loss (accidental delete, bad script). (2) Bad migration that broke the app and you don't have a safe fix-forward. (3) Corruption or unrecoverable DB failure. Always confirm with team/product owner before restoring; restoring overwrites current data.
- **Steps to document:**
  1. **Confirm** — Get agreement from team/product owner that restore is the right action and which point-in-time (if using PITR) or backup to use.
  2. **Open procedure** — Open [BACKUP_RESTORE_PROCEDURE.md](../01-HIGH/BACKUP_RESTORE_PROCEDURE.md) and [docs/runbooks/restore-from-backup.md](../../runbooks/restore-from-backup.md) for full steps.
  3. **Neon restore** — In Neon Console: Project → Backups → choose "Restore to new branch" (recommended so you don't overwrite current branch) or restore in place per Neon docs. Note the new connection string if you created a branch.
  4. **Point app** — If you restored to a new branch, set the app's `DATABASE_URL` to the new branch URL (e.g. in Railway env vars) and redeploy or restart so the app uses the restored DB. Run `npm run migrate:status` to confirm schema matches (pending should be 0 if migrations were already applied to the backup).
  5. **Smoke-check** — Run critical flows: login, create or fetch one job, one payment. Confirm no 500s and data looks correct.
  6. **Notify** — Tell the team restore is complete; update status page or Slack if users were affected.
- **Link:** [BACKUP_RESTORE_PROCEDURE.md](../01-HIGH/BACKUP_RESTORE_PROCEDURE.md), [DATABASE_RECOVERY.md](../01-HIGH/DATABASE_RECOVERY.md), [docs/runbooks/restore-from-backup.md](../../runbooks/restore-from-backup.md).

#### 3.2 Handle a production incident

- **What this runbook is for:** Use it when production is broken or degraded—errors spiking, app down, or users reporting issues. It walks through: how to detect the incident, who responds, how to triage and mitigate, and how to communicate.
- **When to use:** Sentry alert spike, UptimeRobot down, or user reports (e.g. "can't log in", "payments failing"). The on-call person (or whoever is designated) should follow this runbook so response is consistent.
- **Steps to document:**
  1. **Acknowledge** — In Sentry/Opsgenie/PagerDuty (or manually in Slack), acknowledge the incident so the team knows someone is on it.
  2. **Triage** — Determine if the backend is involved: Call `GET /health` and `GET /health/ready` (e.g. `curl https://api.yoursite.com/health/ready`). If ready fails, the app or DB is unhealthy. Check Sentry for a spike in errors or a new high-impact issue; check recent deploys (did we just ship?).
  3. **Mitigate** — If a recent deploy likely caused it, follow the [Rollback runbook](#33-rollback-a-deploy). If it's a resource issue (e.g. out of memory), scale up or restart the app. If it's a known bug, fix forward (deploy a patch) if you can do so safely; otherwise rollback first.
  4. **Communicate** — Post in Slack (or status page) that you're investigating or that a fix is in progress. When resolved, post that the incident is over and a post-mortem will follow.
  5. **Post-incident** — Write a short blameless summary (what happened, what you did, what you'll do to prevent or detect next time). Update this runbook if you found a gap.
- **Link:** [SECURITY_INCIDENT_RESPONSE.md](../00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md), [MONITORING_SETUP.md](../00-CRITICAL/MONITORING_SETUP.md), [docs/runbooks/handle-incident.md](../../runbooks/handle-incident.md).

#### 3.3 Rollback a deploy

- **What this runbook is for:** Use it when a deploy caused errors or regression and you need to revert to the previous working version quickly. It answers: when to rollback, how to do it on your host (e.g. Railway), and what to do about database migrations.
- **When to rollback:** Error rate above your threshold (e.g. > 5%), critical bug (e.g. login broken), or failed migration that broke the app. Prefer rollback over "fix forward" when the fix is uncertain or will take long.
- **Steps to document:**
  1. **Decide** — Confirm rollback is the right move (e.g. compare error rate before/after deploy; check Sentry for new issues tied to the release).
  2. **Redeploy previous** — On Railway: Deployments → select the last known-good deployment → "Redeploy" (or use Railway CLI). On other hosts, use their "rollback" or "revert to previous" action. This restores the previous code and process.
  3. **Database migrations** — If you ran a migration in this deploy: usually **leave the DB as-is** (the previous code may still work with the new schema, or you can fix-forward later). Only run a "down" migration if you have one that is safe and tested (e.g. in staging). Document in the runbook: "We do not run down migrations by default; see ARCHITECTURE or DB runbook."
  4. **Verify** — Call `/health` and `/health/ready`; check Sentry to confirm error rate drops. Smoke-check one critical flow (e.g. login).
  5. **Notify and document** — Notify the team that rollback is done. Write a short incident note (what you rolled back, why) and link to the runbook.

**Verification:** Someone unfamiliar can follow each runbook and complete the steps (in staging if possible).

**Docs to update:** [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) — add "Runbooks" section linking to these.

---

## MEDIUM PRIORITY

**What it is:** Items that improve alerting, staging/CI, load testing, and API testing (Postman).  
**What it does:** Improves incident response, deploy quality, and visibility into performance and API behavior.  
**How we use it:** Do after HIGH; configure Sentry/UptimeRobot alerts, optional staging deploy, run k6, generate Postman collection.

*Medium-priority items improve incident response (alerting), deploy quality (staging + migrations in CI), performance visibility (load test), and API testing (Postman).*

### 4. Error Alerting
**What it is:** Configuring Sentry and UptimeRobot to notify someone when errors spike or the app goes down.  
**What it does:** Ensures we respond to incidents instead of discovering them from users.  
**How we use it:** In Sentry create alert rules; in UptimeRobot add alert contacts and attach to monitors; see MONITORING_SETUP.

**Goal:** Get notified when errors spike or the app is down (e.g. PagerDuty, Opsgenie, or Slack) so someone can respond quickly instead of learning from user complaints.

**Why this matters:** Without alerting, you may not notice an outage or error spike until users report it. Configuring Sentry and UptimeRobot to send alerts (email, Slack, or PagerDuty) gives you a chance to fix issues before they escalate.

**Steps (with detail):**

1. **Sentry alerts**
   - Go to Sentry → your project → **Alerts** → **Create Alert** (or **Alert Rules**).
   - **Rule type:** Choose e.g. "When the number of events in an issue is above 50 in 1 hour" or "When an issue is first seen" (every new issue triggers once). Adjust thresholds to your traffic (e.g. 10 events in 15 minutes for a small app).
   - **Action:** Add your email and/or a webhook. For Slack: create an Incoming Webhook in your Slack workspace, copy the URL, and add it in Sentry as a webhook; Sentry will POST to that URL when the rule fires. For PagerDuty: create a PagerDuty service and add the "Sentry" integration; Sentry will send events to PagerDuty.
   - **Save** the rule. Optionally add a second rule for "When the number of events is above X in 5 minutes" for faster reaction to spikes.

2. **UptimeRobot**
   - Setup is already documented in [MONITORING_SETUP.md](../00-CRITICAL/MONITORING_SETUP.md). Ensure you have at least one HTTP(s) monitor pointing at your app's `/health` or root URL.
   - Go to **Alert Contacts** → **Add Alert Contact**. Add email and/or Slack webhook (or PagerDuty). Attach this contact to your monitor(s) so when the monitor fails (e.g. 3 consecutive failures), UptimeRobot sends an alert.

3. **Optional: PagerDuty/Opsgenie**
   - Use when you need on-call rotation and escalation (e.g. wake someone at 2am). Create a service, connect Sentry and UptimeRobot via their integrations, and set a schedule so someone is always on call.

**Verification:** Trigger a test error in the app (e.g. hit an endpoint that throws) or temporarily pause the app; within a few minutes you should receive an email, Slack message, or PagerDuty incident. If not, check Sentry/UptimeRobot alert config and webhook URLs.

---

### 5. Staging Deploy + Migration in CI

**What it is:** A staging environment that deploys on push and runs migrations so we can test code + schema before production.  
**What it does:** Gives a production-like environment for smoke tests and migration verification.  
**How we use it:** Create staging app and DB on Railway/Neon; deploy on push to staging branch; run `migrate:up` in CI or on deploy; see CI_CD_SETUP.

*Staging lets you test code and schema changes together before production. Running migrations in CI or on deploy keeps the staging DB in sync with the app.*

**Goal:** Every push to a staging branch (or main) deploys to a staging environment; the staging DB has the latest schema so you can test full flows (including new columns/tables) before production.

**Why this matters:** Without staging, you test only locally or in production. Staging gives you a production-like environment (same host, same DB type) where you can run migrations and smoke-test before releasing. Running migrations as part of deploy or CI ensures the staging DB never gets out of sync with the code.

**Steps (with detail):**

1. **Staging environment**
   - Create a second app on Railway (or your host)—e.g. "puretask-staging". Create a separate database (e.g. a Neon branch "staging" or a second Neon project). Set env vars for the staging app: `DATABASE_URL` (staging DB), `NODE_ENV=staging`, same Stripe/SendGrid keys for test mode if you use them. **Do not** use production secrets (e.g. production Stripe live keys) in staging.

2. **Deploy on push**
   - **Railway:** In the staging service, connect the repo and set the "Production" branch to e.g. `staging` or `develop` so every push to that branch deploys to staging. Keep production on `main` (or another branch). Alternatively use GitHub Actions: on push to `staging`, run Railway CLI or call Railway API to trigger a deploy.
   - **Result:** Pushing to the staging branch updates the staging app within a few minutes; you can test the new code there.

3. **Migrations in CI / deploy**
   - **Option A (CI job):** Add a GitHub Actions job that runs on push to `staging` (or after build): set `DATABASE_URL` from a secret (staging DB URL), run `npm run migrate:up`. Then trigger the deploy (or let deploy happen in a separate step). This way migrations run before or with the new code.
   - **Option B (Deploy script):** In your host's deploy command, run `npm run migrate:up` then `npm start` (e.g. `npm run migrate:up && npm start`). The migration runs on each deploy against the staging DB. Document this in [CI_CD_SETUP.md](../01-HIGH/CI_CD_SETUP.md) so the team knows migrations run automatically on staging.

4. **Verification**
   - Push a change to the staging branch. Confirm the staging app redeploys and the staging DB has the latest schema: e.g. run `npm run migrate:status` locally with `DATABASE_URL=staging_url` and see 0 pending. Hit staging's `/health/ready` and a few API endpoints to confirm the app and DB work together.

---

### 6. Load Testing (Run k6)

**What it is:** Running k6 (or similar) against the API to measure latency, RPS, and error rate under load.  
**What it does:** Establishes a baseline so we can alert and compare after changes.  
**How we use it:** Install k6; run against staging or local; record p95, RPS, error rate; see PERFORMANCE_TESTING.

*Load testing tells you how the app behaves under load (latency, error rate, throughput). A baseline lets you compare later runs and plan scaling.*

**Goal:** Establish a performance baseline (e.g. p95 latency, requests per second, error rate) and find bottlenecks before traffic grows.

**Why this matters:** Without load testing, you don't know how many concurrent users or requests the app can handle, or where it will break (DB, CPU, memory). A baseline gives you numbers to alert on (e.g. "p95 &gt; 500ms") and to compare after code or infra changes.

**Steps (with detail):**

1. **Install k6**
   - See [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md) for install (e.g. Windows: `choco install k6`; macOS: `brew install k6`). Verify with `k6 version`.

2. **Run a simple scenario**
   - **VUs (virtual users):** Number of concurrent simulated users. Start with 10–50 VUs for 1–2 minutes so you don't overload a small app.
   - Example: `GET /health` (no auth) and, if you have a test token, `GET /jobs` (with auth). Run against local or staging, not production. Example command: `k6 run --vus 20 --duration 1m script.js` (see PERFORMANCE_TESTING.md for script structure).
   - **What to watch:** k6 outputs http_req_duration (e.g. avg, p95), http_reqs (count and rate), and failures. p95 = 95% of requests completed within this duration; RPS = requests per second.

3. **Record results**
   - Note p95 latency (e.g. 120ms), error rate (e.g. 0%), and RPS (e.g. 200). Save in `docs/active/02-MEDIUM/k6-baseline.txt` or in the repo so you can compare later. Example format: "Baseline 2026-01-31: 20 VUs, 1m; p95=120ms, RPS=200, errors=0%."

4. **Optional:** Add a k6 job in CI that runs against staging on every PR or nightly; fail the job if error rate &gt; 0 or p95 &gt; a threshold (e.g. 500ms) so regressions are caught.

**Doc:** [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md).

---

### 7. Postman Collection

**What it is:** A Postman collection generated from OpenAPI or a script so we can call the API from a UI.  
**What it does:** Lets frontend and QA test endpoints without reading code; useful for demos and regression.  
**How we use it:** Run `npm run docs:postman` (or import from `/api-docs/json`); import into Postman; share the file in repo.

*A Postman collection lets you (and the frontend) call the API from a UI, share requests, and test flows without writing code. It is generated from the OpenAPI spec or a script.*

**Goal:** One-click import for API testing and sharing with frontend so anyone can run requests (auth, jobs, payments) without reading code or Swagger only.

**Why this matters:** Postman is familiar to many developers and QA; a shared collection ensures everyone tests the same endpoints with the same structure. It's also useful for manual regression testing and demos.

**Steps (with detail):**

1. **Export from OpenAPI**
   - Start the app (e.g. `npm start`) and open `http://localhost:4000/api-docs/json` (or your staging/production OpenAPI URL) in a browser; the JSON is the full OpenAPI spec.
   - In Postman: **Import** → **Link** → paste the URL (or **Upload** a downloaded JSON file). Postman will create a collection from the spec (one request per endpoint).
   - **Or** use the existing script: `npm run docs:postman` (if configured) generates `postman/PureTask-API.postman_collection.json`; then in Postman use **Import** → **Upload** that file.

2. **Optional:** In Postman, create an **Environment** with variables e.g. `BASE_URL` = `https://api.yoursite.com` and `JWT` = a test token. Use `{{BASE_URL}}/jobs` in requests so you can switch between local/staging/prod. Save the collection (and optionally the environment) in the repo under `postman/` or `docs/` so the team can import the same file.

**Verification:** Import the collection into Postman; run a few requests (e.g. GET /health, POST /auth/login with test credentials, GET /jobs with the token in the Authorization header). Confirm you get 200 and expected body shape.

---

## LOW PRIORITY (Optional)

**What it is:** Good practices (pen test, key rotation, ADRs, etc.) that are not required to launch.  
**What it does:** Improves long-term security and maintainability when we have capacity.  
**How we use it:** Add when compliance or team capacity allows; use the "What done looks like" column below.

*Low-priority items are good practices but not required to launch. Add them when you have capacity or when compliance (e.g. pen test, retention policy) requires them. For each item we describe what "done" looks like.*

| Item | Action | What "done" looks like |
|------|--------|------------------------|
| **Penetration testing** | Engage external firm; scope: auth, payments, API abuse. | You have a report from the firm; critical/high findings are remediated or accepted with a written rationale; report is stored securely. |
| **API key rotation schedule** | Document in [SECURITY_GUARDRAILS.md](../00-CRITICAL/SECURITY_GUARDRAILS.md): e.g. rotate Stripe/JWT/DB every 90 days; use [SECURITY_INCIDENT_RESPONSE.md](../00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md) if exposed. | The doc states which keys to rotate and how often; first rotation (or "next rotation by date") is scheduled; team knows where to look if a key is exposed. |
| **Audit logging** | Log sensitive ops (e.g. delete user, payout, override) to a table or log stream; queryable for compliance. | Every sensitive action writes a row (who, what, when, optional context); you can query "who deleted user X" or "who approved payout Y". |
| **Data retention policy** | Document in [GDPR_COMPLIANCE.md](../01-HIGH/GDPR_COMPLIANCE.md): how long you keep logs, backups, PII; when you delete or anonymize. | The doc states retention periods (e.g. logs 90 days, backups 30 days, PII until account deletion) and any automated cleanup; legal/product has approved. |
| **ADRs** | Create `docs/adr/` and add short Architecture Decision Records for major choices (e.g. "Why Neon", "Why Sentry"). | You have at least one ADR (e.g. `001-neon-database.md`) with context, decision, and consequences; new major decisions get an ADR. |
| **API changelog** | Maintain `CHANGELOG.md` or `docs/api-changelog.md` with version and breaking changes when you release. | Each release has an entry with date and list of changes; breaking changes are clearly marked so frontend/partners can adapt. |
| **Developer onboarding** | Expand [CONTRIBUTING.md](../03-LOW/CONTRIBUTING.md) and [ARCHITECTURE.md](ARCHITECTURE.md) with "Day 1" setup (clone, env, migrate, test, run). | A new dev can clone, copy `.env.example` to `.env`, run `npm run migrate:up`, `npm test`, and `npm start` and get a running app; doc is linked from README or DOCUMENTATION_INDEX. |

---

## Checklist: Track Your Progress

**What it is:** A tick-list of HIGH, MEDIUM, and LOW items so we don't forget anything.  
**What it does:** Tracks progress and unblocks production confidence (HIGH) and operations (MEDIUM).  
**How we use it:** Copy into your task list or tick items in this doc as you complete them.

*Copy this checklist into your task list or tick items in this doc as you complete them. HIGH items unblock production confidence; MEDIUM items improve operations; LOW items are optional.*

Copy this into your task list or tick in the doc:

**HIGH**
- [ ] Migration runner implemented and documented
- [ ] All tests passing (`npm test`)
- [ ] Runbooks: Restore from backup, Handle incident, Rollback deploy

**MEDIUM**
- [ ] Error alerting (Sentry + UptimeRobot → Slack or PagerDuty)
- [ ] Staging deploy + migration in CI
- [ ] Load test run and baseline recorded
- [ ] Postman collection exported/imported

**LOW**
- [ ] API key rotation schedule documented
- [ ] Audit logging for sensitive ops (if required)
- [ ] Data retention policy documented
- [ ] ADRs / API changelog / onboarding (as needed)

---

## Quick Links

**What it is:** Shortcuts to related docs (gap analysis, roadmap, backup, recovery, monitoring, CI).  
**What it does:** Lets you jump to the right doc without searching.  
**How we use it:** Use when you need the full gap list, restore steps, incident response, or CI setup.

- [COMPREHENSIVE_GAP_ANALYSIS.md](COMPREHENSIVE_GAP_ANALYSIS.md) — full gap list and reanalysis
- [PRODUCTION_READINESS_ROADMAP.md](../00-CRITICAL/PRODUCTION_READINESS_ROADMAP.md) — original roadmap
- [BACKUP_RESTORE_PROCEDURE.md](../01-HIGH/BACKUP_RESTORE_PROCEDURE.md) — restore steps
- [DATABASE_RECOVERY.md](../01-HIGH/DATABASE_RECOVERY.md) — DB recovery
- [SECURITY_INCIDENT_RESPONSE.md](../00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md) — incident and secret rotation
- [MONITORING_SETUP.md](../00-CRITICAL/MONITORING_SETUP.md) — Sentry, metrics, UptimeRobot
- [CI_CD_SETUP.md](../01-HIGH/CI_CD_SETUP.md) — GitHub Actions
- [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md) — k6 and benchmarks

---

---

## What Was Done (2026-01-31)

**What it is:** A record of what was completed in the 2026-01-31 pass (migration runner, runbooks, etc.).  
**What it does:** Shows what is already done so we don't duplicate work.  
**How we use it:** Reference when planning; items marked DONE are in place; items marked DO LOCALLY or optional need your action.

### 1. Migration runner — DONE
**What it is:** The migration runner script and npm scripts that were added.  
**What it does:** Lets us run migrations with `migrate:status` and `migrate:up`.  
**How we use it:** Run `npm run migrate:status` and `npm run migrate:up` when DATABASE_URL is set.
- **Added:** `scripts/migrate-runner.js` — lists `DB/migrations/*.sql` and `DB/migrations/hardening/*.sql`, tracks applied in `schema_migrations`, runs pending on `up`.
- **Added to package.json:** `migrate:status`, `migrate:up`, `migrate:create-schema`.
- **Run:** `npm run migrate:status` (no DB required); `npm run migrate:up` (requires `DATABASE_URL`).

### 2. Fix failing tests — DO LOCALLY
**What it is:** The remaining work to get all tests passing (run locally).  
**What it does:** Unblocks CI and restores confidence in the suite.  
**How we use it:** Run `npm test` locally; fix env/DB/mocks/assertions; re-run until all pass.

- Jest cannot run in this sandbox (spawn EPERM). Run `npm test 2>&1 | tee test-output.txt` locally, fix failures by env/DB/mocks/assertions, then re-run until all pass.

### 3. Runbooks — DONE
**What it is:** The runbooks that were added (restore, incident, rollback).  
**What it does:** Gives step-by-step instructions for critical ops.  
**How we use it:** Follow `docs/runbooks/` during incidents; update when procedures change.

- **Added:** `docs/runbooks/restore-from-backup.md`, `docs/runbooks/handle-incident.md`, `docs/runbooks/rollback-deploy.md`.
- Each has checklists, steps, and links to BACKUP_RESTORE_PROCEDURE, DATABASE_RECOVERY, MONITORING_SETUP, SECURITY_INCIDENT_RESPONSE.

### 4–7. Alerting, staging, k6, Postman
**What it is:** Remaining MEDIUM items (alerting, staging, k6, Postman) and how to do them.  
**What it does:** Tells you what to configure or run for each.  
**How we use it:** Configure Sentry/UptimeRobot for alerting; add staging and k6/Postman when ready; see MONITORING_SETUP and PERFORMANCE_TESTING.

- **Alerting:** Configure in Sentry (Alerts → webhook/Slack) and UptimeRobot (Alert Contacts). No code change.
- **Staging/CI:** Document in CI_CD_SETUP when you add staging; optional.
- **k6:** Run locally per PERFORMANCE_TESTING.md.
- **Postman:** Use `npm run docs:postman` or import from `/api-docs/json`.

---

**Last Updated:** 2026-01-31
