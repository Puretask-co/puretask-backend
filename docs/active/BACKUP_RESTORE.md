# Backup & Restore

**Purpose:** Single doc for backup strategy, setup, and restore procedures (Neon, pg_dump, PITR). Validate integrity and run drills.  
**See also:** [DB/migrations/README.md](../DB/migrations/README.md), [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) Section 5, [RUNBOOK.md](./RUNBOOK.md).

---

## Key terms (plain English)

| Term | Meaning |
|------|--------|
| **Production** | The live app real users use. Changing it affects everyone. |
| **Staging** | A copy of the app for testing before we push to production. |
| **Backup** | A copy of the database at a point in time. |
| **Restore** | Bring the app back using that copy (e.g. after data loss or a bad migration). |
| **PITR** | Point-in-time recovery: restore to a specific time in the past (e.g. right before a bad migration). Neon provides this. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Runbook** | Step-by-step instructions for a task (e.g. how to restore) so anyone can do it without guessing. |

---

## 1. Backup strategy

- **Neon:** Enable point-in-time recovery (PITR) and scheduled snapshots in the Neon dashboard.
- **Manual:** `pg_dump` for ad-hoc exports before risky migrations.
- **Automation:** Use `npm run backup:verify` (if present) to validate backup accessibility.

### 1.1 Neon backup configuration

- Enable automated backups in Neon Console.
- Set retention (7–30 days depending on plan).
- Enable PITR on Pro tier.
- Run verification: `npm run backup:verify`.

Neon provides: daily automatic snapshots, PITR within retention, and branching (create a branch from a restore point). For details see [Neon docs](https://neon.tech/docs).

### 1.2 Logical backups (application-level)

The `backups` table holds business intelligence snapshots (aggregated metrics, trends), not a full DB dump.

- **Purpose:** Reporting and trend analysis.
- **Service:** `src/services/backupService.ts`
- **Worker:** `src/workers/backupDaily.ts` (daily).

These are **not** used for full database restore.

### 1.3 Manual pg_dump (optional)

For full database exports before risky changes:

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
pg_dump $DATABASE_URL --schema=public > backup_schema.sql
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## 2. Restore options

### 2.1 Restore to staging (non-disaster)

1. In **Neon Dashboard:** Branch → Create branch from restore point, or restore primary from snapshot.
2. Update staging `DATABASE_URL` to point to the restored branch.
3. Run schema verification: `npm run db:verify:production`
4. Smoke test: run `npm test` against staging DB.

### 2.2 Disaster restore (production)

1. Create new Neon project or restore from PITR/snapshot (do not overwrite production until verified).
2. Update production `DATABASE_URL` during a maintenance window.
3. If schema is behind: `npm run db:migrate`
4. Verify: `npm run db:verify:production`
5. Restart app; monitor logs and Sentry.

### 2.3 Option A: Neon PITR (recommended)

- **When:** Data loss, bad migration, or corruption.
- In Neon Dashboard → Project → Backups: select restore point, create new branch from backup, verify data, then switch production to the new branch if doing full restore.
- Or via CLI: `neonctl branches list`, then `neonctl branches create --from-backup <backup-id>`.

You get a **new** branch with data as of that time; point the app at it after verification.

### 2.4 Option B: Restore from pg_dump

When you have a SQL dump (e.g. from pre-migration backup):

```bash
psql $DATABASE_URL < backup_20240109_120000.sql
# Or to a new DB first (safer):
createdb puretask_restored
psql puretask_restored < backup_20240109_120000.sql
```

### 2.5 Option C: Schema only (fresh start)

For a new environment or after a full wipe:

```bash
createdb puretask_fresh
psql $DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql
# Optional: seed data
psql $DATABASE_URL -f DB/migrations/000_SEED_TEST_DATA.sql
```

---

## 3. Disaster recovery checklist

### Before restore

- [ ] Identify restore point (timestamp or backup ID).
- [ ] Verify backup exists and is accessible.
- [ ] Document current state (user count, job count, etc.).
- [ ] Notify team of maintenance window.

### During restore

- [ ] Create new branch/database (don’t overwrite production first).
- [ ] Restore from backup.
- [ ] Verify schema: `\dt` (list tables).
- [ ] Run validation queries (see below).
- [ ] Check critical tables: users, jobs, credit_ledger, payouts.

### After restore

- [ ] Verify application can connect.
- [ ] Run smoke tests (login, create job, etc.).
- [ ] Check financial data: credit balances, payouts.
- [ ] Verify webhook endpoints; monitor error logs.
- [ ] Document restore completion.

---

## 4. Integrity and validation

### 4.1 Integrity checks

- **Credit ledger:** Sum of `delta_credits` per user should match balance expectations.
- **Webhook idempotency:** No duplicate (provider, event_id) in `webhook_events`.
- **Payout items:** Each `ledger_entry_id` at most once in `payout_items`.

### 4.2 Validation queries (after restore)

```sql
-- Table counts
SELECT 'users' AS table_name, COUNT(*) AS count FROM users
UNION ALL SELECT 'jobs', COUNT(*) FROM jobs
UNION ALL SELECT 'credit_ledger', COUNT(*) FROM credit_ledger
UNION ALL SELECT 'payouts', COUNT(*) FROM payouts;

-- Orphaned jobs
SELECT COUNT(*) AS orphaned_jobs FROM jobs j
LEFT JOIN users u ON j.client_id = u.id WHERE u.id IS NULL;

-- Credit ledger balance check
SELECT user_id, SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) AS balance
FROM credit_ledger GROUP BY user_id
HAVING SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) < 0;
```

### 4.3 Verification cadence

- **Weekly:** Create test branch from latest backup; run validation queries; test app connection.
- **Monthly:** Full restore to staging; run test suite; document issues.

---

## 5. Runbook reference

| Action        | Command / location              |
|---------------|---------------------------------|
| Verify schema | `npm run db:verify:production`  |
| Migrate       | `npm run db:migrate`            |
| Test DB setup| `npm run db:setup:test`         |
| Neon restore  | Dashboard → Restore / Branch    |

---

## 6. Related documentation

- `DB/migrations/README.md` — Migration guide
- `src/services/backupService.ts` — Backup service
- `src/workers/backupDaily.ts` — Daily backup worker
- Archived runbook: `docs/archive/raw/runbooks/restore-from-backup.md`

**Sources consolidated (2026-02):** This doc synthesizes content from `docs/active/BACKUP_RESTORE.md`, `docs/active/01-HIGH/BACKUP_SETUP.md`, and `docs/active/01-HIGH/BACKUP_RESTORE_PROCEDURE.md`. Originals archived to `docs/archive/raw/consolidated-sources/01-HIGH/`.
