# PureTask Gamification System — Cursor Context Pack

> **Use this file** when working on gamification, governor, or rollout features.  
> Treat it as the source of truth for rules, artifact locations, and wiring.
>
> **If pasting a gamification conversation into Cursor:** Tell Cursor: *"Read docs/active/CURSOR_CONTEXT.md first — it maps the system to this repo."*

---

## 0) What this system is

A **Cleaner Progression + Rewards + Anti-Gaming + Admin Control Plane** for the PureTask marketplace.

**Locked product truths**
- Levels never go down.
- Progress/rewards can pause if maintenance fails (levels remain).
- Customers always choose cleaners.
- "Boosts" are ranking multipliers / early exposure (never guarantees).
- Anti-gaming enforced for login, messaging, photos.

---

## 1) Core rules (canonical)

### Meaningful login
A "login day" counts only if within **15 minutes** of opening the app the cleaner performs ≥1 meaningful action:
- open job request, accept/decline, send meaningful message, status taps, upload photos, update availability.

### Meaningful messages
Counts if: quick template OR ≥ 25 chars OR customer replies within 24h.

### Photo verification
≥ 1 BEFORE + ≥ 1 AFTER photo; timestamps between clock-in and clock-out.

### On-time + GPS
- ±15 minutes of scheduled start
- GPS ≤ 250m at clock-in

### Good-faith declines
Do NOT hurt acceptance: distance (≥11 mi), time conflict, job mismatch, safety, short notice (<18h). Limit: 6 per 7 days.

### Key constants
- Login window: 15 min
- Message threshold: 25 chars OR template OR reply within 24h
- On-time: ±15 min, GPS 250m
- Short notice: < 18 hours
- Good-faith limit: 6 per 7 days
- Distance penalty-free: ≥ 11 miles from home

---

## 2) Repo artifact map (actual paths)

### DB migrations
- `DB/migrations/043_cleaner_level_system.sql` — levels, goals, progress
- `DB/migrations/044_meaningful_login_and_attribution.sql`
- `DB/migrations/045_gamification_expansion.sql`
- `DB/migrations/047_gamification_event_ingestion.sql`
- `DB/migrations/048_gamification_reward_grants_and_choices.sql`
- `DB/migrations/049_gamification_sql_helpers.sql`
- `DB/migrations/050_gamification_reward_idempotency_and_effects.sql`
- `DB/migrations/051_gamification_admin_control_plane.sql` — admin config, budget, governor config, feature flags
- `DB/migrations/052_gamification_cash_budget_enforcement.sql`
- `DB/migrations/053_gamification_badges.sql`
- `DB/migrations/054_gamification_seasonal_challenges.sql`
- `DB/migrations/055_gamification_ops_views.sql`
- `DB/migrations/056_marketplace_health_governor.sql` — metrics, state, audit

### Events table
- **`pt_event_log`** (NOT `event_store`): `event_type`, `occurred_at`, `payload` (JSONB)
- Write via `eventIngestionService.ts`
- Set `EVENT_TABLE_NAME=pt_event_log` if any external scripts expect a different name

### Services
- `src/services/cleanerLevelService.ts` — level progress, goals
- `src/services/gamificationProgressionService.ts` — engine-based progression
- `src/services/gamificationRewardService.ts` — rewards, choices, grants
- `src/services/cashBudgetService.ts` — cash caps, spend checks
- `src/services/badgeService.ts` — badges, achievement feed
- `src/services/seasonService.ts` — seasonal challenges
- `src/services/nextBestActionService.ts` — next best action
- `src/services/progressDebugService.ts` — "why didn't it count?"
- `src/services/marketplaceGovernorService.ts` — regional thermostat
- `src/services/rewardEffectsService.ts` — visibility, early exposure, fee discounts
- `src/lib/metricsCalculator.ts` — metric computation from events
- `src/lib/gamificationMetrics.ts` — rule boundaries (isOnTime, isMeaningfulMessage, etc.)

### Routes
- Gamification: `src/routes/gamification.ts` (mounted at `/cleaner`)
- Governor: `src/routes/governor.ts` (mounted at `/governor`)
- Admin gamification: `src/routes/admin/gamificationControl.ts` (mounted at `/admin/gamification`)

### Workers
- `src/workers/gamification/processCleanerGamification.ts` — progression, rewards, badges

### Config
- `src/config/cleanerLevels/` — goals, rewards, levels JSON
- `src/config/cleanerLevels/season_rules_v1.json`

### Tests
- `src/lib/__tests__/gamificationMetrics.test.ts`
- `src/__tests__/integration/gamification_smoke.test.ts`
- `tests/load/gamification_smoke.js` (k6)

---

## 3) DB client (no `withClient`)

Use `query` and `withTransaction` from `src/db/client.ts`:

```ts
import { query, withTransaction } from "../db/client";
// NOT: withClient (that pattern is from external zip steps)
```

---

## 4) Auth middleware

- `requireAuth`, `requireAdmin` from `src/middleware/authCanonical.ts`
- `requireRole("cleaner"|"client"|"admin")` from `src/middleware/jwtAuth.ts`
- No `requireAdminRole("support"|"ops")` — use `requireAdmin` for admin routes

---

## 5) Governor integration

**Runtime (public):** `GET /api/v1/governor/state?region_id=...`

**Admin:** All under `/admin/gamification`:
- `GET /governor/region?region_id=...` — config + state
- `POST /governor/metrics/insert` — insert metrics row
- `POST /governor/compute` — compute state
- `POST /governor/override` — manual override
- `POST /governor/config/upsert` — merge config patch

**Step 20 scheduler (not yet in repo):** Hourly job that computes metrics, inserts, then calls compute. Would need to use `query` from `src/db/client` and `pt_event_log`. Tables: `jobs`, `job_offers`, `disputes` — schema may differ; align queries to actual columns.

---

## 6) Step 21 feature flags (optional)

The conversation referenced Step 21 with a separate `feature_flags` table. This repo already has:
- `admin_feature_flags` (migration 051) — key, region_id, enabled, variant, config
- `feature_flags` (migration 016) — different structure

For rollout targeting (cohort, percent, region), either extend `admin_feature_flags` or add a new table per Step 21 design. Do not conflate the two.

---

## 7) What Cursor should do when asked

1. **Resolve imports** — Use `query`/`withTransaction` from `src/db/client`; never `withClient`.
2. **Event table** — Use `pt_event_log` with `event_type`, `occurred_at`, `payload`.
3. **Schema alignment** — Jobs: `jobs` table; job offers: `job_offers`; disputes: `disputes`. Check `src/types/db.ts` and migrations for actual columns (e.g. `region_id` may be derived).
4. **Router mounting** — Governor is at `apiRouter.use("/governor", governorRouter)` in `src/index.ts`.
5. **Docs rule** — New .md only in `docs/active/` or `docs/archive/`; append to existing docs (SETUP, ARCHITECTURE, RUNBOOK, etc.) per `.cursor/rules/documentation.mdc`.

---

## 8) Definition of done (gamification)

- [ ] Migrations 043–056 applied
- [ ] Events flowing to `pt_event_log`
- [ ] Goal progress increments with anti-gaming
- [ ] Rewards grant idempotently; cash caps enforced
- [ ] Admin can tune goals/rewards
- [ ] Support can use progress-debug for "why didn't it count?"
- [ ] Governor computes; state available at `/governor/state`
- [ ] Unit + integration smoke tests pass

---

## 9) Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system overview
- [RUNBOOK.md](./RUNBOOK.md) — deploy, incident, gamification support, launch rollout
- [DB/migrations/README.md](../DB/migrations/README.md) — migration order
