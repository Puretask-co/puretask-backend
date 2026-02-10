# Section 6 — Workers, Crons & Background Jobs (Full Runbook)

**Objective:** Every time-based, async, or failure-prone operation runs when it should, runs only once (or idempotently), recovers safely from crashes, leaves an audit trail, never corrupts money or trust.

**Exit condition:** If the API goes down, a worker crashes, or a job runs twice, the system still converges to the correct state.

---

## 6.1 Job Taxonomy

| Category | Examples |
|----------|----------|
| **A) Time-based crons** | Auto-cancel stale bookings, weekly payouts, dispute escalation deadlines, cleanup/archival, reconciliation |
| **B) Event-driven** | Process Stripe webhook event, notify cleaner/client, trigger n8n workflows, post-payment side effects |
| **C) Retry** | Failed notifications, temporary provider outages, partial downstream failures |
| **D) Maintenance** | Data integrity checks, orphan cleanup, index maintenance, analytics rollups |

**Rule:** Every job belongs to exactly one category and follows that category’s rules.

---

## 6.2 Canonical Job Table (jobs_queue or equivalent)

| Column | Purpose |
|--------|---------|
| id | uuid |
| job_type | string |
| payload | jsonb |
| status | pending \| running \| completed \| failed \| retrying \| dead |
| attempt_count | int |
| max_attempts | int |
| run_at | timestamp |
| locked_at | timestamp |
| locked_by | string (worker id) |
| last_error | text |
| created_at, updated_at | timestamps |

**Rule:** No background work happens without a durable job record.

---

## 6.3 Idempotency

- **Job idempotency keys:** Every job has a deterministic key (e.g. auto_cancel_job:{jobId}, weekly_payout:{week}:{cleanerId}).  
- Job creation enforces uniqueness on (job_type, idempotency_key); if job already exists → no-op.  
- **Work-level idempotency:** DB constraints, ledger uniqueness, state machine rules must prevent double effects; workers assume “I might run twice.”

---

## 6.4 Locking & Concurrency

- **Claiming jobs:** SELECT … FOR UPDATE SKIP LOCKED (or advisory locks); only one worker moves a job from pending → running.  
- **Expired locks (crash recovery):** If locked_at older than threshold and status still running → job eligible for reclaim; increment attempt_count; work resumes safely.

---

## 6.5 Retry Strategy

| Failure Type | Retry? | Notes |
|--------------|--------|-------|
| Network timeout | yes | backoff |
| Provider 5xx | yes | backoff |
| Validation error | no | dead |
| Permission error | no | alert |
| Logic invariant violation | no | alert |

- **Backoff:** Exponential + jitter; e.g. attempt 1 → 30s, 2 → 2m, 3 → 10m, 4 → 1h, then dead-letter.  
- **Dead-letter:** Jobs that exceed retries move to dead; alert ops; visible in admin; manually retryable where safe.

---

## 6.6 Cron Discipline

- **Source of truth:** One place where cron schedules live (code-based scheduler, Railway cron config, or DB-driven).  
- **Rule:** Cron **only** creates jobs (with idempotency keys); workers perform the work. Avoids double execution, partial failures, overlapping runs.

---

## 6.7 Critical Job Types (PureTask)

| Job Type | Trigger | Checks | Effect |
|----------|---------|--------|--------|
| **Auto-cancel stale bookings** | Booking not accepted in X time | Still pending, not cancelled | Update status; notify; log event |
| **Weekly payouts** | Weekly cron | Per cleaner | Lock payout row; calculate eligible balance; create ledger entries; trigger Stripe payout; log |
| **Dispute escalation** | Dispute unresolved N days | Still open | Escalate state; notify admin |
| **Notification retries** | Failed delivery_log entries | — | Retry; respect rate limits; mark permanent failures |

**Rule:** Payout job is atomic; partial payouts impossible.

---

## 6.8 Observability

- **Logging:** job id, job type, correlation id, attempt number, duration, outcome.  
- **Metrics:** jobs processed per type; failure rate per type; retry counts; dead-letter counts; job latency.  
- **Alerts:** Payout job failures; backlog size growth; dead-letter spikes; job execution lag.

---

## 6.9 Admin Re-Run & Safety

- Admins can requeue safe jobs; view payload and history; see why a job failed.  
- Any manual action is logged (who, when, why, target entity).

---

## 6.10 Failure Drills

- **Crash simulation:** Kill worker mid-job → confirm job resumes safely.  
- **Double-run:** Enqueue same job twice → confirm no duplicate effects.  
- **Provider outage:** Force Stripe/SendGrid failure → confirm retries and dead-letter behavior.

---

## 6.11 Done Checklist

- [ ] All background work classified  
- [ ] Durable job table exists  
- [ ] Idempotency enforced at job and business level  
- [ ] Safe locking and crash recovery implemented  
- [ ] Retry/backoff rules defined  
- [ ] Dead-letter handling exists  
- [ ] Crons enqueue jobs only  
- [ ] Critical PureTask jobs implemented safely  
- [ ] Observability and alerts defined  
- [ ] Admin tools for job inspection exist  
- [ ] Failure drills pass  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 6 checklist.
