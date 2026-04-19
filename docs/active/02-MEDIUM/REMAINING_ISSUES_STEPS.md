# How to Complete the Remaining Issues

**Last updated:** 2026-01-31  
**Purpose:** Step-by-step instructions to finish the remaining production-readiness items.  
**Related:** [ADDRESS_REMAINING_GAPS.md](ADDRESS_REMAINING_GAPS.md) | [COMPREHENSIVE_GAP_ANALYSIS.md](COMPREHENSIVE_GAP_ANALYSIS.md)

---

## What This Guide Is

**What it is:** A step-by-step guide for the remaining production-readiness items (tests, typecheck, ESLint, alerting, migrations, k6, staging, optional).  
**What it does:** Gives concrete steps and "how you know you're done" for each item.  
**How we use it:** Work through Remaining Issues in order; use with ADDRESS_REMAINING_GAPS and COMPREHENSIVE_GAP_ANALYSIS for full context.

This guide lists **only the work left to do** after the migration runner, runbooks, and Postman script were added. For each remaining item it explains **why it matters**, then gives **concrete steps** and **how you know you're done**. Use it when you want to close the remaining gaps one by one. For the full list of gaps (including what is already done), see [COMPREHENSIVE_GAP_ANALYSIS.md](COMPREHENSIVE_GAP_ANALYSIS.md) and [ADDRESS_REMAINING_GAPS.md](ADDRESS_REMAINING_GAPS.md).

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

## What's Already Done

- **Migration runner** — `scripts/migrate-runner.js`; `npm run migrate:status`, `npm run migrate:up`
- **Runbooks** — `docs/runbooks/restore-from-backup.md`, `handle-incident.md`, `rollback-deploy.md`
- **Postman** — `npm run docs:postman` generates `postman/PureTask-API.postman_collection.json`
- **Error-alerting steps** — In [MONITORING_SETUP.md](../00-CRITICAL/MONITORING_SETUP.md) (Sentry + UptimeRobot)
- **CI migrations** — In [CI_CD_SETUP.md](../01-HIGH/CI_CD_SETUP.md)

---

## Remaining Issues (in order)

**What it is:** The list of work left to do (fix tests, typecheck, ESLint, alerting, migrations, k6, staging, optional).  
**What it does:** Orders items by impact so we fix tests/typecheck first, then alerting/migrations, then load test/staging.  
**How we use it:** Work through each subsection below in order; follow the steps and verification bullets.

*Items are ordered by impact: fixing tests and typecheck unblocks CI and daily development; alerting and migrations improve production safety; load testing and staging are next.*

### 1. Fix failing tests

**What it is:** Getting all tests to pass so CI is green and regressions are caught.  
**What it does:** Restores confidence in the codebase and unblocks PRs.  
**How we use it:** Run `npm test`, fix by env/DB/mocks/assertions; re-run until 100% pass; confirm CI is green.

**Why it matters:** When tests fail, CI can be red and you cannot trust that new changes are safe. Fixing them restores confidence and lets you catch regressions before deploy. A green test suite is the baseline for safe refactors and new features.

**Goal:** `npm test` passes so CI stays green.

**Steps (with detail):**

1. **Run tests and capture output**
   ```bash
   npm test 2>&1 | tee test-output.txt
   ```
   This runs the full suite and saves stdout/stderr to `test-output.txt` so you can review failures without re-running.

2. **Open `test-output.txt`** — For each failure note:
   - **File and test name** — e.g. `src/tests/integration/v4Features.test.ts`, test description "should create a job".
   - **Error type** — e.g. "Expected 200, received 500", "connect ECONNREFUSED", "Timeout of 5000ms exceeded", "Cannot read property 'id' of undefined".
   - **Stack trace** — points to the line in the test or app code that failed.

