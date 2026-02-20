# CURSOR_PROMPTS.md — PureTask Gamification Implementation Playbook (v1)

> Goal: give you **copy/paste prompts** to run inside **Cursor** (Composer / Chat) so it can merge all delivered zips, wire them into your codebase, resolve imports, add feature flags, hook the governor scheduler, and set up CI with the test harness.

**How to use**
1. Put `docs/CURSOR_CONTEXT.md` (from the previous file) in your repo.
2. Put this file in `docs/CURSOR_PROMPTS.md`.
3. In Cursor, open the repo and run these prompts **in order**.  
4. Each prompt is designed to be **one self-contained Cursor request**.

---

## 0) One-time setup prompt (make Cursor treat the context as canon)

### Prompt 0A — “Source of truth”
> Treat `docs/CURSOR_CONTEXT.md` as the canonical spec. Do not invent new rules. If there’s ambiguity, search the repository and follow existing patterns. Do not change product constants without asking.

---

## 1) Unzip & merge steps in order (exact commands + prompts)

### Option A (recommended): Use terminal commands in Cursor

> Run these in Cursor’s terminal from your repo root.

**1A.1 — Create a workspace folder**
```bash
mkdir -p _chatgpt_drop && cd _chatgpt_drop
```

**1A.2 — Copy the zips into the repo**
> If you downloaded the zip files locally, put them into `_chatgpt_drop/zips/` manually (drag & drop in Cursor). Then:
```bash
mkdir -p zips
ls -la zips
```

**1A.3 — Unzip each step into `_chatgpt_drop/steps/`**
```bash
mkdir -p steps
for z in zips/*.zip; do
  echo "Unzipping $z"
  unzip -o "$z" -d steps
done
```

**1A.4 — Inspect structure**
```bash
find steps -maxdepth 3 -type f | head -n 50
```

**1A.5 — Merge into repo (safe, reviewable)**
We merge via git so every change is reviewable:
```bash
cd ..
git status
```

Now use Cursor prompt below (1B) to merge carefully with conflict resolution.

---

### Option B: Cursor “merge assistant” prompt (best results)

### Prompt 1B — “Merge steps into the repo”
> I have a folder `_chatgpt_drop/steps/` that contains multiple step packages from ChatGPT (step5…step21).  
> Please merge them into this repository using existing patterns:
> - Put shared utilities into appropriate existing folders (`src/`, `server/`, etc.)
> - If the step folders contain their own `src/`, merge modules into our `src/` structure.
> - Do not duplicate DB client or RBAC middleware—reuse existing ones.
> - Resolve naming collisions by preserving our existing code and adapting imports from the step code.
> - Keep changes minimal and make sure TypeScript compiles.
> - After merging, provide a summary of what files were added/changed and what manual follow-ups remain.

---

## 2) Resolve imports (DB client, RBAC middleware, config loader)

### Prompt 2A — “Resolve missing imports & align to our project”
> Please run TypeScript compile/typecheck and resolve all missing imports introduced by the step merges.  
> Specifically:
> - Replace any placeholder DB import (e.g., `../db/client`) with our real DB client module.
> - Replace `requireAdminRole(...)` middleware usage with our RBAC/auth pattern.
> - Replace any `node-fetch` usage if our codebase uses native fetch or axios.
> - Ensure all routes are mounted in the main router/app bootstrap.
> - Keep API paths as defined in the step code unless the repo already has an established convention.
> - Output: list every import change and why.

### Prompt 2B — “Make all migrations idempotent + ordered”
> Inspect all SQL migrations from the merged steps.  
> - Ensure they are idempotent (`IF NOT EXISTS`, safe constraints) and follow our migration framework naming.
> - Create a single ordered migration list in `docs/gamification_migrations_order.md` with the exact run order.
> - Confirm there are no duplicate table definitions or conflicting constraints.

---

## 3) Wire feature flags (Step 21) end-to-end

### Prompt 3A — “Integrate feature flag evaluation into runtime”
> Implement feature flag gating using `feature_flags` table from Step 21.  
> Requirements:
> - Add a server utility `isFlagEnabled(flagKey, ctx)` (or adapt the provided one) to our codebase.
> - Define context extraction: region_id, cohort, cleaner_id, client_id.
> - Gate these features:
>   - `gamification_enabled`: progression endpoints + reward granting worker
>   - `gamification_cash_enabled`: cash reward grants (still log blocked)
>   - `gamification_seasons_enabled`: seasons list/multipliers
>   - `gamification_badges_enabled`: badge awarding
>   - `gamification_next_best_action_enabled`: NBA endpoint/cards
>   - `governor_enabled`: application of governor knobs in ranking
> - Don’t change business logic, only wrap with checks.
> Provide code diffs and a list of files modified.

