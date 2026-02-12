# Database Recovery Runbook

## Quick Reference

**Emergency Contact**: [Your Team Contact]  
**Neon Console**: https://console.neon.tech  
**Recovery Script**: `npm run backup:verify`

## Recovery Procedures

### Step 1: Assess the Situation

1. **Identify the Issue**
   - Data corruption?
   - Accidental deletion?
   - Database unavailable?
   - Schema migration failure?

2. **Determine Recovery Point**
   - When did the issue occur?
   - What's the latest known good state?
   - Check application logs for timestamps

3. **Check Backup Availability**
   - Log in to Neon Console
   - Verify backups exist
   - Check retention period hasn't expired

### Step 2: Create Recovery Branch

1. **Access Neon Console**
   - Go to https://console.neon.tech
   - Select your project

2. **Create Branch**
   - Click **Branches** → **Create Branch**
   - Select recovery point:
     - **Latest Backup**: For most recent good state
     - **Point in Time**: For specific timestamp
   - Name: `recovery-YYYY-MM-DD-HHMM`
   - Click **Create**

3. **Get Recovery Connection String**
   - Click on recovery branch
   - Copy connection string
   - Format: `postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require`

### Step 3: Verify Recovery Branch

```bash
# Set recovery database URL
export DATABASE_URL="postgres://user:pass@ep-recovery-xxx.neon.tech/db?sslmode=require"

# Run verification
npm run backup:verify
```

**Expected**: All critical tables present with data

### Step 4: Test Application

```bash
# Update .env with recovery DATABASE_URL
# Run tests
npm test

# Start application (if needed)
npm run dev
```

**Verify**:
- ✅ Application starts successfully
- ✅ Critical endpoints work
- ✅ Data appears correct
- ✅ No errors in logs

### Step 5: Promote Recovery Branch

**Option A: Update Production DATABASE_URL**
- Update production environment variable
- Point to recovery branch connection string
- Restart application

**Option B: Promote Branch to Main**
- In Neon Console, promote recovery branch
- This makes it the new main branch
- Update production DATABASE_URL if needed

### Step 6: Post-Recovery

1. **Monitor Application**
   - Watch error logs
   - Monitor critical metrics
   - Verify user reports

2. **Document Incident**
   - What happened?
   - When did it occur?
   - What was the recovery time?
   - What could prevent this?

3. **Update Procedures**
   - Improve backup verification
   - Add monitoring alerts
   - Update runbook if needed

## Recovery Scenarios

### Scenario: Accidental Data Deletion

**Symptoms**: Missing records, empty tables

**Recovery**:
1. Identify deletion timestamp
2. Create branch from point before deletion
3. Verify data restored
4. Promote branch

**Prevention**: Add soft deletes, audit logs

### Scenario: Data Corruption

**Symptoms**: Invalid data, constraint violations

**Recovery**:
1. Identify corruption timestamp
2. Create branch from point before corruption
3. Verify data integrity
4. Promote branch

**Prevention**: Add data validation, integrity checks

### Scenario: Schema Migration Failure

**Symptoms**: Application errors, missing columns

**Recovery**:
1. Create branch from before migration
2. Fix migration script
3. Re-run migration on recovery branch
4. Verify application works
5. Promote branch

**Prevention**: Test migrations on staging, use transactions

### Scenario: Database Unavailable

**Symptoms**: Connection errors, timeouts

**Recovery**:
1. Check Neon status page
2. If Neon issue, wait for resolution
3. If project issue, create new branch from backup
4. Update DATABASE_URL
5. Restart application

**Prevention**: Monitor database health, set up alerts

## Recovery Checklist

- [ ] Issue identified and documented
- [ ] Recovery point determined
- [ ] Backup verified in Neon Console
- [ ] Recovery branch created
- [ ] Recovery branch verified (`npm run backup:verify`)
- [ ] Application tested with recovery branch
- [ ] Recovery branch promoted or DATABASE_URL updated
- [ ] Application restarted
- [ ] Application monitored post-recovery
- [ ] Incident documented
- [ ] Procedures updated if needed

## Prevention Checklist

- [ ] Automated backups enabled
- [ ] Backup verification scheduled (daily)
- [ ] Recovery procedures documented
- [ ] Team trained on recovery
- [ ] Monitoring alerts configured
- [ ] Regular recovery testing (quarterly)

## Emergency Contacts

- **Database Admin**: [Contact]
- **DevOps Lead**: [Contact]
- **On-Call Engineer**: [Contact]
- **Neon Support**: support@neon.tech

## Additional Resources

- [Neon Documentation](https://neon.tech/docs)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
- [Database Backup Guide](./DATABASE_BACKUP_GUIDE.md)
