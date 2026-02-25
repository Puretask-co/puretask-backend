# PureTask Backend — Architecture

**Purpose:** High-level structure and key flows for maintainability (Section 9).  
**See also:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [COST_MAP.md](./COST_MAP.md), runbooks in [sections/](./sections/).

---

## 1. Stack

- **Runtime:** Node.js 20+, TypeScript
- **API:** Express
- **DB:** PostgreSQL (Neon); access via `src/db/client.ts` (pool, query, withTransaction). Indexes on jobs, users, cleaner_profiles, credit_ledger, payouts, job_events, etc. (see `000_COMPLETE_CONSOLIDATED_SCHEMA.sql`).
- **Redis (optional):** `REDIS_URL` + `USE_REDIS_RATE_LIMITING=true` for distributed rate limiting and `src/lib/cache.ts`; falls back to in-memory if unavailable.
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

**Rule:** Routes do not talk to the DB directly; they call services. Do not import from `src/db/client` or use `query` in route files. Validation uses Zod and `validateBody` / `validateQuery` / `validateParams` from `src/lib/validation.ts`. Pagination: use `parsePagination` from `src/lib/pagination.ts` for list endpoints. Ownership: use `requireOwnership(resourceType, paramName)` from `src/lib/ownership.ts` for any route that accesses a resource by ID (job, payout, invoice, photo, property); admins bypass automatically.

---

## 3. Key flows

- **Auth:** Request → authMiddlewareAttachUser (optional JWT) → route → requireAuth/requireRole → service.
- **Webhooks:** Stripe webhook → raw body → signature check → `webhook_events` insert (idempotent) → handleStripeEvent → 200.
- **Payments:** Payment intents and ledger updates via `paymentService` / `payoutsService`; state machine in [PAYMENT_STATE_MACHINE.md](./sections/PAYMENT_STATE_MACHINE.md).
- **Background work:** Cron or scheduler invokes workers; Section 6 durable jobs: enqueue via `durableJobService.enqueue`, process via `durableJobWorker` (claim → handler → complete/fail).
- **Cleaner Level System:** Behavior-driven gamification (Level 1–10). Levels = permission gates; goals = real rewards (cash, priority visibility, fee reductions). Goal evaluation runs on job completion (`jobTrackingService` approve, `jobsService` event handling) and login (`recordCleanerLogin` on auth). Service: `cleanerLevelService`; routes: `GET /cleaner/level/progress`, `POST /cleaner/level/record-login`. DB: migration 043 (`cleaner_level_definitions`, `cleaner_level_goals`, `cleaner_level_progress`, `cleaner_goal_completions`, `cleaner_rewards_granted`, `cleaner_login_days`, `cleaner_active_boosts`).
- **Trust-Fintech adapter:** Routes at `/api/credits`, `/api/billing`, `/api/appointments` match the Trust frontend hooks contract (useCreditsTrust, useBillingTrust, useLiveAppointmentTrust). Maps to existing credits, invoice, and job/tracking services. See `src/routes/trustAdapter.ts`.

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

**Canonical gamification spec:** The uploaded bundle is the source of truth. **Lead doc:** [gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md](gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md). **Index of all canonical docs:** [gamification_bundle/README.md](gamification_bundle/README.md). Event stream: [event_contract_v1.md](gamification_bundle/docs/event_contract_v1.md). Metrics: [metrics_contract_v1.md](gamification_bundle/docs/metrics_contract_v1.md). Enforcement checklist: [spec_enforcement_matrix_v1.md](gamification_bundle/docs/spec_enforcement_matrix_v1.md). Implementation in this repo: config in `src/config/cleanerLevels/` (and `contracts/`); code in `src/lib/gamification/`, `src/services/`, `src/routes/gamification.ts`, `src/workers/`; DB 043–056 and consolidated schema (bundle SQL in `DB/migrations/bundle_reference/` is reference only).

---

## 3.4 Trust API (Fintech hooks)

All Trust endpoints live under **`/api`** and require **`Authorization: Bearer <token>`**. Role and participant checks are enforced per route. Implemented in `src/routes/trustAdapter.ts`.

| Method | Path | Role | Contract |
|--------|------|------|----------|
| GET | /api/credits/balance | client | `{ balance, currency, lastUpdatedISO }` |
| GET | /api/credits/ledger | client | `{ entries }` (filters: from, to, type, status, search, limit) |
| POST | /api/credits/checkout | client | Body: packageId, successUrl, cancelUrl → `{ checkoutUrl }` |
| GET | /api/billing/invoices | client | `{ invoices }` (each with lineItems) |
| GET | /api/billing/invoices/:id | client (owner) | Full invoice + lineItems |
| POST | /api/client/invoices/:id/pay | client (owner) | Body: payment_method (credits \| card) → `{ ok: true }` |
| GET | /api/appointments/:bookingId/live | client or assigned cleaner | state, etaISO, gps, photos, checklist, events |
| POST | /api/appointments/:bookingId/events | cleaner (assigned) | Body: type (en_route, arrived, note…), gps?, note? → `{ ok: true }` |
| GET | /api/cleaners/:cleanerId/reliability | client | `{ reliability: { score, tier, breakdown, explainers } }` |