3. **Fix by cause:**
   - **Missing env:** If you see "DATABASE_URL is not defined", "JWT_SECRET is required", or connection refused to DB, set env in Jest. In `jest.config.js` or `package.json` Jest section, add `setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts']` and in that file set `process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://...'` (use a test DB URL). Or create `.env.test` and load it in setup (e.g. `dotenv.config({ path: '.env.test' })`). Ensure CI has the same vars (GitHub Actions: Secrets or env in workflow).
   - **DB not ready:** "relation X does not exist" or "column Y does not exist" means the test DB schema is out of date. Point tests at a dedicated test DB, run `npm run migrate:up` once with that DB's URL, then re-run tests. In CI, add a step that runs migrations before tests (see [CI_CD_SETUP.md](../01-HIGH/CI_CD_SETUP.md)).
   - **Mocks:** "Stripe is not a function" or real HTTP calls in tests mean the module isn't mocked. At the top of the test file (or in a shared setup), add `jest.mock('stripe')` (or the path your code uses to import Stripe). Ensure the mock returns the shape the code expects (e.g. `stripe.customers.create` resolves to `{ id: 'cus_...' }`). Check `src/tests/mocks/` for existing mocks; reuse or extend them.
   - **Wrong assertions:** "Expected status 200, received 404" or "Expected object to have property 'id'" means the API or response changed. Open `/api-docs` or [API_EXACT_ENDPOINTS.md](../API_EXACT_ENDPOINTS.md), call the endpoint manually if needed, then update the test's expected status and body to match. Don't change the API only to satisfy the test unless the API was wrong.
   - **Flakiness:** Tests that pass sometimes and fail sometimes are often due to async timing. Prefer deterministic data (fixed IDs, dates). Use `waitFor` or `await` on the specific condition (e.g. "until element appears") instead of a fixed `setTimeout`. Increase timeout only as a last resort and document why.

4. **Re-run**
   ```bash
   npm test
   npm test -- src/tests/integration/v4Features.test.ts   # single suite
   ```
   Run the full suite after fixes to ensure you didn't break another test. Use the single-file form to iterate quickly on one failing suite.

5. **Done when:** `npm test` exits with code 0 and the summary shows all tests passed. Push to a branch and confirm CI (e.g. `.github/workflows/test.yml`) is green.

---

### 2. Fix TypeScript errors

**Why it matters:** TypeScript errors mean the type checker has found mismatches (e.g. Promise vs value, missing exports). Fixing them prevents runtime bugs and keeps the codebase consistent.

**Goal:** `npm run typecheck` passes.

**Steps:**

1. **Run typecheck**
   ```bash
   npm run typecheck 2>&1 | tee typecheck-output.txt
   ```
2. **Fix each error in the output:**
   - **`Module has no exported member 'X'`** (e.g. n8nClient) — Export `X` from that module or change the import to what's actually exported.
   - **`Type 'Promise<AuthUser>' is not assignable to type 'AuthUser'`** — The code returns a Promise but the type expects AuthUser. Use `async` and `return await ...` or ensure the caller `await`s and the return type is `Promise<AuthUser>`.
   - **`Property 'role' does not exist on type 'Promise<AuthUser>'`** — You're using `user.role` where `user` is a Promise. Use `(await user).role` or assign `const u = await user` then use `u.role`.
   - **`Type 'number | null' is not assignable to type 'number'`** — Add a null check or default (e.g. `x ?? 0`) or change the type to `number | null` where appropriate.
   - **Stripe API version** — If the error says the Stripe API version type is wrong, update the `@types/stripe` or the `apiVersion` in code to match the version you use.
3. **Re-run**
   ```bash
   npm run typecheck
   ```
4. **Done when:** `npm run typecheck` exits 0 with no errors.

