# Backup & Restore Procedure

## Overview

PureTask uses Neon PostgreSQL, which provides automatic backups and point-in-time recovery. This document outlines the backup and restore procedures for production readiness.

## Neon Backup Features

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

### Option 1: Neon Point-in-Time Recovery (Recommended)

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

```bash
# Restore full database
psql $DATABASE_URL < backup_20240109_120000.sql

# Restore to new database (safer)
createdb puretask_restored
psql puretask_restored < backup_20240109_120000.sql
```

### Option 3: Restore Schema Only (Fresh Start)

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