**Spec-exact paths (no /api prefix):** For frontends that call the exact spec paths, the same contract is also available at root: **POST /credits/checkout** → `{ checkoutUrl }`, **GET /cleaners/:cleanerId/reliability** → `{ reliability }` (mounted via `trustRootRouter` before the main API router).

Credits ledger is append-only; balance is derived. Invoice payment by credits creates ledger entries. CORS allows `Content-Type` and `Authorization`; frontend origin (e.g. `http://localhost:3000`) is allowlisted.

---

## 3.4a Canonical job status (backend, frontend, n8n in sync)

**Single source of truth:** Job status enum and allowed transitions live in one place so backend, frontend, and n8n stay aligned.

| What | Where |
|------|--------|
| **Statuses** | `requested`, `accepted`, `on_my_way`, `in_progress`, `awaiting_approval`, `completed`, `disputed`, `cancelled` |
| **Code** | `src/state/jobStateMachine.ts` (transitions, events, role permissions); `src/types/db.ts` (`JobStatus` type) |
| **Constants / JSON** | `src/constants/jobStatus.ts` — exports `JOB_STATUSES`, `JOB_EVENT_TYPES`, `TRANSITIONS_MATRIX`, `EVENT_PERMISSIONS`, `JOB_STATUS_CANONICAL` (JSON-serializable for frontend or n8n) |

**Events that drive transitions:** `job_created`, `job_accepted`, `cleaner_on_my_way`, `job_started`, `job_completed`, `client_approved`, `client_disputed`, `dispute_resolved_refund`, `dispute_resolved_no_refund`, `job_cancelled`. Terminal statuses (no further transitions): `completed`, `disputed`, `cancelled`.

**Frontend/n8n:** Import the same status list and transition matrix from the backend repo (e.g. copy `JOB_STATUS_CANONICAL` or add a GET endpoint that returns it), or keep a shared constants package. Do not hardcode status strings elsewhere.

---

## 3.5 Gamification canonical rules and key constants (source: bundle)

**Locked product truths:** Levels never go down. Progress/rewards can pause if maintenance fails (level remains). Customers always choose cleaners. Boosts are ranking multipliers / early exposure (never guarantees). Goals give tangible rewards; leveling up itself is minimal. Anti-gaming enforced for login, messaging, photos.

**Meaningful login:** A login day counts only if within **15 minutes** of opening the app the cleaner performs ≥1 meaningful action: open job request detail, accept/decline, send meaningful message, status taps (on my way/arrived/complete), upload photos, update availability.

**Meaningful message:** Counts if sent using a quick template, OR ≥ 25 chars, OR customer replies within 24 hours. Quick templates include thank you, reschedule offer, request review, request tip, plus operational (on my way, arrived, starting now, finished/photos attached).

**Photo verification:** ≥ 1 BEFORE and ≥ 1 AFTER photo; timestamps between clock-in and clock-out. No extra room/angle requirements.

**On-time + GPS:** On-time if clock-in within **±15 minutes** of scheduled start; GPS within **250 m** of job. Clock-in success requires both clock-in and clock-out within radius.

**Good-faith declines (acceptance rate):** Declines do not hurt acceptance if: distance too far (e.g. travel radius 10 mi, job ≥ 11 mi), time conflict (outside availability), job mismatch (service not offered), safety concern (note required if no photo), access/logistics mismatch, short notice (start &lt; 18 hours away). Limit **6 good-faith declines per 7 days**; beyond that they count. Formula: `accepts / (accepts + declines_non_good_faith)`.

**Add-ons:** Level 4 core 30 add-ons, Level 5 core 45, Level 6 core 60; rewards are add-on-job visibility focused.

| Constant | Value |
|----------|--------|
| Meaningful action window | 15 minutes |
| Meaningful message | 25 chars OR template OR client reply within 24 h |
| On-time window | ±15 minutes |
| GPS radius | 250 m |
| Short notice (good-faith) | &lt; 18 hours |
| Good-faith decline allowance | 6 per 7 days |
| Distance good-faith | travel radius 10 mi; penalty-free at ≥ 11 mi |

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

- **Ownership:** Enforced via `requireOwnership("job"|"user"|"payout"|"invoice"|"photo"|"property", paramName)` in jobs, tracking, photos, premium, etc. Add to any new route that fetches by ID. See RUNBOOK § 3.4 for admin audit reason.
- **Zod validation:** Add `validateBody`/`validateQuery`/`validateParams` to more routes for consistent input validation.
- **Pagination:** `parsePagination(req)` and `formatPaginatedResponse` in `src/lib/pagination.ts`; apply to admin list endpoints. Cursor-based pagination for very large lists is a future enhancement.
- **Admin RBAC:** Roles in use: requireAdmin, requireSupportRole, requireFinanceRole, requireDisputeResolveRole. Sensitive actions require `requireAuditReason` (X-Audit-Reason or body.reason). See RUNBOOK § 3.4.
- **Ops dashboard:** Unified view for disputes, webhooks, risk, and system health.

---

**Last updated:** 2026-02-10