**Files that often need fixes:** `src/lib/auth.ts`, `src/middleware/authCanonical.ts`, `src/middleware/jwtAuth.ts`, `src/integrations/n8n.ts`, `src/integrations/stripe.ts`, `src/lib/queue.ts`, routes using `AuthedRequest` (ensure `req.user` is set by middleware so it's not `undefined`).

---

### 3. Fix or relax ESLint so lint passes

**Why it matters:** Lint enforces style and rules (e.g. no restricted imports, no raw SQL in strings). Passing lint keeps the codebase consistent and can block bad patterns; you can relax rules for tests or config if that is intentional. CI often runs lint, so fixing or relaxing keeps PRs unblocked.

**Goal:** `npm run lint` passes (or only acceptable warnings).

**Steps (with detail):**

1. **Run lint**
   ```bash
   npm run lint 2>&1 | tee lint-output.txt
   ```
   Open `lint-output.txt` and note each file and rule that fails.

2. **Two kinds of issues:**
   - **"TSConfig does not include this file"** — ESLint's TypeScript parser only runs on files in `tsconfig.json`'s `include`. Fix: Either add that path to `tsconfig.json` `include`, or add it to ESLint `ignorePatterns` in `.eslintrc.json` (e.g. `"src/__tests__/**"`, `"docs/**"`) so ESLint doesn't try to type-check it. For test files, ignoring is often acceptable.
   - **Rule violations** (e.g. `no-restricted-imports`, `no-restricted-syntax`, `no-console`) — Either fix the code: use the allowed import (e.g. don't import from `../db` in routes; use the canonical path), avoid template literals for raw SQL (use parameterized queries), use a logger instead of `console.log`. Or relax the rule for that path (e.g. `"no-console": "off"` in an override for `**/tests/**`) if the violation is intentional (e.g. tests may use console for debugging).
3. **Use overrides in `.eslintrc.json`** to exclude or relax rules for tests and config:
   ```json
   "overrides": [
     { "files": ["src/__tests__/**", "src/tests/**"], "rules": { "no-restricted-imports": "off", "no-restricted-syntax": "off", "no-console": "off" } },
     { "files": ["src/config/**"], "rules": { "no-restricted-syntax": "off" } }
   ]
   ```
   Adjust file patterns and rules to match what you want.
4. **Re-run**
   ```bash
   npm run lint
   ```
5. **Done when:** `npm run lint` exits 0 (or with only agreed warnings).

---

### 4. Turn on error alerting

**What it is:** Configuring Sentry and UptimeRobot to notify someone when errors spike or the app goes down.  
**What it does:** Ensures we respond to incidents instead of discovering them from users.  
**How we use it:** In Sentry create alert rules and webhook/Slack; in UptimeRobot add alert contacts; test with a fake error or pause.

**Why it matters:** Without alerting, you may not notice outages or error spikes until users complain. Sentry and UptimeRobot alerts (email or Slack) let you react quickly.

**Goal:** You get notified when the app errors or goes down.

**Steps:**

1. **Sentry**
   - Open Sentry → your project → **Alerts** → **Create Alert** (or **New Alert Rule**).
   - Rule: e.g. "When event count is above 50 in 1 hour" or "When an issue is first seen." Adjust threshold to your traffic.
   - Action: Add your email or a webhook (Slack Incoming Webhook URL, or PagerDuty integration).
   - Save.
2. **UptimeRobot**
   - UptimeRobot setup is in [MONITORING_SETUP.md](../00-CRITICAL/MONITORING_SETUP.md). Ensure you have at least one monitor pointing at `/health` or your API root.
   - In UptimeRobot: **Alert Contacts** → Add (email, Slack webhook, or PagerDuty). Attach that contact to your monitor(s).
3. **Done when:** Trigger a test error or pause the app; within a few minutes you receive an email, Slack message, or PagerDuty incident. If not, check webhook URLs and that the alert rule/contact is attached to the right project/monitor.

---

### 5. Run migrations on a real DB (when ready)

**What it is:** Running `npm run migrate:up` against a real DB (dev/staging first, then prod) so schema matches code.  
**What it does:** Avoids "column does not exist" or "table does not exist" when the app runs.  
**How we use it:** Set DATABASE_URL for dev/staging; run migrate:status then migrate:up; verify; repeat for prod when ready.

**Why it matters:** The migration runner tracks which SQL files have been applied in `schema_migrations`. Running `migrate:up` on a real DB brings the schema in line with the code and avoids "column does not exist" or "table does not exist" errors when the app runs. Doing this first on dev/staging reduces risk for production.

**Goal:** Apply pending migrations in a controlled way so the DB schema matches what the code expects.

**Steps (with detail):**

1. **Use a non-production DB first** (e.g. dev or staging). Do not run against production until you've run against at least one other environment and confirmed the app works.

2. **Set `DATABASE_URL`** for that DB (e.g. in your shell: `export DATABASE_URL=postgresql://...` or in `.env`). Ensure the URL has write access (the runner will create `schema_migrations` and run INSERTs).

3. **Check status**
   ```bash
   npm run migrate:status
   ```
   You should see two sections: **Applied** (migrations already in `schema_migrations`) and **Pending** (migration files on disk that are not yet applied). If the DB is new, Applied may be empty and Pending will list all files in `DB/migrations/` and `DB/migrations/hardening/`.

4. **Apply pending**
   ```bash
   npm run migrate:up
   ```
   The runner runs each pending migration in order, inside a transaction. After each successful migration it inserts the migration name into `schema_migrations`. If one migration fails, the transaction is rolled back and no further migrations run; fix the SQL and run again.

5. **Re-run `migrate:status`** — Pending should now be 0 (or empty); Applied should list all migrations that were just run. The applied count should have increased by the number of pending files you had.

6. **For production:** When you're ready, run the same steps against the production DB. Prefer a maintenance window or low-traffic time. Ensure you have a backup (see [BACKUP_RESTORE_PROCEDURE.md](../01-HIGH/BACKUP_RESTORE_PROCEDURE.md)) and that the app version you're deploying is compatible with the new schema.

---

### 6. Run load tests (k6) and record a baseline

**Why it matters:** A baseline (e.g. p95 latency, error rate, RPS) tells you how the app behaves under load. You can compare later runs to spot regressions (e.g. "p95 doubled after that change") or plan scaling (e.g. "we can handle 100 RPS per instance").

**Goal:** Know how the API behaves under load and record numbers you can alert on or compare to later.

**Steps (with detail):**

1. **Install k6** — See [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md) for install (e.g. `choco install k6` on Windows, `brew install k6` on macOS). Run `k6 version` to confirm.

2. **Run against local or staging** (not production, to avoid affecting users)
   ```bash
   npm run test:load
   # or: k6 run tests/load/api-load-test.js
   ```
   If there is no `test:load` script, use the k6 command from PERFORMANCE_TESTING.md (e.g. `k6 run --vus 20 --duration 1m script.js`). Start with a small load (10–20 VUs, 1 minute).

3. **Note the output:** k6 prints metrics such as:
   - **http_req_duration** — avg, min, med, max, p(95), p(99). p95 = 95% of requests completed within this time (e.g. 120ms).
   - **http_reqs** — total count and rate (RPS).
   - **http_req_failed** — failed request count/rate; error rate = failed / total.
   Save these in a file (e.g. `docs/active/02-MEDIUM/k6-baseline.txt`) or in PERFORMANCE_TESTING.md. Example: "Baseline 2026-01-31: 20 VUs, 1m; p95=120ms, RPS=180, error_rate=0%."

4. **Done when:** You have a baseline and can re-run the same scenario after code or infra changes to compare (e.g. "p95 was 120ms, now 200ms — investigate").

---

### 7. Optional: Staging deploy + migrations in CI

**What it is:** A staging environment that deploys on push and runs migrations.  
**What it does:** Lets us test code + schema before production.  
**How we use it:** Create staging app and DB; deploy on push to staging branch; run migrate:up in CI or deploy script; document in CI_CD_SETUP.

**Why it matters:** Staging lets you test code and schema changes together before production. Running migrations in CI or on deploy ensures the staging DB is always in sync with the app.

**Goal:** Every push to a branch deploys to staging and DB is migrated.

**Steps:**

1. **Create staging** — Second app on Railway (or your host) and a separate DB (e.g. Neon branch). Set env vars (no production secrets).
2. **Deploy on push** — In Railway, connect repo and set "Staging" branch (e.g. `staging` or `develop`). Or add a GitHub Actions job that deploys via Railway API/CLI.
3. **Migrations** — Either:
   - **A)** In CI: job that runs `npm run migrate:up` against staging `DATABASE_URL` (secret), then triggers deploy; or
   - **B)** In deploy script: run `npm run migrate:up` then `npm start`.
