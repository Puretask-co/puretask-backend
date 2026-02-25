# PureTask Database Migrations

**Section 5 policy:** One canonical way to create a fresh DB (consolidated schema); all other changes via forward-only migrations. No manual prod SQL — all schema changes go through migration files. See [docs/active/00-CRITICAL/PHASE_5_STATUS.md](../docs/active/00-CRITICAL/PHASE_5_STATUS.md).

## Quick Start (Fresh Database)

**Option A — Single file (recommended):**

```bash
# Run the generated master (FIX + COMPLETE + views patch + 019 + 057–061)
# Regenerate with: npm run db:generate:master-migration
psql $DATABASE_URL -f DB/migrations/000_MASTER_MIGRATION.sql

# (Optional) Test seed data
psql $DATABASE_URL -f DB/migrations/000_SEED_TEST_DATA.sql
```

**Option B — Run files in order:**

```bash
psql $DATABASE_URL -f DB/migrations/000_COMPLETE_CONSOLIDATED_SCHEMA.sql
psql $DATABASE_URL -f DB/migrations/000_COMPLETE_VIEWS_PATCH.sql
psql $DATABASE_URL -f DB/migrations/019_payout_reconciliation_flags.sql
psql $DATABASE_URL -f DB/migrations/057_pt_safety_reports.sql
psql $DATABASE_URL -f DB/migrations/058_gamification_frontend_spec_tables.sql
psql $DATABASE_URL -f DB/migrations/059_add_invoice_status_and_invoices.sql
psql $DATABASE_URL -f DB/migrations/060_add_reviews_ai_worker_stripe_tables.sql
psql $DATABASE_URL -f DB/migrations/061_add_cleaner_id_payout_misc_tables.sql
# (Optional) 000_SEED_TEST_DATA.sql
```

See **docs/active/MASTER_MIGRATIONS.md** for full canonical order.

---

## Migration Files

| File | Purpose |
|------|---------|
| `000_MASTER_MIGRATION.sql` | **Generated** single file for fresh DB (run `npm run db:generate:master-migration` to regenerate) |
| `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` | Full schema 001–056 + hardening 901–906 (part of master) |
| `000_COMPLETE_VIEWS_PATCH.sql` | Views + one table missing from COMPLETE (part of master) |
| `019_payout_reconciliation_flags.sql` … `061_*.sql` | Forward-only migrations after COMPLETE (part of master) |
| `000_NEON_PATCH_test_db_align.sql` | Schema alignment for existing Neon DBs; run via `npm run db:patch:production` for prod |
| `000_SEED_TEST_DATA.sql` | Test data for development |
| `001_init.sql` → `061_*.sql` | Incremental migrations (reference; use COMPLETE + patch + 019 + 057–061 or master) |
| `archive/` | **Copies** of legacy/reference files (same files also in root); do not run for new DBs |
| `bundle_reference/` | Gamification bundle SQL (reference only; applied via 043–056 in COMPLETE) |

---

## For Existing Databases

If you already have migrations 001-019 applied, you DON'T need `000_CONSOLIDATED_SCHEMA.sql`.

The numbered migrations (001-019) were designed to be applied incrementally:

```
001_init.sql              - Core tables (users, jobs, credits, payouts)
002_supplementary.sql     - Credit purchases, notification preferences
003_credit_views.sql      - Credit balance views and functions
004_connect_payouts.sql   - Stripe Connect payout views
005_backups.sql           - Backup snapshots table
006_job_photos.sql        - Job photos table
007_payment_purposes.sql  - Payment intent enhancements
008_client_stripe_customer.sql - Stripe customer ID on profiles
009_stripe_column_alias.sql - Stripe account ID normalization
010_webhook_retry_queue.sql - Webhook failure retry
011_cleaner_availability.sql - Availability scheduling
012_job_offers.sql        - Job offer broadcast system
013_credit_economy_controls.sql - Fraud detection, audit logs
014_payout_improvements.sql - Payout retry, support tickets
015_referrals_and_boosts.sql - Referral system, premium boosts
016_v2_core.sql           - Properties, teams, subscriptions
017_policy_compliance.sql - Grace cancellations, photo compliance
018_core_systems_v2.sql   - Reliability/risk/matching engines
019_comprehensive_schema_additions.sql - Final schema additions
```

---

## Common Issues

### "relation does not exist"

If you get errors about tables not existing:
1. Make sure you're running migrations in numerical order
2. Or just use `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` on a fresh database

### Type mismatches

- `users.id` is **TEXT** (canonical). All foreign keys to users must use TEXT.
- Most other tables use `UUID` for primary keys. Ensure foreign keys reference the correct type.

---

## Resetting the Database (Nuclear Option)

To completely reset your Neon database:

```sql
-- Connect to your database and run:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Then run `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` again.

---

## Schema Overview

### Core Tables
- `users` - All user accounts (clients, cleaners, admins)
- `client_profiles` - Client-specific data
- `cleaner_profiles` - Cleaner-specific data (tiers, ratings, availability)
- `jobs` - Cleaning jobs
- `job_events` - Job lifecycle audit log

### Credit System
- `credit_ledger` - Source of truth for balances
- `credit_accounts` - Cached balances
- `credit_transactions` - Detailed transaction log

### Payment System
- `payment_intents` - Stripe payment tracking
- `payouts` - Cleaner payout records
- `stripe_customers` - Client Stripe customers
- `stripe_connect_accounts` - Cleaner Stripe Connect

### Reliability System
- `cleaner_metrics` - Aggregated cleaner stats
- `cleaner_events` - Reliability score events
- `cleaner_weekly_streaks` - Streak tracking
- `reliability_snapshots` - Historical scores

### Risk System
- `client_risk_scores` - Client risk scores
- `client_risk_events` - Risk events

### Scheduling System
- `reschedule_events` - Reschedule requests
- `cancellation_events` - Cancellation records
- `grace_cancellations` - Grace period usage

### Matching System
- `match_recommendations` - Match history
- `cleaner_flex_profiles` - Flexibility tracking
- `client_flex_profiles` - Client flexibility

### Availability System
- `cleaner_availability` - Weekly schedule
- `cleaner_time_off` - Time off periods
- `availability_blocks` - Alternative availability system
- `blackout_periods` - Unavailable periods

