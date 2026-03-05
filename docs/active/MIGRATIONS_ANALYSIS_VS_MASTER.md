# Migrations analysis vs master

**Purpose:** Document what the master contains, how to run the analyzer, and what gaps were fixed.

## What the master contains

The master migration (`000_MASTER_MIGRATION.sql`) is built from **nine source files**:

1. 000_FIX_credit_ledger_delta_credits.sql  
2. 000_COMPLETE_CONSOLIDATED_SCHEMA.sql — Full schema (001–056 + hardening 901–906). This is the canonical "everything except 057–061" schema.  
3. 000_COMPLETE_VIEWS_PATCH.sql  
4. 019_payout_reconciliation_flags.sql — Creates table `payout_reconciliation_flags` (referenced by COMPLETE's `payout_reconciliation_flag_history` FK). Not inlined inside COMPLETE, so added explicitly.  
5. 057_pt_safety_reports.sql  
6. 058_gamification_frontend_spec_tables.sql  
7. 059_add_invoice_status_and_invoices.sql  
8. 060_add_reviews_ai_worker_stripe_tables.sql  
9. 061_add_cleaner_id_payout_misc_tables.sql  

See [MASTER_MIGRATIONS.md](./MASTER_MIGRATIONS.md) for full canonical order and usage.

## Analyzer script

**Script:** `scripts/analyze-migrations-vs-master.js`  
**Run:** `node scripts/analyze-migrations-vs-master.js` (from repo root)

**What it does:** For each migration SQL file (except the master), it extracts object names (CREATE TABLE / VIEW / TYPE) and checks whether they appear in `000_MASTER_MIGRATION.sql`. It reports:

- **IN_MASTER** – Files that are canonical sources (the 9 files above).
- **COVERED** – Other migrations whose objects are present in the master (e.g. 001–056 content is in COMPLETE, so they're "covered").
- **HAS_POTENTIAL_NEW** – Migrations that define tables/views/types not found in the master (may indicate a gap or a renamed object).
- **NO_OBJECTS** – Files that don't define tables/views/types (e.g. data seeds, patches).

Typical output: **9 files** are source of the master (IN_MASTER); **~14 files** are COVERED (all extracted object names found in master).

## Gaps that were fixed

- **payout_reconciliation_flags:** COMPLETE had an FK to this table but didn't create it. The table is created in `019_payout_reconciliation_flags.sql`, which is now part of the master.
- **Views and one table missing from COMPLETE:** A verification run (`node scripts/verify-master-completeness.js`) found that several views (and the table `cleaner_tooltip_interactions`) defined in migrations 003–055 were not present in COMPLETE. **000_COMPLETE_VIEWS_PATCH.sql** was added to the master generator; it defines:
  - **Views:** `credit_summary_by_reason`, `cleaner_unpaid_earnings` (003); `pending_webhook_retries`, `webhook_stats` (010); `user_weekly_bonuses` (013); `cleaners_eligible_for_payout` (014); `referral_leaderboard` (015); `v_cleaner_dashboard`, `v_client_dashboard` (019); `stuck_jobs` (038); `gamification_active_reward_grants`, `gamification_cleaner_active_rewards` (050); `ops_cleaner_active_rewards_summary` (055).
  - **Table:** `cleaner_tooltip_interactions` (030), with FK to `onboarding_tooltips` (COMPLETE uses `onboarding_tooltips` where migration 030 used `app_tooltips`).

**Verification:** Run `node scripts/verify-master-completeness.js` to ensure the master still contains every table/view from 001–056/019. It should report "OK: Master includes all tables/views from the canonical migrations."

## Verification script

**Script:** `scripts/verify-master-completeness.js`  
**Run:** `node scripts/verify-master-completeness.js`

Checks that table/view names extracted from migrations 001–056 (+ hardening) and 019 appear in either `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` or `000_MASTER_MIGRATION.sql`. Known exceptions: 019 (separate file), 057–061 (unify migrations), and objects in AFTER_COMPLETE / RENAMED_IN_COMPLETE. Fails only when the **master** is missing an object (not when COMPLETE is missing, since the views patch and 019 supply those in the master).
