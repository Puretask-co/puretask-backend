# PureTask Forward Execution Guide (Backend + Frontend)

**Purpose:** One practical, cross-repo operating guide for what to do next, in what order, and how to verify done-state.  
**Scope:** `/workspace` (backend) + `/workspace/puretask-frontend` (frontend).  
**Owner:** `@owner-platform` (coordinating), with backend/frontend/devops owners per section.

---

## 1) Are we following a guide/checklist today?

Yes. Current guides/checklists already in use:

- **Backend canonical:** `docs/active/RUNBOOK.md`, `docs/active/MASTER_CHECKLIST.md`, `docs/active/DEPLOYMENT.md`, `docs/active/SETUP.md`.
- **Frontend active practice docs:** `TESTING_CHECKLIST.md`, `LAUNCH_CHECKLIST.md`, `docs/TEST_RESULTS.md`, `docs/FRONTEND_VS_BACKEND_REMAINING_WORK.md`, `docs/BACKEND_ENDPOINTS.md`.

What this guide does is **unify** those into one prioritized execution path and remove drift/conflicts.

---

## 2) Current reality summary (what is best for PureTask right now)

### 2.1 Strengths to keep

- Backend has strong operational backbone: deploy/release workflows, architecture checks, migration checks, security scan workflow, worker model, and deterministic E2E user scripts.
- Frontend has strong CI + contract/e2e wiring and a broad app surface already built.
- Cross-repo release orchestration already exists in backend workflows.

### 2.2 Risks to fix first

1. **Contract/document drift across repos** (frontend “remaining work” vs backend endpoint status docs not always aligned).
2. **Migration-path drift risk** (different canonical migration files/paths can create green CI but inconsistent env behavior).
3. **Frontend docs drift** (deployment/checklist docs partially outdated vs actual scripts/workflows).
4. **Insufficient default confidence gate** if only smoke-level checks pass while deeper journeys regress.

This guide prioritizes these before feature expansion.

---

## 3) Definition of done (cross-repo)

PureTask is in a stable “proceed fast” state when all are true:

1. **Backend + frontend contract is single-source and verified in CI and locally.**
2. **Migration path is deterministic across local/test/staging/prod.**
3. **Release path is one-button, traceable, and has post-deploy smoke checks.**
4. **Documentation is current and unambiguous (no conflicting truths).**
5. **Critical user journeys are covered by automated checks (contract + E2E smoke + targeted deeper journeys).**

---

## 4) Priority board (P0 / P1 / P2)

## P0 — Stabilize truth and release safety (do first)

### P0.1 Canonical contract alignment (backend endpoints vs frontend expectations)
- **Owner:** `@owner-backend` + `@owner-frontend`
- **Goal:** One authoritative endpoint contract that both repos follow.
- **Touches:**
  - Backend: `docs/active/BACKEND_ENDPOINTS.md`, `docs/active/RUNBOOK.md` (API/contract section if needed)
  - Frontend: `docs/BACKEND_ENDPOINTS.md`, `docs/FRONTEND_VS_BACKEND_REMAINING_WORK.md`
  - Frontend verifier: `scripts/run-api-verification.js`
- **Verification commands:**
  - Backend running on `:4000`
  - Frontend repo: `npm run test:api`
  - Frontend repo: `npm run verify:fullstack`
- **Exit criteria:**
  - No endpoint marked both “implemented” and “remaining” across docs.
  - `test:api` passes with deterministic test users.

**Status (2026-04-19): completed**
- Canonical + mirror contract docs aligned:
  - Backend canonical: `docs/active/BACKEND_ENDPOINTS.md`
  - Frontend mirror: `puretask-frontend/docs/BACKEND_ENDPOINTS.md`
- Frontend unresolved-gap tracker updated to current state:
  - `puretask-frontend/docs/FRONTEND_VS_BACKEND_REMAINING_WORK.md`
- Contract verification gates are green:
  - `npm run test:api`
  - `npm run verify:fullstack`

### P0.2 Migration path determinism (avoid env mismatch)
- **Owner:** `@owner-backend-platform`
- **Goal:** One documented and CI-enforced migration strategy.
- **Touches:**
  - Backend workflows: `.github/workflows/migrations.yml`, `.github/workflows/ci.yml`
  - Backend scripts/docs: `scripts/setup-test-db.js`, `docs/active/MASTER_MIGRATIONS.md`, `docs/active/SETUP.md`, `docs/active/TROUBLESHOOTING.md`
