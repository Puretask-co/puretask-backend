# DB Snapshots

This folder holds **local schema dumps** for reference and debugging. Files matching `*.sql` here are gitignored — they live on your machine only, never in the repo.

## What belongs here

- pg_dump output for the production schema (no data rows)
- pg_dump output for the test/staging schema
- Manual snapshots taken before a risky migration

## What does NOT belong here

- Migration files — those live in `DB/migrations/` and ARE tracked.
- Anything containing real customer data, even anonymized — handle that out-of-repo (encrypted bucket, password-managed vault). Schema-only dumps are fine.

## Naming convention

`<source>-<kind>-YYYY-MM.sql`. Examples:

- `prod-schema-2026-05.sql`
- `test-schema-2026-05.sql`
- `prod-pre-migration-NNN-2026-05.sql`

## How to take a fresh dump

```powershell
# Schema only, no data:
pg_dump --schema-only --no-owner --no-privileges "$env:DATABASE_URL" > DB/snapshots/prod-schema-$(Get-Date -Format yyyy-MM).sql
```

If you need to commit a schema reference into the repo for some reason (e.g. CI seeding), put it in `DB/migrations/` as a properly numbered migration instead — never lift a gitignored snapshot.

## Why these are not tracked

Schema dumps churn constantly and they contain pg_dump access tokens (`\restrict <token>` headers) that shouldn't end up in git history. The canonical schema is the sequence of migrations in `DB/migrations/`; snapshots are just convenience for grepping the current shape.
