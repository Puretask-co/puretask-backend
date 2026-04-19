# Phase 5 — Database & Migration Hygiene — Status

**Purpose:** Track Phase 5 (Section 5) progress.  
**Runbook:** [SECTION_05_DATABASE.md](../sections/SECTION_05_DATABASE.md).

---

## Current state

| Item | Status | Notes |
|------|--------|-------|
| **Canonical schema strategy** | In progress | Fresh DB: 000_CONSOLIDATED_SCHEMA.sql (+ optional seed). Existing: apply 001+ in order. Policy documented below. |
| **Migration naming** | ✅ | NNN_description.sql (001_init … 042_webhook_events); hardening/ 9NN_. |
| **NOT NULL / FK** | Partial | Many in place; add where missing per runbook. |
| **Unique constraints (idempotency)** | Partial | webhook_events, stripe_events_processed, idempotency_keys, 902/903. |
| **Safe migration workflow** | ✅ | Documented in this file: single system, naming, safe vs risky. |
| **Rollback strategy** | ✅ | Documented: risky migrations need rollback SQL or IRREVERSIBLE note; backward-compatible preferred. |
| **Index map** | ✅ | [DB/docs/INDEX_MAP.md](../../../DB/docs/INDEX_MAP.md); hot paths + 030 + hardening. |
| **Backups + restore** | ✅ | [BACKUP_RESTORE.md](../BACKUP_RESTORE.md); run restore test periodically. |
| **Audit tables** | ✅ | webhook_events, credit_ledger, admin_audit_log (019). |
| **CI: migrations on fresh DB** | ✅ | `.github/workflows/migrations.yml`: consolidated schema + smoke query. |

---

## Schema strategy (Section 5.2)

- **Fresh database:** Run `000_CONSOLIDATED_SCHEMA.sql` only (or equivalent single baseline). Optional: `000_SEED_TEST_DATA.sql` for dev.
- **Existing / production:** Apply numbered migrations in order (001, 002, … 042, …). Do not re-run consolidated schema.
- **New changes:** Add a new migration file `NNN_short_description.sql` (next number). Never edit an already-applied migration.
- **Policy:** No manual prod SQL; all schema changes via migration files. See [DB/migrations/README.md](../../../DB/migrations/README.md).

---

## Safe migration workflow (Section 5.3–5.4)

- **Single system:** Migrations are SQL files applied in order via `psql $DATABASE_URL -f DB/migrations/NNN_*.sql` (or a future `npm run db:migrate` runner). No manual ad-hoc SQL in production.
- **Naming:** `NNN_short_description.sql` only; no `fix_000_*` — fixes get the next number. Migrations are append-only; if a past migration is wrong, add a new migration; do not rewrite history.
- **Safe vs risky:** Additive changes (new nullable column, new table) = safe. Destructive (DROP, enum renames, data rewrites) = risky; require rollback strategy or explicit irreversible note in the migration file.

---

## Rollback strategy for risky migrations

- **Risky migrations** must include a comment at the top with either: (a) rollback SQL (e.g. `-- ROLLBACK: DROP TABLE new_table;`), or (b) `-- IRREVERSIBLE: <reason>`.
- **Prefer backward-compatible:** Add new column nullable first; backfill; then add NOT NULL in a later migration. Avoid single-step DROP column in prod without a deploy that stops using it.
- **Rollback test:** For any risky migration, run the rollback procedure once in dev and document outcome in this file or the runbook.

---

## Index map (Section 5.7) — placeholder

Hot paths to document and justify: job feed/search/filter, booking creation, job completion, disputes listing, ledger/payout calculations, admin dashboards. Every FK and frequent filter column should have a supporting index. Add composite indexes for common filters: `(status, created_at)`, `(user_id, created_at)`, `(job_id, type)`. See existing `030_performance_indexes.sql` and runbook § 5.7. Full index map to be added to [SECTION_05_DATABASE.md](../sections/SECTION_05_DATABASE.md) or `DB/docs/INDEX_MAP.md`.

---

## Links

- [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 5 checklist
- [SECTION_05_DATABASE.md](../sections/SECTION_05_DATABASE.md) — Runbook
- [DB/migrations/README.md](../../../DB/migrations/README.md) — Migration usage

**Last updated:** 2026-01-31
