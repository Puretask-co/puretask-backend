# Migration Execution Guide for Neon

**Date:** 2025-01-12  
**Purpose:** Guide to run all required migrations for V1 testing

---

## Required Migrations

You need to run migrations in this order:

1. **Base Schema** (`000_CONSOLIDATED_SCHEMA.sql`) - Creates all core tables
2. **V1 Hardening Migrations** (`NEON_V1_HARDENING_MIGRATIONS.sql`) - Adds idempotency and safety

---

## Step-by-Step Instructions

### Step 1: Run Base Schema (If Not Already Done)

If your Neon database doesn't have the base tables yet, you need to run the consolidated schema first.

**Option A: Run via Migration Script** (Recommended)
```bash
npm run migrate:run
```

**Option B: Run Manually in Neon SQL Editor**
1. Open `DB/migrations/000_CONSOLIDATED_SCHEMA.sql`
2. Copy the entire file
3. Paste into Neon SQL Editor
4. Run it

**This creates:**
- `users`, `jobs`, `credit_ledger`, `payouts`
- `kpi_snapshots` ✅ (needed for kpi-snapshot worker)
- `stripe_events` ✅ (needed for retry-events worker)
- All other core tables

---

### Step 2: Run V1 Hardening Migrations

**In Neon SQL Editor:**
1. Open `docs/NEON_V1_HARDENING_MIGRATIONS.sql`
2. Copy the **entire file** (lines 1-146)
3. Paste into Neon SQL Editor
4. **Important:** Make sure you're copying pure SQL - no markdown headers
5. Run it

**This creates:**
- `stripe_events_processed` ✅
- `worker_runs` ✅ (includes `error_message` column)
- `payout_items` ✅
- Unique indexes for idempotency ✅

---

### Step 3: Verify Migrations

Run these verification queries in Neon SQL Editor:

```sql
-- Check V1 hardening tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'stripe_events_processed',
    'payout_items',
    'worker_runs'
  )
ORDER BY table_name;

-- Should return 3 rows

-- Check base schema tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'kpi_snapshots',
    'stripe_events'
  )
ORDER BY table_name;

-- Should return 2 rows

-- Check worker_runs has error_message column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'worker_runs' 
  AND column_name = 'error_message';

-- Should return 1 row with data_type = 'text'

-- Check stripe_events has stripe_event_id column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stripe_events' 
  AND column_name = 'stripe_event_id';

-- Should return 1 row with data_type = 'text'
```

---

## Troubleshooting

### Error: "syntax error at or near '#'"

**Problem:** You may have accidentally copied markdown headers (lines starting with `#`) into SQL.

**Solution:** 
- Only copy SQL statements (lines starting with `CREATE`, `SELECT`, `--`, etc.)
- Skip any markdown headers like `# Title` or `## Section`

### Error: "relation already exists"

**Problem:** Tables already exist from previous migration runs.

**Solution:** This is fine! The migrations use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, so they're safe to re-run.

### Error: "column does not exist"

**Problem:** Base schema not fully applied yet.

**Solution:** Run `000_CONSOLIDATED_SCHEMA.sql` first, then run V1 hardening migrations.

---

## Expected Results After All Migrations

After running both migrations, these workers should pass:

- ✅ **auto-cancel**: Should work (may have data issues but worker functions correctly)
- ✅ **payouts**: Should pass completely
- ✅ **kpi-snapshot**: Should pass (requires `kpi_snapshots` table)
- ✅ **retry-events**: Should pass (requires `stripe_events.stripe_event_id` column)

---

## Quick Verification Command

After migrations, run:
```bash
npm run test:worker-dryrun
```

You should see:
```
Total Workers Tested: 4
✅ Successful: 4
❌ Failed: 0
```

---

## Notes

- All migrations are **idempotent** (safe to run multiple times)
- The V1 hardening migrations only add new tables/indexes, they don't modify existing tables
- If you get foreign key errors, ensure `000_CONSOLIDATED_SCHEMA.sql` ran successfully first

