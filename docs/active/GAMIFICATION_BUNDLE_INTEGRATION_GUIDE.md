# How to Add the New Gamification Bundle Into the Current System

**Purpose:** Step-by-step guide to integrate the uploaded gamification bundle (the "new system") into the current backend (the "old/current" one). You **cannot** just paste all the bundle code on topâ€”the bundle was built for a different project layout and DB shape. This doc explains why and gives a detailed path that works.

**See also:** [BUNDLE_VS_BACKEND_FULL_DIFF.md](./BUNDLE_VS_BACKEND_FULL_DIFF.md), [BUNDLE_MERGE_ANALYSIS.md](./BUNDLE_MERGE_ANALYSIS.md), [gamification_bundle/README.md](gamification_bundle/README.md) (canonical spec).

---

## 1. Can You "Just Add All the Code On"?

**No.** Reasons:

| Issue | Bundle expects | Current backend has |
|-------|-----------------|----------------------|
| **DB helper** | withClient from ../db/client | withTransaction and query only |
| **User IDs** | UUID for cleaner_id / client_id | **TEXT** (users.id) everywhere |
| **Config path** | ../config/config.json | ../config/cleanerLevels/*.json + index |
| **Service paths** | ../services/progression_service, etc. | Services in src/services/ (e.g. gamificationProgressionService) |
| **Engine path** | ../../puretask_gamification_step5/src/... | Engine in src/lib/gamification/ |
| **Admin** | Separate admin_users table | Single users table; admin = users with role |
| **Entry point** | Bundle has its own app.ts, routes | Your app is src/index.ts and existing routes |

If you copy the bundle folder and wire it "as is," the build fails (wrong imports) and the app would use the wrong IDs and DB helpers. So you have to **adapt** the bundle to your repo, then **replace or merge** with the current engine.

---

## 2. Two Ways to Integrate

### Option A: Replace piece-by-piece inside current engine (recommended)

- Keep **one** engine: src/lib/gamification/.
- For each file (types, goal_evaluator, level_evaluator, metricProviderAdapter, reward_granter), **compare** bundle version with current, then **edit the current file** to take any improvements. No second copy of the engine.
- **Pros:** No duplicate engine; clear single brain. **Cons:** You do the diff and paste by hand.

### Option B: Adapt the bundle in place, then swap

- In a **new branch**, copy bundle files into a temporary folder (e.g. src/gamification-bundle-adapted/).
- Fix **imports and types**: withClient to withTransaction, paths to your db/, config/cleanerLevels/, lib/gamification/types, and ensure cleaner_id is **string** everywhere.
- When the adapted folder **builds and tests**, replace the contents of src/lib/gamification/ with the adapted files, then delete the adapted folder.
- **Pros:** You can run and test the "bundle version" before swapping. **Cons:** More steps and a temporary duplicate.

**Recommendation:** Use **Option A** for the core engine; use **Option B** only if you want to run the full bundle flow in isolation first.

---

## 3. High-Level Order of Operations

1. **Backup and branch** (see 4.1).
2. **Types** â€” Align src/lib/gamification/types.ts with bundle if needed.
3. **Engine core (no DB)** â€” goal_evaluator, level_evaluator: copy over any extra logic from bundle; keep imports to ./types, ./goal_evaluator.
4. **Metric provider** â€” Keep your MetricsCalculatorMetricProvider; merge bundle logic only if useful.
5. **Reward granter** â€” Merge bundle logic into current reward_granter.ts; keep your DB (withTransaction) and config (cleanerLevels).
6. **Services** â€” Update only if bundle introduces new behavior; keep calling src/lib/gamification.
7. **Worker** â€” processCleanerGamification already uses the lib; no structural change.
8. **Config** â€” Optionally replace or merge goals.json, rewards.json with bundle definitions.
9. **Tests** â€” Run unit and integration tests after each step.
10. **Keep bundle excluded** â€” src/gamification-bundle stays excluded from tsconfig; do not wire it in.

---

## 4. Detailed Step-by-Step Guide

### 4.1 Backup and branch

  git checkout -b integrate-gamification-bundle
  git status

### 4.2 Types (src/lib/gamification/types.ts)

- Prefer keeping your **stricter** types. If the bundle adds a field you need, add it. **Check:** npm run build.

### 4.3 Goal evaluator (src/lib/gamification/goal_evaluator.ts)

- Compare bundle src/gamification-bundle/goal_evaluator.ts with current. Copy over improvements; keep from "./types" and MetricProvider. **Check:** build and goal_evaluator tests.

### 4.4 Level evaluator (src/lib/gamification/level_evaluator.ts)

- Compare bundle level_evaluator with current. Merge logic; keep ./goal_evaluator, ./types. **Check:** build and level_evaluator tests.

### 4.5 Metric provider adapter (src/lib/gamification/metricProviderAdapter.ts)

- Do **not** replace with bundle SQL provider (withClient). Copy metric/windowing logic only if useful. **Check:** build and tests.

### 4.6 Reward granter (src/lib/gamification/reward_granter.ts)

- Compare bundle reward_granter with current. Merge idempotency/expiration/choice logic; keep your DB/config. **Check:** build and reward_granter tests.

### 4.7 Services

- Do **not** replace with bundle services (different DB/config). Add bundle behavior inside your existing services if needed. **Check:** integration tests.

### 4.8 Worker (src/workers/gamification/processCleanerGamification.ts)

- No change. Ensure it never imports from src/gamification-bundle. **Check:** build and worker tests.

### 4.9 Config

- Option 1: Keep current JSON. Option 2: Diff and replace/merge goals.json, rewards.json; keep cleanerLevels loader. **Check:** full gamification flow.

### 4.10 Keep bundle as reference only

- Do not remove tsconfig exclude for src/gamification-bundle. Do not import from it in routes, services, or workers.

---

## 5. Quick Reference

| Item | Change? | What to do |
|------|--------|------------|
| types.ts | Optional | Add missing types from bundle; keep strict. |
| goal_evaluator.ts | Yes (merge) | Copy logic improvements; keep your imports. |
| level_evaluator.ts | Yes (merge) | Same. |
| metricProviderAdapter.ts | Optional | Keep adapter; copy metric logic if useful. |
| reward_granter.ts | Yes (merge) | Merge logic; keep your DB/config. |
| gamificationProgressionService | Optional | Only if new behavior; keep calling lib. |
| gamificationRewardService | Optional | Same. |
| processCleanerGamification | No | Already uses lib. |
| routes, config JSON | Optional | Merge bundle definitions if desired. |
| src/gamification-bundle/ | No | Reference only; excluded from build. |

---

## 6. Checklist (after each step)

- npm run build passes.
- Unit tests: npm run test -- --run src/lib/gamification/__tests__/
- No imports from src/gamification-bundle in lib, services, workers, routes.
- cleaner_id remains string (TEXT); DB uses withTransaction/query from src/db/client.

---

## 7. Summary

- **You cannot "just add all the code on"**â€”bundle imports and DB/user-ID assumptions do not match your repo.
- **You can** integrate by **merging bundle logic into src/lib/gamification/** and optionally config, step by step.
- **Order:** types, goal_evaluator, level_evaluator, metricProviderAdapter, reward_granter, then optional services/config; keep bundle as reference and excluded.

**Last updated:** 2026-02 (after bundle merge and documents switch).

---

## 8. What Things / Systems / Features Need to Be Created (Bundle â†’ Final)

For the **bundle code** to morph into the **final** running implementation (instead of staying reference-only), the following need to be **created** or **in place**. This is a checklist of gaps, not a merge-order.

### 8.1 DB layer: `withClient` adapter

- **Gap:** Bundle code calls `withClient(async (client) => { ... })` and expects a single DB client. The backend only exports `withTransaction` and `query` from `src/db/client`.
- **Create:** A small adapter (e.g. `src/db/bundleAdapter.ts` or inside a gamification adapter folder) that exports `withClient` implemented using the existing pool:
  - Either `withClient(fn) = withTransaction(fn)` so every bundle call runs in a transaction, or
  - `withClient(fn) = pool.connect() then fn(client) then release`, if you prefer no auto-transaction.
- **Result:** Bundle services and workers can keep the same `withClient(cb)` pattern while using the real backend DB.

### 8.2 Config bridge (single config shape)

- **Gap:** Bundle imports `config from "../config/config.json"` (one JSON with goals, rewards, levels, etc.). The backend uses `src/config/cleanerLevels` (separate loaders and JSON files).
- **Create:** Either:
  - A **config loader** that returns a single object matching the bundleâ€™s expected shape (e.g. `getBundleConfig(): { goals, rewards, levels, ... }` built from cleanerLevels and optionally `admin_config_versions`), and replace every bundle `import config from ...` with `import { getBundleConfig } from ...` and use `getBundleConfig()` at runtime, or
  - A **build-time or runtime** step that writes a single `config.json` from cleanerLevels so the bundle can keep `import config from ...` (path pointed at that file).
- **Result:** Bundle code has one config entry point that works with the current repo.

### 8.3 Import path / module mapping

- **Gap:** Bundle uses paths that donâ€™t exist: `../../puretask_gamification_step5/src/goal_evaluator`, `../services/progression_service`, `../db/client`, `../config/config.json`, `../middleware/rbac`.
- **Create:** Either:
  - **Option A (recommended):** Donâ€™t run the bundle folder as-is. Merge bundle logic into existing `src/lib/gamification/` and `src/services/` (see Â§4). Then no new â€œsystemsâ€ are needed; the final code is the current code with bundle logic merged in.  
  - **Option B:** A **bundle adapter layer**: e.g. `src/gamification-bundle-adapted/` where you copy bundle files and fix imports to point to `../../lib/gamification/`, `../../db/client` (or the withClient adapter), `../../config/cleanerLevels` or the new config bridge, and `../../routes/auth` or a small RBAC shim. Then the â€œfinalâ€ code is that adapted folder plus wiring into the app.
- **Result:** No broken imports; bundle-derived code compiles and runs inside this repo.

### 8.4 RBAC / admin auth shim

- **Gap:** Bundle uses `requireAdminRole("support")` / `requireAdminRole("ops")` from `../middleware/rbac`. The backend has `requireAdmin` (and possibly role on `req.user`).
- **Create:** A thin **RBAC shim** (e.g. in `src/middleware/rbac.ts` or next to admin routes) that exports `requireAdminRole(role)` and implements it by checking `req.user?.role === role` (or a list of roles that imply â€œadminâ€), and optionally `req.adminUser = req.user` so bundle routes that read `(req as any).adminUser.id` keep working.
- **Result:** Bundle admin routes can stay as-written; they use the same auth as the rest of the backend.

### 8.5 Admin services: governor and feature flags

- **Gap:** Bundle has `AdminGovernorService` and `AdminFeatureFlagService` used by `admin_gamification.ts`. The backend has `marketplaceGovernorService` and runtime config / feature flags, but the **API shape** may differ.
- **Create:** Either:
  - **Implement** bundle-style `AdminGovernorService` and `AdminFeatureFlagService` that use `withTransaction` (or the new withClient adapter) and backend tables (`users(id)` for actor, no `admin_users`), and place them in `src/services/` with names the bundle expects (or re-export under those names), or
  - **Map** existing backend services to the same interface and re-export them so bundle admin routes get the same methods (get/set governor state, get/set feature flags).
- **Result:** Bundle admin gamification routes work without rewriting them.

### 8.6 Progression and reward grant services (bundle interface)

- **Gap:** Bundle workers and routes call `ProgressionService` and `RewardGrantService` from `../services/progression_service` and `../services/reward_grant_service`. The backend has `gamificationProgressionService` and `gamificationRewardService` with potentially different method signatures.
- **Create:** Either:
  - **Merge** bundle logic into existing `gamificationProgressionService` and `gamificationRewardService` (see integration guide Â§4.7), so there is only one implementation and no â€œbundle interface,â€ or
  - **Thin wrappers** that implement the bundleâ€™s `ProgressionService` / `RewardGrantService` interface and delegate to the existing services (withTransaction + existing DB). Then point bundle workers and routes at these wrappers.
- **Result:** Worker and route code that expects `ProgressionService` / `RewardGrantService` can run unchanged.

### 8.7 Worker entry point and cron

- **Gap:** Bundle has `process_cleaner_gamification.ts` and `process_cleaner_gamification_with_rewards.ts` that use `withClient` and bundle services. The backend already has `processCleanerGamification` in `src/workers/gamification/` that uses `withTransaction` and backend services.
- **Create:** No new â€œworker systemâ€ is strictly required if you merge bundle logic into the existing worker (Â§4.8). If you instead **run the bundle worker code**, then: ensure the job queue (or cron) calls the bundleâ€™s process function, and that that function uses the withClient adapter and the wrapped progression/reward services above. So â€œcreateâ€ = **wiring**: the single entry point that cron/jobs use should be the chosen implementation (current worker or adapted bundle worker).
- **Result:** Cleaner gamification is run by one canonical path (existing or bundle-derived), and it uses the same DB and config as the rest of the app.

### 8.8 User ID type (TEXT everywhere)

- **Gap:** Bundle was written for UUID user IDs; backend uses TEXT `users.id`.
- **Create:** Not a new system, but a **convention and code pass**: ensure every bundle-derived file uses `string` (TEXT) for `cleaner_id`, `client_id`, `actor_admin_user_id`, etc. Add no new tables or columns; use existing `users(id)`. Document in the integration guide and in code comments.
- **Result:** No type errors or runtime mismatches; DB and app stay aligned.

### 8.9 Optional: event-style safety reports (pt_safety_reports)

- **Gap:** Bundle event/metrics contract may assume an event-style **pt_safety_reports** table (e.g. for metrics). The backend has **safety_reports** (different shape); it does not have **pt_safety_reports**.
- **Create:** Only if you need the bundleâ€™s event pipeline for safety: a **migration** (e.g. `057_pt_safety_reports.sql`) that creates `pt_safety_reports` with `cleaner_id TEXT REFERENCES users(id)`, and any event ingestion that writes to it. Otherwise skip; keep using `safety_reports`.
- **Result:** If you need it, event and metrics logic can rely on pt_safety_reports; if not, nothing to do.

### 8.10 Tests for bundle-derived code

- **Gap:** Bundle has its own tests (e.g. `goal_evaluator.test.ts`, `reward_granter.test.ts`) with imports like `../src/reward_granter` and its own jest config. They donâ€™t run in the backend repo as-is.
- **Create:** Either:
  - **Move** bundle tests into the backend test tree (e.g. `src/lib/gamification/__tests__/`) and fix imports to use `../../lib/gamification/...`, then run with the backendâ€™s test runner, or
  - **Add** a small test harness that resolves bundle paths to backend paths so bundle tests run against the merged (or adapted) implementation.
- **Result:** Regression coverage for the logic that became â€œfinalâ€ (whether merged or adapted).

---

## 9. Summary: minimal â€œcreateâ€ list for bundle â†’ final

| # | Thing to create | Purpose |
|---|------------------|--------|
| 1 | **withClient adapter** | So bundle DB calls use backend pool/transactions |
| 2 | **Config bridge** | Single config shape (goals/rewards/levels) for bundle code |
| 3 | **Import path fix or adapter layer** | No broken imports; bundle compiles in this repo |
| 4 | **RBAC shim** | requireAdminRole + req.adminUser for bundle admin routes |
| 5 | **AdminGovernorService + AdminFeatureFlagService** | Match bundle admin API (or wrap existing services) |
| 6 | **Progression/Reward service interface** | Either merge bundle into existing services or add wrappers |
| 7 | **Worker wiring** | One canonical processCleanerGamification (current or bundle-derived) |
| 8 | **TEXT user IDs** | Convention + pass over bundle-derived code; no new schema |
| 9 | **pt_safety_reports (optional)** | Only if event-style safety events are required |
| 10 | **Tests** | Move or harness bundle tests to run against final code |

Once these are in place, the â€œnew bundle fileâ€ can morph into the final code (either by merging into existing files or by running the adapted bundle folder as the implementation).


---

## Implementation (detailed how-to)

For **concrete file paths, code snippets, and verification** for each of the items above (withClient adapter, config bridge, RBAC shim, admin services, progression/reward, worker, tests), use: **[GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md](./GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md)**.
