# Phase 6 — Workers, Crons & Background Jobs — Status

**Purpose:** Track Phase 6 (Section 6) progress.  
**Runbook:** [SECTION_06_WORKERS.md](../sections/SECTION_06_WORKERS.md).

---

## Current state

| Item | Status | Notes |
|------|--------|------|
| **Job taxonomy** | ✅ | Documented in runbook § 6.1: cron, event, retry, maintenance. |
| **Durable jobs table** | ✅ | `hardening/906_durable_jobs.sql`: job_type, idempotency_key, status, attempt_count, locked_at, payload_json, unique(job_type, idempotency_key). |
| **Job idempotency** | ✅ | UNIQUE (job_type, idempotency_key). |
| **Locking / crash recovery** | ✅ | durableJobService.claim (FOR UPDATE SKIP LOCKED), releaseStaleLocks; durableJobWorker runs cycle. |
| **Retry/backoff** | ✅ | durableJobService.fail() sets retrying + run_at backoff or dead after max_attempts. |
| **Crons enqueue only** | ⏳ | durable_jobs + worker in place; existing crons still run legacy scripts; migrate to enqueue over time. |
| **Payout/dispute jobs** | ✅ | Payout idempotency via Phase 4 (Stripe idempotencyKey, payout_items 903). |
| **Observability** | Partial | worker_runs (904); job-level logs/metrics in worker implementation. |

---

## Links

- [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 6
- [SECTION_06_WORKERS.md](../sections/SECTION_06_WORKERS.md)

**Last updated:** 2026-01-31
