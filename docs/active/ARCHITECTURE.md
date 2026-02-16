# PureTask Backend — Architecture

**Purpose:** High-level structure and key flows for maintainability (Section 9).  
**See also:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [COST_MAP.md](./COST_MAP.md), runbooks in [sections/](./sections/).

---

## 1. Stack

- **Runtime:** Node.js 20+, TypeScript
- **API:** Express
- **DB:** PostgreSQL (Neon); access via `src/db/client.ts` (pool, query, withTransaction)
- **Auth:** JWT; canonical middleware in `src/middleware/authCanonical.ts` (requireAuth, requireRole, requireAdmin, requireSuperAdmin)
- **Payments:** Stripe (Connect, Payment Intents, webhooks)
- **Workers:** ts-node scripts; scheduler in `src/workers/scheduler.ts`; durable jobs in `src/workers/durableJobWorker.ts`

---

## 2. Layering (target)

| Layer | Role | Location |
|-------|------|----------|
| **Routes** | Thin: validate input, call service, return response | `src/routes/` |
| **Services** | Business logic, orchestration | `src/services/` |
| **Repositories / DB** | Queries, transactions | `src/db/`, services that use pool |
| **Middleware** | Auth, validation, context, security | `src/middleware/`, `src/lib/` |
| **Workers** | Background jobs, crons | `src/workers/` |

**Rule:** Routes do not talk to the DB directly; they call services. Validation uses Zod and `validateBody` / `validateQuery` / `validateParams` from `src/lib/validation.ts`.

---

## 3. Key flows

- **Auth:** Request → authMiddlewareAttachUser (optional JWT) → route → requireAuth/requireRole → service.
- **Webhooks:** Stripe webhook → raw body → signature check → `webhook_events` insert (idempotent) → handleStripeEvent → 200.
- **Payments:** Payment intents and ledger updates via `paymentService` / `payoutsService`; state machine in [PAYMENT_STATE_MACHINE.md](./sections/PAYMENT_STATE_MACHINE.md).
- **Background work:** Cron or scheduler invokes workers; Section 6 durable jobs: enqueue via `durableJobService.enqueue`, process via `durableJobWorker` (claim → handler → complete/fail).
- **Cleaner Level System:** Behavior-driven gamification (Level 1–10). Levels = permission gates; goals = real rewards (cash, priority visibility, fee reductions). Goal evaluation runs on job completion (`jobTrackingService` approve, `jobsService` event handling) and login (`recordCleanerLogin` on auth). Service: `cleanerLevelService`; routes: `GET /cleaner/level/progress`, `POST /cleaner/level/record-login`. DB: migration 043 (`cleaner_level_definitions`, `cleaner_level_goals`, `cleaner_level_progress`, `cleaner_goal_completions`, `cleaner_rewards_granted`, `cleaner_login_days`, `cleaner_active_boosts`).
- **Gamification Engine (Step 5–9):** JSON-config-driven evaluators for goals, levels, rewards. `src/lib/gamification/`: goal_evaluator, level_evaluator, reward_granter, metricProviderAdapter. Metrics from `metricsCalculator.ts`. Progression: `gamificationProgressionService`, `gamificationRewardService`. Routes: `GET /cleaner/level/progression`, `POST /cleaner/rewards/select`, `GET /cleaner/rewards/active`, `GET /cleaner/rewards/choices`, `GET /cleaner/rewards/effects`. Worker: `processCleanerGamification` (expires rewards/choices, persists progress, grants rewards idempotently). DB: migration 048, 050. Reward effects (Step 9): `rewardEffectsService`, `matchingRankerService`, `feePolicyService` — visibility multiplier, early exposure, fee discounts, instant payout waivers; maintenance pause neutralizes effects.

---

## 3.1 Reward effects in practice (Step 9)

**Principles:** Rewards never guarantee jobs; they shift ordering among eligible candidates.

- **Priority visibility:** Multiplier on ranking score (capped, default 1.35). Apply only among eligible cleaners (distance, availability, service match).
- **Early exposure:** For X minutes after request creation, small bump (default 1.08×) in ranked list. Cap: 30 minutes.
- **Add-on spotlight:** Multiplier applies only when job includes add-ons.
- **Platform fee discount:** Reduces base platform fee percent; cap 10%.
- **Instant payout waiver:** Uses consumed when cleaner chooses instant payout; call `feePolicyService.maybeConsumeInstantPayoutWaiver`.
- **Maintenance pause:** If cleaner is paused, effects return neutral (visibility=1, early=0, etc.); level never decreases.

---

## 3.2 Admin Gamification Control Plane (Step 10–11)

