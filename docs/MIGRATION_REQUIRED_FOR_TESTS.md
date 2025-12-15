# ⚠️ Database Migrations Required for V1 Hardening Tests

**Status:** Tests are failing because V1 hardening migrations haven't been run on the test database.

## Required Migrations

Before running V1 hardening tests, you **must** run these migrations:

```bash
# Run all V1 hardening migrations
npm run migrate:run DB/migrations/hardening/901_stripe_events_processed.sql
npm run migrate:run DB/migrations/hardening/902_ledger_idempotency_constraints.sql
npm run migrate:run DB/migrations/hardening/903_payout_items_uniqueness.sql
npm run migrate:run DB/migrations/hardening/904_worker_runs_table.sql
npm run migrate:run DB/migrations/hardening/905_users_fk_text_consistency.sql
```

## What Each Migration Does

1. **901_stripe_events_processed.sql** - Creates `stripe_events_processed` table for webhook idempotency
2. **902_ledger_idempotency_constraints.sql** - Adds unique constraints to `credit_ledger` for idempotent operations
3. **903_payout_items_uniqueness.sql** - Creates `payout_items` table with uniqueness constraints
4. **904_worker_runs_table.sql** - Creates `worker_runs` table for worker execution tracking
5. **905_users_fk_text_consistency.sql** - Adds documentation comment (no schema changes)

## Current Test Failures (Before Migrations)

1. ❌ `stripe_events_processed` table does not exist
2. ❌ Missing unique constraints on `credit_ledger` 
3. ❌ Missing `payout_items` table

## After Running Migrations

All V1 hardening tests should pass:
- ✅ Environment guards
- ✅ Ledger idempotency
- ✅ Stripe webhook idempotency
- ✅ Atomic job completion

## Quick Fix Command

```bash
# Run all hardening migrations at once (if your migration script supports it)
for file in DB/migrations/hardening/*.sql; do
  npm run migrate:run "$file"
done
```

