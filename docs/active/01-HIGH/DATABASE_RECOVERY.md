# Database Recovery Runbook

## Quick Reference

**What it is:** Emergency contact, Neon Console link, and recovery script for quick access during an incident.  
**What it does:** Gives on-call or responders the essentials without scrolling.  
**How we use it:** Fill in Emergency Contact; use Neon Console and recovery script when restoring.

**Emergency Contact**: [Your Team Contact]  
**Neon Console**: https://console.neon.tech  
**Recovery Script**: `npm run backup:verify`

**What this doc is for:** Use it when the database is corrupted, data is lost, or a migration failed. It walks through: (1) assess the situation, (2) create a Neon recovery branch, (3) verify and test, (4) promote or point the app. Each step explains **what to do** and **how to verify**. See also `docs/runbooks/restore-from-backup.md` for a shorter checklist.

**Why it matters:** During an incident you need one place to follow step-by-step. This runbook and the restore runbook ensure anyone (or on-call) can restore without guessing.

**In plain English:** If the database is broken or data was deleted by mistake, use this doc. It walks you through: figure out what went wrong, create a "recovery copy" of the database from a past point in time (Neon lets you do that), check that the copy is good, then point the app at the copy so we're back online.

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

## Recovery Procedures

**What it is:** The step-by-step process to restore the DB (assess, create branch, verify, test, promote, post-recovery).  
**What it does:** Ensures we restore in the right order and verify before switching the app.  
**How we use it:** Follow steps 1–6 in order; use runbook `docs/runbooks/restore-from-backup.md` for a shorter checklist.

### Step 1: Assess the Situation
**What it is:** Figuring out what went wrong and what "good" looks like (timestamp, backup ID).  
**What it does:** Avoids restoring to the wrong point or overwriting good data.  
**How we use it:** Identify issue (corruption, deletion, migration failure); determine recovery point from logs or team.

**What this step is for:** Before touching the DB, confirm what went wrong and what "good" looks like (timestamp, backup ID). Avoids restoring to the wrong point or overwriting good data.

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

**What this step is for:** In Neon you create a new branch from a backup or point-in-time. That branch is a copy of the DB at that moment; production is unchanged until you point the app at the new branch.

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
**What it is:** Checking that the recovery branch has the expected data and schema.  
**What it does:** Confirms we didn't restore to the wrong time or a bad state.  
**How we use it:** Connect to the recovery branch; run queries or `npm run backup:verify`; spot-check critical tables.

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
**What it is:** Making the recovery branch the primary DB (or pointing the app at it).  
**What it does:** Switches production (or staging) to the restored data.  
**How we use it:** In Neon promote the recovery branch to primary, or update DATABASE_URL to the recovery branch; deploy if needed.

**Option A: Update Production DATABASE_URL**
- Update production environment variable
- Point to recovery branch connection string
- Restart application

**Option B: Promote Branch to Main**
- In Neon Console, promote recovery branch
- This makes it the new main branch
- Update production DATABASE_URL if needed

### Step 6: Post-Recovery
**What it is:** Actions after restore (notify team, document incident, review prevention).  
**What it does:** Closes the loop and reduces chance of repeat.  
**How we use it:** Notify stakeholders; update incident doc; run Prevention Checklist; schedule post-mortem if needed.

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
- [Database Backup Guide](../DATABASE_BACKUP_GUIDE.md)
