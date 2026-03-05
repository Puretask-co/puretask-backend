# Gamification Backend – Implementation Guide

This document is a **detailed design and build guide** for implementing all gamification-related backend APIs and persistence. Use it in your **backend** codebase so the frontend (puretask-frontend) can persist flags, goals, rewards, governor, abuse actions, support debug, and cleaner trust signals.

**Frontend expectations:** The frontend already calls these endpoints (see `BACKEND_ENDPOINTS.md` and `src/services/gamificationAdmin.service.ts`). Implement the routes and response shapes below so the UI works with real data.

---

## Table of contents

1. [Auth & authorization](#1-auth--authorization)
2. [Feature flags (gamification)](#2-feature-flags-gamification)
3. [Goals library](#3-goals-library)
4. [Rewards](#4-rewards)
5. [Choice reward groups](#5-choice-reward-groups)
6. [Marketplace Health Governor](#6-marketplace-health-governor)
7. [Abuse / fraud monitor](#7-abuse--fraud-monitor)
8. [Support debug: cleaner gamification](#8-support-debug-cleaner-gamification)
9. [Cleaner profile: level and badges (client trust signals)](#9-cleaner-profile-level-and-badges-client-trust-signals)
10. [Cleaner-facing progress and goals](#10-cleaner-facing-progress-and-goals)
11. [Suggested data model (tables/entities)](#11-suggested-data-model-tablesentities)
12. [Error handling and status codes](#12-error-handling-and-status-codes)

---

## 1. Auth & authorization

- **Admin gamification routes** (`/admin/gamification/*`, `/admin/support/cleaner/:cleanerId/gamification`): require **admin** role. Return `403 Forbidden` if the user is not an admin.
- **Cleaner progress/goals/rewards** (`/cleaner/progress`, `/cleaner/goals`, etc.): require **cleaner** role; optionally ensure the authenticated user is the cleaner for that resource where applicable.
- **GET /cleaners/:id**: public or authenticated; if you add `level` and `badges`, they are **public** (client-facing trust signals). Do not expose internal scoring or raw metrics.

---

## 2. Feature flags (gamification)

**Purpose:** Global and optional per-region toggles for gamification, rewards, cash rewards, seasonal features, and the governor.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/gamification/flags` | Return current gamification flags (and optional region overrides). |
| PATCH | `/admin/gamification/flags` | Update one or more flags. |

### GET `/admin/gamification/flags`

- **Auth:** Admin only.
- **Response (200):**

```json
{
  "gamification_enabled": true,
  "rewards_enabled": true,
  "cash_rewards_enabled": false,
  "seasonal_enabled": true,
  "governor_enabled": true,
  "region_overrides": {
    "north": { "governor_enabled": false },
    "south": { "rewards_enabled": false }
  }
}
```

- **Field rules:**
  - All five keys are booleans: `gamification_enabled`, `rewards_enabled`, `cash_rewards_enabled`, `seasonal_enabled`, `governor_enabled`.
  - `region_overrides` is optional. Keys are region identifiers (e.g. `north`, `south`); values are partial flag sets that override the global value for that region only.

### PATCH `/admin/gamification/flags`

- **Auth:** Admin only.
- **Request body:** Partial JSON; only send keys you want to update.

```json
{
  "gamification_enabled": false,
  "cash_rewards_enabled": true
}
```

Or with region overrides:

```json
{
  "region_overrides": {
    "north": { "governor_enabled": false }
  }
}
```

- **Response (200):** Same shape as GET (full current state after update).
- **Persistence:** Store in a key-value table (e.g. `system_settings` or `gamification_flags`) keyed by flag name and optionally by region. If no row exists, use a sensible default (e.g. all `true` except `cash_rewards_enabled: false`).

---

## 3. Goals library

**Purpose:** Admin defines goals (core, stretch, maintenance) per level with metric, target, and window. Cleaner app uses these to drive progress and rewards.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/gamification/goals` | List goals (optional filters). |
| GET | `/admin/gamification/goals/:id` | Single goal by ID. |
| POST | `/admin/gamification/goals` | Create goal. |
| PATCH | `/admin/gamification/goals/:id` | Update goal (optionally with versioning). |

### Query params for GET `/admin/gamification/goals`

- `level` (number, optional): filter by level (1–10).
- `type` (string, optional): `core` | `stretch` | `maintenance`.
- `enabled` (boolean, optional): filter by enabled.

### Response shape (list)

**GET `/admin/gamification/goals`** → 200:

```json
{
  "goals": [
    {
      "id": "goal-uuid-1",
      "title": "Complete 30 add-ons",
      "description": "Complete 30 add-on services within the current level window.",
      "level": 2,
      "type": "core",
      "metric_key": "add_on_completions",
      "operator": "gte",
      "target": 30,
      "window": "last_30_days",
      "filters": null,
      "enabled": true,
      "effective_at": "2026-01-01T00:00:00Z",
      "version": 1,
      "updated_at": "2026-02-10T12:00:00Z"
    }
  ]
}
```

### Single goal (GET by id, POST response, PATCH response)

Each goal object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | yes | Unique ID. |
| title | string | yes | Short label (e.g. "Complete 30 add-ons"). |
| description | string | no | Longer explanation. |
| level | number | yes | Level 1–10 this goal belongs to. |
| type | string | yes | `core` \| `stretch` \| `maintenance`. |
| metric_key | string | no | e.g. `add_on_completions`, `on_time_rate`, `dispute_free_jobs`. |
| operator | string | no | e.g. `gte`, `lte`, `eq`. |
| target | number or string | yes | Target value (number or string for display, e.g. `"90%"`). |
| window | string | no | e.g. `last_30_days`, `last_jobs_10`, `lifetime`. |
| filters | object | no | JSON for extra filters (e.g. region, job type). |
| enabled | boolean | yes | Whether goal is active. |
| effective_at | string (ISO 8601) | no | When this version became effective. |
| version | number | no | Version for rollback. |
| updated_at | string (ISO 8601) | yes | Last update time. |

### POST `/admin/gamification/goals` body

Send any subset of the fields above (except `id`, `updated_at`). Server generates `id`, `updated_at`, and optionally `version` (1) and `effective_at` (now).

### PATCH `/admin/gamification/goals/:id` body

Send only fields to update. Optionally support versioning: increment `version` and set `effective_at` to now when publishing a new version.

---

## 4. Rewards

**Purpose:** Admin defines rewards (visibility, cash, badge, etc.) with duration, usage limits, and stacking. Rewards are attached to goals or levels and granted when conditions are met.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/gamification/rewards` | List all reward definitions. |
| GET | `/admin/gamification/rewards/:id` | Single reward by ID (for admin edit). |
| POST | `/admin/gamification/rewards` | Create reward. |
| PATCH | `/admin/gamification/rewards/:id` | Update reward. |

### Response shape (list)

**GET `/admin/gamification/rewards`** → 200:

```json
{
  "rewards": [
    {
      "id": "reward-uuid-1",
      "kind": "visibility",
      "name": "Priority Visibility",
      "duration_days": 14,
      "usage_limit": null,
      "stacking": "replace",
      "permanent": false,
      "enabled": true,
      "updated_at": "2026-02-10T12:00:00Z"
    }
  ]
}
```

### Reward object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string (UUID) | yes | Unique ID. |
| kind | string | yes | e.g. `visibility`, `cash`, `badge`. |
| name | string | no | Display name. |
| duration_days | number | no | How long the reward lasts (null if usage-based). |
| usage_limit | number | no | Max uses (null if duration-based or unlimited). |
| stacking | string | no | e.g. `replace`, `stack`, `none`. |
| permanent | boolean | no | If true, does not expire. |
| enabled | boolean | yes | Active or disabled. |
| updated_at | string (ISO 8601) | yes | Last update. |

POST body: same fields except `id` and `updated_at`. PATCH body: partial fields to update.

---

## 5. Choice reward groups

**Purpose:** When a cleaner earns a "choice" reward (e.g. "choose one of these"), the admin defines the group of options, eligibility window, and expiration. Cleaner selects one; backend records the selection and grants that reward.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/gamification/choices` | List choice reward groups. |
| GET | `/admin/gamification/choices/:id` | Single choice group with options. |
| POST | `/admin/gamification/choices` | Create choice group. |
| PATCH | `/admin/gamification/choices/:id` | Update group (options, eligibility, expiry). |

### GET `/admin/gamification/choices` → 200

```json
{
  "choice_groups": [
    {
      "id": "choice-uuid-1",
      "title": "Level 4 completion reward",
      "reward_ids": ["reward-uuid-1", "reward-uuid-2"],
      "eligibility_window_days": 14,
      "expires_at": "2026-03-01T00:00:00Z",
      "enabled": true,
      "updated_at": "2026-02-10T12:00:00Z"
    }
  ]
}
```

### Choice group object

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Unique ID. |
| title | string | Admin label. |
| reward_ids | string[] | IDs of rewards the cleaner can choose from (choose one). |
| eligibility_window_days | number | Days after earning that the cleaner has to choose. |
| expires_at | string (ISO 8601) | Optional hard expiry. |
| enabled | boolean | Active or disabled. |
| updated_at | string (ISO 8601) | Last update. |

POST/PATCH: same shape (partial for PATCH). Backend should validate that `reward_ids` reference existing rewards.

### Cleaner-facing: record selection

- When a cleaner selects one option from a choice group, the frontend will call **POST `/cleaner/rewards/choice/:choiceGroupId/select`** with body `{ "reward_id": "reward-uuid-1" }`. Implement this in the cleaner rewards flow: validate eligibility, record selection, grant the chosen reward, and mark the choice as used so it cannot be selected again.
- Return **409 Conflict** (or 422) with a clear message if the cleaner has already selected for this choice group (e.g. `"Choice already made"`). The frontend can show a toast and refresh.

---

## 6. Marketplace Health Governor

**Purpose:** Per-region tuning of supply/demand, fill time, and multipliers/caps (e.g. early exposure minutes, reward caps). Admin views state and can apply recommended changes or manual overrides and lock regions.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/gamification/governor` | Current governor state per region. |
| PATCH | `/admin/gamification/governor` | Apply overrides or recommended values. |

### GET `/admin/gamification/governor` → 200

Return a structure the frontend can render as a table. Example:

```json
{
  "regions": [
    {
      "region": "north",
      "supply_score": 72,
      "demand_score": 85,
      "fill_time_hours": 2.1,
      "early_exposure_min": 10,
      "cap_multiplier": 1.0,
      "locked": false,
      "updated_at": "2026-02-10T12:00:00Z"
    }
  ],
  "recommended_changes": []
}
```

- `recommended_changes`: optional array of suggested adjustments (e.g. "increase early_exposure_min for north by 5") for the "Apply recommended" button.
- If you prefer a flat list keyed by region, the frontend can accept either `regions` array or a map; document the shape you choose.

### PATCH `/admin/gamification/governor` body

Example:

```json
{
  "overrides": [
    { "region": "north", "early_exposure_min": 15, "locked": false }
  ]
}
```

Or:

```json
{
  "apply_recommended": true
}
```

Response: same shape as GET (current state after update). The frontend admin Governor page has "Apply recommended", "Lock region", and "Reset overrides" buttons; wiring these will call PATCH with the above shapes.

### Persistence

Store per-region governor settings (supply/demand inputs, fill time, early_exposure_min, cap_multiplier, locked) in a table (e.g. `governor_region_settings`). Recompute or cache metrics (e.g. supply_score, demand_score) from jobs/cleaners if needed.

---

## 7. Abuse / fraud monitor

**Purpose:** Surface signals (spam messages, login farming, photo timestamp violations, decline abuse) and allow admin to pause rewards for a cleaner, require review, or open a case.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/gamification/abuse` | List abuse/fraud signals (paginated). |
| POST | `/admin/gamification/abuse/:cleanerId/pause-rewards` | Pause rewards for a cleaner. |

### GET `/admin/gamification/abuse`

- **Query params:** `type` (optional): `spam_messages` | `login_farming` | `photo_timestamp` | `decline_abuse`. Omit or use a sentinel value for "all types". `page` (optional, default 1). `per_page` (optional, default 20).
- **Response (200):**

```json
{
  "items": [
    {
      "id": "signal-uuid-1",
      "cleaner_id": "user-uuid-cleaner",
      "cleaner_name": "Jane D.",
      "type": "spam_messages",
      "severity": "medium",
      "detail": "High message volume, similar content",
      "detected_at": "2026-02-13T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 42
  }
}
```

- **Severity:** `low` | `medium` | `high`. Derive from rules or thresholds.
- **Persistence:** Either real-time computed from logs/events or a table of "abuse_signals" populated by jobs (e.g. message volume, photo timestamps, decline rates). Cleaner name can be joined from users/cleaners.
- **Frontend:** Currently sends `type` when filtering by tab; may later send `page` and `per_page` for pagination. Always return `pagination` so the UI can show total count and add paging.

### POST `/admin/gamification/abuse/:cleanerId/pause-rewards`

- **Auth:** Admin only.
- **Body (optional):**

```json
{
  "reason": "Spam message pattern detected. Under review."
}
```

- **Response:** 204 No Content or 200 with `{ "ok": true }`.
- **Side effect:** Set a flag or row (e.g. `cleaner_reward_pause`: cleaner_id, paused_until optional, reason, admin_id, created_at). All logic that grants or applies rewards for this cleaner must check this flag and skip (or reduce) rewards while paused.

---

## 8. Support debug: cleaner gamification

**Purpose:** Support agents view a cleaner's gamification state in one place: level, goal progress, why progress is paused, reward grant history, and computed metrics. Optional guarded actions: recompute, grant reward manually, remove reward, and copy a support-friendly explanation.

### Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/support/cleaner/:cleanerId/gamification` | Full gamification debug view for one cleaner. |
| POST | `/admin/support/cleaner/:cleanerId/gamification/recompute` | Recompute level and goal progress (optional). |
| POST | `/admin/support/cleaner/:cleanerId/gamification/grant-reward` | Grant a reward manually (guarded). |
| POST | `/admin/support/cleaner/:cleanerId/gamification/remove-reward` | Remove an active reward (guarded). |

### GET `/admin/support/cleaner/:cleanerId/gamification` → 200

Response should contain everything the support UI needs:

```json
{
  "cleaner_id": "user-uuid-cleaner",
  "current_level": 4,
  "level_label": "Trusted Pro",
  "progress_paused": false,
  "progress_paused_reason": null,
  "core_completion_percent": 72,
  "stretch_selected": true,
  "maintenance_ok": true,
  "goal_progress": [
    {
      "goal_id": "goal-uuid-1",
      "title": "Complete 45 add-ons",
      "current": 27,
      "target": 45,
      "window": "last_30_days",
      "status": "in_progress"
    }
  ],
  "active_rewards": [
    {
      "reward_id": "reward-uuid-1",
      "name": "Priority Visibility",
      "granted_at": "2026-02-01T00:00:00Z",
      "expires_at": "2026-02-15T00:00:00Z"
    }
  ],
  "reward_grant_history": [
    {
      "reward_id": "reward-uuid-1",
      "name": "Priority Visibility",
      "granted_at": "2026-02-01T00:00:00Z",
      "trigger": "goal_completed",
      "goal_id": "goal-uuid-2"
    }
  ],
  "computed_metrics_debug": {
    "on_time_rate_last_30": 0.92,
    "acceptance_rate_non_good_faith": 0.88,
    "add_on_completions_in_window": 27,
    "dispute_free_jobs_in_window": 12
  },
  "support_explanation": "Level 4 (Trusted Pro). Core 72% complete. Stretch selected. Maintenance OK. Progress not paused. Active reward: Priority Visibility until 2026-02-15."
}
```

- **support_explanation:** Short, plain-English paragraph for "Copy explanation" (support macro). Generate from the same data so it stays in sync.

### POST `/admin/support/cleaner/:cleanerId/gamification/recompute`

- **Body:** Empty or `{}`.
- **Response:** 200 with updated payload (same shape as GET) or 204.
- **Side effect:** Recompute level, core/stretch/maintenance completion, and "progress paused" from current metrics and rules; persist so GET returns fresh values.

### POST `/admin/support/cleaner/:cleanerId/gamification/grant-reward`

- **Body:**

```json
{
  "reward_id": "reward-uuid-1",
  "reason": "Support override: customer compensation",
  "duration_days": 7
}
```

- **Response:** 200 with updated `active_rewards` / `reward_grant_history` or 204.
- **Guarded:** Require admin role; optionally require a "support override" permission or audit log entry.

### POST `/admin/support/cleaner/:cleanerId/gamification/remove-reward`

- **Body:**

```json
{
  "reward_id": "reward-uuid-1",
  "reason": "Granted in error"
}
```

- **Response:** 200 or 204.
- **Side effect:** Remove or expire the active reward for this cleaner; append to grant history as "removed" so support has a trail.

---

## 9. Cleaner profile: level and badges (client trust signals)

**Purpose:** The **public** cleaner profile (used by clients when browsing cleaners) should expose minimal trust signals: level (1–10) and a few top badges. No internal scoring or raw metrics.

### Endpoint to extend

- **GET `/cleaners/:id`** (existing). Frontend expects `{ cleaner: Cleaner }`. Extend the `cleaner` object with two optional fields.

### Add to the cleaner object

| Field | Type | Description |
|-------|------|-------------|
| level | number (1–10) | Current gamification level. Omit if gamification disabled or not computed. |
| badges | array | Top badges to show (e.g. up to 3–5). Omit if none. |

### Badge object (in `cleaner.badges[]`)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique badge id (e.g. `on_time_pro`, `photo_perfect`). |
| name | string | Display name (e.g. "On-Time Pro"). |
| icon | string | Optional emoji or icon code (e.g. `"⏱️"`). |

Example extended response:

```json
{
  "cleaner": {
    "id": "user-uuid",
    "name": "Jane Doe",
    "avatar_url": "...",
    "rating": 4.9,
    "reviews_count": 120,
    "verified": true,
    "background_checked": true,
    "level": 4,
    "badges": [
      { "id": "on_time_pro", "name": "On-Time Pro", "icon": "⏱️" },
      { "id": "photo_perfect", "name": "Photo Perfect", "icon": "📸" }
    ]
  }
}
```

- **Source of truth:** Level comes from your gamification level computation (same as support debug). Badges can be a fixed list of "profile-visible" badges; for each badge, check if the cleaner has earned it (from a `cleaner_badges` or achievements table) and only include earned ones. Order by "priority" or "most recent" and slice to top 3–5.

---

## 10. Cleaner-facing progress and goals

**Purpose:** Cleaners see their progress hub, goals list, goal detail, rewards, and maintenance. Backend must expose read-only progress and goals keyed by the authenticated cleaner.

### Existing endpoint (from BACKEND_ENDPOINTS.md)

- **GET `/cleaner/goals`** – already listed under "Cleaner Enhanced". Frontend expects a list of goals with progress for the current cleaner.

Suggested response shape (aligned with frontend):

```json
{
  "goals": [
    {
      "id": "goal-uuid-1",
      "type": "core",
      "title": "Complete 45 add-ons",
      "current": 27,
      "target": 45,
      "window": "last_30_days",
      "counts_when": "Add-on services completed in the last 30 days.",
      "reward_preview": "Priority Visibility 14 days"
    }
  ]
}
```

- **Important:** `type` must be the goal type: `core` | `stretch` | `maintenance` (not the metric key). Use `metric_key` in the goals library for the underlying metric (e.g. `add_on_completions`). The frontend uses `type` for filtering (e.g. level detail page) and for display.
- **Source:** Use the same goals from the admin goals library (enabled, by level). For each goal, compute `current` from your metrics store. Filter to goals for the cleaner's current level. Optionally include **`counts_when`** and **`reward_preview`** for the goal-detail UI.

### New or extended: GET `/cleaner/progress`

Frontend progress hub needs: level, core completion %, stretch selected, maintenance ok, next best actions, active rewards. Either:

- Add **GET `/cleaner/progress`** that returns one payload, or
- Keep using **GET `/cleaner/goals`** and have the frontend derive progress from goals; and add a small **GET `/cleaner/progress/summary`** that returns only `{ current_level, level_label, core_completion_percent, stretch_selected, maintenance_ok, progress_paused, progress_paused_reason }`.

Example **GET `/cleaner/progress`** or **GET `/cleaner/progress/summary`** → 200:

```json
{
  "current_level": 4,
  "level_label": "Trusted Pro",
  "core_completion_percent": 72,
  "stretch_selected": true,
  "maintenance_ok": true,
  "progress_paused": false,
  "progress_paused_reason": null,
  "active_rewards": [
    {
      "reward_id": "reward-uuid-1",
      "name": "Priority Visibility",
      "effect": "Early exposure +10 min for 14 days",
      "expires_at": "2026-02-15T00:00:00Z",
      "days_remaining": 7
    }
  ]
}
```

- **Next best actions:** Can be computed server-side (e.g. "complete 3 more add-ons") and added as `next_best_actions: [{ title, description, action_href?, action_label?, unlock_preview? }]`, or left for the frontend to derive from goals and progress.
- **Optional:** Include `recovery_steps: string[]` when `progress_paused` is true so the Maintenance page can show recovery steps. The frontend also calls GET `/cleaner/maintenance` for the same fields; you may return them in progress or in a dedicated maintenance endpoint.

### GET `/cleaner/badges` (authenticated cleaner)

- **Auth:** Cleaner only.
- **Response (200):** `{ "badges": [ { "id", "name", "icon?", "earned", "earned_date?", "how_to_earn?", "featured?", "can_pin?", "category?" } ] }`. `category` is `core` | `fun`. Used by the Badges page and Recent achievements on Progress.

### GET `/cleaner/rewards` (authenticated cleaner)

- **Auth:** Cleaner only.
- **Response (200):** `{ "active_rewards": [ { "reward_id", "name", "effect?", "expires_at?", "days_remaining?", "applies_to?" } ], "reward_history": [ { "reward_id", "name", "granted_at", "trigger?", "goal_id?", "effect?" } ], "choice_eligible": [ { "choice_group_id", "title", "reward_options": [ { "reward_id", "name", "effect?" } ], "expires_at?" } ] }`. Used by the Rewards Center (Active, Earned, Choice tabs). Omit choice groups the cleaner has already selected.

### GET `/cleaner/stats` (authenticated cleaner)

- **Auth:** Cleaner only.
- **Response (200):** `{ "on_time_rate?", "acceptance_rate?", "photo_compliance?", "avg_rating?", "disputes_opened_lost?", "add_on_completions?" }`. Values can be number or string. Used by the Stats page.

### GET `/cleaner/maintenance` (authenticated cleaner)

- **Auth:** Cleaner only.
- **Response (200):** `{ "progress_paused", "progress_paused_reason?", "recovery_steps?" }`. When paused, set reason and recovery_steps. Optional if the same fields are returned in GET `/cleaner/progress`.

---

## 11. Suggested data model (tables/entities)

Use this as a starting point; adapt to your DB and conventions.

- **gamification_flags**  
  Key (e.g. `gamification_enabled`, or `region:north:governor_enabled`), value (boolean or JSON), updated_at.

- **goals**  
  id (PK), title, description, level, type (core/stretch/maintenance), metric_key, operator, target (numeric or string), window, filters (JSON), enabled, effective_at, version, created_at, updated_at.

- **rewards**  
  id (PK), kind, name, duration_days, usage_limit, stacking, permanent, enabled, created_at, updated_at.

- **goal_rewards**  
  goal_id (FK), reward_id (FK), optional sort/priority. Links goals to rewards.

- **choice_groups**  
  id (PK), title, reward_ids (JSON array or separate table), eligibility_window_days, expires_at, enabled, updated_at.

- **cleaner_choice_selections**  
  cleaner_id, choice_group_id, selected_reward_id, selected_at. One row per (cleaner, choice_group).

- **governor_region_settings**  
  region (PK), supply_score, demand_score, fill_time_hours, early_exposure_min, cap_multiplier, locked, updated_at.

- **cleaner_gamification_state** (or equivalent)  
  cleaner_id (PK), current_level, level_updated_at, stretch_goal_id (nullable), maintenance_ok, progress_paused, progress_paused_reason, updated_at.

- **cleaner_reward_grants**  
  id (PK), cleaner_id, reward_id, granted_at, expires_at (nullable), trigger (e.g. goal_completed, manual), goal_id (nullable), granted_by (admin user id if manual).

- **cleaner_reward_pause**  
  cleaner_id (PK), paused_at, reason, paused_until (nullable), admin_id.

- **abuse_signals** (optional)  
  id (PK), cleaner_id, type, severity, detail, detected_at. Or compute on the fly from logs.

- **cleaner_badges** (or achievements)  
  cleaner_id, badge_id, earned_at. Badge definitions can be static (e.g. on_time_pro, photo_perfect) with names and icons.

- **metrics cache** (optional)  
  cleaner_id, metric_key (e.g. add_on_completions_last_30_days), value, computed_at. Refreshed by jobs or a cron so progress and goals can be computed quickly.

### 11.1 SQL migrations in this codebase

**No new migrations are required** to implement this spec. The following existing migrations already provide the tables and columns:

| Spec concept | Migration(s) | Table(s) / notes |
|--------------|--------------|------------------|
| gamification_flags | 051 | `admin_feature_flags` (key, region_id, enabled); API maps to five booleans + region_overrides. |
| goals | 058 | `gamification_goals` (id, title, level, type, metric_key, target, window, enabled, version, …). |
| rewards | 058 | `gamification_rewards` (id, kind, name, duration_days, stacking, permanent, enabled, …). |
| goal_rewards | — | **Optional.** No table yet; link can be in app config or add a `goal_rewards` (goal_id, reward_id, sort) migration if you want explicit FK linking. |
| choice_groups | 058 | `gamification_choice_groups` (id, title, reward_ids JSONB, eligibility_window_days, expires_at, enabled). |
| cleaner_choice_selections | 048 | `gamification_choice_eligibilities` (cleaner_id, choice_group_id, selected_reward_id, selected_at, status). |
| governor_region_settings | 051, 056, 058 | `region_governor_config` (058 adds supply_score, demand_score, fill_time_hours, early_exposure_min, cap_multiplier, locked); `region_governor_state` for computed state. |
| cleaner_gamification_state | 043, 048 | `cleaner_level_progress` (cleaner_id, current_level, maintenance_paused, maintenance_paused_reason); `cleaner_goal_progress` for per-goal progress. |
| cleaner_reward_grants | 048, 050 | `gamification_reward_grants` (cleaner_id, reward_id, granted_at, ends_at, source_type, source_id, status). |
| cleaner_reward_pause | 058 | `cleaner_reward_pause` (cleaner_id, reason, paused_until, admin_id). |
| abuse_signals | 058 | `abuse_signals` (id, cleaner_id, type, severity, detail, detected_at). |
| cleaner_badges | 053, consolidated | `cleaner_badges` (cleaner_id, badge_id, earned_at). |
| metrics cache | — | **Optional.** `cleaner_goal_progress` (048) caches goal progress; no separate metrics cache table; add one if you want precomputed metric_key/value. |

**Relevant migration files:** `043_cleaner_level_system.sql`, `048_gamification_reward_grants_and_choices.sql`, `050_gamification_reward_idempotency_and_effects.sql`, `051_gamification_admin_control_plane.sql`, `053_gamification_badges.sql`, `056_marketplace_health_governor.sql`, `058_gamification_frontend_spec_tables.sql` (and consolidated schema if you apply that).

---

## 12. Error handling and status codes

- **400 Bad Request:** Invalid body or query params (e.g. invalid `type` filter, missing required field).
- **401 Unauthorized:** Missing or invalid auth token.
- **403 Forbidden:** Valid auth but not admin (for admin routes) or not allowed to access that cleaner.
- **404 Not Found:** Goal/reward/choice/cleaner not found by id.
- **409 Conflict:** Optional for "choice already made" or "reward already granted".
- **422 Unprocessable Entity:** Business rule violation (e.g. reward not in choice group, cleaner not eligible).
- **500 Internal Server Error:** Unexpected server error; do not expose internal details in the response body.

Return a consistent error body so the frontend can show toasts, e.g.:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required."
  }
}
```

---

## Summary checklist for backend

- [ ] **Flags:** GET/PATCH `/admin/gamification/flags`; persist and return global + optional region_overrides.
- [ ] **Goals:** GET (list + by id), POST, PATCH `/admin/gamification/goals`; persist with level, type, metric, target, window, enabled, versioning.
- [ ] **Rewards:** GET, POST, PATCH `/admin/gamification/rewards`; persist reward definitions.
- [ ] **Choices:** GET (list + by id), POST, PATCH `/admin/gamification/choices`; persist choice groups and POST `/cleaner/rewards/choice/:id/select` to record selection and grant reward (return 409 if already selected).
- [ ] **Governor:** GET/PATCH `/admin/gamification/governor`; persist per-region settings and optional recommended_changes.
- [ ] **Abuse:** GET `/admin/gamification/abuse` (with type, page, per_page); POST `/admin/gamification/abuse/:cleanerId/pause-rewards`; persist pause state and optionally abuse_signals; return pagination.
- [ ] **Support debug:** GET `/admin/support/cleaner/:cleanerId/gamification` (full payload); optional POST recompute, grant-reward, remove-reward with guarded access and audit.
- [ ] **Cleaner profile:** Extend GET `/cleaners/:id` with `level` and `badges[]` (id, name, icon) for client trust signals.
- [ ] **Cleaner progress:** GET `/cleaner/goals` with progress (current/target), **type** (core|stretch|maintenance), counts_when, reward_preview; GET `/cleaner/progress` or `/cleaner/progress/summary` with level, core %, stretch, maintenance, active_rewards, optional next_best_actions and recovery_steps.
- [ ] **Cleaner badges:** GET `/cleaner/badges` returning `{ badges: [] }` with id, name, icon, earned, earned_date, how_to_earn, category.
- [ ] **Cleaner rewards:** GET `/cleaner/rewards` returning active_rewards, reward_history, choice_eligible.
- [ ] **Cleaner stats:** GET `/cleaner/stats` returning on_time_rate, acceptance_rate, photo_compliance, avg_rating, disputes_opened_lost, add_on_completions.
- [ ] **Cleaner maintenance:** GET `/cleaner/maintenance` returning progress_paused, progress_paused_reason, recovery_steps (or include in progress response).
- [ ] **Auth:** Enforce admin for admin routes; cleaner for cleaner routes; public or auth for GET `/cleaners/:id` with level/badges only (no internal metrics).

Once these are implemented, the frontend can remove fallbacks and rely on your API for persistence and display.

---

## Quick reference: all gamification-related routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/admin/gamification/flags` | Admin | Get gamification flags |
| PATCH | `/admin/gamification/flags` | Admin | Update flags |
| GET | `/admin/gamification/goals` | Admin | List goals (query: level, type, enabled) |
| GET | `/admin/gamification/goals/:id` | Admin | Get goal by id |
| POST | `/admin/gamification/goals` | Admin | Create goal |
| PATCH | `/admin/gamification/goals/:id` | Admin | Update goal |
| GET | `/admin/gamification/rewards` | Admin | List rewards |
| GET | `/admin/gamification/rewards/:id` | Admin | Get reward by id |
| POST | `/admin/gamification/rewards` | Admin | Create reward |
| PATCH | `/admin/gamification/rewards/:id` | Admin | Update reward |
| GET | `/admin/gamification/choices` | Admin | List choice groups |
| GET | `/admin/gamification/choices/:id` | Admin | Get choice group |
| POST | `/admin/gamification/choices` | Admin | Create choice group |
| PATCH | `/admin/gamification/choices/:id` | Admin | Update choice group |
| GET | `/admin/gamification/governor` | Admin | Get governor state |
| PATCH | `/admin/gamification/governor` | Admin | Apply overrides / recommended |
| GET | `/admin/gamification/abuse` | Admin | List abuse signals (query: type, page, per_page) |
| POST | `/admin/gamification/abuse/:cleanerId/pause-rewards` | Admin | Pause rewards for cleaner |
| GET | `/admin/support/cleaner/:cleanerId/gamification` | Admin | Support debug view |
| POST | `/admin/support/cleaner/:cleanerId/gamification/recompute` | Admin | Recompute progress (optional) |
| POST | `/admin/support/cleaner/:cleanerId/gamification/grant-reward` | Admin | Grant reward manually (guarded) |
| POST | `/admin/support/cleaner/:cleanerId/gamification/remove-reward` | Admin | Remove reward (guarded) |
| GET | `/cleaners/:id` | Public/Auth | Get cleaner profile; **include level, badges** |
| GET | `/cleaner/goals` | Cleaner | List my goals with progress (type = core\|stretch\|maintenance) |
| GET | `/cleaner/progress` or `/cleaner/progress/summary` | Cleaner | Progress hub summary |
| GET | `/cleaner/badges` | Cleaner | List badges with earned status |
| GET | `/cleaner/rewards` | Cleaner | Active rewards, reward history, choice-eligible groups |
| GET | `/cleaner/stats` | Cleaner | Metrics for Stats page |
| GET | `/cleaner/maintenance` | Cleaner | Paused status and recovery steps (optional if in progress) |
| POST | `/cleaner/rewards/choice/:choiceGroupId/select` | Cleaner | Select one reward (body: `{ "reward_id": "..." }`); return 409 if already selected |
