# Gamification Bundle â€” Detailed Implementation Guide

**Purpose:** Step-by-step instructions to implement every piece needed for the bundle to become the final running code. Follow in order; each step includes file paths, code snippets, and verification.

**Prerequisites:** [GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md](./GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md) (why you cannot just add code, and what to create). This doc is the **how**.

**Related:** [BUNDLE_MERGE_ANALYSIS.md](./BUNDLE_MERGE_ANALYSIS.md), [gamification_bundle/README.md](gamification_bundle/README.md).

---

## Before you start

1. **Branch:** `git checkout -b implement-gamification-bundle`
2. **Backup:** Ensure you have a tag or branch to revert to (e.g. `pre-gamification-bundle-switch`).
3. **Build:** Run `npm run build` and `npm run test -- --run src/lib/gamification` so you have a green baseline.

---

## Step 1: Create the withClient adapter

Bundle code calls `withClient(async (client) => { ... })`. The backend only exports `withTransaction` and `query` from `src/db/client.ts`. Create an adapter so bundle-style code can run.

### 1.1 Create the file

**Path:** `src/db/bundleAdapter.ts`

### 1.2 Implementation

```ts
/**
 * Adapter for bundle-style withClient(cb) so bundle-derived code can use the backend DB.
 * Uses withTransaction so each callback runs in a transaction.
 */
import { withTransaction } from "./client";
import type { PoolClient } from "pg";

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(fn);
}
```

### 1.3 Re-export (optional)

In `src/db/client.ts` add: `export { withClient } from "./bundleAdapter";` so bundle code can `import { withClient } from "../db/client"`.

### 1.4 Verify

`npm run build` passes.

---

## Step 2: Create the config bridge

Bundle expects a single `config` (goals, rewards, levels). Backend uses `getGoals()`, `getLevels()`, `getRewards()` from `src/config/cleanerLevels`.

### 2.1 Create the file

**Path:** `src/config/cleanerLevels/bundleConfigBridge.ts`

### 2.2 Implementation

```ts
import { getGoals, getLevels, getRewards } from "./index";

export function getBundleConfig(): {
  goals: ReturnType<typeof getGoals>;
  levels: ReturnType<typeof getLevels>;
  rewards: ReturnType<typeof getRewards>;
} {
  return { goals: getGoals(), levels: getLevels(), rewards: getRewards() };
}
```

In bundle-derived code replace `import config from "../config/config.json"` with `import { getBundleConfig } from "../config/cleanerLevels/bundleConfigBridge"` and use `const { goals } = getBundleConfig()`.

### 2.3 Verify

`npm run build` passes.

---

## Step 3: Import path strategy (choose one)

**Option A (recommended):** Merge bundle logic into existing `src/lib/gamification/` and `src/services/`. No new folder; follow per-file merge in GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md Section 4.

**Option B:** Copy `src/gamification-bundle/*` to `src/gamification-bundle-adapted/` and fix every import:
- `../../puretask_gamification_step5/src/goal_evaluator` -> `../../lib/gamification/goal_evaluator`
- `../db/client` -> `../../db/bundleAdapter`
- `../config/config.json` -> use `getBundleConfig()` from `../../config/cleanerLevels/bundleConfigBridge`
- `../services/progression_service` -> wrapper or `../../services/gamificationProgressionService` (Step 6)
- `../middleware/rbac` -> `../../middleware/rbac` (Step 4)

---

## Step 4: RBAC shim for bundle admin routes

Bundle uses `requireAdminRole("support"|"ops")` and `(req as any).adminUser.id`. Backend has `requireAuth`, `requireAdmin`, `req.user`.

### 4.1 Create the file

**Path:** `src/middleware/rbac.ts`

### 4.2 Implementation

Export `requireAdminRole(minRole)` that:
1. Runs after `requireAuth` so `req.user` exists.
2. Sets `(req as any).adminUser = { id: req.user.id, role: mappedRole }` (map backend roles admin/super_admin/ops_finance/support_* to bundle admin/ops/support/viewer).
3. Returns 403 if `role` is below `minRole` (viewer < support < ops < admin).

Use `requireAuth` then `requireAdminRole("support")` or `requireAdminRole("ops")` on bundle admin routes.

### 4.3 Verify

Build passes; admin routes that use the shim get `req.adminUser`.

---

## Step 5: Admin services (governor + feature flags)