- **Verification commands:**
  - Backend: `npm run db:validate:migrations`
  - Backend: `STRICT_MIGRATION_PATH=1 npm run db:setup:test`
  - Backend: `npm run test:ci`
- **Exit criteria:**
  - Same migration strategy documented and used across CI + local/test instructions.

**Status (2026-04-19): completed**
- CI migration path is now deterministic and aligned:
  - `.github/workflows/migrations.yml`: runs `db:validate:migrations` then strict `db:setup:test`.
  - `.github/workflows/ci.yml`: runs `db:validate:migrations` and strict `db:setup:test` before test suite.
- Deterministic setup behavior is enforced and documented:
  - `scripts/setup-test-db.js` supports strict mode (`STRICT_MIGRATION_PATH=1`) and fails fast on drift.
  - Canonical docs updated: `docs/active/MASTER_MIGRATIONS.md`, `docs/active/SETUP.md`, `docs/active/TROUBLESHOOTING.md`.
- Canonical user-id FK contract drift removed from unify migrations:
  - `DB/migrations/059_add_invoice_status_and_invoices.sql`
  - `DB/migrations/060_add_reviews_ai_worker_stripe_tables.sql`
  - `DB/migrations/061_add_cleaner_id_payout_misc_tables.sql`
  - `DB/migrations/000_MASTER_MIGRATION.sql` regenerated

### P0.3 Release orchestration hard gate
- **Owner:** `@owner-devops`
- **Goal:** Cross-repo release only proceeds after validation pair passes.
- **Touches:**
  - Backend: `.github/workflows/release-orchestration.yml`
  - Backend: `.github/workflows/release.yml`
  - Frontend: `.github/workflows/release.yml`
- **Verification commands/checks:**
  - Trigger backend orchestration workflow dispatch with explicit backend/frontend refs.
  - Confirm backend + frontend release dispatches happen only after validate job success.
- **Exit criteria:**
  - Coordinated release is traceable by backend_ref + frontend_ref + environment.

**Status (2026-04-19): completed**
- Cross-repo orchestration now enforces hard gate semantics:
  - `deploy` job is blocked on successful `validate` job and consumes an uploaded validation manifest artifact.
  - `validate` now runs backend migration validation + deterministic DB setup + backend CI test gate before frontend contract checks.
- Release refs and trace metadata are propagated explicitly:
  - orchestration dispatch passes `backend_ref`, `frontend_ref`, and `orchestration_run_id` to backend/frontend release workflows.
  - backend release workflow now accepts and prints these trace fields.
- Frontend release workflow path is now present and orchestration-compatible:
  - Added `puretask-frontend/.github/workflows/release.yml` with matching `workflow_dispatch` inputs.

## P1 — Confidence and maintainability

### P1.1 Frontend docs drift cleanup (must match real scripts/workflows)
- **Owner:** `@owner-frontend-platform`
- **Goal:** Remove stale guidance that causes misconfiguration.
- **Touches:**
  - Frontend: `README.md`, `docs/DEPLOYMENT.md`, `LAUNCH_CHECKLIST.md`, `docs/ENV_SETUP.md`
- **Verification commands:**
  - Frontend: `npm run build`
  - Frontend: `npm run start`
  - Frontend: `npm run test:api`
- **Exit criteria:**
  - Docs use correct ports, valid file links, and current deployment target(s).

**Status (2026-04-19): completed**
- Frontend docs now match current scripts and release flow:
  - `README.md`, `docs/DEPLOYMENT.md`, `LAUNCH_CHECKLIST.md`, `docs/ENV_SETUP.md`
- Script and workflow references updated to current reality:
  - dev/start on `3001`, backend API base `:4000`, full-stack verification (`test:api`, `test:e2e:smoke`, `verify:fullstack`)
  - CI deploy dispatch and release workflow contract aligned with `.github/workflows/ci.yml` and `.github/workflows/release.yml`
- Current verification notes captured:
  - `test:api` passes after deterministic user seeding (`npm run seed:e2e:users` in backend)
  - `build` currently fails on a pre-existing JSX parse error in `src/app/client/bookings/[id]/page.tsx`
  - `start` command is valid but local verification hit `EADDRINUSE` on `3001` in this environment

