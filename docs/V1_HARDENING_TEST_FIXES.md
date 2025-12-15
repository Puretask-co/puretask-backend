# V1 Hardening Test Fixes

**Date:** 2025-01-12

## Issues Found

The V1 hardening tests are failing due to database schema mismatches:

1. **Missing `stripe_events_processed` table** - Migration 901 needs to be run
2. **Missing required fields in test inserts:**
   - `password_hash` required in `users` table
   - `estimated_hours` doesn't exist (removed from schema)
3. **Test references wrong table structure** - Need to verify actual schema

## Fixes Applied

### 1. Fixed User Creation in Tests
Added `password_hash` field to user inserts:
```sql
INSERT INTO users (id, email, role, password_hash) 
VALUES ($1, $2, $3, $4) 
ON CONFLICT (id) DO NOTHING
```

### 2. Removed Non-Existent `estimated_hours` Field
The schema doesn't have `estimated_hours` - it was removed. Tests now use only required fields.

### 3. Added `actual_end_at` for Awaiting Approval Jobs
Jobs in `awaiting_approval` status should have `actual_end_at` set.

## Required Actions

### Before Running Tests

1. **Run V1 Hardening Migrations:**
   ```bash
   # These migrations must be run before tests
   npm run migrate:run DB/migrations/hardening/901_stripe_events_processed.sql
   npm run migrate:run DB/migrations/hardening/902_ledger_idempotency_constraints.sql
   npm run migrate:run DB/migrations/hardening/903_payout_items_uniqueness.sql
   npm run migrate:run DB/migrations/hardening/904_worker_runs_table.sql
   npm run migrate:run DB/migrations/hardening/905_users_fk_text_consistency.sql
   ```

2. **Verify Database Schema:**
   - Confirm `stripe_events_processed` table exists
   - Confirm `stripe_events` table has correct columns
   - Confirm unique constraints exist on `credit_ledger`

## Test Status

After fixes and migrations:
- ✅ Environment guards test should pass
- ⏸️ Ledger idempotency tests - waiting on migrations
- ⏸️ Stripe webhook idempotency - waiting on migrations  
- ⏸️ Atomic job completion - fixed user creation, should pass after migrations