Backend already has: `adminConfigService`, `adminBudgetService`, `adminGovernorService`, `adminFeatureFlagService`, `adminAuditService`. No new implementations. If you port bundle admin routes, call these existing services and map request/response (e.g. `actorId: req.user.id`).

---

## Step 6: Progression and reward services

**Option A (recommended):** Merge bundle logic into `gamificationProgressionService` and `gamificationRewardService`. Single implementation.

**Option B:** Create wrapper classes `ProgressionService` and `RewardGrantService` that delegate to existing services and match bundle method names/shapes. Point bundle-derived code at these wrappers.

---

## Step 7: Worker wiring

Existing worker: `src/workers/gamification/processCleanerGamification.ts`. If you merged (Option A), no change. If you use adapted bundle worker, wire cron/jobs to one entry (either existing or adapted) that uses `withClient` and the chosen progression/reward services.

---

## Step 8: User ID type (TEXT)

Ensure all bundle-derived or merged code uses `string` for `cleaner_id`, `client_id`, `actor_admin_user_id`. No UUID for user IDs. Pass over new/merged code.

---

## Step 9: Optional â€” pt_safety_reports

Only if event-style safety table is required. Add migration `DB/migrations/057_pt_safety_reports.sql` with `cleaner_id TEXT REFERENCES users(id)`, `report_id UUID`, `occurred_at`, `payload JSONB`. Create index on `(cleaner_id, occurred_at)`. Add ingestion when you have events.

---

## Step 10: Tests

If merged: run `npm run test -- --run src/lib/gamification` and gamification integration tests. If adapted folder: move bundle tests into `src/lib/gamification/__tests__/` and fix imports to `../goal_evaluator`, `../types`; use repo test runner.

---

## Implementation checklist (summary)

| Step | What to do | Verify |
|------|------------|--------|
| 1 | Create `src/db/bundleAdapter.ts` with `withClient` | Build passes |
| 2 | Create `src/config/cleanerLevels/bundleConfigBridge.ts` | Build passes |
| 3 | Choose Option A (merge) or B (adapted folder); fix imports | Build passes |
| 4 | Create `src/middleware/rbac.ts` with `requireAdminRole` | Admin routes get role |
| 5 | Use existing admin services; map bundle admin routes | Admin endpoints work |
| 6 | Merge or wrap progression/reward services | Progression/reward work |
| 7 | One worker entry; wire cron/jobs | Worker runs |
| 8 | All user IDs string (TEXT) | No UUID for users |
| 9 | (Optional) 057_pt_safety_reports + ingestion | If needed |
| 10 | Run/move tests | Tests pass |

**Order:** Do Steps 1 and 2 first; then 4 if using bundle admin routes; then 3 and 6â€“8; 5 when wiring admin; 9 if needed; 10 throughout and at end.

**Last updated:** 2026-02.

---

## Step 4 â€” Full RBAC code (copy-paste)

Create ``src/middleware/rbac.ts`` with the following. It maps backend roles (admin, super_admin, ops_finance, support_lead, support_agent) to bundle roles (admin, ops, support, viewer) and sets ``req.adminUser`` for bundle routes.

``````ts
import { Request, Response, NextFunction } from "express";
import type { AuthedRequest } from "./authCanonical";

export type AdminRole = "admin" | "ops" | "support" | "viewer";

const ROLE_ORDER: Record<AdminRole, number> = {
  viewer: 1, support: 2, ops: 3, admin: 4,
};

function bundleRoleFromBackendRole(backendRole: string): AdminRole {
  if (backendRole === "admin" || backendRole === "super_admin") return "admin";
  if (backendRole === "ops_finance") return "ops";
  if (backendRole === "support_lead" || backendRole === "support_agent") return "support";
  return "viewer";
}

export function requireAdminRole(minRole: AdminRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authed = req as AuthedRequest;
    if (!authed.user) {
      return res.status(401).json({ ok: false, error: "admin auth required" });
    }
    (req as any).adminUser = {
      id: authed.user.id,
      role: bundleRoleFromBackendRole(authed.user.role),
    };
    const role = (req as any).adminUser.role as AdminRole;
    if (!role || ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
      return res.status(403).json({ ok: false, error: "insufficient role" });
    }
    next();
  };
}
``````

Use after ``requireAuth``: ``router.use(requireAuth); router.get("/admin/...", requireAdminRole("support"), handler);``
