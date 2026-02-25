# PureTask Database Schema Guide

## 📁 Consolidated Schema Files

### `000_CONSOLIDATED_SCHEMA.sql` (Original)
**Coverage:** Migrations 001-019  
**Last Updated:** 2024  
**Use Case:** If you want to run the base system without the latest features

**Includes:**
- Core tables (users, jobs, payments, credits)
- Cleaner reliability system
- Client risk management  
- Subscriptions
- Calendar sync
- Teams & goals
- AI integration
- Basic policy compliance

---

### `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` ✨ (NEW - Recommended)
**Coverage:** Migrations 001-025 + Hardening 901-905  
**Last Updated:** January 2026  
**Use Case:** **Use this for all new deployments** - includes everything

**Includes everything from the original PLUS:**

#### New Features (Migrations 020-025):
- **020:** Stripe object processed tracking (idempotency)
- **021:** Payout pause feature
- **022:** Enhanced dispute routing, payout audit trails
- **023:** Cleaner portal with invoicing system
- **024:** V3 tier-aware pricing snapshots
- **025:** Complete authentication system:
  - Email verification
  - Password reset flows
  - Two-factor authentication (TOTP + SMS)
  - Session management & revocation
  - OAuth support (Google, Facebook, Apple)
  - Security audit logging
  - Login attempt tracking & account lockout
  - Trusted devices
  - Email change verification

#### Production Hardening (901-905):
- **901:** Stripe webhook event deduplication
- **902:** Credit ledger idempotency constraints
- **903:** Payout items uniqueness enforcement
- **904:** Worker execution tracking
- **905:** User ID foreign key consistency

---

## 🚀 Quick Start

### For New Deployments (Recommended):

```bash
# Use the COMPLETE schema
psql your_database < 000_COMPLETE_CONSOLIDATED_SCHEMA.sql
```

This gives you the full production-ready system with all features and hardening.

---

### For Existing Databases:

**Don't use the consolidated schemas!** They're only for fresh databases.

Instead, run the individual migration files you're missing:

```bash
# Check which migrations you've run
SELECT * FROM schema_migrations;  # or your migration tracking table

# Run any missing migrations in order
psql your_database < 020_stripe_object_processed.sql
psql your_database < 021_pause_payouts.sql
# ... etc
```

---

## 📊 What's in Each Migration

### Base System (001-019)
Already documented in existing migration files.

### V3+ Features (020-025)

| # | Name | Description |
|---|------|-------------|
| 020 | Stripe Object Processed | Prevents duplicate processing of Stripe events |
| 021 | Pause Payouts | Ability to pause payouts per cleaner |
| 022 | Schema Enhancements | Dispute routing, payout audit, reconciliation history |
| 023 | Cleaner Portal Invoicing | Full invoicing system for cleaners |
| 024 | V3 Pricing Snapshot | Lock pricing at booking time |
| 025 | Auth Enhancements | Enterprise-grade authentication system |

### Hardening (901-905)

| # | Name | Purpose |
|---|------|---------|
| 901 | Stripe Events | Webhook deduplication |
| 902 | Ledger Idempotency | Prevent double-crediting |
| 903 | Payout Uniqueness | Prevent duplicate payouts |
| 904 | Worker Runs | Track background jobs |
| 905 | FK Consistency | Document user ID type constraints |

---

## ⚠️ Important Notes

### User ID Type
**Canonical Decision:** `users.id` is `TEXT`, not `UUID`

All foreign keys referencing `users.id` MUST be `TEXT`. The complete consolidated schema enforces this correctly.

### Fresh Database Only
Both consolidated schemas are **ONLY** for fresh database setups. They will fail or cause data corruption on existing databases.

### Migration Tracking
After running a consolidated schema, you may want to insert records into your migration tracking table:

```sql
-- Example (adjust to your migration tracking system)
INSERT INTO schema_migrations (version) VALUES
  ('001'), ('002'), ('003'), ... ('025'),
  ('901'), ('902'), ('903'), ('904'), ('905');
```

---

## 🔍 File Sizes

- `000_CONSOLIDATED_SCHEMA.sql`: ~1,714 lines (001-019)
- `000_COMPLETE_CONSOLIDATED_SCHEMA.sql`: ~2,362 lines (001-025 + 901-905)

---

## 🎯 Which One Should I Use?

| Scenario | Use |
|----------|-----|
| New production deployment | `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` |
| New development environment | `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` |
| Testing/staging | `000_COMPLETE_CONSOLIDATED_SCHEMA.sql` |
| Existing database | Individual migration files only |
| Learning/exploration | `000_CONSOLIDATED_SCHEMA.sql` (simpler) |

**Recommendation:** Always use the COMPLETE version for any real deployment.

---

## 📝 Changelog

### January 2026
- Created `000_COMPLETE_CONSOLIDATED_SCHEMA.sql`
- Added migrations 020-025
- Added hardening migrations 901-905
- Fixed UUID/TEXT consistency in auth tables

### 2024
- Created original `000_CONSOLIDATED_SCHEMA.sql`
- Consolidated migrations 001-019

---

## 🆘 Support

If you're unsure which schema to use or encounter issues:
1. Check your current migration status
2. Review this README
3. Consult the team lead or database administrator

**Never run a consolidated schema on a database with existing data!**

