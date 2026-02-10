## What

<!-- Short description of what this PR changes -->

## Why

<!-- Why this change; link to ticket or runbook if applicable -->

## Test

- [ ] Unit / integration tests added or updated
- [ ] Manual smoke check (if applicable)

## Rollback notes

<!-- If this is risky (DB migration, feature flag, config): how to roll back -->

## Migration notes

<!-- If this includes DB migrations: run order, backfill, or "none" -->

### If this PR adds or changes DB migrations

- [ ] All FKs to `users(id)` use `TEXT` (canonical schema)
- [ ] No `BEGIN;` / `COMMIT;` in migration files
- [ ] Migrations are idempotent (`IF NOT EXISTS`, `ON CONFLICT`)
- [ ] Dependencies documented (e.g. 055 requires 043, 048, 050)
- [ ] `npm run db:validate:migrations` passes

## Checklist

- [ ] Lint and typecheck pass
- [ ] No secrets or .env in diff
- [ ] Docs/runbook updated if behavior or config changed