4. **Document** — Add a short "Staging" section in [CI_CD_SETUP.md](../01-HIGH/CI_CD_SETUP.md) with the branch name and how migrations run.

---

### 8. Optional: Other items

**What it is:** Good practices (key rotation, audit logging, data retention, pen test) not required to launch.  
**What it does:** Improves long-term security and compliance when we have capacity.  
**How we use it:** Add when compliance or team capacity allows; see ADDRESS_REMAINING_GAPS LOW PRIORITY.

*These are good practices but not required to launch. Add them when you have capacity or compliance needs.*

- **API key rotation** — Document in [SECURITY_GUARDRAILS.md](../00-CRITICAL/SECURITY_GUARDRAILS.md) (e.g. rotate Stripe/JWT/DB every 90 days). Use [SECURITY_INCIDENT_RESPONSE.md](../00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md) if a key is exposed.
- **Audit logging** — Log sensitive actions (e.g. delete user, payout, override) to a table or log stream.
- **Data retention** — Document in [GDPR_COMPLIANCE.md](../01-HIGH/GDPR_COMPLIANCE.md) how long you keep logs/backups/PII.
- **Penetration test** — Engage an external firm; scope auth, payments, API abuse.

---

## Checklist (copy and tick)

**What it is:** A tick-list of remaining items (tests, typecheck, lint, alerting, migrations, k6, staging, optional).  
**What it does:** Tracks progress so we don't forget anything.  
**How we use it:** Copy into your task list or tick items as you complete them.

