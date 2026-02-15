# PureTask Backend – Execution Plan

**Created:** 2025-02-12  
**Status:** In Progress  
**Goal:** Complete immediate and short-term tasks to stabilize tests, git, V4, CI, and code quality.

---

## Phase 1: Immediate (This Week)

### Task 1.1: Fix npm/Vitest Setup
**Goal:** `npm run test` runs reliably.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 1.1.1 | Verify `node_modules` and `package.json` scripts | `npm run test` invokes vitest |
| 1.1.1b | **If npm install fails** (MODULE_NOT_FOUND in npm itself): User must repair npm – run `npm install -g npm@latest` or reinstall Node.js | npm install succeeds |
| 1.1.2 | Run `npm install` to ensure deps installed | No MODULE_NOT_FOUND errors |
| 1.1.3 | Run `npm run test` | Tests execute (pass or fail, but run) |
| 1.1.4 | If vitest not in PATH, use `npx vitest run` or fix script | Script works on clean install |
| 1.1.5 | Add/verify test setup for CI (env vars, DB) | Tests can run in CI environment |

---

### Task 1.2: Sync Git
**Goal:** Resolve `.cursor/rules` lock, pull, push.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 1.2.1 | User closes Cursor completely | `.cursor/rules` released |
| 1.2.2 | User runs `git pull origin main` from external terminal | Pull succeeds |
| 1.2.3 | Resolve any merge conflicts if present | Clean working tree |
| 1.2.4 | `git push origin main` | Push succeeds |
| 1.2.5 | Optional: Add `.cursor/rules` to `.gitignore` if not needed in repo | Prevents future lock conflicts |

**Note:** Steps 1.2.1–1.2.4 require user action (close Cursor). Automation cannot resolve file locks.

---

### Task 1.3: Fix V4 Analytics/Manager 500s
**Goal:** Debug and fix failing endpoints.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 1.3.1 | Identify failing endpoints (analytics, manager) | List of endpoints returning 500 |
| 1.3.2 | Add/log error handling to capture stack traces | Errors visible in logs |
| 1.3.3 | Fix `analyticsService.ts` – null checks, missing deps | Endpoints return 200 or proper errors |
| 1.3.4 | Fix `managerDashboardService.ts` – same approach | Endpoints return 200 or proper errors |
| 1.3.5 | Verify with curl/Postman or integration tests | All V4 admin endpoints respond correctly |

---

### Task 1.4: Fix V4 Integration Tests
**Goal:** Update failing tests and/or service implementations.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 1.4.1 | Run `npm run test:integration` and capture failures | List of failing tests |
| 1.4.2 | For each failure: determine if test or service is wrong | Categorized list |
| 1.4.3 | Fix test assertions (stale expectations, wrong URLs) | Tests reflect current API |
| 1.4.4 | Fix service implementations (if service is buggy) | Services match contracts |
| 1.4.5 | Re-run until all V4 integration tests pass | 100% pass for V4 suite |

---

## Phase 2: Short Term (2–4 Weeks)

### Task 2.1: Add CI for Tests
**Goal:** Add `test.yml` (or equivalent) to run tests on PRs.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 2.1.1 | Create `.github/workflows/test.yml` | File exists |
| 2.1.2 | Configure: checkout, Node 20, npm install | Job runs |
| 2.1.3 | Run `npm run typecheck` | TypeScript check in CI |
| 2.1.4 | Run `npm run lint` | ESLint in CI |
| 2.1.5 | Run `npm run test` (or test:smoke if full suite needs DB) | Tests run in CI |
| 2.1.6 | Configure DATABASE_URL for integration tests (if needed) | Integration tests pass or skip gracefully |

---

### Task 2.2: Update MASTER_CHECKLIST
**Goal:** Mark completed tasks and align with current implementation.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 2.2.1 | Audit V1 tasks – mark completed items ✅ | V1 section accurate |
| 2.2.2 | Audit V2 tasks – mark completed items ✅ | V2 section accurate |
| 2.2.3 | Audit V3 tasks – mark completed items ✅ | V3 section accurate |
| 2.2.4 | Audit V4 tasks – mark completed items ✅ | V4 section accurate |
| 2.2.5 | Update version overview table | Status reflects reality |
| 2.2.6 | Update progress summary (X/94 tasks) | Numbers correct |

---

### Task 2.3: Reduce ESLint Warnings
**Goal:** Replace `any`, remove unused vars, clean up warnings.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 2.3.1 | Run `npm run lint` and count warnings | Baseline count |
| 2.3.2 | Fix high-impact files first (routes, services) | Fewer warnings |
| 2.3.3 | Replace `any` with proper types where easy | Type safety improved |
| 2.3.4 | Remove or prefix unused vars with `_` | No unused-var warnings |
| 2.3.5 | Target: reduce to &lt; 50 warnings | Manageable warning count |

