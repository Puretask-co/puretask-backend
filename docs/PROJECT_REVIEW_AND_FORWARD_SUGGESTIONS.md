# PureTask Backend — Project Review & Forward Suggestions

**Date:** 2026-01-31  
**Purpose:** Summarize what is complete vs. incomplete, then give concrete next steps and priorities.

---

## 1. What’s Complete

### 1.1 API & Routes

- **Route coverage:** 50+ route files under `src/routes/` (auth, admin, client, cleaner, jobs, payments, analytics, v2, etc.).
- **Swagger/OpenAPI:** All route files now have `@swagger` JSDoc blocks:
  - Core: auth, jobs, admin, client, cleaner, credits, analytics, cancellation, assignment, etc.
  - Enhanced: authEnhanced (26), clientEnhanced, cleanerEnhanced, adminEnhanced.
  - Feature: message-history (8), gamification (14), cleanerPortal (10), alerts, ai, onboardingReminders, adminIdVerifications, clientInvoices, cleanerOnboarding, etc.
- **Docs UI:** Swagger UI at `/api-docs` (when not production or when `ENABLE_API_DOCS=true`), config in `src/config/swagger.ts`.

### 1.2 Backend Structure

- **Express app:** Central `src/index.ts` with middleware (helmet, CORS, rate limit, auth attach), then route mounting.
- **Auth:** Canonical auth in `authCanonical.ts`, enhanced auth (2FA, OAuth, sessions, email verification, password reset) in `authEnhanced.ts`.
- **DB:** Single `src/db/client.ts` with `query`; used across services and routes.
- **Services:** Clear service layer (auth, jobs, credits, payouts, invoices, notifications, AI, gamification-related logic, etc.).
- **Workers:** Many workers under `src/workers/` (auto-cancel, payouts, KPI, backup, onboarding reminders, reliability, durable jobs, etc.) with scripts in `package.json`.
- **State:** Job state machine in `src/state/jobStateMachine.ts`.
- **Integrations:** Stripe, SendGrid, Twilio, n8n, OpenAI (where used).

### 1.3 Database

- **Migrations:** `DB/migrations/` with many migrations (000–042 + hardening 901–906); consolidated schema and incremental changes.
- **Schema:** Covers users, jobs, credits, payouts, invoices, cleaner portal, AI, onboarding/gamification, message history, etc.

### 1.4 Testing

- **Unit:** e.g. `middleware/__tests__`, `services/__tests__`, `lib/__tests__`, `workers/__tests__`, `tests/unit/`.
- **Integration:** e.g. `tests/integration/` (auth, credits, job lifecycle, Stripe, disputes, v1–v4 features, migrations, etc.).
- **Smoke:** `tests/smoke/` (auth, health, jobs, credits, events, messages, jobLifecycle).
- **E2E:** `tests/e2e/` (e.g. recurring-booking, admin-id-verification).
- **Load/performance:** k6 scripts in `tests/load/`, `tests/performance/benchmarks.ts`.
- **Jest:** `jest.config.js`, `jest.config.coverage.js`; scripts: `test`, `test:unit`, `test:integration`, `test:coverage`, etc.

### 1.5 DevOps & Quality

- **CI:** GitHub Actions for backend-architecture-checks, ci, migrations, security-scan, test.
- **Linting/formatting:** ESLint, Prettier; `npm run lint`, `npm run typecheck`.
- **Security:** Gitleaks config (`.gitleaks.toml`), secret scan in CI, security docs (incident response, runbooks).
- **Env:** `src/config/env.ts` with `requireEnv()` for required vars; `.env.example`; `ENV_VARS_CHECKLIST.md`.

### 1.6 Documentation

- **Env:** `ENV_VARS_CHECKLIST.md` for required/optional vars and templates.
- **Phases:** `docs/active/00-CRITICAL/PHASE_*_STATUS.md` (0–14) and runbooks.
- **Product:** `product/` (e.g. PRODUCT_VISION, FINAL_PLATFORM_CAPABILITIES).
- **DB:** `DB/docs/`, migration READMEs.

---

## 2. What’s Not Complete / Needs Attention

### 2.1 Bug: `gamification.ts` uses undefined `db`

- **Issue:** `src/routes/gamification.ts` imports `query` from `../db/client` but calls `db.query(...)` in several places. There is no `db` import, so those calls will throw at runtime.
- **Locations:** Lines ~156, 276, 572, 582, 640, 787, 795, 891 (e.g. onboarding update, achievements mark-seen, template save/rate, tooltips dismiss, template publish).
- **Fix:** Replace every `db.query` with `query` in that file (same signature from `src/db/client`).

### 2.2 Phase 0 & 1 (from PHASE_0_1_STATUS.md)

- **Phase 0:** `npm test` should be run locally with a valid `.env` (or test env) and any failures fixed.
- **Phase 1 (manual):** Secret inventory off-repo, rotate secrets in the defined order, invalidate old tokens/webhooks, purge git history if needed, store secrets only in deployment (e.g. Railway). No code change, but required for security.

### 2.3 Test Environment

- Tests may assume DB and/or env (Stripe, SendGrid, etc.). Ensure:
  - A test DB and test env vars are documented (e.g. in README or `docs/`).
  - CI runs tests with appropriate secrets (e.g. GitHub Actions env) or with mocks so main flows are green.

### 2.4 Gaps You May Want to Address Later