- [ ] **Tests:** `npm test` passes
- [ ] **TypeScript:** `npm run typecheck` passes
- [ ] **Lint:** `npm run lint` passes
- [ ] **Alerting:** Sentry + UptimeRobot alerts configured and tested
- [ ] **Migrations:** `npm run migrate:up` run on dev/staging (and prod when ready)
- [ ] **Load test:** k6 run once and baseline recorded
- [ ] **Staging (optional):** Staging env + deploy + migrations documented
- [ ] **Optional:** Rotation schedule, audit logging, data retention, pen test

---

## Quick links

**What it is:** Shortcuts to related docs (ADDRESS_REMAINING_GAPS, COMPREHENSIVE_GAP_ANALYSIS, MONITORING_SETUP, CI_CD_SETUP, etc.).  
**What it does:** Lets you jump to the right doc without searching.  
**How we use it:** Use when you need full gap list, monitoring setup, or CI setup.

| Doc | Use |
|-----|-----|
| [ADDRESS_REMAINING_GAPS.md](ADDRESS_REMAINING_GAPS.md) | Full gap list and "what was done" |
| [COMPREHENSIVE_GAP_ANALYSIS.md](COMPREHENSIVE_GAP_ANALYSIS.md) | Full reanalysis and checklists |
| [MONITORING_SETUP.md](../00-CRITICAL/MONITORING_SETUP.md) | Sentry, UptimeRobot, error alerting |
| [CI_CD_SETUP.md](../01-HIGH/CI_CD_SETUP.md) | CI, migrations in CI, staging |
| [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md) | k6 and load testing |
| [docs/runbooks/](../../runbooks/) | Restore, incident, rollback |
