# PureTask Backend — Project Issues and Remediation

**Purpose:** Single document listing known problems, violations, and risks with concrete remediation steps.  
**Use with:** [AUDIT_TICKETS.md](./AUDIT_TICKETS.md) (bugs/risks already fixed), [PR_AUDIT_RUBRIC.md](./PR_AUDIT_RUBRIC.md) (audit checklist).

---

## 1. Architecture and layering

### 1.1 Routes calling DB directly (High)

| Issue | Severity | What's wrong | Recommendation |
|-------|----------|--------------|-----------------|
| Routes import and use `query` / `pool` | **High** | Architecture (ARCHITECTURE.md) states "routes don't talk to DB; they call services." Many route files import `../db/client` and run queries: `admin.ts`, `admin/*.ts` (settings, gamificationControl, risk, finance, clients, cleaners), `jobs.ts`, `gamification.ts`, `trustAdapter.ts`, `payments.ts`, `stripe.ts`, `notifications.ts`, `users.ts`, `cleanerEnhanced.ts`, `clientEnhanced.ts`, `dashboardStubs.ts`, `search.ts`, `message-history.ts`, `uploads.ts`, etc. | **Fix:** (1) For each route file that imports `query`, identify every SQL call. (2) Move each call into an existing or new service function. (3) Route handler only calls `service.method(...)` and returns the result. (4) Remove `db/client` import from the route. (5) Re-enable ESLint `no-restricted-imports` for `src/routes/**` (see §1.2). Do in batches (e.g. one router per PR). |
| ESLint rule not enforced for routes | **High** | `.eslintrc.json` has `no-restricted-imports` banning `../db/client` in routes, but an **override** turns it **off** for `src/lib/**`, `src/middleware/**`, and `src/routes/**`. So route files are allowed to import DB. | **Fix:** Remove the override that disables `no-restricted-imports` for `src/routes/**`. After routes no longer import DB (§1.1), this will enforce the rule. Keep overrides for `src/core/**`, `src/workers/**`, `src/db/**`, `src/services/**` (and optionally `src/lib/**`, `src/middleware/**`) if those layers are permitted to use DB. |

---

## 2. Authentication — two stacks (Medium)

| Issue | Severity | What's wrong | Recommendation |
|-------|----------|--------------|-----------------|
| jwtAuth vs authCanonical | **Medium** | `authCanonical` is canonical (requireAuth, requireRole, requireAdmin). `jwtAuth` is legacy. **gamification.ts** uses `requireRole` from **jwtAuth**. **manager.ts** and **analytics.ts** use **jwtAuth** only (`jwtAuthMiddleware`, `requireRole("admin")`). Inconsistent auth and two code paths for the same concern. | **Fix:** (1) Replace `jwtAuth` usage in `src/routes/gamification.ts` with `requireAuth` / `requireRole` from `authCanonical`. (2) Replace `jwtAuthMiddleware` and `requireRole` from jwtAuth in `manager.ts` and `analytics.ts` with `requireAuth` and `requireRole` (or `requireAdmin`) from `authCanonical`. (3) Add ESLint restricted-import for `**/middleware/jwtAuth` (message: "Use authCanonical."). (4) Once no route uses jwtAuth, deprecate or remove `src/middleware/jwtAuth.ts` (or keep for non-route use only and document). |

---

## 3. Migration complexity (Medium)

| Issue | Severity | What's wrong | Recommendation |
|-------|----------|--------------|-----------------|
| Many SQL files and multiple "complete" schemas | **Medium** | 100+ SQL files: incremental 001–065+, hardening 9xx, multiple consolidated/master files, NEON patches, archive, bundle_reference. "Which to run" depends on env (fresh vs existing). New contributors can run wrong set or order. | **Fix:** (1) **Already done:** DB/migrations/README.md documents Option A (000_MASTER_MIGRATION.sql) and Option B (ordered list). (2) Add a short "Decision tree" at top of README: "Fresh DB? → Run 000_MASTER_MIGRATION.sql. Existing DB with 001–019? → Run 000_FIX (if needed), then 000_COMPLETE_CONSOLIDATED_SCHEMA.sql + 000_COMPLETE_VIEWS_PATCH.sql + 019 + 057–065 in order. Production patch? → See DEPLOYMENT.md / run db:patch:production." (3) In MASTER_MIGRATIONS.md, state explicitly that 000_MASTER_MIGRATION.sql is the single canonical file for greenfield; incremental files are for reference/history only. |
| credit_summary_by_reason / credit_ledger schema | **Fixed** | View used `direction`/`amount` while consolidated schema uses `delta_credits`. | **Done.** 000_COMPLETE_VIEWS_PATCH.sql and 000_MASTER_MIGRATION.sql now define the view with `delta_credits`. |

---

## 4. Lint debt (Low)

| Issue | Severity | What's wrong | Recommendation |
|-------|----------|--------------|-----------------|
| Many ESLint warnings, no errors | **Low** | 1600+ warnings (e.g. `@typescript-eslint/no-explicit-any`, raw SQL template literals, no-unused-vars, no-console). Rules are warn, so CI doesn't fail. | **Fix:** (1) Fix in batches by directory or rule (e.g. "no-explicit-any in src/services"). (2) For new code: add pre-commit or CI step that runs ESLint and fails on **new** violations (e.g. `eslint --max-warnings 0` on changed files only, or baseline). (3) Optionally tighten key rules to `error` over time (e.g. no-explicit-any) after reducing backlog. (4) Keep `no-restricted-syntax` for SQL template literals as warn until parameterized queries are standard. |

---

## 5. Duplicate gamification code (Low)

