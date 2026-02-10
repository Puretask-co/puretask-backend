# Schema & Migrations Review

**Date:** 2026-02-10  
**Scope:** All DB/migrations/*.sql files

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|------|
| **users.id type** | ✅ Canonical TEXT | 000_CONSOLIDATED, 000_COMPLETE use `users.id TEXT` |
| **FK consistency (gamification)** | ✅ Fixed | 043 `cleaner_level_progress.cleaner_id` corrected to TEXT |
| **FK consistency (025 auth)** | ✅ Fixed | Standalone 025 now uses user_id TEXT |
| **BEGIN/COMMIT** | ✅ Fixed | 049 BEGIN/COMMIT removed |
| **View dependencies** | ✅ Correct | 055 depends on 043, 048, 050 in order |
| **Duplicate migrations** | ℹ️ Multiple NEON_FIX variants | 027, 028, 029, 030, 031 have _NEON_FIX vs _system/_suite |

---

## Critical Issues

### 1. **043: cleaner_level_progress.cleaner_id was UUID (FIXED)**

**File:** `DB/migrations/043_cleaner_level_system.sql` line 60

**Issue:** Was `cleaner_id UUID`; canonical schema has `users.id TEXT`. FK type mismatch caused test DB setup to fail.

**Fix applied:** Changed to `cleaner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`.

---

### 2. **025: Standalone migration used user_id UUID (FIXED)**

**File:** `DB/migrations/025_auth_enhancements.sql`

**Issue:** Tables `two_factor_codes`, `user_sessions`, `oauth_accounts`, `security_events`, `email_change_requests`, `trusted_devices` used `user_id UUID`. Canonical schema has `users.id TEXT`. UUID cannot reference TEXT.

**Fix applied:** All `user_id UUID` changed to `user_id TEXT`; function params `p_user_id UUID` → `p_user_id TEXT`.

---

### 3. **049: BEGIN/COMMIT (FIXED)**

**File:** `DB/migrations/049_gamification_sql_helpers.sql`

**Issue:** Wrapped migration in `BEGIN;` / `COMMIT;`. If any statement failed, Neon SQL Editor showed "Failed transaction: ROLLBACK required".

**Fix applied:** Removed `BEGIN;` and `COMMIT;` for consistency with 048, 050–056.

---

## Schema Consistency

### users.id Type

| Source | users.id Type | FK to users(id) |
|--------|---------------|-----------------|
| 000_CONSOLIDATED_SCHEMA | TEXT | TEXT |
| 000_COMPLETE_CONSOLIDATED_SCHEMA | TEXT | TEXT |
| 001_init | TEXT | TEXT |
| Gamification 043–056 | — | TEXT (except 043 cleaner_level_progress bug) |
| 025 (standalone) | — | TEXT ✅ Fixed |

### Gamification Migrations (041–056)

| Migration | user/cleaner refs | BEGIN/COMMIT | Notes |
|-----------|-------------------|--------------|-------|
| 041 | N/A | No | n8n_event_log |
| 042 | N/A | No | webhook_events |
| 043 | cleaner_id TEXT | No | ✅ Fixed |
| 044 | cleaner_id TEXT | No | ✅ |
| 045 | N/A | No | ALTERs, message_templates |
| 046 | cleaner_id TEXT | No | ✅ |
| 047 | cleaner_id TEXT | No | ✅ |
| 048 | cleaner_id TEXT | No | ✅ |
| 049 | N/A | No | Haversine functions ✅ Fixed |
| 050 | N/A | No | Views, indexes |
| 051 | created_by, updated_by, actor_admin_user_id TEXT | No | ✅ |
| 052 | cleaner_id TEXT | No | ✅ |
| 053 | cleaner_id TEXT | No | ✅ |
| 054 | cleaner_id TEXT | No | ✅ |
| 055 | Views only | No | ✅ |
| 056 | N/A | No | ✅ |

---

## Dependency Chain

### Test DB Setup (scripts/setup-test-db.js)

1. `000_CONSOLIDATED_SCHEMA.sql` (001–019)
2. `041` → `042` → … → `056` in order

### Gamification Internal Dependencies

- **043** creates: cleaner_level_progress, cleaner_goal_completions, cleaner_active_boosts, etc.
- **044** depends on: cleaner_active_boosts (view)
- **048** creates: cleaner_goal_progress, gamification_reward_grants, gamification_choice_eligibilities
- **050** creates: gamification_cleaner_active_rewards (view over gamification_reward_grants)
- **055** depends on: cleaner_level_progress (043), cleaner_goal_progress (048), gamification_cleaner_active_rewards (050)

---

## Duplicate / Variant Migrations

| Base | Variants | Purpose |
|------|----------|---------|
| 027 | admin_settings_system, admin_settings_NEON_FIX | System vs Neon-specific |
| 028 | cleaner_ai_settings_suite, cleaner_ai_settings_NEON_FIX | Same |
| 029 | enhanced_cleaner_ai_templates, enhanced_templates_NEON_FIX | Same |
| 030 | onboarding_gamification_system, onboarding_gamification_NEON_FIX, performance_indexes | Same |
| 031 | message_history_system, message_history_NEON_FIX | Same |

**Note:** setup-test-db.js does NOT run these. It uses 000_CONSOLIDATED + 041–056. The NEON_FIX variants are for Neon-specific deployments.

---

## Missing Migrations

- **036** – Gap in numbering (035, 037 exist)

---

## Recommendations

1. ~~**Fix 043**~~ – Done.
2. ~~**Fix 049**~~ – Done.
3. ~~**Fix 025**~~ – Done.
4. **Document** – NEON UUID variant instructions in TROUBLESHOOTING.md (already present).

---

## Implemented Improvements (2026-02-10)

| # | Improvement | Status |
|---|-------------|--------|
| 1 | Migration validation script | ✅ `npm run db:validate:migrations` |
| 2 | CI runs validation before db setup | ✅ In .github/workflows/test.yml |
| 3 | PR template migration checklist | ✅ In .github/PULL_REQUEST_TEMPLATE.md |
| 4 | Setup-test-db uses 000_COMPLETE | ✅ Default; USE_LEGACY_SCHEMA=1 for old |
| 5 | Neon UUID bundle + docs | ✅ `npm run db:generate:neon-uuid`, docs in TROUBLESHOOTING |

---

## Ways to Do This Better (Future)

### 1. **Use a migration runner (e.g. node-pg-migrate, Prisma Migrate, Knex)**
- Track applied migrations in a table (`schema_migrations`).
- Run only pending migrations; avoid manual paste-and-run.
- Rollback support for failed migrations.
- Single source of truth for migration order.

### 2. **Environment-aware type handling**
- Add a pre-migration check: `SELECT data_type FROM information_schema.columns WHERE table_name='users' AND column_name='id'`.
- Or use a build step that emits TEXT or UUID variants from a single migration source.
- Reduces duplicate NEON_FIX files.

### 3. **Linting/validation for migrations**
- Script that greps for `REFERENCES users(id)` and ensures the column type matches.
- Script that flags `BEGIN;`/`COMMIT;` in migrations.
- Run in CI before merge.

### 4. **Consolidate NEON_FIX variants**
- Pick one canonical schema (e.g. users.id TEXT) and align all deployments.
- Or document a single "Neon UUID" migration bundle instead of per-file variants.
- Reduces confusion about which file to run.

### 5. **Idempotency by design**
- Prefer `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ON CONFLICT DO NOTHING`.
- Avoid raw `CREATE TABLE` without `IF NOT EXISTS` for additive changes.
- Allows safe re-runs and partial recovery.

### 6. **No explicit transactions in migration files**
- Let the runner handle transactions, or run statements individually.
- Avoids "Failed transaction: ROLLBACK required" in editors that batch-run SQL.

### 7. **Test DB setup mirrors production path**
- Use the same migration sequence for test and prod (e.g. 000_COMPLETE + 041–056).
- Ensures tests catch schema issues before deploy.

### 8. **Single consolidated schema for fresh installs**
- Prefer `000_COMPLETE_CONSOLIDATED_SCHEMA` everywhere.
- Add 020–025 + hardening to setup-test-db.js if not already covered.
- Reduce drift between "quick start" and "full schema."

### 9. **Migration checklist in PR template**
- [ ] All FKs to users(id) use TEXT (or match target DB).
- [ ] No BEGIN/COMMIT in file.
- [ ] Idempotent (IF NOT EXISTS, ON CONFLICT).
- [ ] Dependencies documented (e.g. "055 requires 043, 048, 050").

### 10. **Automated smoke test after migrations**
- Run `npm run db:setup:test` in CI.
- Run a minimal query against key tables (users, jobs, cleaner_level_progress).
- Fail CI if schema setup fails.

---

## Validation Checklist

- [ ] Run `npm run db:setup:test` successfully
- [ ] Run `npm run test:gamification` (or full test suite)
- [ ] On Neon with users.id UUID: use UUID variant per TROUBLESHOOTING.md
