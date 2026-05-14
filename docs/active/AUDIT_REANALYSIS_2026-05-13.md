# PureTask Backend — Audit Reanalysis (2026-05-13)

**Author:** PURETASK + assistant pair  
**Method:** 4 parallel research agents (security / code-quality / ops-observability / DB layer) + direct CI-workflow and docs review. Findings cross-validated against the codebase.  
**Why this exists:** The earlier `AUDIT_CORRECTION_PLAYBOOK.md` was authored before this re-scan. This document supersedes it for **scope**; the playbook remains authoritative for items not re-listed here.

---

## How to read this

- Every gap has **severity**, **where** (file:line if applicable), **WHY** (impact in plain language), **WHAT** (the change in one sentence), **HOW** (concrete first step). Long fixes are deferred to their own playbook entries.
- Severity ladder: **P0** = ship-stopper / live security risk → **P3** = nice-to-have.
- Items already fixed in branch `audit-corrections-2026-05` (PR #26) and PR #27 are **not** repeated here — see `SOLO_RUN_SUMMARY_2026-05-13.md` for those.

---

# SECTION A — P0 (do this week, ideally today)

These are not theoretical. Each one is a live exposure or a known-bad runtime state.

## A.1 🔴 Rotate Neon database credentials (and JWT_SECRET)

**Where:**  
- `.env.production` (local, gitignored *now* — but tracked in git history at commits `f24ac5c`, `670e0bd` per `git log --all -- .env.production`)  
- `.env.staging` (same)  
- `.env.development` (same)  
- Plus the originally-known JWT leak at the same vintage (Playbook 0.1)

**WHY:** The Neon connection strings — including the actual current passwords (`npg_KDNnTPAbdw14` and `npg_gI0edR5WtcLl`) — exist in old commits even though the files are now gitignored. **Anyone who has cloned the repo at any point can pull those out of git history.** Combined with the previously-known JWT_SECRET leak from the same window, an attacker can both forge auth tokens AND log directly into your production Postgres.

**WHAT:** Rotate every credential that was ever in a tracked file in this repo before commit `f24ac5c`. At minimum: production DB password, staging DB password, dev DB password, JWT_SECRET, any Stripe webhook secret that was in those files, n8n webhook secret, SendGrid/Twilio if they were ever tracked.

**HOW:**
1. Neon console → each project → roles → reset password. Paste new value into Railway production/staging Variables. Update the local `.env.*` files. **Test login works after** (rotating DB doesn't log users out, but rotating JWT does).
2. JWT_SECRET rotation: same procedure as Playbook 0.1.
3. After rotation, document the rotation date in `docs/active/SECRETS_TRIAGE_2026-05.md` so the audit trail is one place.
4. **Do not** try to scrub git history. The secrets are already compromised — rotation is what protects you. History rewrite has cascading consequences (every cloned copy invalidated) and doesn't undo any leak that already happened.

**Done when:** `psql "$OLD_PROD_URL"` fails with auth error, and the app still works.

---

## A.2 🔴 SQL injection audit on 804 template-literal queries

**Where:** ESLint rule `no-restricted-syntax` flags 804 violations across the codebase. Worst clusters:
- `src/core/db/rescheduleDb.ts` (10)
- `src/core/reasonCodeService.ts` (8)
- `src/core/cancellationService.ts` (3)
- `src/workers/v2-operations/photoRetentionCleanup.ts:59`
- `src/workers/v2-operations/payoutReconciliation.ts:26`
- `src/config/env.ts` (3)

**WHY:** Backtick-template SQL is the canonical SQL-injection pattern. The rule is in place *as a warning* but the codebase has 804 occurrences. Not all are real injection risk — many are template literals with no interpolation, just multi-line strings — but each one needs to be confirmed safe. Until then, this is sitting on a known bad pattern in payment / job / credit flows.

**WHAT:** Audit each violation; convert any with interpolated user data to parameterized form (`pool.query('... WHERE id = $1', [id])`).

**HOW:**
1. `npm run lint 2>&1 | grep "no-restricted-syntax" > sql-audit.txt`
2. Walk the file list. For each: is interpolation used? If no (`pool.query(\`SELECT ... \`)`), the warning can be suppressed inline with a comment explaining it's a static string. If yes, parameterize.
3. After each batch, lower the ESLint `--max-warnings` ratchet by the number of warnings cleared.
4. Once the count is at zero for `no-restricted-syntax`, add an `error`-level override for that rule.

**Done when:** zero `no-restricted-syntax` warnings, and an `eslint --rule "no-restricted-syntax: error"` run still exits 0.

---

## A.3 🔴 No `statement_timeout` on the app DB pool

**Where:** `src/db/client.ts` pool config. Migration runner has `query_timeout: 30000` but the app pool does not.

**WHY:** A single hung query (deadlock, slow plan, network glitch on a Neon cold start) holds its connection forever. Under load on a 100-connection-max Neon free tier, a handful of hung queries exhaust the pool and the whole API hangs. There is no upper bound on query duration in production today.

**WHAT:** Add `statement_timeout: 30000` (30s) to the pool's `options` field — or pass it via the connection string parameter.

**HOW:** In `src/db/client.ts` pool init, add `statement_timeout: 30_000` to the `new Pool({...})` config. Confirm the longest legitimate query in the app (large analytics aggregations in `src/routes/admin/analytics.ts`, KPI snapshots) finishes within 30s, or carve out a separate pool/connection for them.

**Done when:** a deliberately slow query (`SELECT pg_sleep(60)`) errors at 30s instead of hanging.

---

## A.4 🔴 Workers bypass Sentry entirely

**Where:** `package.json` worker scripts. Pattern:
```
"worker:payout-weekly": "ts-node src/workers/v1-core/payoutWeekly.ts",
"worker:durable-jobs": "ts-node src/workers/runDurableJobWorker.ts",
... and 16 more
```

The API uses `start: "node -r ./dist/instrument.js ./dist/index.js"` which preloads Sentry. Workers run via `ts-node src/workers/...` and never load `instrument.ts`, so `Sentry.init()` never runs.

**WHY:** Every worker crash, every silent retry-loop, every webhook-replay miss is invisible. The whole point of Sentry is the alerting and rollups. We've been paying for it and not getting it for the cron stack.

**WHAT:** Either preload the same instrumentation in worker scripts, or call `Sentry.init()` explicitly at the top of each worker `main()`.

**HOW:**
- Option A (smallest diff): change every `worker:*` script to `ts-node -r ./src/instrument.ts src/workers/...`.
- Option B (more honest): export an `initSentryForWorker(workerName)` from `src/instrument.ts` and call it as the first line of each worker, with `serverName` tagged to the worker name. This gives per-worker dashboards in Sentry.
- Either way: wrap each worker's `main()` body in `try { await main() } catch (e) { Sentry.captureException(e); throw e }` so unhandled errors get reported before the process exits.

**Done when:** trigger a deliberate throw in a worker (e.g. `throw new Error("audit-test")` in `payoutWeekly.ts`) and confirm it appears in Sentry within 60s. Then remove the throw.

---

## A.5 🔴 `npm test` fails on 11 integration test files

**Where:** Pre-existing before this session. Confirmed in `src/tests/integration/` — credits, jobs, stripe, trustE2E, v2/v3/v4 features tests all fail on `npm test`.

**WHY:** They all hit a real Postgres via `query()` from `src/db/client.ts`, and they expect a schema + clean state — which means they need `TEST_DATABASE_URL` set to a database that was set up by `npm run db:setup:test`. Right now the dev environment doesn't do this automatically, and CI workarounds the issue by running only the deterministic slice (`test:ci`). Coverage on payment / credit / stripe flows is therefore not being measured.

**WHAT:** Either (a) make `npm run db:setup:test` part of `pretest` so the suite Just Works, or (b) split the test commands so `test` runs only the unit slice and `test:integration` requires `TEST_DATABASE_URL`.

**HOW:**
1. Decide on option a or b. I recommend **a** — the friction of remembering to seed before `npm test` is what's keeping these tests red.
2. Add to `package.json`: `"pretest": "node -e \"if(!process.env.TEST_DATABASE_URL) process.exit(0)\" && npm run db:setup:test"` (no-op if env var isn't set, so unit-only mode still works).
3. Document in `SETUP.md` that running the full suite requires `TEST_DATABASE_URL`.
4. Verify locally: set `TEST_DATABASE_URL`, run `npm test`, expect all 92 test files green.

**Done when:** `npm test` runs all integration tests and they pass when `TEST_DATABASE_URL` is set; clearly skips when it isn't.

---

# SECTION B — P1 (this sprint, before the next material feature ships)

## B.1 🟡 `authEnhanced.ts` uses manual try/catch on 25 routes (no `asyncHandler`)

**Where:** `src/routes/authEnhanced.ts` — every `router.post/get(... async (req, res) => { try {...} catch(err) { res.status(...).json(...) } })` block.

**WHY:** If anything in the catch block throws (e.g. `res.json()` after headers already sent, or a typo in the error code), the rejection is unhandled and the process risks termination. The codebase already has `asyncHandler` middleware and a `src/lib/errors.ts` factory; this file just predates the convention.

**WHAT:** Wrap each handler in `asyncHandler(...)` and let the global error middleware handle the response shape.

**HOW:**
1. Open `src/routes/authEnhanced.ts`.
2. For each handler: replace the manual try/catch with `asyncHandler(async (req, res) => { ... throw Errors.someCode("...") instead of res.status })`.
3. Confirm the global error middleware in `src/index.ts` produces the same response shape the client expects (don't change the error envelope shape during this refactor — that's a separate decision).
4. Run the deterministic test slice; add a quick supertest case for one error path to prove the global handler returns the right code.

**Done when:** zero `try {` blocks remain in `authEnhanced.ts`; integration tests that exercise auth errors still pass.

---

## B.2 🟡 Logger doesn't emit Sentry breadcrumbs

**Where:** `src/lib/logger.ts` — emits structured JSON to stdout but never calls `Sentry.addBreadcrumb()`.

**WHY:** When an error fires, Sentry's issue page shows the stack but no preceding log lines. You lose the most useful debugging artifact: the trail of `logger.info("calling stripe", {...})` that led to the failure. This is silently degrading Sentry's value across the entire app.

**WHAT:** In the logger's `log()` function, also push the same payload as a Sentry breadcrumb (with the redacted-payload version, not the raw).

**HOW:** Import Sentry into `src/lib/logger.ts`. After the JSON `console.log()`, call `Sentry.addBreadcrumb({ category: 'log', level, message, data: redacted })`. Guard with a check for `Sentry.isInitialized()` so it's safe to call from CLIs that never init Sentry.

**Done when:** trigger a controlled Sentry exception in a route that has 5 prior `logger.info` calls; verify all 5 appear as breadcrumbs on the Sentry issue.

---

## B.3 🟡 `/health` always returns 200 even when DB is down

**Where:** `src/routes/health.ts` — root `/health` returns 200 unconditionally; only `/health/ready` actually queries the DB.

**WHY:** Railway's healthcheck (`railway.toml`) points to `/health`. Railway will never drain or restart the service when the DB is unreachable, because the healthcheck still passes. Customers see 500s; the platform thinks everything is fine.

**WHAT:** Make `/health` perform the same readiness checks as `/health/ready`, OR retarget Railway's `healthcheckPath` to `/health/ready`.

**HOW:** Cheaper option: change `railway.toml` `healthcheckPath` to `/health/ready`. Note that `healthcheckTimeout` is currently `100` seconds (per `railway.toml`), which is plenty. Verify `isDatabaseReady()` in `/health/ready` is fast enough to be a healthcheck (single `SELECT 1`, no joins). If you want `/health` to keep being a liveness probe and `/health/ready` to be the readiness probe, split semantics explicitly in the doc.

**Done when:** stop the DB temporarily in a non-prod environment, confirm Railway detects unhealthy and restarts.

---

## B.4 🟡 Rate limiter falls open if Redis is down (instead of fail-closed)

**Where:** `src/index.ts` ~line 176 — `if (env.USE_REDIS_RATE_LIMITING && env.REDIS_URL) { use redis limiter } else { use in-memory limiter }`. The in-memory fallback gives per-instance limits; across N Railway replicas, an attacker effectively gets N× the budget.

**WHY:** During a Redis outage, the rate limiter silently degrades to a single-process counter. Login brute-force protection collapses. CI checks won't catch this because tests run with `USE_REDIS_RATE_LIMITING=false`.

**WHAT:** When `USE_REDIS_RATE_LIMITING=true` in production, a Redis connection failure should return 503 from the limiter, not silently fall back to memory.

**HOW:** In `src/lib/rateLimitRedis.ts`, the limiter creation path catches Redis errors and re-throws them. Add a top-level Redis health check at app startup: refuse to start in `NODE_ENV=production` if Redis is required and unreachable. Surface Redis disconnects to Sentry.

**Done when:** with `REDIS_URL=redis://does-not-exist`, production-mode startup fails fast and logs the reason; dev-mode startup proceeds with the in-memory limiter.

---

## B.5 🟡 CSRF tokens stored in process memory

**Where:** `src/middleware/csrf.ts:12-37` — `Map<string, ...>` token store.

**WHY:** Multi-replica deployments (Railway can scale horizontally) have N separate token stores. A token issued on replica A fails on replica B. Today this works because Railway scaling is probably 1 replica, but it's a landmine the moment you scale.

**WHAT:** Move CSRF tokens to Redis with a TTL.

**HOW:** Reuse the existing Redis client (`src/lib/redis.ts`). Key scheme: `csrf:{sessionId}` → token, with 1h TTL. Sessions should be the JWT `jti` rather than client IP. Plumb through the existing JWT verification middleware.

**Done when:** issue a token on one replica (or simulated by restarting the process), confirm it validates on another.

---

## B.6 🟡 Helmet CSP is disabled — **partially addressed (CSP exists elsewhere)**

**Where:** `src/index.ts` `app.use(helmet({ contentSecurityPolicy: false, ... }))`.

**Status:** Originally rated P1; downgraded after re-audit on 2026-05-13.

**Re-audit finding:** A Content-Security-Policy header IS already set on every response by the custom `securityHeaders` middleware at `src/middleware/security.ts:37`. Directives applied:

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' <FRONTEND_URL>;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

This is reasonably strict — `frame-ancestors 'none'` blocks clickjacking, `script-src 'self'` blocks inline-script XSS. The Helmet `contentSecurityPolicy: false` was intentional so the two CSP sources don't clobber each other; the `src/index.ts` comment now says so explicitly.

**What's left (lower priority):**
- The CSP doesn't whitelist Stripe.js (`https://js.stripe.com`) — only matters if HTML pages from this backend need to embed Stripe Checkout/Elements. The backend is mostly JSON, so this is mostly theoretical.
- The CSP doesn't whitelist Sentry — only matters for browser-side Sentry. We use server-side Sentry only, so non-issue.
- No CSP report-uri / Report-To wired up.

**Done when:** if Swagger UI or any HTML view breaks under CSP, add a per-route relaxation; otherwise leave as-is.

---

## B.7 🟡 File uploads validate MIME only (no magic-number check)

**Where:** `src/services/fileUploadService.ts:94-127` — `validateFile()` checks `mimetype` from multer (client-controlled) and size only.

**WHY:** A client can send `Content-Type: application/pdf` with a `.exe` payload. If uploads are served back to other users (cleaner profile photos, ID documents, job photos), this is a stored-XSS / executable-distribution vector.

**WHAT:** Verify the actual file signature (magic numbers) using `file-type` (npm package), not the declared MIME.

**HOW:** `npm install file-type@21`. In `validateFile()`, after the size check, call `fileTypeFromBuffer(buffer)` and compare against the allow-list. Reject if mismatch or if no signature recognized (some types like SVG are extra dangerous and need explicit rejection).

**Done when:** a `.exe` uploaded as `.pdf` is rejected with a 415; matching the MIME survives.

---

## B.8 🟡 No account lockout on failed login

**Where:** `src/routes/auth.ts:201-255`, `src/services/authService.ts:126-160`.

**WHY:** Global rate limiter caps the IP, but credential-stuffing across distributed IPs is unimpeded. With a leaked password list, the attacker just slowly walks the user table.

**WHAT:** Track failed-login attempts per email, lock the account for 15 minutes after 5 failures.

**HOW:** Add `failed_login_count INT DEFAULT 0` and `locked_until TIMESTAMPTZ` to `users` (or a small `auth_lockouts` table). On a wrong password, increment. On a correct password, reset. Reject login while `locked_until > now()`. Surface lockout events to Sentry. Send the user a one-shot unlock email if locked.

**Done when:** 5 wrong passwords for a known account from any IP combination trigger a 423 Locked response.

---

## B.9 🟡 Duplicate migration numbers in `DB/migrations/`

**Where:** 019, 027, 028, 029, 030, 031, 044, 045 each have multiple files — alphabetical execution order is the only thing keeping it stable, and rename-then-pick-up-by-glob would break.

**WHY:** A new dev runs `db:setup:test` and gets a deterministic-looking sequence, but if anyone moves a file around (or adds a new `030_X.sql` with a name that sorts ahead of the existing `030_Y.sql`) the schema diverges from production silently. This is exactly the kind of issue that surfaces as a Stripe webhook insert failing in prod at 2 AM.

**WHAT:** Renumber the `*NEON_FIX*` variants to sequential numbers above the current ceiling (somewhere in the 070+ range).

**HOW:** This needs to be done carefully so existing environments don't try to re-run already-applied migrations. The safest path:
1. Audit which environment has which set applied: `psql -c "\dt"` against test, staging, prod.
2. Pick the canonical order (alphabetical within each number).
3. Rename the duplicates to extend the sequence: e.g. `030_onboarding_gamification_NEON_FIX.sql` → `069_onboarding_gamification_neon_fix.sql`.
4. Update `scripts/setup-test-db.js`'s explicit file list to reference the new names.
5. Update `scripts/validate-migrations.js` to reject any new `NNN_*.sql` if `NNN` already exists.
6. Apply the new names in test, then staging, then prod. Each environment should already have the content applied, so renaming files only changes what `setup-test-db.js` looks for.

**Done when:** `find DB/migrations -name "*.sql" | awk -F'/' '{print $NF}' | sed 's/_.*//' | sort | uniq -d` returns empty.

---

## B.10 🟡 Second Postgres pool in `gamification-bundle` leaks connections

**Where:** `src/gamification-bundle/client.ts:3` — `new Pool({ connectionString: process.env.DATABASE_URL })` with no `max`, no `connectionTimeoutMillis`, never closed.

**WHY:** Neon free tier caps total connections. The bundle's pool defaults to `max: 10`. On every cold start of the bundle path, another 10 connections are allocated. Across cron runs and API instances this drifts upward; under sustained load it starves the main pool.

**WHAT:** Import the shared pool from `src/db/client.ts` instead.

**HOW:** Delete `src/gamification-bundle/client.ts`. Replace all imports with `import { pool } from "../db/client"` (or use the `query()` helper). If the bundle is intentionally isolated for testing in a sandbox, gate the second pool behind an explicit env var so it's never on in production.

**Done when:** `grep -r "new Pool" src/` returns only one location (`src/db/client.ts`).

---

## B.11 🟡 N+1 query patterns in 87 files

**Where:** Top offender is `src/services/jobMatchingService.ts:126-188` — per candidate cleaner, ~5 additional queries (availability, prefs, past jobs, response rate, boost multiplier). For 100 cleaners that's ~500 queries per match. Same shape appears in `cleanerOnboardingService.ts`, `payoutsService.ts`, `badgeService.ts`, `goalChecker.ts`, `gamification.ts`, `lib/queue.ts`, `core/db/matchingDb.ts`, `supportGamificationService.ts`.

**WHY:** With Neon, each query is ~10-20ms of round trip. 500 queries is 5-10 seconds of wall clock for a single match — and matching runs on every job creation. This is currently the throughput ceiling.

**WHAT:** Rewrite the worst three (matching, payouts, goal-checker) to fetch in a single CTE or batched join.

**HOW:** Start with `jobMatchingService.ts`. Build a single query that returns the cleaner row plus all the derived columns (`COALESCE` for absent values). Add an integration test that asserts the response time on a synthetic 100-cleaner pool. Repeat for the next worst file. Don't try to fix all 87 at once; the long tail isn't load-bearing.

**Done when:** the three highest-volume N+1 sites are batched; `pg_stat_statements` shows queries-per-match drop to ≤5.

---

## B.12 🟡 `sendAlert()` wired but never called

**Where:** `src/lib/alerting.ts` exports `sendAlert()` (Slack webhook). The only caller is `src/workers/workerMetrics.ts`. Error paths in routes and workers don't invoke it.

**WHY:** You have an alert helper and a Slack webhook env var, and they're connected to nothing. Critical signals (5xx error rate spikes, dead-letter queue growth, worker absence) are not getting routed to a place a human will see them.

**WHAT:** Wire `sendAlert()` into the three signals that actually need eyes: global error handler when error rate exceeds threshold; dead-letter queue size threshold; worker heartbeat absence.

**HOW:** Three small writes:
1. In the Express error middleware, increment a per-minute counter; if >N/min, call `sendAlert("error spike", ...)`.
2. In a new daily worker, query dead-letter queue depth; alert above a threshold.
3. Use the `worker_runs` table (already exists per `904_worker_runs_table.sql`) to detect missing heartbeats: any worker that hasn't reported in 2× its expected interval triggers an alert.

**Done when:** an artificial error spike fires a Slack message within 2 minutes.

---

## B.13 🟡 44 routes send custom error responses, bypassing global middleware

**Where:** Concentrated in `src/routes/gamification.ts` (44 instances of `res.status(500).json({ error: { code, message } })` in catch blocks).

**WHY:** When you eventually change the error response envelope (add a `traceId`, normalize a code), you have to find 44 places instead of 1. Worse, some of these may include raw error objects in the body without going through redaction.

**WHAT:** Replace inline `res.status(...).json(...)` in catch blocks with `throw Errors.<code>(...)`. Let the global error middleware in `src/index.ts` serialize.

**HOW:** Same pattern as B.1 (authEnhanced fix). Audit the file; for each catch block, replace with a thrown `AppError`. The global handler already redacts.

**Done when:** `grep -n "res.status.*json.*error.*{.*code" src/routes/gamification.ts` returns empty.

---

## B.14 🟡 Untyped DB query results everywhere

**Where:** ~165 `any` usages, concentrated in `src/core/availabilityService.ts`, `src/core/db/rescheduleDb.ts`, `src/core/db/matchingDb.ts`, `src/services/cleanerOnboardingService.ts`, `src/routes/gamification.ts`.

**WHY:** `const result = await query<any>("SELECT ...")` means the compiler can't catch a typo on `row.cleanr_id` (note the typo) vs `row.cleaner_id`. The code path runs, the field is `undefined`, and bugs surface only at runtime — usually in production.

**WHAT:** Introduce per-table row interfaces (or zod schemas) and use them in `query<RowT>(...)`.

**HOW:** Start with the three biggest offenders. For each table, write a TypeScript `interface` matching the schema (from migrations or `pg_dump --schema-only`). Use it as the generic in `query<T>`. The compiler will then flag every mistyped access. This is incremental — you don't need to type the whole codebase to start getting value.

**Done when:** top three `query<any>` files are typed; new code that adds another `<any>` is caught by code review.

---

## B.15 🟡 CI/CD Pipeline deploy step is permanently red (RAILWAY_TOKEN unset)

**Where:** `.github/workflows/ci.yml` previously had a `deploy` job (lines ~177-235) that ran `railway up` after build/test/security-scan. The job's `env: RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}` resolved to empty — secrets `RAILWAY_TOKEN`, `RAILWAY_API_SERVICE`, `RAILWAY_SCHEDULER_SERVICE`, `RAILWAY_WORKER_SERVICE` are not set in the `production` GitHub environment (or aren't reaching it).

**WHY:** The CI/CD Pipeline workflow was failing on every push to `main` at the deploy step, exiting with "Invalid RAILWAY_TOKEN". This made the CI signal misleading — every main-branch run showed a red ✗, suggesting prod was broken. In reality, production was deploying fine via **Railway's native GitHub integration** (Railway watches `main` directly and runs the build defined in `nixpacks.toml`, separately from GitHub Actions). The workflow's deploy step was a redundant second deploy path that never worked.

**WHAT:** Remove the deploy job. Railway's native integration is the actual deploy path; the workflow step was duplicate, broken, and confusing.

**HOW:** Delete the `deploy:` job from `ci.yml`. Leave a comment explaining why so the next person doesn't try to "restore the missing deploy step." If you later want CI-driven deploys back (for the smoke-test verification step it provided), restore from git history and set `RAILWAY_TOKEN` + `RAILWAY_API_SERVICE`/`RAILWAY_SCHEDULER_SERVICE`/`RAILWAY_WORKER_SERVICE` in the `production` GitHub environment.

**Done when:** push to main; CI/CD Pipeline goes fully green (no broken deploy step). Confirm Railway dashboard still shows the corresponding deploy fired from its native integration.

---

# SECTION C — P2 (next month)

## C.1 🟠 Prettier shows 87+ unformatted files in CI (continue-on-error)

**Where:** `.github/workflows/ci.yml` lines 33-35 — `format:check` has `continue-on-error: true`. Locally `npm run format:check` reports 157 files.

**WHY:** Formatting drift makes diffs noisier than they need to be and breaks `git blame`. The continue-on-error was a baseline-cleanup concession; that baseline is now stale.

**WHAT:** Either `npm run format` once across the whole tree (one big diff, easy to review), or accept the drift permanently and remove the workflow step entirely.

**HOW:** One commit: `npm run format && git add -A && git commit -m "style: reformat tree with prettier (no logic changes)"`. Verify `npm test` still passes (formatting shouldn't change behavior). Remove `continue-on-error` from the workflow. Future PRs that drift fail the workflow.

**Done when:** `npm run format:check` exits 0 on `main`; CI step no longer has continue-on-error.

---

## C.2 🟠 Architecture-checks workflow is warn-only on real architectural issues

**Where:** `.github/workflows/backend-architecture-checks.yml` — route size check (>300 lines) and DB-in-routes check both end with "this is a warning, not an error."

**WHY:** Warnings without enforcement are noise. Either the rule matters and should block, or it doesn't and the check should be deleted.

**WHAT:** Adopt a ratchet pattern (same as the ESLint warning ratchet from playbook 1.2): record the current count, fail CI if it goes up.

**HOW:** Capture the current count of routes >300 lines and the current count of DB-importing routes (per the whitelist). Encode those numbers into the workflow. Fail if the actual count exceeds. Ratchet downward as routes get cleaned up.

**Done when:** workflow fails when a new route exceeds 300 lines OR a new (non-whitelisted) route imports `db/client`.

---

## C.3 🟠 4 architecture docs referenced from CI workflow don't exist

**Where:** `.github/workflows/backend-architecture-checks.yml` references `docs/ARCHITECTURE_MIGRATION_GUIDE.md`, `docs/architecture-what-lives-where.md`, `docs/ARCHITECTURE_ENFORCEMENT_GUIDE.md`, `docs/EVENT_SYSTEM_SPEC.md`. None exist at those paths — they're in `docs/_archive/old-misc/` and `docs/archive/raw/legacy_docs/...`.

**WHY:** When CI prints "see `docs/ARCHITECTURE_MIGRATION_GUIDE.md`" and the dev goes looking, they don't find it. The check becomes ignorable.

**WHAT:** Either move the archived copies back into the referenced paths, or update the workflow to point to docs that exist (`docs/active/ARCHITECTURE.md`, etc.).

**HOW:** Quick fix: in `backend-architecture-checks.yml`, replace each reference with the closest current doc. If the archived content is materially useful, lift it back into `docs/active/` per Playbook 3.1.

**Done when:** every doc path printed by the workflow resolves to an actual file.

---

## C.4 🟠 Canonical RUNBOOK and CONTRIBUTING link to 10+ missing docs

**Where:** `docs/active/RUNBOOK.md` and `docs/active/CONTRIBUTING.md` reference: `docs/active/API_DOCUMENTATION.md`, `docs/event_contract_v1.md`, `docs/metrics_contract_v1.md`, `docs/spec_enforcement_matrix_v1.md`, `docs/BACKEND_ENDPOINTS.md`, `docs/DEPLOYMENT.md`, `docs/ENV_SETUP.md`, `docs/FRONTEND_VS_BACKEND_REMAINING_WORK.md`, `docs/SKIPPED_TESTS.md`, `docs/TEST_RESULTS.md`. None exist.

**WHY:** The canonical docs are bait — they point at content that's gone. Anyone navigating from RUNBOOK loses trust in the docs.

**WHAT:** Fix every broken link in RUNBOOK + CONTRIBUTING. For each: either restore the content (lift from archive), point to the canonical replacement, or delete the reference.

**HOW:** For each missing doc, decide:
- Does it exist somewhere else in `docs/`? Repoint.
- Is there a current equivalent? Repoint (e.g. `DEPLOYMENT.md` → `DEPLOY_TO_RAILWAY.md`).
- Is it gone for good? Delete the link.
- Is the content valuable but absent? Lift from archive (Playbook 3.1).

**Done when:** every link in RUNBOOK and CONTRIBUTING resolves.

---

## C.5 🟠 175 markdown files in `docs/active/`, multi-axial organization

**Where:** `docs/active/` has 175 .md files across overlapping folder schemes: priority-tiered (`00-CRITICAL/`, `01-HIGH/`, `02-MEDIUM/`, `03-LOW/`), audit-section-numbered (`sections/SECTION_01_*` through `SECTION_14_*`), domain-grouped (`founder/`, `legal/`, `incidents/`, `gamification_bundle/`), plus 53 at the flat root.

**WHY:** A new dev (or future-you) opens `docs/active/` and is presented with two parallel taxonomies competing for the same content. Multiple docs cover the same topic from different angles (3 endpoint docs, 4 gamification docs, 3 audit docs). Search is unreliable; updating requires editing N copies.

**WHAT:** Pick one axis and consolidate.

**HOW:** This is a multi-hour project, not a one-pass fix. Suggested sequence:
1. Designate `docs/active/RUNBOOK.md` as the single index. Every other doc reachable from there.
2. Identify content overlaps via filename heuristics first (`API_REFERENCE.md` + `API_EXACT_ENDPOINTS.md` + `BACKEND_ENDPOINTS.md` — three docs, one canonical), then read-and-merge.
3. Archive the duplicates (`docs/_archive/consolidation-2026-05/`) rather than delete.
4. The priority-tier `0X-NAME` folders made sense at audit-time but pollute now; consider flattening once the content is deduplicated.

**Done when:** `docs/active/*.md` (top-level glob) is ≤15 files; everything else is under a single domain folder.

---

## C.6 🟠 SSRF protection not enforced on every outbound `fetch`

**Where:** `src/lib/ssrfProtection.ts` defines `validateOutboundUrl()`. Used in `src/lib/httpClient.ts`. Not used in `src/services/aiService.ts:85` (direct OpenAI fetch).

**WHY:** An SSRF lib that's "use it if you remember" is a sign that the next outbound API integration will skip it. The fix is structural, not per-call.

**WHAT:** Block raw `fetch()`/`http.request()` outside of `httpClient.ts`. Make `httpClient.ts` the single egress point and have it always validate.

**HOW:** Add an ESLint rule `no-restricted-globals: ["error", "fetch"]` plus an exception for `src/lib/httpClient.ts`. Wrap any current direct callsites in `httpClient`. Audit specifically: `aiService.ts`, `oauthService.ts`, notification provider files, any n8n integration.

**Done when:** zero raw `fetch(` calls in `src/` outside `src/lib/httpClient.ts`.

---

## C.7 🟠 N8N webhook signature verification falls open in dev

**Where:** `src/lib/auth.ts:257-308` — if `N8N_WEBHOOK_SECRET` is unset, dev mode skips signature verification entirely.

**WHY:** A misconfigured staging or a dev env that escapes its purpose will accept arbitrary webhook payloads. The signature check is the only thing standing between a malicious sender and our event ingestion.

**WHAT:** Require the secret to be set; reject if missing, in every env.

**HOW:** Change the early-return to throw on startup if the env var is missing. Provide a documented dev secret in `.env.example` so dev still works out of the box.

**Done when:** `N8N_WEBHOOK_SECRET=""` and a webhook is sent → 401, in every NODE_ENV.

---

## C.8 🟠 `noUncheckedIndexedAccess` not enabled — silent `undefined`s

**Where:** `tsconfig.json` doesn't set this flag. Codebase has many `array[0]`/`obj[key]` accesses assumed to be defined.

**WHY:** Common runtime crash pattern: a query returns 0 rows, code does `result.rows[0].user_id`, app blows up with "Cannot read properties of undefined." With this flag on, the compiler forces an explicit check at every index access. Catches dozens of latent bugs.

**WHAT:** Flip the flag, fix the resulting errors.

**HOW:** Flip `noUncheckedIndexedAccess: true` in `tsconfig.json`. Run `tsc --noEmit` and capture the error list. Expect ~200 errors. Fix in priority order: services first, then routes, then workers. Most fixes are adding `if (!row) return null;` or `?? defaultValue`. This will take a few hours but is high-leverage.

**Done when:** `tsc --noEmit` passes with the flag on; no `@ts-ignore` was added.

---

## C.9 🟠 `strictFunctionTypes` still off

**Where:** `tsconfig.json` — `"strictFunctionTypes": false`. Playbook 1.4 deferred this.

**WHY:** Same reasoning as Playbook 1.4 — function-variance bugs hide here.

**WHAT:** Flip the flag, fix the (small number of) resulting errors.

**HOW:** Flip the flag. Run `tsc --noEmit`. Expect 30-50 errors, mostly in middleware and service wrappers where function signatures drifted. Fix one at a time.

**Done when:** flag is `true`, build passes.

---

## C.10 🟠 23 bare `console.*` calls in non-worker production code

**Where:** `src/routes/search.ts`, `src/routes/gamification.ts`, `src/routes/message-history.ts`, `src/routes/cleaner-ai-*.ts`.

**WHY:** Console bypasses `logRedaction.ts`. If a logged object contains a Stripe payload or PII, it lands in CloudWatch / Railway log buffer un-redacted.

**WHAT:** Replace with `logger.info`/`logger.debug`/`logger.error` from `src/lib/logger.ts`.

**HOW:** Mechanical change. Ratchet the ESLint `no-console` rule to `error` for routes after the fix lands.

**Done when:** zero `no-console` warnings in non-worker code.

---

## C.11 🟠 11 routes import `db/client` (architectural boundary breach)

**Where:** Per Playbook 1.1, the architectural check whitelists 45 route files that may import `db/client`. The intent is to shrink that list to zero. Currently the worst is `src/routes/jobs.ts` (called out in earlier memory).

**WHAT:** Move DB calls in `jobs.ts` into `jobsService.ts` (which already exists). Remove `jobs.ts` from the whitelist in `scripts/check-route-db-imports.js`.

**HOW:** Per route file: each `pool.query(...)` becomes a service call. Add the service method if it doesn't exist. The service method takes the parameters, returns the result; the route just orchestrates HTTP. After the move, lint catches any remaining import.

**Done when:** `jobs.ts` is off the whitelist; per-file lint exempts shrink one route at a time.

---

## C.12 🟠 No full DB backup — only logical snapshots

**Where:** `src/workers/v2-operations/backupDaily.ts` calls `backupService.ts` which records counts/aggregates into a `backups` table. That's observability, not restore capability.

**WHY:** When (not if) something goes catastrophically wrong with the DB, the logical snapshots are useless for recovery. You need `pg_dump` or Neon's snapshot feature.

**WHAT:** Add an actual `pg_dump`-to-S3 weekly backup, OR rely on Neon's managed backups (verify they're enabled on your tier).

**HOW:** Two options:
- **Cheap:** confirm Neon has automated backups on the production project (Neon dashboard → Project → Backups). Document the retention. Test restore on a non-prod clone quarterly — see Playbook 4.3.
- **Self-managed:** `npm install pg-dump-restore` or shell out to `pg_dump`, pipe to `aws s3 cp` (you already have `@aws-sdk/client-s3`). Weekly cron. 30-day retention.

**Done when:** there exists a process that, given a fresh DB, restores the previous week's data within 30 minutes.

---

## C.13 🟠 JWT default expiry is 30 days, no refresh-token rotation

**Where:** `src/config/env.ts` default `JWT_EXPIRES_IN: "30d"`.

**WHY:** 30-day tokens give a stolen-token attacker a month of access. The compensating control (revocation via `invalidated_tokens` table) only works if the user notices and revokes.

**WHAT:** Drop to 7d (or shorter) and implement refresh tokens.

**HOW:** This is a multi-touch change: shorter access tokens, a refresh-token endpoint, client behavior change to refresh on 401. Coordinate with the frontend. Document in `FOUNDER_AUTH.md`.

**Done when:** access tokens expire within hours-to-a-week; refresh tokens rotate on use; revocation cuts off in <1 hour.

---

## C.14 🟠 JWT verification doesn't pin the algorithm

**Where:** `src/lib/auth.ts:verifyAuthToken` — uses `jwt.verify(token, secret)` without specifying `algorithms`.

**WHY:** Classic JWT footgun: an attacker can sign a token with `alg: none` (or RS256 against your HS256 secret) and trick the verifier. Today this is only theoretically exploitable because the lib defaults are reasonable, but pinning the algorithm closes the door for real.

**WHAT:** Pass `{ algorithms: ['HS256'] }` to every `jwt.verify` call.

**HOW:** Single-file change. Audit every callsite, add the option.

**Done when:** `grep -n "jwt.verify" src/` shows `algorithms` set everywhere.

---

# SECTION D — Structural / longer-running

These are real but won't be finished in a sprint. Listed so they're tracked.

## D.1 🔵 Doc consolidation (see C.5 above)

Track in its own working doc once C.5 starts. Currently 175 docs in `docs/active/` with overlapping organization schemes.

## D.2 🔵 Migration consolidation

96 migration files including duplicates and `*.bak` files. After B.9 (renumbering), consider an actual consolidation: take a `pg_dump --schema-only` of production at a tagged point, replace all migrations with one baseline, restart numbering. This is risky (every environment has to be at the same point first) and only worth doing every ~year.

## D.3 🔵 Replace `query<any>` with typed rows across the codebase

B.14 starts this for the worst three files; the long tail is ~165 instances. Either type per-table interfaces or migrate to a query builder / mapper that does it for you.

## D.4 🔵 1629 ESLint warnings → 0 ratchet

The lint ratchet is at the current ceiling (Playbook 1.2). Each cleanup batch should lower the ratchet rather than leave it static. SQL template literal audit (A.2) alone removes ~804 once they're parameterized.

## D.5 🔵 1.1 — DB-in-routes refactor (deferred from Playbook 1.1)

Reaffirmed by code-quality audit. `src/routes/client.ts` (~900 lines, imports db/client) and `src/routes/jobs.ts` are the worst offenders. C.11 above is the playbook entry.

## D.6 🔵 Backend architecture migration guides — broken refs

C.3 above. The CI workflow points at archived docs. Either repath or restore.

## D.7 🔵 `jobsService.ts` (1200+ lines) and `userManagementService.ts` (~700 lines) want extraction

Code quality agent flagged. Don't tackle proactively; pick one when you're already in the file for a bug fix and feel the friction.

---

# SECTION E — Section 6 of the original playbook (founder concerns)

These are unchanged from the playbook. Listed for completeness so the AUDIT_REANALYSIS is the single index.

- **6.1 KPI reports** — still pending
- **6.2 Monthly infra cost tracking** — still pending  
- **6.3 Performance baselines** — still pending
- **6.4 Third-party security review** — still pending (consider after A.1–A.4 done)
- **6.5 GDPR / data-deletion endpoint** — still pending
- **6.6 PCI compliance scope verification** — still pending
- **6.7 Customer support intake process** — still pending
- **6.8 Written legal posture** — `docs/active/legal/` has drafts; verify counsel review per `COUNSEL_REVIEW_RATIONALE.md`
- **6.9 Insurance coverage** — still pending
- **6.10 Bus-factor plan** — still pending

---

# Order of operations (one screen)

If you do nothing else, do these eight, in this order:

1. **A.1 Rotate Neon + JWT credentials** (today). 1–2h on Railway + Neon dashboards.
2. **A.4 Workers init Sentry** (today). One-line `package.json` change plus testing.
3. **A.3 statement_timeout on DB pool** (this week). One-line change.
4. **A.5 Make `npm test` actually run** (this week). Wire up test DB setup. Unblocks measuring real coverage.
5. **A.2 SQL template literal audit** (this sprint). 804 instances; budget a focused day.
6. **B.2 Logger → Sentry breadcrumbs** (this sprint). Single-file change, massive observability payoff.
7. **B.3 `/health` returns 503 when DB down** (this sprint). One-line `railway.toml` change.
8. **C.5 Doc consolidation** (next month). Largest payoff for new-contributor velocity.

Everything else compounds from these.

---

# What's already done (don't redo)

Per `docs/active/SOLO_RUN_SUMMARY_2026-05-13.md` and PR #26/#27:

- vitest 4 + uuid 14 bump
- ESLint warning ratchet (1.2)
- Coverage threshold floor (1.3)
- npm audit blocking + 2 highs resolved (1.5)
- Stale root docs archived (3.2)
- Jest configs/deps removed (3.4)
- Phase docs banner (3.5)
- Incident playbooks scaffold + 5 filled (4.1)
- ON_CALL.md, DEPLOY_TO_RAILWAY.md, MIGRATION_POLICY.md (4.2, 4.4, 4.5)
- Root SQL files relocated to `DB/snapshots/` (5.4)
- 4 archived docs leaking JWT removed; SECRETS_TRIAGE doc (0.2)
- tsconfig __tests__ exclude (CI typecheck fix)
- migrations.yml inline-node quote-escape fix (PR #27)

---

**End of reanalysis.** Append to this document, not to the original playbook — that one is the snapshot at start-of-week.
