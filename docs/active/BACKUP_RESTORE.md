# Backup & Restore Procedure

**Purpose:** Section 5 — Document how to restore from backup; validate integrity.  
**See also:** [DB/migrations/README.md](../DB/migrations/README.md), [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) Section 5.

---

## Backup Strategy

- **Neon:** Enable point-in-time recovery (PITR) and scheduled snapshots in Neon dashboard.
- **Manual:** `pg_dump` for ad-hoc exports before risky migrations.
- **Automation:** Use `scripts/backup:verify` (if present) to validate backup accessibility.

---

## Restore to Staging

1. **In Neon Dashboard:** Branch → Create branch from restore point, or restore primary from snapshot.
2. **Update staging `DATABASE_URL`** to point to restored branch.
3. **Run schema verification:**
   ```bash
   npm run db:verify:production
   ```
4. **Smoke test:** Run `npm test` against staging DB (use `DATABASE_URL` for test).

---

## Restore Procedure (Disaster)

1. Create new Neon project or restore from PITR/snapshot.
2. Update production `DATABASE_URL` (during maintenance window).
3. Run migrations if schema is behind: `npm run db:migrate`
4. Verify: `npm run db:verify:production`
5. Restart app; monitor logs and Sentry.

---

## Integrity Checks

- **Credit ledger:** Sum of `delta_credits` per user should match balance expectations.
- **Webhook idempotency:** No duplicate (provider, event_id) in `webhook_events`.
- **Payout items:** Each `ledger_entry_id` appears at most once in `payout_items`.

---

## Runbook Reference

| Action           | Command / Location                |
|------------------|-----------------------------------|
| Verify schema    | `npm run db:verify:production`    |
| Migrate          | `npm run db:migrate`              |
| Test DB setup    | `npm run db:setup:test`           |
| Neon restore     | Dashboard → Restore / Branch      |

**Last updated:** 2026-02-02