### Prompt 3B — “Add admin endpoints for flags”
> Add admin endpoints to read/update feature flags:
> - GET `/admin/flags`
> - POST `/admin/flags/update` (requires admin role)
> Include audit log writes to `feature_flag_audit`.
> Ensure updates support setting `targeting` JSON and `is_enabled`.

---

## 4) Hook up Marketplace Health Governor scheduler (Step 20) + apply governor knobs safely

### Prompt 4A — “Wire the governor scheduler into our job system”
> Integrate Step 20 governor scheduler into our existing job runner (cron/BullMQ/worker).  
> Requirements:
> - Run hourly per region_id
> - Compute and insert `region_marketplace_metrics`
> - Call governor compute endpoint or service method
> - Make region list configurable (env var `REGION_IDS`)
> - Ensure job is idempotent (inserting a metrics row is OK; do not double-apply rewards)
> - Add logging & error alerts
> - Add a “dry run” mode for staging

### Prompt 4B — “Apply governor knobs to ranking (behind flag)”
> Apply `region_governor_state` outputs to ranking, behind `governor_enabled` flag:
> - Multiply ranking score by `visibility_multiplier` (bounded)
> - Add `early_exposure_minutes` to early exposure window (bounded)
> - Do not change eligibility; only ordering
> - Ensure customers can still scroll and select anyone
> Provide code changes and a short explanation of how the knobs are applied.

### Prompt 4C — “Wire governor cash toggle into reward granting”
> Ensure reward granting checks:
> - Step 13 cash caps (global/region)
> - Governor state `cash_rewards_enabled` (region)
> - Flag `gamification_cash_enabled`
> If any check fails, cash rewards are not granted but the attempt is logged with a reason.

---

## 5) Set up CI with automated test harness (Step 19)

### Prompt 5A — “Add CI pipeline: unit + integration smoke”
> Add CI workflow (GitHub Actions or our existing CI) that runs:
> 1) Typecheck/build
> 2) Unit tests for anti-gaming rule helpers
> 3) Integration smoke tests against a running test server
> Details:
> - Spin up Postgres service in CI if needed
> - Run migrations
> - Start API server
> - Run Step 19 integration tests with env:
>   - API_BASE_URL
>   - ADMIN_TOKEN (dev token in CI)
>   - REGION_ID
> - Output logs on failure
> Provide the YAML + any scripts added.

### Prompt 5B — “Nightly load smoke (optional)”
> Add a nightly scheduled CI job that runs the Step 19 k6 smoke test for 30 seconds.
> If we can’t install k6 in CI, create a fallback node-based load smoke using autocannon.

---

## 6) Final hardening prompts (recommended before pilot)

### Prompt 6A — “Create a staging verification checklist”
> Produce `docs/staging_verification_checklist.md` that includes:
> - critical API endpoints to hit
> - sample event sequences to simulate (login → meaningful action → job completion → reward)
> - verification of pause reasons and debug endpoint responses
> - verification of cash cap behavior
> - verification of governor state changes and ranking application

### Prompt 6B — “Create a one-click seed script”
> Create a script `scripts/seed_gamification_config.ts` that loads:
> - goals JSON
> - rewards JSON
> - badges JSON
> - seasons JSON
> into the database tables using upserts.
> Add a `--dry-run` flag and logs.
> Ensure it’s safe to run multiple times.

---

## 7) “If Cursor gets confused” fallback prompts

### Prompt 7A — “Find the canonical constants”
> Scan `docs/CURSOR_CONTEXT.md` and ensure the implementation matches constants:
> - login window: 15 minutes
> - message meaningful: template OR ≥25 chars OR reply within 24h
> - on-time: ±15 minutes
> - gps: 250m
> - short notice: <18 hours
> - good-faith allowance: 6 per 7 days
> - distance: 10mi radius, good-faith at >=11mi
> Flag any mismatches with file paths and line numbers.

### Prompt 7B — “Search for duplicate implementations”
> Search the repo for duplicate implementations of:
> - acceptance rate calc
> - on-time calc
> - meaningful message calc
> - meaningful login calc
> Consolidate into shared helpers without changing behavior.

---

## 8) Quick terminal commands (for you, not Cursor chat)

**Run typecheck**
```bash
npm run typecheck || npm run build
```

**Run tests**
```bash
npm test
```

**Run Step 19 harness locally (if kept separate)**
```bash
cd puretask_gamification_step19_test_harness
npm i
npm run test:unit
API_BASE_URL=http://localhost:3000 npm run test:integration
```

---

## 9) Definition of done (Cursor should confirm this)

- [ ] All migrations applied cleanly
- [ ] Event ingest produces metric updates
- [ ] Goals increment correctly with anti-gaming filters
- [ ] Rewards grant idempotently + obey caps + obey flags + obey governor
- [ ] Admin can tune & audit changes
- [ ] Debug endpoint explains “didn’t count”
- [ ] Governor computes hourly and applies (behind flag)
- [ ] CI runs unit + integration smoke on every PR
