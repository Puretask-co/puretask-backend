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

### P0.2 Migration path determinism (avoid env mismatch)
- **Owner:** `@owner-backend-platform`
- **Goal:** One documented and CI-enforced migration strategy.
- **Touches:**
  - Backend workflows: `.github/workflows/migrations.yml`, `.github/workflows/ci.yml`
  - Backend scripts/docs: `scripts/setup-test-db.js`, `docs/active/MASTER_MIGRATIONS.md`, `docs/active/SETUP.md`, `docs/active/TROUBLESHOOTING.md`
- **Verification commands:**
  - Backend: `npm run db:validate:migrations`
  - Backend: `npm run db:setup:test`
  - Backend: `npm run test:ci`
- **Exit criteria:**
  - Same migration strategy documented and used across CI + local/test instructions.

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

### P1.2 Expand automated journey coverage beyond minimum smoke
- **Owner:** `@owner-qa` + `@owner-frontend`
- **Goal:** Catch high-value regressions early.
- **Touches:**
  - Frontend workflows: `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`
  - Frontend tests: `tests/e2e/**`
- **Verification commands:**
  - Frontend: `npm run test:e2e:smoke`
  - Frontend: `npm run test:e2e`
- **Exit criteria:**
  - CI default path includes at least one booking/payments-adjacent journey in addition to auth smoke.

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
- `npm run db:setup:test`
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

1. Execute **P0.1** contract alignment doc pass and refresh frontend API verification expectations.
2. Execute **P0.2** migration determinism pass (docs + CI + scripts) and re-run backend CI-equivalent checks.
3. Execute **P0.3** release orchestration validation using explicit backend/frontend refs.
4. Then continue with **P1.1** frontend docs drift cleanup before adding new feature surface.

This sequence is currently the best risk-adjusted path for PureTask.
