# Database Migration Best Practices - PureTask Backend

**Date:** 2025-01-11  
**Status:** ✅ Implemented

---

## Overview

This document outlines the best practices we follow for database migrations in the PureTask backend.

---

## ✅ Best Practices Implemented

### 1. **Idempotency**
- ✅ All migrations use `IF EXISTS` / `IF NOT EXISTS` checks
- ✅ Safe to run multiple times without errors
- ✅ No data loss if migration runs twice

**Example:**
```sql
CREATE TABLE IF NOT EXISTS cleaner_profiles (...);
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_tier ON cleaner_profiles (tier);
```

### 2. **Conditional Logic**
- ✅ Uses `DO $$ BEGIN ... END $$;` blocks for conditional execution
- ✅ Checks current state before making changes
- ✅ Provides informative NOTICE messages

**Example:**
```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ... WHERE constraint_name = 'payouts_cleaner_id_fkey') THEN
    ALTER TABLE payouts ADD CONSTRAINT ...;
    RAISE NOTICE 'Added constraint';
  ELSE
    RAISE NOTICE 'Constraint already exists';
  END IF;
END $$;
```

### 3. **Non-Destructive**
- ✅ Only adds/updates, never deletes data
- ✅ Drops constraints only if they're incorrect
- ✅ Creates missing columns/tables safely

### 4. **Schema Consistency**
- ✅ Matches exact schema from `001_init.sql`
- ✅ Handles schema drift gracefully
- ✅ Adds missing columns if table exists but is incomplete

### 5. **Error Handling**
- ✅ Clear error messages
- ✅ Validates environment before running
- ✅ Provides troubleshooting hints

### 6. **Verification**
- ✅ Automated verification script (`npm run migrate:verify`)
- ✅ Checks foreign keys, tables, columns, indexes
- ✅ Provides actionable feedback

---

## Migration Script Best Practices

### ✅ **What We're Doing Right**

1. **Environment Validation**
   - ✅ Checks `DATABASE_URL` exists
   - ✅ Validates connection string format
   - ✅ Provides clear error messages

2. **Connection Management**
   - ✅ Uses connection pooling
   - ✅ Sets timeouts (connection, query)
   - ✅ Properly releases connections

3. **Error Handling**
   - ✅ Catches and reports errors clearly
   - ✅ Provides troubleshooting hints
   - ✅ Exits with appropriate codes

4. **User Feedback**
   - ✅ Clear progress messages
   - ✅ Success/failure indicators
   - ✅ Next steps guidance

### ⚠️ **Considerations**

1. **Transactions**
   - Most DDL can be in transactions
   - `CREATE INDEX CONCURRENTLY` cannot
   - Our migration uses DO blocks which handle their own logic

2. **Large Migrations**
   - Current migration is small and fast
   - For larger migrations, consider batching
   - Monitor execution time

---

## Migration File Structure

### Standard Format:

```sql
-- Migration Name
-- Description of what it does
-- Best Practice: Include context and purpose

-- Step 1: Check current state
-- Step 2: Make conditional changes
-- Step 3: Verify changes
-- Step 4: Handle edge cases
```

### Our Migration (`000_fix_payouts_fk.sql`):

1. ✅ **Header comment** - Explains purpose
2. ✅ **Commented diagnostic query** - For manual checking
3. ✅ **Conditional FK drop** - Only if wrong
4. ✅ **Conditional FK add** - Only if missing
5. ✅ **Table creation** - With IF NOT EXISTS
6. ✅ **Column addition** - Handles schema drift
7. ✅ **Index creation** - With IF NOT EXISTS
8. ✅ **Data migration** - Creates missing profiles if needed

---

## Running Migrations

### Best Practice: Always Verify

```bash
# 1. Run migration
npm run migrate:fix-payouts-fk

# 2. Verify it worked
npm run migrate:verify

# 3. Run tests
npm run test:smoke
```

### Order of Operations:

1. ✅ **Backup** (if production) - Always backup before migrations
2. ✅ **Test in dev** - Run in development first
3. ✅ **Run migration** - Execute the migration
4. ✅ **Verify** - Use verification script
5. ✅ **Test** - Run test suite
6. ✅ **Monitor** - Check application logs

---

## Verification Checklist

After running a migration, verify:

- [ ] Foreign key constraints are correct
- [ ] Required tables exist
- [ ] Required columns exist
- [ ] Required indexes exist
- [ ] Data integrity is maintained
- [ ] Tests pass
- [ ] Application starts without errors

---

## Common Issues & Solutions

### Issue: "relation does not exist"
**Solution:** Run `001_init.sql` first to create base tables

### Issue: "permission denied"
**Solution:** Use a database user with ALTER TABLE permissions

### Issue: "constraint already exists"
**Solution:** This is fine - migration checks and skips

### Issue: "column does not exist"
**Solution:** Migration handles this - adds missing columns

### Issue: Connection timeout
**Solution:** 
- Check DATABASE_URL is correct
- Verify network connectivity
- Check database is running

---

## Migration Tools Comparison

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **Neon SQL Editor** | Easy, visual feedback | Manual, not automated | Quick fixes, one-off changes |
| **npm script** | Automated, CI/CD friendly | Requires Node.js | Development, CI/CD |
| **psql** | Standard tool, powerful | Requires psql install | Advanced users, scripts |
| **Migration tool** | Versioning, rollback | Setup overhead | Large projects, teams |

**Our Choice:** npm script + Neon SQL Editor (hybrid approach)

---

## Future Improvements

### Potential Enhancements:

1. **Migration Versioning**
   - Track which migrations have been run
   - Prevent running same migration twice
   - Enable rollback capability

2. **Migration Testing**
   - Test migrations in isolated environment
   - Verify rollback works
   - Test with sample data

3. **Automated Verification**
   - Run verification after each migration
   - Fail CI/CD if verification fails
   - Generate migration reports

---

## Conclusion

Our migration system follows industry best practices:

✅ **Idempotent** - Safe to run multiple times  
✅ **Non-destructive** - Never deletes data  
✅ **Conditional** - Checks before changing  
✅ **Verifiable** - Automated verification  
✅ **Documented** - Clear guides and comments  

**Status:** Production-ready ✅

