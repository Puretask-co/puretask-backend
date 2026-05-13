# Database Migration Policy

The project has 96 SQL files in `DB/migrations/`. This document is the policy for naming, writing, running, and recovering from migrations.

## Naming

- Format: `NNN_<short_snake_case_description>.sql` where `NNN` is a zero-padded incrementing number.
- Examples:
  - `042_add_cleaner_certifications.sql`
  - `043_index_jobs_status.sql`
- The current numbering is messy (multiple `000_*` baselines plus an `_appendix_043_to_906.sql`). New migrations should pick the next free number above the highest existing one.
- If you create one, also update `MIGRATIONS_INDEX.md` (if present) so the next person can find it.

## Forward-only

This project uses **forward-only** migrations. Down-migrations are not maintained.

- To undo a migration, write a new forward migration that reverses the effect.
- Reason: simpler operations, fewer bugs, matches the auto-deploy model on Railway.

## What's safe in a migration

- `CREATE TABLE` (new tables don't break existing code).
- `CREATE INDEX CONCURRENTLY` (won't lock the table; use this for any non-trivial table).
- `ALTER TABLE ADD COLUMN <name> <type>` when nullable or has a default.
- `INSERT` for seed/lookup data, with `ON CONFLICT DO NOTHING` for idempotency.
- Backfills in **batched** `UPDATE` (e.g., 1000 rows per batch with a `WHERE id BETWEEN ...`).

## What's dangerous

- `ALTER TABLE ADD COLUMN NOT NULL` without a default — blocks writes while it rewrites the table on Postgres.
- `DROP COLUMN` — breaks code that still reads it. Deploy code that stops reading the column first, then drop in a later migration.
- `RENAME COLUMN` — same problem as drop; do it as `ADD new` → backfill → switch code → `DROP old`.
- Full-table `UPDATE` without a `WHERE` filter on a large table — locks the whole table.
- `LOCK TABLE` or `ALTER TABLE` without `CONCURRENTLY` on a hot path — every transaction that touches the table waits.
- Migrations that depend on application code that hasn't deployed yet.

## Required checks before merging a migration

- [ ] Tested locally against `TEST_DATABASE_URL` (a copy of production schema, ideally with sample data).
- [ ] Reviewed by another set of eyes (a person or a code-review pass with AI; never merge a migration cold).
- [ ] Estimated runtime on prod-size data is < 30 seconds, OR the migration is `CONCURRENTLY` / batched.
- [ ] Application code that depends on the schema change is either in the same PR or already deployed.
- [ ] The migration is **idempotent** where possible: `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `CREATE OR REPLACE`. Idempotent migrations recover safely from interrupted runs.

## How to run migrations

- **Locally:** `npm run db:migrate` runs `DB/migrations/000_COMPLETE_CONSOLIDATED_SCHEMA.sql` against the configured database. For a single migration: `node scripts/run-migration.js DB/migrations/<file>.sql`.
- **Production:** migrations run during Railway deploy via the build phase. Verify in the deploy log that each migration that should run actually ran.
- **Test DB:** `npm run db:setup:test` provisions a clean test schema for the CI integration tests.

## Consolidating old migrations

There are already several `000_*` consolidated baselines. New consolidations should be rare:

- Trigger: when the migration count crosses 100, or when local dev setup becomes painfully slow.
- Procedure: dump the current schema, replace all numbered migrations with one new baseline, and ensure every environment (test, staging, prod) is at the same point before the baseline replaces history.
- Last consolidation: see git log for `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` history.

## Recovery if a migration breaks prod

1. **Stop the bleeding.** If the migration is hung, find the session: `SELECT pid, state, query_start, LEFT(query, 100) FROM pg_stat_activity WHERE state <> 'idle';`. Cancel with `SELECT pg_cancel_backend(<pid>)`; only `pg_terminate_backend(<pid>)` if cancel fails.
2. **Decide: roll forward or back?** Application code-only rollbacks don't undo schema changes. If the migration partially completed, you must finish it forward or write a compensating migration. Rolling the *app* back to the previous version may break if the new code is still pointing to migrated tables — verify schema compatibility before promoting.
3. **Forward fix.** Write a new migration that brings the DB back to a consistent state. Test it locally on a snapshot before running in prod.
4. **Capture the timeline.** Even a brief postmortem in `docs/active/incidents/postmortems/` is enough — what we ran, what broke, what we changed.

## Things this project does NOT do

- Down migrations.
- Auto-rollback on migration failure.
- A `migrations` tracking table per ORM convention (we apply files manually via scripts; track which ran via the consolidated baselines).

If any of those become needed, that's a separate change that requires updating this policy first.
