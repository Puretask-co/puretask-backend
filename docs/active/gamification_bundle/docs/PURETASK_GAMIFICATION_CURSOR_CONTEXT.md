# PureTask Gamification System — Cursor Context Pack (v1)

> Paste this file into Cursor as the “project context” (or drop into your repo as `docs/CURSOR_CONTEXT.md`).
> It summarizes what we built, where the code artifacts are, and how everything fits together.

---

## 0) What this system is

A production-grade **Cleaner Progression + Rewards + Anti-Gaming + Admin Control Plane** for the PureTask marketplace.

**Locked product truths**
- Levels never go down.
- Progress/rewards can pause if maintenance fails (but levels remain).
- Customers always choose cleaners.
- “Boosts” are ranking multipliers / early exposure windows (never guarantees).
- Goals give tangible rewards; leveling up itself is minimal.
- Anti-gaming is enforced for login, messaging, photos.

---

## 1) Core rules (canonical)

### Meaningful login (anti-streak abuse)
A “login day” counts only if within **15 minutes** of opening the app the cleaner performs ≥1 meaningful action:
- open job request detail, accept/decline, send meaningful message, status taps (on my way/arrived/complete), upload photos, update availability.

### Meaningful messages (anti-spam)
Counts if:
- sent using a quick template OR
- ≥ 25 chars OR
- customer replies within 24 hours.

**Templates included**
- Thank you
- Reschedule offer
- Request review
- Request tip
- plus operational templates (on my way, arrived, starting now, finished/photos attached, any focus areas)

### Photo verification (simplified)
Counts if:
- ≥ 1 BEFORE photo and ≥ 1 AFTER photo
- timestamps fall **between clock-in and clock-out**
No “how to clean” requirements.

### On-time + GPS (final)
- On-time if clock-in is within **±15 minutes** of scheduled start
- GPS radius **<= 250 meters**
- Clock-in success requires both clock-in and clock-out within radius

### Good-faith declines (fair acceptance)
Declines do NOT hurt acceptance if:
- Distance too far: cleaner travel radius 10 miles → job >= 11 miles from home base
- Time conflict: outside availability windows
- Job mismatch: service not offered (e.g., move-out not enabled)
- Safety concern: optional 1 photo, but not required; written note required if no photo
- Access/logistics mismatch
- Short notice: start < **18 hours** away
Limit: 6 good-faith declines per 7 days; beyond that they count.

Acceptance rate formula:
`accepts / (accepts + declines_non_good_faith)`

### Ratings
Cleaner-facing: stars only (e.g., 4.8 / 5).
Internal: optional normalized percent.

### Add-ons (revenue-quality lever)
- Customer chooses add-ons **during booking** after hours estimate & cleaner selected
- Add-on prices set by cleaner, multiplied by tier/reliability
- Add-on core goals:
  - Level 4: 30 add-ons
  - Level 5: 45 add-ons
  - Level 6: 60 add-ons
- Rewards are add-on-job visibility focused (spotlight/preferred/premium access)

---

## 2) System architecture (high level)

**Inputs**
- Event stream (job request lifecycle, messaging, login sessions, clock-in/out, photos, ratings, disputes, etc.)

**Processing**
- Metric computation + progress updates (worker)
- Goal evaluation (core/stretch/maintenance)
- Reward granting (cash + non-cash) with idempotency and budgets
- Badge awarding (core + fun)
- Seasonal multipliers (optional)
- Next Best Action recommender

**Outputs**
- Cleaner progression API (levels/goals/progress)
- Reward activation state (visibility multipliers, fee discounts, early exposure minutes)
- Admin tuning console APIs
- Support/debug API: “why didn’t it count?”

**Governance**
- Marketplace Health Governor: regional thermostat adjusting visibility/cash emphasis based on supply/demand/quality
- Feature flags + staged rollout controls

---

## 3) What code artifacts exist (deliverables map)

### Contracts & Specs
- `spec_enforcement_matrix_v1.md` / `.csv`
- `metrics_contract_v1.md` / `.json`
- `event_contract_v1.md` / `.json`
- `event_to_metric_mapping_v1.json`
- `puretask_goal_definitions_v1_1.json`
- `puretask_gamification_config_v1_1_full_goals.json`

### DB migrations
- `puretask_gamification_migrations.sql`
- `event_tables_migration_v1.sql`
- Step 18 Governor migration included in its zip
- Step 21 Feature flags migration included in its zip

