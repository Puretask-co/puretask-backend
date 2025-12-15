# How to Run Database Migrations

This guide explains how to run `DB/migrations/000_fix_payouts_fk.sql` to fix the foreign key constraint.

---

## Option 1: Neon SQL Editor (Recommended) ⭐

This is the easiest method if you're using Neon as your database.

### Steps:

1. **Open Neon Console**
   - Go to [Neon Console](https://console.neon.tech)
   - Select your project
   - Click on your database

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Or use the query editor in your database dashboard

3. **Copy and Paste Migration**
   - Open `DB/migrations/000_fix_payouts_fk.sql` in your editor
   - Copy the entire file contents
   - Paste into Neon SQL Editor

4. **Run the Migration**
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - The migration will execute all steps automatically

5. **Verify Success**
   - Look for "NOTICE" messages in the output:
     - `"Foreign key constraint is correct or does not exist"`
     - `"Added correct foreign key constraint: payouts.cleaner_id -> users.id"`
   - Or check for any error messages

---

## Option 2: npm Script (Recommended for Automation) ⭐

This is the best method for automated deployments and CI/CD pipelines.

### Steps:

1. **Ensure Environment is Set**
   ```bash
   # Make sure DATABASE_URL is in your .env file
   # Or set it as an environment variable
   export DATABASE_URL="your-database-connection-string"
   ```

2. **Run the Migration**
   ```bash
   # Run the specific migration
   npm run migrate:fix-payouts-fk
   
   # Or run any migration file
   npm run migrate:run DB/migrations/000_fix_payouts_fk.sql
   ```

3. **Verify Success**
   - Check console output for success messages
   - Look for "✅ Migration completed successfully"
   - Check for any error messages

**Advantages:**
- ✅ Uses Node.js (no need for psql)
- ✅ Reads from `.env` automatically
- ✅ Better error handling
- ✅ Works in CI/CD pipelines
- ✅ Cross-platform (Windows, Mac, Linux)

---

## Option 3: psql Command Line

If you have `psql` installed and prefer command-line tools.

### Steps:

1. **Get Your Connection String**
   ```bash
   # Your DATABASE_URL from .env file
   # Format: postgresql://user:password@host:port/database?sslmode=require
   ```

2. **Run the Migration**
   ```bash
   # Using connection string directly
   psql "your-database-connection-string" -f DB/migrations/000_fix_payouts_fk.sql
   
   # Or using environment variable
   psql $DATABASE_URL -f DB/migrations/000_fix_payouts_fk.sql
   ```

3. **Verify Success**
   - Check the output for NOTICE messages
   - No errors should appear

**Note:** On Windows, you may need to use `psql.exe` or install PostgreSQL client tools.

---

## Option 4: Using a Migration Tool

You can use a migration tool like `node-pg-migrate` or `db-migrate`, but you'll need to set it up first.

---

## Verification

After running the migration, verify it worked using one of these methods:

### Option 1: Automated Verification Script (Recommended) ⭐

```bash
npm run migrate:verify
```

This script automatically checks:
- ✅ Foreign key constraint exists and references `users.id`
- ✅ `cleaner_profiles` table exists with all required columns
- ✅ All required indexes exist

### Option 2: Manual SQL Query

Run this query in Neon SQL Editor or psql:

```sql
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'payouts'
  AND kcu.column_name = 'cleaner_id';
```

**Expected Result:**
```
constraint_name          | column_name | foreign_table_name | foreign_column_name
-------------------------|-------------|---------------------|--------------------
payouts_cleaner_id_fkey  | cleaner_id  | users               | id
```

If you see `cleaner_profiles` instead of `users`, the migration didn't work correctly.

---

## What This Migration Does

The migration file `000_fix_payouts_fk.sql` follows database migration best practices:

### Best Practices Followed:
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Conditional** - Uses `IF EXISTS` / `IF NOT EXISTS` checks
- ✅ **Non-destructive** - Only adds/updates, never deletes data
- ✅ **Transactional** - Uses DO blocks for atomic operations
- ✅ **Informative** - Uses RAISE NOTICE for feedback

### Steps Performed:

1. **Checks Current Foreign Key**
   - Queries the database to see what the current FK references
   - Uses information_schema for reliable detection

2. **Drops Incorrect Foreign Key** (if needed)
   - Only drops if FK references wrong table (`cleaner_profiles` instead of `users`)
   - Uses conditional logic to avoid errors

3. **Adds Correct Foreign Key**
   - Creates `payouts.cleaner_id` → `users.id` foreign key
   - Only if it doesn't already exist
   - Uses `ON DELETE RESTRICT` for data integrity

4. **Ensures cleaner_profiles Table Exists**
   - Creates the table if it doesn't exist
   - Matches exact schema from `001_init.sql`
   - Adds all required columns with proper types and defaults
   - Creates necessary indexes

5. **Adds Missing Columns** (if table exists but is incomplete)
   - Checks for missing columns and adds them
   - Handles schema drift gracefully
   - Ensures `reliability_score`, `hourly_rate_credits`, etc. exist

6. **Creates Missing Profiles** (if needed)
   - If FK references `cleaner_profiles`, creates profiles for existing cleaners
   - Uses `ON CONFLICT DO NOTHING` for safety

---

## Troubleshooting

### Error: "relation 'payouts' does not exist"
- **Solution:** Run `001_init.sql` first to create the tables

### Error: "permission denied"
- **Solution:** Make sure you're using a database user with ALTER TABLE permissions

### Error: "constraint already exists"
- **Solution:** This is fine - the migration checks for this and skips if it exists

### Error: "column 'reliability_score' does not exist"
- **Solution:** The migration creates `cleaner_profiles` with this column, but if the table already exists without it, you may need to add it manually:
  ```sql
  ALTER TABLE cleaner_profiles 
  ADD COLUMN IF NOT EXISTS reliability_score NUMERIC(5,2) NOT NULL DEFAULT 100.0;
  ```

---

## Quick Start Guide

### For Neon (Easiest):

1. Copy the entire contents of `DB/migrations/000_fix_payouts_fk.sql`
2. Paste into Neon SQL Editor
3. Click "Run"
4. Verify: `npm run migrate:verify`
5. Done! ✅

### For Automation/CI:

```bash
# Run migration
npm run migrate:fix-payouts-fk

# Verify it worked
npm run migrate:verify
```

---

## Next Steps

After running the migration:

1. **Verify the constraint** using the verification query above
2. **Run your tests** to ensure everything works:
   ```bash
   npm run test:smoke
   ```
3. **Check logs** for any foreign key constraint errors

---

## Need Help?

If you encounter issues:
1. Check the migration output for NOTICE messages
2. Run the verification query to see current FK state
3. Check your database logs for detailed error messages

