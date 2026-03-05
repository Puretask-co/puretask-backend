# Backup & Restore Procedure

## Overview

**What it is:** The high-level summary of our backup and restore setup (Neon, logical backups, pg_dump).  
**What it does:** Describes what backups exist and when to use each restore option.  
**How we use it:** Read this first; then use Neon Backup Features, Backup Strategy, and Restore Procedures when configuring or performing a restore.

PureTask uses Neon PostgreSQL, which provides automatic backups and point-in-time recovery. This document outlines the backup and restore procedures for production readiness.

**What this doc is for:** Use it when you need to (1) understand what backups exist (Neon automatic, logical, pg_dump), (2) restore after data loss or a bad migration, or (3) run a restore drill. Each option below explains **what it is**, **when to use it**, and **how to verify** after restore.

**Why backup/restore matters:** Without tested restore procedures, you don't know if backups are usable. This doc and the runbook (`docs/runbooks/restore-from-backup.md`) let anyone perform a restore during an incident.

**In plain English:** *Backup* = a copy of the database at a point in time. *Restore* = bring the app back using that copy (e.g. after data loss or a bad change). *PITR* (Point-in-Time Recovery) = choose exactly when in the past to restore to (e.g. "right before the bad migration"). Neon does this for us; we just pick the time and create a new branch from it.

---

## New here? Key terms (plain English)

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## Neon Backup Features

**What it is:** The backup capabilities Neon gives us (PITR, automatic snapshots, branching).  
**What it does:** Lets us restore to a point in time or create a branch from a past state.  
**How we use it:** Rely on Neon Console for backups; use PITR when we need to restore (see Restore Procedures).

Neon automatically provides:
- **Point-in-time recovery (PITR)**: Restore to any point in time within the retention period
- **Automatic backups**: Daily snapshots
- **Branching**: Create database branches for testing/rollback

## Backup Strategy

### 1. Neon Automatic Backups
- **Frequency**: Daily automatic snapshots
- **Retention**: 7 days (Neon free tier) or 30 days (paid tier)
- **Location**: Managed by Neon
- **Access**: Via Neon Console → Backups

### 2. Logical Backups (Application-Level)
**What it is:** Application-level snapshots stored in the `backups` table (metrics, trends).  
**What it does:** Supports business reporting and trend analysis; not a full DB dump.  
**How we use it:** Run via backupDaily worker; query backups table for reporting; not used for full restore.

The `backups` table stores business intelligence snapshots:
- **Purpose**: Aggregated metrics, not full database dump
- **Service**: `src/services/backupService.ts`
- **Worker**: `src/workers/backupDaily.ts` (runs daily)
- **Use Case**: Business reporting, trend analysis

### 3. Manual pg_dump (Optional)
For full database exports:

```bash
# Export full database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Export specific schema
pg_dump $DATABASE_URL --schema=public > backup_schema.sql

# Export compressed
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

## Restore Procedures

**What it is:** The steps to restore the DB after data loss, bad migration, or corruption.  
**What it does:** Gives us a repeatable way to get back to a good state.  
**How we use it:** Prefer Option 1 (Neon PITR); use Option 2 if we have a pg_dump file; run a restore drill periodically.

### Option 1: Neon Point-in-Time Recovery (Recommended)

**What it is:** Neon stores backup history; you can create a new branch from a past point in time.  
**What it does:** Restores to a chosen time without overwriting the current branch; we then point the app at the new branch.  
**How we use it:** In Neon Console create a branch from a timestamp before the incident; verify; update DATABASE_URL to the new branch; see runbook for full steps. You don't overwrite the current branch—you get a new branch with data as of that time, then point the app at it if you're doing a full restore.

**When to use:** Data loss, bad migration, or corruption. Prefer this over pg_dump restore when you're on Neon because it's fast and doesn't require a dump file.

1. **Via Neon Console**:
   - Go to Neon Dashboard → Your Project → Backups
   - Select restore point
   - Create new branch from backup
   - Verify data integrity
   - Switch production to new branch (if needed)

2. **Via Neon CLI**:
   ```bash
   # List available restore points
   neonctl branches list
   
   # Create branch from backup
   neonctl branches create --from-backup <backup-id>
   ```

### Option 2: Restore from pg_dump

**What it is:** Restore a full database from a SQL dump file you created earlier with `pg_dump`. Use when you have a dump and need to restore to a new or empty database.

**When to use:** When you don't use Neon PITR, or you have a custom dump from another source. Prefer restoring to a new database so you don't overwrite production until verified.

```bash
# Restore full database
psql $DATABASE_URL < backup_20240109_120000.sql