- **Config versions:** `admin_config_versions` stores versioned goals, rewards, levels, governor. Create via `POST /admin/gamification/config/:type`; rollback via `POST /admin/gamification/config/:type/rollback`.
- **Reward budget:** `admin_reward_budget` — cash caps, emergency kill switches. `GET/POST /admin/gamification/budget`.
- **Governor:** `region_governor_config` — per-region caps (visibility, early exposure, fee discount). `GET/POST /admin/gamification/governor/:regionId`.
- **Feature flags:** `admin_feature_flags` — A/B toggles by region. `GET/POST /admin/gamification/flags`.
- **Audit:** `admin_audit_log` — append-only before/after. `GET /admin/gamification/audit`.
- **Runtime config loader (Step 11):** `RuntimeConfigLoader` loads active config from DB with static fallback. Polls every 2 min. Debug: `GET /admin/gamification/runtime-config/bundle?region_id=...`, `GET /admin/gamification/runtime-config/active?type=goals&region_id=...`.
- **Integration (Step 12):** `gamificationProgressionService` and `rewardEffectsService` use loader for goals/levels/rewards/governor; static config fallback when DB has no active versions.

---

## 3.3 Cash Budget, Badges, Seasonal Challenges (Step 13–15)

- **Cash budget enforcement (Step 13):** `CashBudgetService` enforces `admin_reward_budget` caps (daily/monthly cents) and kill switches (`emergency_disable_all_rewards`, `cash_rewards_enabled`). Ledger: `gamification_cash_reward_ledger`; spend views: `gamification_cash_spend_daily`, `gamification_cash_spend_monthly`. Worker and `selectChoiceReward` check `canSpend()` before granting cash rewards; `recordCashGrantWithClient` writes ledger idempotently. Helper: `isCashReward()` in `rewardKindHelpers.ts` (supports `amount_usd` and `amount_cents`).
- **Badge system (Step 14):** `badge_definitions`, `cleaner_badges`, `cleaner_achievement_feed`. `BadgeService` evaluates triggers (metric, window, compound, derived) against metric snapshots, awards idempotently, writes feed entries. Worker calls `awardEligibleBadges` after progression. Routes: `GET /cleaner/badges`, `/badges/earned`, `/badges/feed`; admin: `GET/POST /admin/gamification/badges`, `/badges/upsert`, `/badges/enable`.
- **Seasonal challenges (Step 15):** `season_rules`, `season_application_log`. `SeasonService.getActiveSeasons()` + `applyMultipliers()` for progress boosts. Routes: `GET /cleaner/seasons/active`; admin: `GET/POST /admin/gamification/seasons`, `/seasons/upsert`, `/seasons/enable`. Seed: `config/cleanerLevels/season_rules_v1.json`. Integrate by loading active seasons and applying multipliers to metric snapshot before goal evaluation (optional pipeline enhancement).
- **Next Best Action (Step 16):** `NextBestActionService` ranks incomplete goals by fastest path to reward. Uses `getRuntimeConfigLoader`, `BadgeService.buildMetricSnapshot`, `SeasonService`. Route: `GET /cleaner/next-best-actions?region_id=...&limit=3`. Returns paused state, 1–3 actions with reward preview and optional season boost chips.
- **Support / Ops (Step 17):** `ProgressDebugService` for “why didn’t it count?” diagnostics from `pt_event_log`. Ops views: `ops_cleaner_gamification_snapshot`, `ops_cleaner_goal_counts`, `ops_cleaner_active_rewards_summary`. Route: `GET /admin/gamification/cleaners/:id/progress-debug`. Support macros and in-app explainers in [RUNBOOK.md](./RUNBOOK.md).
- **Marketplace Health Governor (Step 18):** `region_marketplace_metrics`, `region_governor_state`, `region_governor_audit`. `MarketplaceGovernorService` classifies region and outputs safe knobs. Runtime: `GET /api/v1/governor/state?region_id=...`. Admin: `GET /admin/gamification/governor/region`, `POST .../governor/metrics/insert`, `/governor/compute`, `/governor/override`, `/governor/config/upsert`.

---

## 4. Security

- **CORS:** Allowlist in `src/index.ts` (no wildcard with credentials).
- **Headers:** Helmet + custom security middleware.
- **Rate limiting:** Per-route / global via `src/lib/security.ts` and optional Redis.
- **Secrets:** Env only; validated at startup in `src/config/env.ts`. See [SECTION_01_SECRETS.md](./sections/SECTION_01_SECRETS.md).

---

## 5. Docs and runbooks

- **Checklist:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md)
- **Phases:** [00-CRITICAL/PHASE_*_STATUS.md](./00-CRITICAL/)
- **Runbooks:** [sections/SECTION_*.md](./sections/)
- **DB:** [DB/migrations/README.md](../DB/migrations/README.md), [DB/docs/INDEX_MAP.md](../DB/docs/INDEX_MAP.md)

---

## 6. Planned improvements (backlog)

- **Ownership audit:** Verify all routes that access resources by ID enforce ownership (client/cleaner/admin) via `requireOwnership` or equivalent.
- **Zod validation:** Add `validateBody`/`validateQuery` to more routes for consistent input validation.
- **Cursor pagination:** Add cursor-based pagination to high-cardinality lists (jobs, users) for stable performance.
- **Admin RBAC:** Document or add role support (e.g. `support_agent`, `support_lead`, `ops_finance`) for fine-grained admin access.
- **Ops dashboard:** Unified view for disputes, webhooks, risk, and system health.

---

**Last updated:** 2026-02-10