| Issue | Severity | What's wrong | Recommendation |
|-------|----------|--------------|-----------------|
| Two gamification implementations | **Low** | `src/lib/gamification/` (goal_evaluator, level_evaluator, reward_granter, metricProviderAdapter, etc.) and `src/gamification-bundle/` (parallel goal_evaluator, level_evaluator, reward_granter, process_cleaner_gamification, admin_*, fee_policy, etc.). Both have tests. Bundle is excluded from ESLint and tsconfig build. | **Fix:** (1) Treat `src/lib/gamification/` as **canonical** for evaluators, reward logic, and in-app progression. (2) Document in docs/active and in gamification-bundle/README.md that `src/gamification-bundle/` is **reference/legacy** and not used by the main app at runtime (or list the only entry points that still use it, if any). (3) If no route or worker imports from gamification-bundle, move it to `docs/archive/` or `src/_legacy/gamification-bundle` and update imports/tests. (4) If some code still uses bundle, migrate those call sites to lib/gamification (and bundleAdapter/db layer) then deprecate bundle. |

---

## 6. Skipped tests (Low)

| Issue | Severity | What's wrong | Recommendation |
|-------|----------|--------------|-----------------|
| it.skip in integration tests | **Low** | **disputeFlow.test.ts:** 3 skipped (open/resolve dispute, non-admin resolve). **v4Features.test.ts:** 1 skipped (risk review queue admin). **v1Hardening.test.ts:** 1 skipped (duplicate webhook processing). **onboardingFlow.test.ts:** 1 skipped (full 10-step onboarding). **cleanerOnboarding.test.ts:** 1 skipped (onboarding progress). **v2Features.test.ts:** 1 skipped (stuckJobDetection worker import). | **Fix:** (1) For each skipped test: either fix the behavior/mock so the test can run and remove `it.skip`, or document why it's skipped (e.g. "Blocked by #123") and add a ticket to un-skip. (2) Prefer fixing: dispute flow tests (stabilize dispute resolution path), onboarding (stabilize progress endpoint or mock), risk review (admin-only path), webhook dedupe (if still relevant). (3) Track in AUDIT_TICKETS.md or backlog: "Un-skip integration tests: disputeFlow (3), v4 risk (1), onboarding (2), v1Hardening (1), v2 (1)." |

---

## 7. Response and error handling

| Issue | Severity | What's wrong | Recommendation |
|-------|----------|--------------|-----------------|
| Double response (headers already sent) | **Low** | `src/routes/gamification.ts` (onboarding progress handler): in some paths the response is sent twice, causing "Cannot set headers after they are sent to the client" (e.g. line 643). Logged in onboardingRealAuth.test; test still passes. | **Fix:** (1) Trace the handler: ensure every code path sends exactly one response (res.json or res.status(...).json) and returns after sending. (2) In catch, only send if `!res.headersSent`. (3) Avoid calling next() or res.* after a response has been sent. (4) Add a small integration test that hits the progress endpoint and asserts single 200 and no second write. |

---

## 8. Consistency and maintainability

| Issue | Severity | What's wrong | Recommendation |
|-------|----------|--------------|-----------------|
| Input validation coverage | **Low** | Not all POST/PATCH routes verified to use validateBody (Zod). Mass assignment and strictness of PATCH schemas not fully audited. | **Fix:** Audit POST/PATCH routes (e.g. from BACKEND_ENDPOINTS.md or route index); ensure each has validateBody/validateQuery/validateParams where needed; document any exceptions. |
| Ownership and auth matrix | **Low** | requireOwnership used on job, payout, etc.; full resource×role matrix not in one place. | **Fix:** Keep ARCHITECTURE.md §2.1 "Authorization and ownership matrix" up to date; add any missing resources (invoice, photo, property, etc.) and "who can access" and "enforced by" column. Run authz regression tests (authzRegression.test.ts) after changes. |
| Env and secrets | **Low** | .env.example documents many vars; no single "required vs optional" table for production. | **Fix:** In SETUP.md or DEPLOYMENT.md, add a table: Env var | Required (prod) | Default | Notes. Redact secrets; document where they are set (e.g. Railway, Neon). |

---

## 9. Summary table

| # | Issue | Severity | Status |
|---|--------|----------|--------|
| 1.1 | Routes calling DB directly | High | In progress (route-by-route extraction started: `status`, `search`, `notifications`, `health`) |
| 1.2 | ESLint no-restricted-imports off for routes | High | In progress (routes re-enabled with temporary baseline override; baseline shrinking) |
| 2 | Two auth stacks (jwtAuth vs authCanonical) | Medium | Fixed for route usage (`analytics`, `manager`, `gamification`) |
| 3 | Migration complexity / which to run | Medium | Partially documented; add decision tree |
| 4 | Lint debt (1600+ warnings) | Low | Open |
| 5 | Duplicate gamification (lib vs bundle) | Low | Open |
| 6 | Skipped tests (7) | Low | In progress (2 tests unskipped; remaining skips tracked) |
| 7 | Double response in gamification route | Low | Open |
| 8 | Validation/ownership/env consistency | Low | Open |

---

## 10. Recommended order of work

1. **High:** Stop new violations — remove ESLint override for routes (§1.2) and fix route imports so routes no longer import db/client (§1.1). Do route-by-route to avoid a single giant PR.
2. **Medium:** Unify auth — migrate gamification, manager, analytics to authCanonical (§2). Then document migration path clearly (§3).
3. **Low:** Lint batches, un-skip tests, fix double-response, document gamification bundle as legacy, then validation/ownership/env docs.

*Last updated: 2026-03; reflects post-merge analysis and existing AUDIT_TICKETS/PR_AUDIT_RUBRIC.*
