# Gap analysis: new data / bundle switch

**Purpose:** What is missing and what needs to be created or added for switching to the new (bundle) gamification data and behavior. Use this with [GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md](./GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md) and [BUNDLE_MERGE_ANALYSIS.md](./BUNDLE_MERGE_ANALYSIS.md).

---

## 1. What is already in place

| Item | Status | Location / notes |
|------|--------|-------------------|
| **withClient adapter** | Done | `src/db/bundleAdapter.ts`, re-exported from `src/db/client.ts` |
| **Config bridge** | Done | `src/config/cleanerLevels/bundleConfigBridge.ts` (`getBundleConfig()`) |
| **RBAC shim** | Done | `src/middleware/rbac.ts` (`requireAdminRole`, `req.adminUser`) |
| **ProgressionService wrapper** | Done | `src/services/bundleProgressionServiceAdapter.ts` |
| **RewardGrantService wrapper** | Done | `src/services/bundleRewardGrantServiceAdapter.ts` |
| **grantForCompletedGoals** | Done | `src/services/gamificationRewardService.ts`; worker uses `grantRewardsForGoal` |
| **Contract JSONs** | Present | `src/config/cleanerLevels/contracts/` (event_contract_v1, metrics_contract_v1, event_to_metric_mapping_v1) |
| **Admin control plane** | Done | Routes and services (admin config, budget, governor, flags, audit); DB 051 |
| **Runtime config loader** | Done | Loads from `admin_config_versions` with static fallback |
| **Optional migration pt_safety_reports** | File only | `DB/migrations/057_pt_safety_reports.sql` — run if event-style safety events needed |

---

## 2. What is missing or to create

### 2.1 Event / metrics contract usage

| Gap | What to create | Why |
|-----|----------------|-----|
| **Event validation** | Load `event_contract_v1.json` and validate incoming events (e.g. `event_type` in allowlist, required fields) before writing to `pt_event_log`. | New data switch: ensure only contract-compliant events are ingested. |
| **Metrics contract** | Optional: validate or document metric keys from `metrics_contract_v1.json` in `metricsCalculator` or metric provider. | Align metric keys with canonical spec. |
| **Event→metric mapping** | Use `event_to_metric_mapping_v1.json` when deriving metrics from events (if not already implicit in code). | Ensures events feed the right metrics per spec. |

**Suggestion:** Add `src/config/cleanerLevels/contracts/eventContractLoader.ts` (or in `lib/`) that loads the contract and exposes `getAllowedEventTypes()` and `validateEventPayload(event)` (optional strict validation). Call from the route or service that writes to `pt_event_log`.

### 2.2 Database

| Gap | What to create | Why |
|-----|----------------|-----|
| **057 pt_safety_reports** | Run migration `057_pt_safety_reports.sql` if you need event-style safety reports for metrics/contract. | Only if new data pipeline requires it. |
| **Fresh DB path** | Document or script: create new DB → set `DATABASE_URL` → run only `npm run db:migrate` (no fix script). | Clean setup for new data avoids partial-schema errors. |
| **Fix migration for existing DBs** | Already added: `000_FIX_credit_ledger_delta_credits.sql`. Run before consolidated schema on existing DBs. | Documented in SETUP.md. |

### 2.3 Config and env

| Gap | What to create | Why |
|-----|----------------|-----|
| **Gamification kill switch** | Already exists: feature flag / runtime config (e.g. `isGamificationEnabled`). Optional: add `GAMIFICATION_ENABLED` in `.env.example` if you want an env-level kill switch. | Quick disable for new data without code change. |
| **Bundle config in runtime loader** | Runtime loader already uses static goals/rewards/levels; DB versions override. No change needed unless you want loader to use `getBundleConfig()` shape explicitly. | Current design is sufficient. |

### 2.4 Code paths

| Gap | What to create | Why |
|-----|----------------|-----|
| **Wire bundle adapters** | Optional: if you add routes or workers that expect bundle-style `ProgressionService` / `RewardGrantService`, import from `bundleProgressionServiceAdapter` and `bundleRewardGrantServiceAdapter`. | Main app currently uses `gamificationProgressionService` and `gamificationRewardService` directly; adapters are for future or ported code. |
| **Event ingestion route** | Ensure `POST /cleaner/events` (or equivalent) writes to `pt_event_log` with idempotency and, if added, event contract validation. | New data: events should be contract-compliant. |

### 2.5 Tests and observability

| Gap | What to create | Why |
|-----|----------------|-----|
| **Contract validation tests** | Unit test: load event_contract_v1.json, assert allowed event types and that sample payloads pass validation. | Regress when contract or validation changes. |
| **Integration tests** | Fix or un-skip existing failing integration tests (dispute, V3, onboarding) so new data flows are covered. | Pre-existing; important before full switch. |
| **Metrics coverage** | Optional: list metric keys from metrics_contract and ensure each is implemented or stubbed in `metricsCalculator`. | Doc or test to track coverage. |

