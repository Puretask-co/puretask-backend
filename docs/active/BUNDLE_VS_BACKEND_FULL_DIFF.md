# Bundle vs Backend: Full Diff and “Before the Switch” Guide

**Purpose:** One place that explains exactly what was in the file you uploaded (PureTask Gamification Master Bundle), what already existed in this backend, what we did (merge-as-reference), and how to back up before any overwrite.  
**Use this before overwriting anything.**

---

## 1. What you uploaded (the bundle)

You uploaded the **PureTask Gamification Master Bundle** (from `Desktop\New folder`). It contained:

### 1.1 Bundle folder structure (what was in “New folder”)

| Folder / file | Contents |
|---------------|----------|
| **docs/** | 12 markdown files: Cursor context, event contract, metrics contract, spec-enforcement matrix, migration run order, runtime config loading, admin UI wireframe, reward meanings, CURSOR_PROMPTS, READMEs |
| **configs/** | JSON: puretask_goal_definitions_v1_1.json, event_contract_v1.json, metrics_contract_v1.json, event_to_metric_mapping_v1.json, config.json, config_v1_2.json; plus tsconfig/package.json |
| **migrations/** | 5 SQL files: event_tables_migration_v1.sql, step6_persistence, step8_reward_idempotency, step9_reward_effects_views, step10_admin_control_plane |
| **code/** | 29 TypeScript/Node files: goal_evaluator, level_evaluator, reward_granter, progression_service, admin_* services, reward_effects_service, sql_metric_provider, tests, app.ts, etc. |
| **data/** | CSV / data files (if any) |
| **MANIFEST.json** | Bundle manifest (generated 2026-02-20) |

### 1.2 What the bundle was designed to do

- Define the **event stream** (pt_event_log, pt_engagement_sessions, pt_engagement_actions, pt_safety_reports) for metrics.
- Define **goals, levels, rewards** via JSON config and **evaluators** (goal_evaluator, level_evaluator, reward_granter).
- **Persistence:** reward grants, choice eligibilities, season rules (gamification_season_rules).
- **Idempotency:** unique indexes on grants and choice eligibilities; choice TTL (expires_at).
- **Admin control plane:** admin_users, feature_flags, reward_budget, config_versions, audit_log, region_governor_config.
- **Runtime:** load active config from DB; poll; rollback = new version.

The bundle assumed **UUID** for user IDs and a separate **admin_users** table. It did not assume an existing `users` table with TEXT id or existing `job_offers` / `safety_reports` schema.

---

## 2. What already existed in this backend (before the merge)

### 2.1 Database (migrations 043–056 and consolidated schema)

- **043:** Cleaner level system (cleaner_level_definitions, cleaner_level_goals, cleaner_level_progress, cleaner_goal_completions, cleaner_rewards_granted, cleaner_login_days, cleaner_active_boosts, etc.).
- **046:** safety_reports (cleaner_id TEXT → users(id), job_offer_id, note, photo_url, created_at).
- **047:** pt_event_log, pt_engagement_sessions, pt_engagement_actions — **TEXT** cleaner_id/client_id and FKs to **users(id)**. No pt_safety_reports.
- **048:** cleaner_goal_progress, gamification_reward_grants, gamification_choice_eligibilities, view gamification_active_rewards — **TEXT** cleaner_id → users(id).
- **049:** SQL helpers (pt_haversine_meters, pt_haversine_miles, pt_within_radius_meters).
- **050:** Idempotency indexes, choice expires_at, views gamification_active_reward_grants / gamification_cleaner_active_rewards, function gamification_use_reward.
- **051:** Admin control plane — admin_feature_flags, admin_reward_budget, admin_config_versions, admin_audit_log (before_state/after_state), region_governor_config — all reference **users(id)**, no admin_users table.
- **052–056:** Cash budget enforcement, badges, seasonal challenges (season_rules + season_application_log), ops views, marketplace health governor.

So the backend **already had** the same concepts (events, engagement, rewards, choices, seasons, admin, governor) but with **TEXT user IDs**, **users(id)** for admin, **safety_reports** (not pt_safety_reports), and **season_rules** (not gamification_season_rules).

### 2.2 Config (already in backend)

- **src/config/cleanerLevels/**  
  goals.json, levels.json, rewards.json, levelCopy.json, goodFaithDeclines.json, badges.json, quickTemplates.json, bestPractices.json, seasonalRules.json, rewardUnlocksByLevel.json, choiceRewardGroups.json, season_rules_v1.json, index.ts (loader).
- No event_contract or metrics_contract JSON here before the merge.

### 2.3 Code (already in backend — this is what actually runs)

- **Routes:** src/routes/gamification.ts, admin/gamificationControl.ts, admin/levelTuning.ts, governor.ts, cleanerEnhanced.ts (level/progression).
- **Services:** cleanerLevelService.ts, cleanerGoalsService.ts, gamificationRewardService.ts, rewardEffectsService.ts, rewardKindHelpers.ts, feePolicyService.ts, matchingRankerService.ts, cashBudgetService.ts, runtimeConfigLoader.ts, adminConfigService.ts, adminBudgetService.ts, adminAuditService.ts, badgeService.ts, nextBestActionService.ts, progressDebugService.ts, marketplaceGovernorService.ts.
- **Lib/gamification:** src/lib/gamification/ — goal_evaluator.ts, level_evaluator.ts, reward_granter.ts, metricProviderAdapter.ts, types.ts, tests.
- **Workers:** src/workers/gamification/processCleanerGamification.ts, v2-operations/goalChecker.ts, scheduler.ts (cron), workerHandlers.
- **Metrics:** src/lib/metricsCalculator.ts, lib/gamificationMetrics.ts.

So the backend **already had** a full gamification pipeline: config loaders, evaluators, reward granting, effects, admin APIs, workers, and metrics.

### 2.4 Docs (already in backend)

- **docs/active/**  
  ARCHITECTURE.md (gamification in §3, 3.1–3.3), RUNBOOK.md (§4 Gamification support, §5 launch rollout), SETUP.md, DEPLOYMENT.md, MASTER_CHECKLIST.md, TROUBLESHOOTING.md, DECISIONS.md, FRONTEND_API_EXPECTATIONS.md, etc.
- No event contract, metrics contract, or spec-enforcement matrix docs before the merge.

---

## 3. What we did (merge as reference — we did NOT overwrite)

We did **not** overwrite your existing data or replace your running pipeline. We:

1. **Copied bundle docs** → `docs/active/gamification_bundle/` and `docs/active/gamification_bundle/docs/` (all 12 files).
2. **Copied bundle SQL** → `DB/migrations/bundle_reference/` (reference only; **did not run** these migrations).
3. **Copied bundle configs** (contracts only) → `src/config/cleanerLevels/contracts/` (event_contract_v1.json, metrics_contract_v1.json, event_to_metric_mapping_v1.json). We did **not** overwrite goals.json, levels.json, or rewards.json.
4. **Copied bundle code** → `src/gamification-bundle/` (reference only). We did **not** replace `src/lib/gamification/`, `src/services/`, or `src/routes/gamification.ts`.
5. **Merged canonical rules into docs** — We took the bundle’s **rules and constants** (meaningful login 15 min, message 25 chars, on-time ±15 min, GPS 250 m, good-faith 6/7 days, etc.) and added them to ARCHITECTURE §3.5 and RUNBOOK §4. So the *content* of the bundle docs that was “more complete” is now in your canonical docs; the bundle docs themselves sit alongside as reference.
6. **Documented the migration diff** — `DB/migrations/bundle_reference/README.md` explains exactly what differs between bundle SQL and 043–056 (pt_safety_reports, UUID vs TEXT, admin_users vs users, etc.).

So: **nothing that runs in production was overwritten.** The app still uses the same DB schema (043–056), the same config (cleanerLevels/*.json), and the same code (lib/gamification, services, routes, workers). The bundle exists as **reference and extra docs**.

---

## 4. Detailed diff: what’s different between bundle and backend

### 4.1 Documents

| Topic | Bundle (uploaded) | Backend (before merge) | After merge |
|-------|-------------------|-------------------------|-------------|
| Canonical rules + constants | PURETASK_GAMIFICATION_CURSOR_CONTEXT.md (15 min, 25 chars, 250 m, 18 h, 6/7 days, etc.) | In RUNBOOK support macros only, no single table | **ARCHITECTURE §3.5** and **RUNBOOK §4** now have the same rules + constants (from bundle). Bundle doc still in gamification_bundle/docs/. |
| Event contract | event_contract_v1.md + .json (full event stream spec) | Not present | **Copied** to gamification_bundle/docs/ and contracts/; not overwriting any backend doc. |
| Metrics contract | metrics_contract_v1.md + .json (every metric, config knobs) | Not present | **Copied** to gamification_bundle/docs/ and contracts/; not overwriting any backend doc. |
| Spec-enforcement matrix | spec_enforcement_matrix_v1.md (merge-gate checklist) | Not present | **Copied** to gamification_bundle/docs/. |
| Runtime config loading | runtime_config_loading.md | Mentioned briefly in ARCHITECTURE | **Copied** to gamification_bundle/docs/; ARCHITECTURE points to it. |
| Admin UI wireframe | admin_ui_wireframe_spec.md | Not present | **Copied** to gamification_bundle/docs/. |
| Migration run order | MIGRATION_RUN_ORDER.md | DB/migrations/README.md (different content) | **Copied** to gamification_bundle/docs/; backend README unchanged. |
| Cursor prompts / BUNDLE_README | CURSOR_PROMPTS.md, README.md, BUNDLE_README.md | Not present | **Copied** to gamification_bundle/docs/. |

So: **bundle docs added new reference material and enriched ARCHITECTURE/RUNBOOK; we did not overwrite ARCHITECTURE, RUNBOOK, or SETUP with the raw bundle files.**

### 4.2 Migrations (SQL)

| Item | Bundle | Backend (043–056) | Verdict |
|------|--------|-------------------|--------|
| pt_event_log, pt_engagement_* | cleaner_id/client_id **UUID**; no FK to users | **TEXT** + FK to users(id) | **Backend correct.** Do not run bundle event SQL. |
| pt_safety_reports | Yes (event-style: occurred_at, payload, photo_id, job_request_id) | **No** (backend has safety_reports only) | **Backend has different table** (safety_reports with job_offer_id, photo_url). We decided **not** to add pt_safety_reports; current setup is enough. |
| Reward grants, choice eligibilities | cleaner_id UUID | **TEXT** + users(id) | **Backend correct.** |
| gamification_season_rules | Yes (id uuid, start_at/end_at, enabled, rules) | **No**; backend has **season_rules** (id TEXT, starts_at/ends_at, is_enabled, regions, rule) + season_application_log | **Backend more complete.** Do not run bundle season table. |
| cleaner_goal_progress | Not in bundle | **Yes** in 048 | **Backend has more.** |
| admin_users | Yes; admin tables reference admin_users(id) | **No**; admin tables reference **users(id)** | **Backend design kept.** Do not add admin_users. |
| admin_audit_log | before / after | **before_state / after_state** | Same data; backend names clearer. |
| Idempotency, views, gamification_use_reward | Same as 050 | **050** | **Equivalent.** |

Full migration diff is in **DB/migrations/bundle_reference/README.md**.

### 4.3 Config files

| Config | Bundle | Backend (before) | After merge |
|--------|--------|-------------------|-------------|
| goals | puretask_goal_definitions_v1_1.json (bundle) | goals.json (cleanerLevels) | **Unchanged.** We did not overwrite goals.json. Bundle goal defs are in configs/ in the bundle folder only. |
| levels, rewards | config.json / config_v1_2.json (bundle) | levels.json, rewards.json (cleanerLevels) | **Unchanged.** We did not overwrite. |
| event_contract_v1.json | Yes | No | **Copied** to src/config/cleanerLevels/contracts/. |
| metrics_contract_v1.json | Yes | No | **Copied** to src/config/cleanerLevels/contracts/. |
| event_to_metric_mapping_v1.json | Yes | No | **Copied** to src/config/cleanerLevels/contracts/. |

So: **runtime config (goals, levels, rewards) was not overwritten.** Only the three contract JSONs were added under `contracts/`.

### 4.4 Code (TypeScript / Node)

| Area | Bundle (code/) | Backend (what runs) | After merge |
|------|----------------|---------------------|-------------|
| Goal / level / reward evaluation | goal_evaluator.ts, level_evaluator.ts, reward_granter.ts (bundle) | **src/lib/gamification/** goal_evaluator, level_evaluator, reward_granter + metricProviderAdapter | **Backend unchanged.** Bundle copy lives in **src/gamification-bundle/** (reference only). |
| Progression, rewards, effects | progression_service, reward_grant_service, reward_effects_service, reward_effects (bundle) | **cleanerGoalsService, gamificationRewardService, rewardEffectsService**, etc. | **Backend unchanged.** Bundle copy in src/gamification-bundle/. |
| Admin | admin_config_service, admin_budget_service, admin_audit_service, admin_governor_service, admin_feature_flag_service, admin_gamification (bundle) | **adminConfigService, adminBudgetService, adminAuditService**, admin routes, etc. | **Backend unchanged.** Bundle copy in src/gamification-bundle/. |
| Metrics / SQL | sql_metric_provider, in_memory_metric_provider (bundle) | **metricsCalculator, lib/gamificationMetrics, metricProviderAdapter** | **Backend unchanged.** |
| Worker | process_cleaner_gamification*, cleaners_gamification (bundle) | **processCleanerGamification** (workers/gamification), goalChecker, scheduler | **Backend unchanged.** |
| App entry | app.ts, client.ts (bundle) | **src/index.ts**, Express routes | **Backend unchanged.** |

So: **no production code was overwritten.** The bundle code is in **src/gamification-bundle/** and is **not** imported by the main app. The pipeline that runs is still the original backend (lib/gamification, services, routes, workers).

---

## 5. How the backend gamification works today (what actually runs)

1. **Config:** Loaded from **src/config/cleanerLevels/** (goals.json, levels.json, rewards.json, etc.) and optionally from DB via **runtimeConfigLoader** (admin_config_versions).
2. **Events:** App and workers write to **pt_event_log**, **pt_engagement_sessions**, **pt_engagement_actions** (047). Good-faith safety evidence goes to **safety_reports** (046).
3. **Metrics:** **metricsCalculator** / **gamificationMetrics** compute metric values from DB (jobs, clock-in/out, photos, messages, etc.).
4. **Goals / levels:** **cleanerGoalsService**, **gamificationProgressionService**, and **lib/gamification** (goal_evaluator, level_evaluator) evaluate progress and level eligibility.
5. **Rewards:** **gamificationRewardService**, **reward_granter**, **rewardEffectsService** grant and apply rewards (visibility, early exposure, fee discounts, etc.); **cashBudgetService** enforces caps; **feePolicyService** applies fee/instant-payout effects.
6. **Workers:** **processCleanerGamification** (and scheduler) expire rewards/choices, persist progress, grant rewards idempotently; **goalChecker** runs on job completion / triggers.
7. **Admin:** **adminConfigService**, **adminBudgetService**, **adminAuditService**, **admin_feature_flags**, **region_governor_config** — all use **users(id)**; no admin_users table.
8. **APIs:** Routes under **gamification.ts**, **admin/gamificationControl.ts**, **governor.ts**, **cleanerEnhanced.ts** expose progression, rewards, effects, debug, and admin controls.

All of that is **unchanged** by the merge. The bundle did not replace any of it.

---

## 6. What “overwrite everything with the new data” would mean

If you **did** overwrite everything with the bundle:

- **Docs:** You’d replace or heavily rewrite ARCHITECTURE, RUNBOOK, SETUP with the bundle’s docs. You’d lose backend-specific wiring (paths, service names, Trust API, etc.) unless you merged by hand.
- **Migrations:** You **must not** run the bundle SQL as-is (UUID vs TEXT, admin_users, pt_safety_reports, different season table). So “overwrite” for DB would mean either ignoring bundle SQL and keeping 043–056, or writing new migrations that match the bundle’s *intent* but with TEXT and users(id) — which is what 043–056 already do.
- **Config:** You’d overwrite goals.json, levels.json, rewards.json with the bundle’s versions. That could change goal IDs, reward IDs, and level rules and break existing progress or rewards if they’re tied to those IDs.
- **Code:** You’d replace src/lib/gamification, parts of services, and maybe routes with the bundle’s code. The bundle code expects UUID and admin_users and different imports; you’d have to refactor it to use TEXT and users(id) and your existing DB/client. So “overwrite” would be a large, error-prone refactor, not a drop-in replace.

So “overwrite everything” is **not** a safe one-step operation. The backend is already aligned with the bundle’s *behavior* and *schema intent* (with better fit to your DB and auth). What we did instead was **merge the bundle as reference** and **pull only the better doc content** (rules and constants) into your canonical docs.

---

## 7. What you should do before any “switch” or overwrite

### 7.1 Create a GitHub backup (recommended)

So you can always revert to “before the switch”:

1. **Commit any uncommitted changes** (so the backup is clean):
   - `git status`
   - `git add .` and `git commit -m "Pre-bundle-switch state"` if needed.

2. **Create a backup branch** (e.g. keeps current main as-is; backup is a named branch):
   - `git checkout -b backup-before-gamification-bundle-switch`
   - `git push -u origin backup-before-gamification-bundle-switch`

3. **Tag the same commit** (optional, for a clear “restore point”):
   - `git tag pre-gamification-bundle-switch`
   - `git push origin pre-gamification-bundle-switch`

4. **Go back to main** (or your main branch) to keep working:
   - `git checkout main`

If you ever need to “undo” a switch:  
`git checkout backup-before-gamification-bundle-switch`  
or  
`git checkout pre-gamification-bundle-switch`

### 7.2 Do you need to “overwrite” at all?

- **Current state:** Backend has the full pipeline (events, metrics, goals, levels, rewards, admin, workers). Bundle content is merged as **reference** (docs, contract JSONs, bundle_reference migrations, src/gamification-bundle code). Canonical rules and constants from the bundle are in ARCHITECTURE §3.5 and RUNBOOK §4.
- **Recommendation:** **Do not overwrite** production code or config with the bundle. Use the bundle as reference and, if needed, copy specific pieces (e.g. a new metric or goal shape) into your existing codebase after testing. If you still want a “bundle-first” codebase, do it on a **new branch** after creating the backup above, and plan for refactoring bundle code to use TEXT and users(id) and your existing services.

---

## 8. Short reference: where everything lives now

| What | Location |
|------|----------|
| **Bundle docs** (reference) | docs/active/gamification_bundle/ and docs/active/gamification_bundle/docs/ |
| **Bundle SQL** (reference only; do not run) | DB/migrations/bundle_reference/ |
| **Bundle code** (reference only; not wired) | src/gamification-bundle/ |
| **Contract JSONs** (from bundle) | src/config/cleanerLevels/contracts/ |
| **Canonical rules + constants** (from bundle, now canonical) | ARCHITECTURE §3.5, RUNBOOK §4 |
| **Migration diff (bundle vs 043–056)** | DB/migrations/bundle_reference/README.md |
| **What actually runs** | Same as before: 043–056 schema, src/config/cleanerLevels/*.json, src/lib/gamification, src/services, src/routes, src/workers |

---

**Last updated:** 2026-02 (after bundle merge). Use this doc before any overwrite and after creating a GitHub backup (branch + optional tag).
