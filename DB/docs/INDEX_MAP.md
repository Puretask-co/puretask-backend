# PureTask — Index Map & Justification

**Purpose:** Document hot query paths and indexes for Section 5 (Database & Migration Hygiene).  
**Source:** [SECTION_05_DATABASE.md](../../docs/active/sections/SECTION_05_DATABASE.md) § 5.7.

---

## Hot paths

| Path | Tables | Justification |
|------|--------|---------------|
| Job feed / search / filter | jobs, users | Cleaner search, available jobs, client/cleaner dashboards |
| Booking creation | jobs, credit_ledger, payment_intents | Create job, deduct credits, payment |
| Job completion | jobs, job_events, credit_ledger | Complete job, release escrow, ledger |
| Disputes listing | disputes, jobs, users | Admin/support dispute queue |
| Ledger / payout calculations | credit_ledger, payouts, payout_items | Balances, payout runs |
| Admin dashboards | jobs, users, payments, payouts | Analytics, finance, risk |
| Auth / session | users, sessions (if any) | Login, token validation |
| Messages / notifications | messages, notifications | Inbox, unread counts |
| Webhook idempotency | webhook_events, stripe_events_processed | Dedupe by event_id |

---

## Indexes (existing)

Primary indexes are defined in:

- **030_performance_indexes.sql** — users (email, role, rating, cleaner search, last_active, stripe_connect); jobs (client_id, cleaner_id, status, scheduled_start_at, client+status, cleaner+status, available, created_at); messages (sender, receiver, conversation, unread, created_at); payments (user_id, job_id, status, stripe_intent, user+status); notifications; reviews; sessions; analytics.
- **019_comprehensive_schema_additions.sql** (and consolidated) — admin_audit_log (admin_user_id, entity_type+entity_id, action, created_at).
- **013_credit_economy_controls.sql** — audit_logs (actor_id, action, resource_type+resource_id, created_at).
- **042_webhook_events.sql** — unique (provider, event_id); index on processing_status, created_at as needed.
- **hardening/901–905** — stripe_events_processed, credit_ledger idempotency, payout_items uniqueness, worker_runs, users FK.

---

## Composite index patterns

- **(status, created_at)** — list by status with recency.
- **(user_id, created_at)** or **(client_id, status, scheduled_start_at)** — user-scoped lists.
- **(job_id, type)** — job-scoped events/items.
- **Unique (provider, event_id)** — webhook idempotency (042, 901).

---

## Maintenance

- Monitor usage: `pg_stat_user_indexes` (idx_scan).
- Avoid redundant indexes; prefer composite over multiple single-column where queries match.
- New indexes: add via migration `NNN_description.sql` and document here.

**Last updated:** 2026-01-31
