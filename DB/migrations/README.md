# PureTask Database Migrations

**Section 5 policy:** One canonical way to create a fresh DB (consolidated schema); all other changes via forward-only migrations. No manual prod SQL — all schema changes go through migration files. See [docs/active/00-CRITICAL/PHASE_5_STATUS.md](../docs/active/00-CRITICAL/PHASE_5_STATUS.md).

## Quick Start (Fresh Database)

For a **fresh Neon database**, run these files in order:

```bash
# 1. Run the COMPLETE consolidated schema (creates all tables, functions, views)
#    Includes: core, V2–V4, migrations 026–056 (AI assistant, gamification, etc.), hardening 901–906
psql $DATABASE_URL -f DB/migrations/000_COMPLETE_CONSOLIDATED_SCHEMA.sql

# 2. (Optional) Run the test seed data
psql $DATABASE_URL -f DB/migrations/000_SEED_TEST_DATA.sql
```

That's it! Your database is ready. The consolidated schema includes migrations 001–056 and hardening 901–906.

---

## Migration Files

| File | Purpose |
|------|---------|
| `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` | **Complete schema** - migrations 001–056 + hardening 901–906 |
| `000_CONSOLIDATED_SCHEMA.sql` | Legacy schema (001–019 only) |
| `000_NEON_PATCH_test_db_align.sql` | **Schema alignment** - FKs, columns, enums for existing Neon DBs (test + production). Run via `npm run db:patch:production` for prod. |
| `000_SEED_TEST_DATA.sql` | Test data for development |
| `001_init.sql` → `025_...` | Historical incremental migrations (for reference) |

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

