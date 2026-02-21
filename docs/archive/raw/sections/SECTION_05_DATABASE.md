# Section 5 — Database & Migration Hygiene (Full Runbook)

**Objective:** Database layer is consistent (one correct schema source of truth), safe to migrate (repeatable, reversible), integrity-protected, performance-ready, auditable.

**Exit condition:** A new environment can be provisioned from zero with one command; migrations apply cleanly; data corruption is structurally difficult.

---

## 5.1 Current Risks

- **Migration sprawl:** Many incremental migrations + “consolidated schema” + fix_* patches → fresh DB diverges from production.  
- **Integrity:** Escrow mismatches, orphaned jobs, payouts not matching ledger, disputes without evidence linkage.  
- **Performance:** Huge tables, expensive admin queries, lock contention during payouts.

---

## 5.2 Canonical Schema Strategy

**Option A (recommended):** Consolidated baseline + forward migrations  
- `000_base.sql` (or equivalent) is the **only** way to create a fresh DB.  
- All future changes via migrations 001+.  
- Deterministic fresh boot; faster onboarding and CI.

**Option B:** Pure incremental migrations only (no consolidated schema; DB built by applying all migrations from day one).

**Deliverable:** Written policy — “How we build fresh DB” + “How we apply migrations in prod.”

---

## 5.3 Migration Tooling

- **One** migration system: node-postgres runner, Prisma, Knex, or Flyway-style SQL.  
- Naming: `NNN_description.sql` (strict numeric order).  
- No “fix_000_*” — fixes get the next number.  
- Migrations are append-only history; if a past migration is wrong, add a new one; do not rewrite history.

---

## 5.4 Migration Safety Types

| Type | Examples |
|------|----------|
| **safe** | Additive: new column nullable, new table |
| **risky** | Drop column/table, rewrite data, enum changes |
| **requires downtime** | Rare |

Risk migrations must include rollback strategy or explicit irreversible note.

---

## 5.5 Foreign Keys & Cascade

- Hard delete **almost never** for payments, ledger, events, disputes; use deleted_at soft deletes.  
- Jobs → Users (client, cleaner) must be real users.  
- Disputes → Job must exist; Evidence → Dispute must exist.  
- Use ON DELETE RESTRICT for critical tables; ON DELETE CASCADE only for truly dependent records (e.g. join tables).

---

## 5.6 Check Constraints & Unique Constraints

- Amounts >= 0 where appropriate; currency ISO code; status fields match allowed transitions (or enforced at app layer).  
- **Unique:** stripe event_id, payment_intent_id, idempotency keys, delivery provider message_id (scoped), user email (case-insensitive).

---

## 5.7 Indexing Strategy

- **Hot paths:** job feed/search/filter, booking creation, job completion, disputes listing, ledger/payout calculations, admin dashboards.  
- Every foreign key has an index; every frequent filter column has supporting index.  
- Composite indexes for common filters: (status, created_at), (user_id, created_at), (job_id, type).  
- Avoid index bloat; prefer a few high-signal composite indexes + monitoring.

**Deliverable:** Index map + justification.

---

## 5.8 Enum & Status Hygiene

- Every enum change is a migration; additions easy; removals/renames risky.  
- Prefer lookup tables for high-change lists (service types, dispute reasons, notification templates).

---

## 5.9 Transactions & Concurrency

- **Mandatory transactions:** job completion, escrow release, payout creation, dispute decisions, refunds.  
- **Concurrency:** Row locks on job row, ledger operation unique constraints, or SELECT … FOR UPDATE.  
- Two requests cannot “complete” the same job twice.

---

## 5.10 Auditing & History

- webhook_events (Section 4), ledger (Section 4).  
- Admin actions table: who, what, when, why, target entity, before/after (where safe).  
- Disputes: decisions history, evidence list, notes, timestamps.

---

## 5.11 Seeding & Local Dev

- Seeds safe to run multiple times; no secrets.  
- Create test admin, test cleaner/client, sample jobs.  
- Local vs prod parity: same schema, constraints, migrations.

---

## 5.12 Backup, Restore, Disaster Readiness

- Neon branching + point-in-time restore (if enabled); scheduled snapshots.  
- **Deliverable:** [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) — restore procedure (how to restore to staging; validate integrity; cut over).

---

## 5.13 Validation & CI Gate

- CI: spin up fresh Postgres → apply baseline + migrations → run smoke queries → fail if anything breaks.  
- Optional: explain analyze for hottest queries; ensure no missing indexes.

---

## 5.14 Done Checklist

- [ ] Canonical schema strategy chosen and documented  
- [ ] One migration system enforced  
- [ ] Migrations sequential and cleanly applied from zero  
- [ ] Foreign keys and delete strategies finalized  
- [ ] Unique constraints for all critical IDs  
- [ ] Index map created and implemented  
- [ ] Transaction boundaries documented and enforced  
- [ ] Audit tables for money and admin decisions  
- [ ] Seeds repeatable and safe  
- [ ] Backup/restore procedure documented  
- [ ] CI verifies fresh DB builds cleanly  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 5 checklist.