---

### Task 2.4: Clean Up Deprecated Workers
**Goal:** Decide on `_deprecated/` and `disabled/` workers.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 2.4.1 | List workers in `_deprecated/` and `disabled/` | Inventory |
| 2.4.2 | Check if any are imported/used | Dependencies mapped |
| 2.4.3 | Decision: delete, move to archive, or re-enable | Clear decision per worker |
| 2.4.4 | Remove from `workers/index.ts` if referenced | No dead imports |
| 2.4.5 | Move to `docs/archive` or delete | Clean structure |

---

## Phase 3: Medium Term (1–2 Months)

### Task 3.1: Finish V4
**Goal:** Stable analytics and manager endpoints and tests.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 3.1.1 | All analytics endpoints return 200 (or proper 4xx) | No 500s |
| 3.1.2 | All manager endpoints return 200 (or proper 4xx) | No 500s |
| 3.1.3 | All V4 integration tests passing | 100% pass |
| 3.1.4 | Document any known limitations | Docs updated |

---

### Task 3.2: Production Verification
**Goal:** Staging E2E per TESTING_GUIDE.md Sections 1–10.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 3.2.1 | Set up staging environment | Staging available |
| 3.2.2 | Run Section 1–5 scenarios (Stripe, booking, escrow) | Pass |
| 3.2.3 | Run Section 6–8 (approval, refunds, payouts) | Pass |
| 3.2.4 | Run Section 9 (integrity checks) | Pass |
| 3.2.5 | Run Section 10 (master scenarios A–O) | Critical paths verified |

---

### Task 3.3: Integrate Durable Jobs
**Goal:** Wire `durableJobService` and `durableJobWorker` if applicable.

| Step | Action | Success Criteria |
|------|--------|------------------|
| 3.3.1 | Review `durableJobService.ts` and `durableJobWorker.ts` | Architecture understood |
| 3.3.2 | Check if migration 906 exists and is applied | Schema ready |
| 3.3.3 | Wire worker to run on schedule (cron/worker process) | Worker runs |
| 3.3.4 | Integrate with existing job/event flows | End-to-end works |
| 3.3.5 | Add tests for durable job flow | Tests cover flow |

---

## Execution Order

1. **Task 1.1** – Fix tests (enables validation for everything else)
2. **Task 1.3** – Fix V4 500s (unblocks Task 1.4)
3. **Task 1.4** – Fix V4 tests (validates Task 1.3)
4. **Task 1.2** – Sync git (user action; can be done in parallel)
5. **Task 2.1** – Add CI (locks in test quality)
6. **Task 2.2** – Update MASTER_CHECKLIST (documentation)
7. **Task 2.3** – Reduce ESLint warnings (code quality)
8. **Task 2.4** – Clean up deprecated workers (cleanup)
9. **Tasks 3.1–3.3** – Medium-term (after short-term complete)

---

## Progress Log

| Task | Started | Completed | Notes |
|------|---------|-----------|-------|
| 1.1 Fix npm/Vitest | 2025-02-12 | - | Blocked: npm install fails (MODULE_NOT_FOUND in npm). User must run `npm install -g npm@latest` or reinstall Node. |
| 1.2 Sync git | - | - | User action: close Cursor, run git pull/push from external terminal |
| 1.3 Fix V4 500s | 2025-02-12 | 2025-02-12 | Analytics & manager switched from legacy authMiddleware to jwtAuthMiddleware. Works with JWT (prod) and x-user-id (test). |
| 1.4 Fix V4 tests | 2025-02-12 | - | In progress: migrated Jest→Vitest, added vitest dep, 72 tests pass. Remaining: metrics module, schema mismatches, jest refs in externalServices |
| 2.1 Add CI | 2025-02-12 | 2025-02-12 | `.github/workflows/test.yml` created. Runs typecheck, lint, test. Add DATABASE_URL secret for tests. |
| 2.2 Update MASTER_CHECKLIST | 2025-02-12 | 2025-02-12 | Version overview and key tasks marked complete |
| 2.3 Reduce ESLint | 2025-02-12 | - | Partial: removed unused imports (index, aiService, jobsService), fixed workers index type. 191 warnings remain (mostly `any`) |
| 2.4 Clean deprecated workers | 2025-02-12 | 2025-02-12 | Index uses active workers; package.json paths fixed; removed worker:stuck-detection |
| 3.1 Finish V4 | - | - | Pending |
| 3.2 Production verification | - | - | Pending |
| 3.3 Integrate durable jobs | - | - | Pending |

---

**Last Updated:** 2025-02-12
