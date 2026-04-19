# Master migrations – canonical order and usage

**Purpose:** Single source of truth for "what to run on a fresh DB" and "what the master file contains."

There is effectively **one** deterministic setup path for CI/local test DBs: `npm run db:setup:test` with `STRICT_MIGRATION_PATH=1` (applies COMPLETE + 041–056 + NEON patches + 059–061, without fallback/skip behavior). For fresh SQL-only bootstrap, use **000_MASTER_MIGRATION.sql** (FIX + COMPLETE + views patch + 019 + 057–061) and regenerate with `npm run db:generate:master-migration`.

## Canonical migration order

For a **brand-new database**, use either:

- **Option A:** One file: `DB/migrations/000_MASTER_MIGRATION.sql`  
  - Regenerate with: `npm run db:generate:master-migration`

- **Option B:** Run these files in order:
  1. `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` (001–056 + hardening 901–906)
  2. `000_COMPLETE_VIEWS_PATCH.sql` (views + `cleaner_tooltip_interactions` missing from COMPLETE)
  3. `019_payout_reconciliation_flags.sql` (table referenced by COMPLETE FK)
  4. (optional) `000_SEED_TEST_DATA.sql` — test data. Skip in production.
  5. `057_pt_safety_reports.sql`
  6. `058_gamification_frontend_spec_tables.sql`
  7. `059_add_invoice_status_and_invoices.sql`
  8. `060_add_reviews_ai_worker_stripe_tables.sql`
  9. `061_add_cleaner_id_payout_misc_tables.sql`

Skip `000_FIX_credit_ledger_delta_credits.sql` on a brand-new DB (it's for fixing existing DBs that already had the old credit_ledger shape).

## What the master file contains

`000_MASTER_MIGRATION.sql` is **generated** by `scripts/generate-master-migration.js`. It inlines, in order:

| # | Source file |
|---|-------------|
| 1 | 000_FIX_credit_ledger_delta_credits.sql |
| 2 | 000_COMPLETE_CONSOLIDATED_SCHEMA.sql |
| 3 | 000_COMPLETE_VIEWS_PATCH.sql |
| 4 | 019_payout_reconciliation_flags.sql |
| 5 | 057_pt_safety_reports.sql |
| 6 | 058_gamification_frontend_spec_tables.sql |
| 7 | 059_add_invoice_status_and_invoices.sql |
| 8 | 060_add_reviews_ai_worker_stripe_tables.sql |
| 9 | 061_add_cleaner_id_payout_misc_tables.sql |

## Fresh DB quick reference

| Step | Command / file |
|------|-----------------|
| Regenerate master | `npm run db:generate:master-migration` |
| Apply to fresh DB | `psql $DATABASE_URL -f DB/migrations/000_MASTER_MIGRATION.sql` |
| Optional test data | `psql $DATABASE_URL -f DB/migrations/000_SEED_TEST_DATA.sql` |

## Deterministic CI/local test path (P0.2)

Use this when preparing a backend test database for CI-equivalent runs:

1. `npm run db:validate:migrations`
2. `STRICT_MIGRATION_PATH=1 DATABASE_URL=... npm run db:setup:test`

`STRICT_MIGRATION_PATH=1` enforces determinism by failing fast on schema drift instead of silently falling back to legacy consolidated schema or skipping unify migrations.

## Existing databases (production / test)

- **Production:** To align with test and get invoices, reviews, worker_runs, etc., run the "unify" migrations (views patch, 019, 059, 060, 061). Use `npm run db:migrate:unify-prod` (requires `UNIFY_PROD=1` and `PROD_URL` or `DATABASE_URL`). See [PROD_TEST_SCHEMA_REFERENCE.md](./PROD_TEST_SCHEMA_REFERENCE.md).
- **Test:** `npm run db:migrate:unify-test` runs 059–061 on test DB.

For existing DBs that already have COMPLETE applied:
1. Run **000_COMPLETE_CONSOLIDATED_SCHEMA.sql** (additive; uses `IF NOT EXISTS`).
2. Run **000_COMPLETE_VIEWS_PATCH.sql**, then **019_payout_reconciliation_flags.sql**, then **057**, **058**, **059**, **060**, **061** in that order.

See also: [DB/migrations/README.md](../DB/migrations/README.md).