# Restore to new database (safer)
createdb puretask_restored
psql puretask_restored < backup_20240109_120000.sql
```

### Option 3: Restore Schema Only (Fresh Start)

**What it is:** Create a new database and apply only the schema (tables, indexes) from your migrations or consolidated schema file. No data.

**When to use:** New environment (e.g. fresh staging), or after a complete wipe when you'll re-seed or re-import data.

For a fresh database with schema only:

```bash
# 1. Create new database
createdb puretask_fresh

# 2. Run consolidated schema
psql $DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql

# 3. (Optional) Run seed data
psql $DATABASE_URL -f DB/migrations/000_SEED_TEST_DATA.sql
```

## Disaster Recovery Checklist

**What this checklist is for:** Follow it during a real restore or a drill. Before = confirm scope and notify. During = do the restore and verify. After = smoke-test and monitor.

### Before Restore
- [ ] Identify the restore point (timestamp or backup ID)
- [ ] Verify backup exists and is accessible
- [ ] Document current state (user count, job count, etc.)
- [ ] Notify team of maintenance window

### During Restore
- [ ] Create new branch/database (don't overwrite production)
- [ ] Restore from backup
- [ ] Verify schema integrity: `\dt` (list tables)
- [ ] Verify data integrity: Run smoke queries
- [ ] Check critical tables: users, jobs, credit_ledger, payouts

### After Restore
- [ ] Verify application can connect
- [ ] Run smoke tests: login, create job, etc.
- [ ] Check financial data: credit balances, payouts
- [ ] Verify webhook endpoints still work
- [ ] Monitor error logs for 24 hours
- [ ] Document restore completion

## Validation Queries

After restore, run these to verify integrity:

```sql
-- Check table counts
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL
SELECT 'credit_ledger', COUNT(*) FROM credit_ledger
UNION ALL
SELECT 'payouts', COUNT(*) FROM payouts;

-- Check for orphaned records
SELECT COUNT(*) as orphaned_jobs 
FROM jobs j 
LEFT JOIN users u ON j.client_id = u.id 
WHERE u.id IS NULL;

-- Check credit ledger integrity
SELECT 
  user_id,
  SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) as balance
FROM credit_ledger
GROUP BY user_id
HAVING SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) < 0;

-- Check recent activity
SELECT 
  DATE(created_at) as date,
  COUNT(*) as jobs_created
FROM jobs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Backup Verification

### Weekly Backup Test
1. Create test branch from latest backup
2. Verify schema is complete
3. Run validation queries
4. Test application connection
5. Document results

### Monthly Full Restore Drill
1. Restore to staging environment
2. Run full test suite
3. Verify all critical paths work
4. Document any issues found

## Neon-Specific Notes

- **Branching**: Neon branches are instant and don't consume storage until written to
- **PITR**: Available for 7-30 days depending on plan
- **Storage**: Backups don't count against storage quota
- **Performance**: Restores are fast (seconds to minutes)

## Emergency Contacts

- **Neon Support**: https://neon.tech/support
- **Database Admin**: [Your contact]
- **On-Call Engineer**: [Your contact]

## Related Documentation

- `DB/migrations/README.md` - Migration guide
- `src/services/backupService.ts` - Backup service code
- `src/workers/backupDaily.ts` - Daily backup worker