### P1.2 Expand automated journey coverage beyond minimum smoke
- **Owner:** `@owner-qa` + `@owner-frontend`
- **Goal:** Catch high-value regressions early.
- **Touches:**
  - Frontend workflows: `.github/workflows/ci.yml`
  - Frontend tests: `tests/e2e/**`
- **Verification commands:**
  - Frontend: `npm run test:e2e:smoke`
  - Frontend: `npm run test:e2e`
- **Exit criteria:**
  - CI default path includes at least one booking/payments-adjacent journey in addition to auth smoke.

**Status (2026-04-19): completed**
- Frontend CI now includes an `e2e-smoke` job that checks out backend + frontend, prepares deterministic backend test data, and gates deploy on Playwright smoke success.
- Frontend smoke lane expanded beyond auth-only by adding a payments-adjacent credits/billing journey (`tests/e2e/trust/credits-billing-smoke.spec.ts`) and wiring it into `test:e2e`.
- Added focused smoke/auth regression scripts in `package.json`:
  - `test:e2e:smoke` (stable login page smoke)
  - `test:e2e` (auth smoke + credits/billing trust smoke)
  - `test:e2e:auth-regression` (full legacy login regression suite, on-demand)
- Playwright backend webServer path resolution hardened for both monorepo and sibling-repo layouts.

### P1.3 Resolve highest-impact skipped test suites
- **Owner:** `@owner-frontend`
- **Goal:** Reduce hidden regression risk.
- **Touches:**
  - Frontend tests listed in `docs/SKIPPED_TESTS.md`
- **Verification commands:**
  - Frontend: `npm run test`
  - Frontend: `npm run test:coverage`
- **Exit criteria:**
  - Top-priority skipped suites are restored or intentionally deferred with explicit rationale.

## P2 — Scale-quality and operational polish

### P2.1 Backend architecture debt reduction (route→service boundaries)
- **Owner:** `@owner-backend`
- **Goal:** Lower risk and improve long-term maintainability.
- **Touches:**
  - Backend routes/services with direct DB access concentration.
- **Verification commands:**
  - Backend: `npm run lint`
  - Backend: `npm run test:integration`
- **Exit criteria:**
  - Critical-path routes no longer own complex DB orchestration inline.

### P2.2 Security/quality gate tightening
- **Owner:** `@owner-security`
- **Goal:** Move advisory checks toward enforceable policy where signal is high.
- **Touches:**
  - Backend workflow gates (format/audit/scan policy)
  - Frontend workflow policy where applicable
- **Verification commands:**
  - Backend: `npm run security:scan`
  - Backend: `npm audit --audit-level=critical`
  - Frontend: `npm run lint && npm run test`
- **Exit criteria:**
  - Team-agreed policy with explicit fail/pass boundaries for CI checks.

---

## 5) Weekly execution rhythm (recommended)

### Monday — Contract & migration integrity
- Run backend DB/migration checks.
- Run frontend `test:api` against current backend.
- Resolve contract mismatches first.

### Midweek — Feature + debt lane
- Implement planned P0/P1/P2 tasks.
- Keep changes behind deterministic verification commands.

### Friday — Release readiness pass
- Backend: lint/typecheck/test:ci/build.
- Frontend: lint/test:coverage/verify:fullstack/build.
- Confirm docs updated for any behavior/config changes.

---

## 6) Mandatory command gates before merge/release

### Backend gate
- `npm run lint`
- `npm run typecheck`
- `npm run test:ci`
- `STRICT_MIGRATION_PATH=1 npm run db:setup:test`
- `npm run build`

### Frontend gate
- `npm run lint`
- `npm run test:coverage`
- `npm run test:api`
- `npm run verify:fullstack`
- `npm run build`

If any gate fails, do not promote release refs.

---

## 7) Immediate next actions (starting now)

1. Execute **P1.3** resolve highest-impact skipped test suites.
2. Keep **P1.2** as a standing guardrail by requiring `npm run test:e2e:smoke` + `npm run test:e2e` in CI before deployment.
3. Keep **P0.1** as a standing guardrail by requiring `npm run test:api` + `npm run verify:fullstack` before release promotion.
4. Keep **P0.2** as a standing guardrail by requiring `npm run db:validate:migrations` + `STRICT_MIGRATION_PATH=1 npm run db:setup:test` before release promotion.
5. Keep **P0.3** as a standing guardrail by requiring orchestration releases to pass validate job and carry explicit backend/frontend refs.

This sequence is currently the best risk-adjusted path for PureTask.