### Engine & Services (zip steps)
- Step 5: engine core
- Step 6: persistence + API
- Step 8: rewards choice
- Step 9: enforcement ranking
- Step 10: admin control plane
- Step 11: runtime config loader
- Step 12: full integration patch
- Step 13: cash budget enforcement
- Step 14: badges
- Step 15: seasonal challenges
- Step 16: next best action
- Step 17: support + ops + debug
- Step 18: marketplace governor
- Step 19: automated test harness
- Step 20: governor scheduler job
- Step 21: rollout + monitoring pack (feature flags + alerts + playbook)

---

## 4) Local sandbox artifact index (what to unzip into repo)

If you exported these from ChatGPT sandbox, they are available at:

- `puretask_gamification_step5_engine.zip`
- `puretask_gamification_step6_persistence_api.zip`
- `puretask_gamification_step8_rewards_choice.zip`
- `puretask_gamification_step9_enforcement_ranking.zip`
- `puretask_gamification_step10_admin_control_plane.zip`
- `puretask_gamification_step11_runtime_config_loader.zip`
- `puretask_gamification_step12_full_integration_patch.zip`
- `puretask_gamification_step13_cash_budget_enforcement.zip`
- `puretask_gamification_step14_badges.zip`
- `puretask_gamification_step15_seasonal_challenges.zip`
- `puretask_gamification_step16_next_best_action.zip`
- `puretask_gamification_step17_support_ops_debug.zip`
- `puretask_gamification_step18_marketplace_governor.zip`
- `puretask_gamification_step19_test_harness.zip`
- `puretask_gamification_step20_governor_scheduler.zip`
- `puretask_gamification_step21_launch_rollout_monitoring.zip`

(Plus earlier: `puretask_gamification_engineering_tickets.md`, `puretask_gamification_migrations.sql`, `puretask_gamification_config_v1.json`.)

---

## 5) Integration checklist (repo wiring)

### Router mounting (Express)
- Mount governor router (`governorRouter`) if using Step 18.
- Mount debug router (`progressDebugRouter`) from Step 17.
- Mount admin control plane routes.

### Worker jobs
- Event consumer → metric updates → goal evaluation → rewards granting
- Badge awarding worker
- Seasonal multipliers application (if enabled)
- Governor scheduler (Step 20) hourly:
  - compute metrics row
  - insert metrics
  - compute governor state

### Ranking
- Apply `region_governor_state.visibility_multiplier` to scoring
- Add `early_exposure_minutes` to early exposure window (bounded)

### Feature flags
- Gate:
  - gamification_enabled
  - cash enabled
  - seasons enabled
  - badges enabled
  - next_best_action enabled
  - governor enabled (apply-to-ranking)

### Budgets
- Ensure cash rewards flow checks:
  - global + region caps (Step 13)
  - governor cash_rewards_enabled (Step 18)

---

## 6) Operational rollout plan (how to ship safely)

Use Step 21 playbook:
1) Staging preflight + Step 19 tests
2) Internal cohort (no cash, no seasons, no governor apply)
3) Pilot city (cash with low caps; governor compute-only week 1)
4) Percent rollout to 100% in-region
5) Multi-region expansion with governor on day 1

---

## 7) What Cursor should do next (recommended prompts)

When pasting conversation into Cursor, ask it to:
1) **Unzip and merge** each step zip into your monorepo structure.
2) Resolve import paths (db client, rbac middleware, existing job schemas).
3) Align table names in Step 20 scheduler queries to your real schema.
4) Wire feature flag checks into:
   - progression endpoints
   - rewards granting
   - seasons service
   - badge awarding
   - governor application in ranking
5) Add CI pipeline running Step 19 harness against staging.
6) Run DB migrations in order and verify idempotency.

---

## 8) “Definition of Done” for this system

✅ All migrations applied successfully  
✅ Event stream producing expected metrics  
✅ Goal progress increments correctly with anti-gaming filters  
✅ Rewards grant idempotently and obey cash caps  
✅ Admin can tune goals/rewards and rollback changes  
✅ Support can answer “why didn’t it count?” using debug endpoint  
✅ Governor computes per region hourly and state is applied (when enabled)  
✅ Feature flag rollouts work (cohort + percent + region)  
✅ CI runs unit + integration smoke; load smoke passes  

---

## 9) Key constants (for quick reference)
- Login meaningful window: 15 minutes
- Message meaningful threshold: 25 chars OR template OR customer reply within 24h
- On-time: ±15 minutes
- GPS radius: 250m
- Short notice good-faith decline: < 18 hours
- Good-faith decline allowance: 6 per 7 days
- Distance good-faith decline: travel radius 10 miles, penalty-free at >= 11 miles