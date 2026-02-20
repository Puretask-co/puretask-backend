# Gamification bundle migrations (reference only — do not run)

These SQL files are from the PureTask Gamification Master Bundle. **Do not run them directly on production.** The backend applies equivalent or stricter schema via 043–056 and `000_COMPLETE_CONSOLIDATED_SCHEMA.sql`. Below is a **detailed diff** of what differs or exists only in one side.

---

## Mapping (bundle → backend)

| Bundle file | Backend migration(s) |
|-------------|----------------------|
| `event_tables_migration_v1.sql` | `047` (event log + engagement); **pt_safety_reports** → see diff below |
| `step6_persistence_migration_v1_3.sql` | `043`, `048`, `054` (season table name differs) |
| `step8_reward_idempotency_migration_v1_4.sql` | `050` (same idempotency + choice TTL) |
| `step9_reward_effects_views_v1_5.sql` | `050` (same views + `gamification_use_reward`) |
| `step10_admin_control_plane_migration_v2_0.sql` | `051` (backend uses `users(id)`, no `admin_users`) |

Run order in the bundle: 1 → 2 → 3 → 4 → 5.

---

## Detailed diff: bundle vs backend 043–056

### 1) **pt_safety_reports (bundle only) — NOT in backend**

- **Bundle** (`event_tables_migration_v1.sql`): Creates **pt_safety_reports**  
  - Columns: `report_id` UUID PK, `cleaner_id` UUID, `job_request_id` UUID, `occurred_at`, `note`, `photo_id` UUID, `payload` JSONB.  
  - Index: `(cleaner_id, occurred_at)`.  
  - Event-stream style (occurred_at, payload) for metrics/contract.
- **Backend**: Has **safety_reports** (046) only:  
  - Columns: `id` UUID, `cleaner_id` TEXT FK users(id), `job_offer_id` UUID FK job_offers(id), `reason`, `note`, `photo_url` TEXT, `created_at`.  
  - Different name, different keys (`job_offer_id` vs `job_request_id`, `photo_url` vs `photo_id`), no `occurred_at`/`payload`.  
- **Conclusion:** Backend does **not** have the bundle’s **pt_safety_reports** table. If you need event-style safety reports for metrics_contract_v1 or event ingestion, add a **new migration** that creates `pt_safety_reports` with `cleaner_id TEXT REFERENCES users(id)` (and optional `job_request_id`) to stay consistent with backend types.

### 2) **Event/engagement tables: UUID vs TEXT for user IDs**

- **Bundle:** `pt_event_log.cleaner_id`/`client_id` UUID; `pt_engagement_sessions`/`pt_engagement_actions` use `cleaner_id` UUID with no FK to `users`.
- **Backend 047 / consolidated:** Same tables but `cleaner_id`/`client_id` **TEXT** and FKs to `users(id)`.  
- **Conclusion:** Backend is aligned with canonical `users.id` (TEXT). No action; do not run bundle event SQL as-is.

### 3) **Admin: admin_users (bundle) vs users (backend)**

- **Bundle step10:** Creates **admin_users** (id uuid, email, role, created_at, disabled_at). All admin tables reference `admin_users(id)` for `created_by`/`updated_by`/`actor_admin_user_id`.
- **Backend 051:** No `admin_users`. All admin tables use **users(id)** (TEXT) for `created_by`, `updated_by`, `actor_admin_user_id`.
- **Conclusion:** Backend uses a single `users` table; bundle uses a separate admin table. Backend design is already applied; no need to add `admin_users`.

### 4) **Audit log column names**

- **Bundle:** `admin_audit_log` has **before** and **after** (jsonb).
- **Backend 051:** **before_state** and **after_state**.  
- **Conclusion:** Same data; backend names are clearer. No migration needed.

### 5) **admin_reward_budget**

- **Bundle:** `region_id` text NULL; unique on `(scope, COALESCE(region_id,'__global__'))`.
- **Backend 051:** `region_id` TEXT NOT NULL DEFAULT `'__global__'`; UNIQUE (scope, region_id).  
- **Conclusion:** Same intent; backend is stricter. No action.

### 6) **Season rules table**

- **Bundle step6:** **gamification_season_rules** — id uuid, name, description, start_at, end_at, enabled, rules jsonb, created_at, updated_at. No application log.
- **Backend 054:** **season_rules** — id TEXT, name, description, starts_at, ends_at, is_enabled, regions TEXT[], rule jsonb, created_at, updated_at; plus **season_application_log**.  
- **Conclusion:** Backend has different name, TEXT id, `regions` array, and application log. Backend is more complete; do not run bundle step6 season table.

### 7) **cleaner_goal_progress**

- **Bundle step6:** Does not create this table.
- **Backend 048:** Creates **cleaner_goal_progress** (cleaner_id, goal_id, current_value, progress_ratio, completed, updated_at).  
- **Conclusion:** Backend has more (goal progress cache). No action.

### 8) **Step 8 / Step 9 (idempotency, views, function)**

- **Bundle step8 + step9:** Idempotency indexes, `expires_at` on choice eligibilities, views `gamification_active_reward_grants` / `gamification_cleaner_active_rewards`, function `gamification_use_reward(grant_id uuid)`.
- **Backend 050:** Same indexes, column, views, and function.  
- **Conclusion:** Equivalent; no action.

---

## Summary: what’s different or missing in backend

| Item | In bundle | In backend | Action |
|------|-----------|------------|--------|
| pt_safety_reports | Yes (event-style) | No (only safety_reports) | Optional: add migration for pt_safety_reports if event-stream safety is required |
| safety_reports | No | Yes (046) | Already in backend |
| admin_users | Yes | No (use users) | Keep backend design |
| Event/engagement FKs | UUID | TEXT → users(id) | Keep backend |
| season_rules vs gamification_season_rules | gamification_season_rules | season_rules + application_log | Keep backend |
| cleaner_goal_progress | No | Yes (048) | Keep backend |

**Only potential gap:** **pt_safety_reports**. Add a new migration (e.g. `057_pt_safety_reports.sql`) only if you need the bundle’s event-style safety report table for metrics or event ingestion; otherwise keep using `safety_reports` for good-faith decline evidence.
