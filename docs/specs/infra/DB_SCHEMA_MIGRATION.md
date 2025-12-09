# DB Schema & Migration Spec
(Infrastructure Spec)

## Scope
Defines how we manage database schema, migrations, and compatibility. Ensures financial and job data integrity is preserved through changes.

## Principles
- One canonical schema (consolidated) for fresh setups.
- Incremental migrations for existing environments.
- Backward-compatible changes where possible; avoid destructive alters without plan.
- All schema changes go through migrations; no ad-hoc manual DDL in production.

## Migration Process
- Fresh setup: run consolidated schema, then seed (dev/test).
- Existing DB: apply migrations in order; never skip.
- Preflight: schema diff/review; test migrations on staging.
- Rollback: only for non-destructive steps; for destructive changes, use forward fixes.

## Constraints & Defaults
- Use proper types: UUID PKs (consistent), DECIMAL for credits/amounts, timestamps with time zone.
- NOT NULL and FK constraints for critical relations (ledger, earnings, payouts, jobs, users, cleaners).
- Enums/lookup tables for status fields to prevent invalid states.
- Indexes on FK, frequently filtered columns (status, user_id, job_id, cleaner_id, event_id).

## Data Safety
- No dropping columns with live data without migration path.
- For refactors: add new columns, backfill, switch reads/writes, then deprecate old columns.
- Financial tables: never delete rows; use status/flags for “inactive/void.”

## Versioning & Documentation
- Each migration named and numbered.
- Keep a README in DB/migrations (already present) with run order and guidance.
- Record schema versions deployed to each environment.

