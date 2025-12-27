# Worker Dry-Run Test Issues

**Date:** 2025-01-12  
**Status:** Issues identified, fixes in progress

---

## Issues Found

### 1. ✅ FIXED: Payouts Worker - `cleaner_earnings.usd_due` Column Missing

**Problem:**
- Worker queries `cleaner_earnings` table with non-existent `usd_due` column
- Actual schema has `amount_cents` column
- V1 uses `payouts` table directly, not `cleaner_earnings`

**Fix Applied:**
- Updated `src/workers/processPayouts.ts` to use `payouts` table directly
- Removed dependency on `cleaner_earnings` table for payout creation
- V1: Payouts are created automatically via `recordEarningsForCompletedJob` when jobs complete

**Status:** ✅ Code fixed

---

### 1b. ✅ FIXED: Payouts Worker - Wrong Column Reference `u.stripe_connect_id`

**Problem:**
- Worker query was checking `u.stripe_connect_id` which doesn't exist on `users` table
- Stripe account ID is stored in `cleaner_profiles.stripe_account_id`, not `users.stripe_connect_id`

**Fix Applied:**
- Updated query in `findPendingPayouts()` to use `cp.stripe_account_id` from `cleaner_profiles` table
- Removed incorrect `u.stripe_connect_id` check

**Status:** ✅ Code fixed

---

### 2. ⚠️ MIGRATION REQUIRED: `worker_runs.error_message` Column Missing

**Problem:**
- `workerUtils.ts` tries to update `error_message` column
- Migration `904_worker_runs_table.sql` includes `error_message TEXT`
- Error suggests migration hasn't been run on test database

**Fix:**
- Ensure migration `904_worker_runs_table.sql` is run on test database
- Migration file already includes `error_message TEXT` column

**Status:** ⚠️ Requires migration run

---

### 3. ⚠️ MIGRATION REQUIRED: `kpi_snapshots` Table Missing

**Problem:**
- `kpiDailySnapshot` worker queries `kpi_snapshots` table
- Table exists in `000_CONSOLIDATED_SCHEMA.sql` but may not be in test database

**Fix:**
- Ensure `000_CONSOLIDATED_SCHEMA.sql` is run (it includes `kpi_snapshots` table)

**Status:** ⚠️ Requires schema migration

---

### 4. ⚠️ MIGRATION REQUIRED: `stripe_events.stripe_event_id` Column

**Problem:**
- `retryFailedEvents` worker queries `stripe_events.stripe_event_id`
- Column exists in schema but may not be in test database

**Fix:**
- Ensure `000_CONSOLIDATED_SCHEMA.sql` is run (it includes `stripe_events` table with `stripe_event_id`)

**Status:** ⚠️ Requires schema migration

---

### 5. ⚠️ DATA ISSUE: Auto-Cancel Worker - Foreign Key Violations

**Problem:**
- Many jobs have `client_id` values that don't exist in `users` table
- Causes foreign key constraint violations when trying to refund credits

**Fix:**
- This is a test database data issue, not a code issue
- Test database may have orphaned jobs without corresponding users
- Consider cleaning up test data or ensuring users exist before creating jobs

**Status:** ⚠️ Data cleanup needed

---

## Summary of Fixes

### Code Fixes (✅ Complete)
- ✅ Fixed `processPayouts.ts` to use `payouts` table instead of `cleaner_earnings.usd_due`
- ✅ Updated worker to work with V1 payout flow

### Migration Requirements (⚠️ Action Needed)
1. Run `000_CONSOLIDATED_SCHEMA.sql` (if not already run)
2. Run `904_worker_runs_table.sql` (V1 hardening migration)
3. Verify all tables exist: `worker_runs`, `kpi_snapshots`, `stripe_events`, `cleaner_earnings`, `payouts`

### Test Data Cleanup (⚠️ Action Needed)
- Clean up orphaned jobs with invalid `client_id` values
- Ensure test users exist before creating test jobs

---

## Next Steps

1. **Run Migrations:**
   ```sql
   -- Run on test database
   -- 1. Ensure 000_CONSOLIDATED_SCHEMA.sql is run
   -- 2. Run 904_worker_runs_table.sql (already includes error_message)
   ```

2. **Verify Tables Exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_name IN (
       'worker_runs',
       'kpi_snapshots',
       'stripe_events',
       'cleaner_earnings',
       'payouts'
     );
   ```

3. **Clean Test Data:**
   ```sql
   -- Remove orphaned jobs
   DELETE FROM jobs 
   WHERE client_id NOT IN (SELECT id FROM users);
   ```

4. **Re-run Worker Dry-Run Tests:**
   ```bash
   npm run test:worker-dryrun
   ```

---

## Expected Results After Fixes

- ✅ **auto-cancel**: Should pass (after data cleanup)
- ✅ **payouts**: Should pass (after migrations)
- ✅ **kpi-snapshot**: Should pass (after migrations)
- ✅ **retry-events**: Should pass (after migrations)