---

## 3. Summary: priority order

1. **High:** Add event contract loader + optional validation for event ingestion (new data quality).
2. **High:** Document “fresh DB” path and when to run 057 (new data setup).
3. **Medium:** Add `GAMIFICATION_ENABLED` to `.env.example` if desired; ensure feature flag is documented.
4. **Medium:** Unit test for event contract validation.
5. **Low:** Wire bundle adapters only if you add bundle-derived routes/workers; otherwise leave as-is.
6. **Low:** Explicit event→metric mapping usage if not already implied in code.

---

## 4. PureTask suggestions (general)

- **Dispute / V3 / onboarding tests:** Fix or document known failures; un-skip when auth/mocks are in place so regressions are caught.
- **DB migrations:** Prefer a single consolidated migration on fresh DBs; use fix migration only for existing DBs. Consider a small “schema version” table or migration tracking so you can detect partial state.
- **Observability:** Ensure gamification worker runs (processCleanerGamification) are logged or metricked so you can confirm new data is processed.
- **Docs:** Keep DECISIONS.md updated when you complete bundle adapter work or contract validation so the next contributor sees current state.

---

---

## 5. What’s left to do or create (implementation checklist)

Use this list to drive remaining gamification-bundle implementation. Items are ordered by impact.

### 5.1 Core implementation (choose one path)

| # | Item | Effort | Notes |
|---|------|--------|--------|
| 1 | **Option A: Merge bundle logic into current engine** | Done | Merged bundle logic/comments into `src/lib/gamification/` (goal_evaluator, level_evaluator, reward_granter, types). Build and 11 gamification unit tests pass. See GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md §4. |
| 2 | **Option B: Adapted bundle folder** | High | Optional: copy bundle to e.g. `src/gamification-bundle-adapted/`, fix imports, wire as single implementation. Not required; Option A is complete. |
| 3 | **Step 8 — User ID type** | Low | Current engine and merged code use `string` for `cleaner_id`; audit any new bundle-derived code for UUID vs string. |

The app uses merged `src/lib/gamification/` and existing services; bundle folder remains reference-only (excluded from build).

### 5.2 Data and config

| # | Item | Effort | Notes |
|---|------|--------|--------|
| 4 | **Run 057_pt_safety_reports.sql** | Low | Only if you need event-style safety reports for metrics/contract. Migration file exists. |
| 5 | **Document fresh-DB path** | Done | SETUP.md has “Fresh DB path (clean setup / new data)” with steps; RUNBOOK §1 references it. |
| 6 | **Deploy event contract for STRICT_EVENT_CONTRACT** | Done | RUNBOOK §4.4 and DEPLOYMENT describe: copy `src/config/cleanerLevels/contracts/*.json` into dist or set cwd so loader finds the file. |
| 7 | **GAMIFICATION_ENABLED in .env** | Done | `.env.example` documents it; `isGamificationEnabled()` returns false when `GAMIFICATION_ENABLED=false`. |

### 5.3 Tests and observability

| # | Item | Effort | Notes |
|---|------|--------|--------|
| 8 | **Event contract unit test** | Done | `src/config/cleanerLevels/contracts/__tests__/eventContractLoader.test.ts` — 10 tests for getAllowedEventTypes, isAllowedEventType, validateEventForContract. |
| 9 | **Fix or document integration tests** | Medium | Dispute, V3, onboarding tests were failing pre-bundle; fix or un-skip so new data flows are covered. |
| 10 | **Gamification worker logging** | Done | `processCleanerGamification` logs `gamification_worker_run` (start), `gamification_worker_complete` (durationMs). |
| 11 | **Metrics contract coverage** | Optional | To verify: list metric keys from `src/config/cleanerLevels/contracts/metrics_contract_v1.json` and cross-check with `metricsCalculator` (or metric provider). Optional: use `event_to_metric_mapping_v1.json` when deriving metrics from events. See RUNBOOK §4. |

### 5.4 Optional / later

| # | Item | Notes |
|---|------|--------|
| 12 | **Wire bundle adapters in new code** | If you add routes/workers that expect bundle-style `ProgressionService`/`RewardGrantService`, import from `bundleProgressionServiceAdapter` and `bundleRewardGrantServiceAdapter`. |
| 13 | **Explicit event→metric mapping** | Use `event_to_metric_mapping_v1.json` in metric derivation if not already implied in code. |

**Summary:** Option A merge is complete; event contract, fresh DB path, worker logging, GAMIFICATION_ENABLED, and deploy/057 are documented; build copies contract JSON to dist. Remaining optional: run 057 when needed; fix remaining integration test skips (v1Hardening, v2Features); metrics contract coverage.

---

**Last updated:** 2026-02 (after bundle adapters, grantForCompletedGoals, event contract loader, DECISIONS/RUNBOOK; added §5 “What’s left”).
