# PURETASK_DATA_MODEL

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of This Document

Defines the canonical data model for PureTask: core entities and relationships, ownership by engine, event vs state tables, ledger accounting, migration philosophy, schema support for V1-V5, and how automation interacts safely. Designed to be scalable, auditable, migration-safe, automation-friendly, and resistant to corruption.

---

## 2. Data Model Philosophy

- Job-centric worldview: jobs are the atomic unit; most entities reference a job or support job creation, execution, or resolution.  
- State + events: state tables for current truth; event tables for history/audit. State answers "what is true now"; events answer "how did we get here."  
- Ledger, not balances: economic value tracked via append-only ledger entries; balances are derived.  
- Ownership by engine: each table has a single owning engine; others read or react, but only owner mutates.

---

## 3. Core Identity and Access Entities

- users (Admin/Auth): id, role (client, cleaner, admin), status, created_at.  
- user_profiles (Admin/Ops): name, contact info, verification status.  
- auth_sessions / api_keys (Auth): API and admin/worker access.

---

## 4. Booking Engine Entities

- jobs (Booking): current job state; fields include id, client_id, cleaner_id nullable, state, start_time, end_time, timezone optional, pricing_snapshot_id, created_at.  
- job_events (Booking): immutable lifecycle history; job_id, event_type, previous_state, new_state, actor_type (system/client/cleaner/admin), created_at.  
- job_assignments (Matching): assignment attempts and outcomes.  
- job_verifications (Booking): check-in/out and evidence.

---

## 5. Matching Engine Entities

- cleaner_availability: recurring availability.  
- cleaner_time_off: one-off overrides.  
- cleaner_service_areas: geographic eligibility.  
- cleaner_preferences: capabilities and preferences.

---

## 6. Pricing Engine Entities

- pricing_snapshots: immutable pricing captured at booking (base_price, add_ons, discounts, platform_fee, credits_required). Never mutated.

---

## 7. Credit and Payment Engine Entities

- wallets: logical wallets (client, cleaner, platform).  
- ledger_entries: append-only credit movements (wallet_id, amount, reason_code, reference_type, reference_id, created_at). Immutable.  
- stripe_events: deduplicated Stripe webhook events.

---

## 8. Payout Engine Entities

- payouts: payout attempt.  
- payout_items: ledger items included.  
- payout_failures: diagnostics and retries.

---

## 9. Reliability and Tier Engine Entities

- reliability_scores: current reliability state.  
- reliability_events: event-driven score changes.  
- tier_history: immutable tier transitions.

---

## 10. Dispute Engine Entities

- disputes: dispute state machine.  
- dispute_events: lifecycle history.  
- dispute_evidence: immutable evidence records.

---

## 11. Messaging Engine Entities

- threads: conversation containers.  
- messages: user/system/admin messages.  
- notifications: notification intents.  
- notification_deliveries: channel-specific delivery logs.

---

## 12. Subscription Engine Entities

- subscriptions: configuration.  
- subscription_jobs: links subscriptions to generated jobs.  
- subscription_events: lifecycle history.

---

## 13. Risk and Fraud Engine Entities

- risk_scores: composite risk score.  
- risk_flags: discrete indicators.  
- risk_actions: applied restrictions.

---

## 14. Analytics Engine Entities

- kpi_daily_snapshots: daily aggregates.  
- kpi_weekly_summaries: derived rollups.

---

## 15. Admin and Ops Entities

- admin_actions: all admin interventions.  
- audit_logs: immutable audit trail.  
- admin_notes: internal annotations.

---

## 16. Worker and Automation Support Tables

- worker_runs: worker execution status.  
- failed_jobs: unrecoverable failures for ops review.

---

## 17. Migration Philosophy

- Canonical migration set: one consolidated baseline, small additive migrations, no divergent histories.  
- Backward-compatible changes: allow new tables, new nullable columns, new indexes; avoid breaking type changes without backfill and avoid silent data mutation.  
- Event-safe refactors: state can change; events are never rewritten.

---

## 18. V1-V5 Schema Evolution

- V1: Core jobs, credits, payouts, basic reliability, basic admin.  
- V2: Disputes, deeper matching, tiering, better analytics.  
- V3: Subscriptions, incentives, advanced payouts.  
- V4: Risk automation, advanced fraud controls.  
- V5: Platform generalization, multi-market support, vertical expansion.  

---

## 19. Canonical Rules

- One owner per table.  
- Events are immutable.  
- Ledgers are append-only.  
- Jobs are the system spine.  
- Automation enforces consistency.  
- Migrations are deliberate.  

---

## 20. Final Note

If code, migrations, or workflows diverge from this model, the model wins. Any deviation must be intentional, documented, and reviewed.

---

End of document.