- **authRefactored.ts:** Present in routes; confirm if it’s still used or deprecated and remove/redirect if needed.
- **Worker tests:** Only a subset of workers have `__tests__`; expanding coverage for critical workers (payouts, job lifecycle) is useful.
- **E2E:** Only a couple of e2e specs; expanding for critical user journeys (book → assign → complete → pay) would strengthen confidence.
- **API versioning:** v2 routes exist; if you add v3/v4 publicly, document versioning policy and deprecation.

---

## 3. Detailed Suggestions: What to Accomplish Next

### 3.1 Immediate (This Week)

1. **Fix `gamification.ts`**
   - In `src/routes/gamification.ts`, replace all `db.query` with `query`.
   - Run `npm run typecheck` and `npm test` (or at least tests that hit gamification) to confirm.

2. **Run and stabilize tests**
   - Run `npm test` locally with a valid `.env` (and test DB if required).
   - Fix any failing tests; document in README or `docs/` how to run tests (env, DB, mocks).
   - Ensure CI `test.yml` is green (or green when secrets/env are set).

3. **Confirm API docs in browser**
   - Start app (`npm run dev`), open `/api-docs`, and spot-check a few tags (Auth, Cleaner, Client, Admin) to ensure paths and methods look correct.

### 3.2 Short-Term (Next 2–4 Weeks)

4. **Complete Phase 1 security actions (if not done)**
   - Follow `docs/active/00-CRITICAL/PHASE_1_USER_RUNBOOK.md`.
   - Rotate secrets in the documented order; purge history if secrets were ever committed; keep secrets only in deployment.

5. **Document “how to run and test”**
   - In README or `docs/`:
     - Prerequisites (Node 20+, PostgreSQL/Neon).
     - Copy `.env.example` → `.env`, list required vars (point to `ENV_VARS_CHECKLIST.md`).
     - `npm ci`, `npm run build`, `npm run dev`.
     - How to run tests (unit, integration, smoke), and what env/DB they need.
     - Optional: how to run workers locally for debugging.

6. **Add a few high-value tests**
   - One integration test that hits authEnhanced (e.g. 2FA status or sessions) if not already covered.
   - One integration test for cleanerPortal (e.g. list clients or list invoices) to protect those routes.
   - Optionally: one smoke test for `/api-docs` (e.g. 200 and HTML).

### 3.3 Medium-Term (1–3 Months)

7. **Harden critical paths**
   - Identify the top 5–10 API flows (e.g. login, create job, assign, complete, payout, refund).
   - Ensure each has at least one integration or e2e test and that errors (4xx/5xx) are handled and optionally logged/monitored.

8. **Worker and job reliability**
   - Ensure critical workers (e.g. payouts, auto-cancel, job reminders) are running in production (cron or scheduler) and monitored.
   - Use `WORKER_STATUS.md` and any runbooks to document how to restart or debug workers.

9. **Observability**
   - Confirm Sentry (or similar) is configured in production and that critical errors are captured.
   - Optionally: add a small set of business metrics (e.g. jobs created per day, payouts count) that you can inspect in Sentry or a dashboard.

10. **Product and roadmap**
    - Align backend work with `product/PRODUCT_VISION.md` and `FINAL_PLATFORM_CAPABILITIES.md`.
    - If `PURETASK_LONG_TERM_ROADMAP.md` is empty, add a short list of backend priorities (e.g. “scale workers,” “add webhooks,” “improve reporting API”) so the next phase of work is clear.

### 3.4 Ongoing

11. **Keep API docs in sync**
    - When adding or changing routes, add or update `@swagger` blocks so `/api-docs` stays the single source of truth.

12. **Dependency and security hygiene**
    - Periodically run `npm audit` and fix high/critical issues.
    - Bump Node to supported LTS when feasible (you’re already on Node 20+).

13. **DB migrations**
    - Keep using the existing migration pattern; run new migrations in a repeatable way (e.g. CI or a documented deploy step) and avoid editing applied migrations.

---

## 4. Summary Checklist

| Area              | Status   | Next action |
|-------------------|----------|-------------|
| API routes        | Complete | Keep docs in sync when changing routes. |
| Swagger docs      | Complete | Spot-check `/api-docs`; fix gamification bug so routes work. |
| gamification.ts   | Bug      | Replace `db.query` → `query` and test. |
| Tests (suite)     | Present  | Run locally; fix failures; document how to run. |
| Phase 0/1         | Partial  | Run tests; complete Phase 1 secret rotation/purge if needed. |
| Docs (env, phase) | Good     | Add “how to run and test” in README or docs. |
| Workers           | Many     | Ensure production schedule; document in WORKER_STATUS. |
| Observability     | Sentry   | Confirm production config; add metrics if desired. |

---

## 5. Suggested Order of Operations

1. Fix `gamification.ts` (`db` → `query`).
2. Run `npm run typecheck` and `npm test`; fix any failures.
3. Open `/api-docs` and do a quick sanity check.
4. Document “how to run and test” the backend.
5. Complete Phase 1 security actions (inventory, rotate, purge, verify).
6. Add 1–2 integration tests for authEnhanced and cleanerPortal.
7. Plan next priorities (workers, observability, product roadmap) based on your launch or product timeline.

---

*This document can be updated as you complete items or as the project evolves. Consider linking it from README or from `docs/active/00-CRITICAL/` so it stays visible.*
