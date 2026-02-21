# Backup & Restore Procedure

**Purpose:** Section 5 deliverable — documented backup schedule and restore steps.  
**See also:** [SECTION_05_DATABASE.md](./SECTION_05_DATABASE.md) § 5.12.

---

## Backup strategy

- **Neon:** Use Neon’s point-in-time restore (PITR) and branching if enabled. Schedule regular snapshots per Neon project settings.
- **Alternative:** If self-hosted Postgres, run `pg_dump` on a schedule (e.g. daily) to a secure object store; retain 7–30 days per policy.
- **Secrets:** Never store DB credentials in repo; use Railway/Neon env vars.

---

## Restore procedure (e.g. to staging)

1. **Create target DB** (new Neon branch or new database).
2. **Apply schema:**
   - **Option A (fresh):** `psql $DATABASE_URL -f DB/migrations/000_CONSOLIDATED_SCHEMA.sql`
   - **Option B (incremental):** Apply migrations 001 through 042 and `hardening/*` in order (see [DB/migrations/README.md](../../DB/migrations/README.md)).
3. **Restore data (if from backup):** `psql $DATABASE_URL < backup.sql` or use Neon PITR to a point in time.
4. **Validate:** Run smoke queries (e.g. `SELECT COUNT(*) FROM users;`, `SELECT 1 FROM jobs LIMIT 1;`). Check app and workers connect and key flows work.
5. **Cut-over:** Point staging app to new DB URL; verify; document outcome.

---

## Restore test (recommended)

- Periodically run a restore to a staging or dev DB and verify app + workers. Record result in PHASE_5_STATUS or runbook (e.g. “Restore test 2026-01-31: success”).

---

**Last updated:** 2026-01-31
