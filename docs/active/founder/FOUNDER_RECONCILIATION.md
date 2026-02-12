# Founder Reference: Reconciliation

**Candidate:** Reconciliation (Module #38)  
**Where it lives:** `reconciliationService`, payout vs earnings  
**Why document:** How we detect mismatches between payouts and earnings and what we do about it.

---

## The 8 main questions

### 1. What it is

**Technical:** Reconciliation in PureTask is the process of detecting and flagging mismatches between what we paid out to a cleaner (Stripe Connect transfer) and what we recorded as their earnings (from completed jobs). Implemented in `src/services/reconciliationService.ts` and used by the **payout reconciliation worker** (`src/workers/v2-operations/payoutReconciliation.ts`). **Flow:** (1) Worker runs on schedule; (2) for each payout (or batch), compute expected earnings (e.g. sum of job earnings for that period/cleaner) and compare to actual payout amount (from payouts table or Stripe); (3) if delta (difference) exceeds tolerance (e.g. 0 or a small threshold), upsertReconciliationFlag(payoutId, cleanerId, deltaCents, status 'flagged'); (4) Admin sees list via getPayoutReconciliationFlags() (GET /admin/payouts/reconciliation/flags); (5) Admin resolves: resolvePayoutReconciliationFlag(payoutId, status 'resolved'|'ignored', note, resolvedBy) — UPDATE flag, INSERT into payout_reconciliation_flag_history for audit. **Tables:** payout_reconciliation_flags (payout_id, cleaner_id, delta_cents, status, note, flagged_at, resolved_at, resolved_by); payout_reconciliation_flag_history (payout_id, status, note, actor_id). reconciliationService ensures tables exist (CREATE TABLE IF NOT EXISTS). Operational metrics (operationalMetricsService) include reconciliationFlagRate and reconciliation status (ok/warning/error) with unresolved count for alerts.

**Simple (like for a 10-year-old):** Reconciliation is “did we pay the right amount?” We compare what we think the cleaner earned (from finished jobs) to what we actually sent them (the payout). If the numbers don’t match we create a “flag” for an admin to look at. The admin can mark it “resolved” or “ignored” and add a note. We keep a history of what was done so we have an audit trail.

### 2. Where it is used

**Technical:** `src/services/reconciliationService.ts` — ensureTable (CREATE TABLE IF NOT EXISTS), upsertReconciliationFlag, getPayoutReconciliationFlags, resolvePayoutReconciliationFlag; `src/workers/v2-operations/payoutReconciliation.ts` — runs on schedule, computes expected vs actual, calls upsertReconciliationFlag for mismatches; `src/routes/admin.ts` — GET /admin/payouts/reconciliation/flags, POST /admin/payouts/reconciliation/:payoutId/resolve; operationalMetricsService and status/summary (reconciliation status, unresolved count); alerting (lib/alerting) may include “Payout reconciliation resolved.” Deprecated/disabled stuckJobDetection and autoPausePayouts referenced reconciliation for “payout vs earnings” and “pause payouts for flagged cleaners” (current flow may not pause). DB: payout_reconciliation_flags, payout_reconciliation_flag_history.

**Simple (like for a 10-year-old):** The code lives in reconciliationService and the payoutReconciliation worker. The worker runs on a schedule and creates flags when payout and earnings don’t match. Admins see the list and resolve or ignore and add a note. The status page and metrics show how many are open and whether things are ok or need attention. We might send an alert when something is resolved.

### 3. When we use it

**Technical:** When the payout reconciliation worker runs (scheduled, e.g. after payouts are processed); when an admin views open flags (GET flags); when an admin resolves or ignores a flag (POST resolve). Triggered by scheduler (worker) and by admin actions. Operational metrics and status/summary read flags on each request (or cache) to show reconciliation status and unresolved count.

**Simple (like for a 10-year-old):** We use it when the reconciliation job runs (after we’ve sent payouts) and when an admin looks at the list or marks a flag resolved or ignored. The status page and metrics use the flags to show “how are we doing?”

### 4. How it is used

**Technical:** **Worker:** Load payouts (e.g. last batch or period); for each payout get cleaner_id and amount_cents (actual); compute expected earnings (e.g. sum from job_earnings or credit_ledger for that cleaner in that period); delta_cents = actual - expected (or abs); if abs(delta_cents) > tolerance (e.g. 0), call upsertReconciliationFlag(payoutId, cleanerId, deltaCents). **upsertReconciliationFlag:** INSERT into payout_reconciliation_flags (payout_id, cleaner_id, delta_cents, status 'flagged') ON CONFLICT (payout_id) DO UPDATE set delta_cents, status 'flagged', flagged_at NOW(), clear resolved_at/resolved_by/note. **getPayoutReconciliationFlags:** SELECT where status = 'flagged'. **resolvePayoutReconciliationFlag:** UPDATE payout_reconciliation_flags SET status, note, resolved_at, resolved_by WHERE payout_id; INSERT into payout_reconciliation_flag_history. **Metrics:** Count payouts with flags, compute reconciliationFlagRate; status = error if unresolved > threshold, warning if > 0, else ok. **Alerts:** When admin resolves, may send “Payout reconciliation resolved” (Slack/email).

**Simple (like for a 10-year-old):** The worker looks at each payout and compares “what we sent” to “what we think they earned.” If they don’t match we add or update a flag. Admins see only “flagged” ones. When they resolve or ignore we update the flag and write a history row. We count how many payouts have flags and show “ok” or “warning” or “error” on the status page. We might notify when something is resolved.

### 5. How we use it (practical)

**Technical:** Ensure payout reconciliation worker is scheduled (scheduler.ts: workerName "payout-reconciliation"). Admin: GET /admin/payouts/reconciliation/flags, POST /admin/payouts/reconciliation/:payoutId/resolve with body { status: 'resolved'|'ignored', note?, resolvedBy }. Env: no required reconciliation-specific env; worker schedule in scheduler config. Status/summary and operational metrics include reconciliation; alerts may be configured for unresolved count or resolution.

**Simple (like for a 10-year-old):** We make sure the reconciliation job is on the schedule. Admins call “get flags” and “resolve” with a status and optional note. The status page and metrics show reconciliation; we might alert when there are too many open or when one is resolved.

### 6. Why we use it vs other methods

**Technical:** Detecting payout vs earnings mismatches quickly reduces financial and operational risk; flagging for admin review (instead of auto-correcting) avoids wrong automated fixes. Centralizing in reconciliationService and one worker keeps logic in one place; audit history (flag_history) supports compliance and debugging. Alternatives (no reconciliation, or full auto-correction) would be risky or error-prone.

**Simple (like for a 10-year-old):** We use it so we notice when we paid the wrong amount and so an admin can fix it or explain it. We don’t let the system “fix” it automatically in case the fix is wrong. Having one place for “flag” and “resolve” and a history of what was done keeps things clear and auditable.

### 7. Best practices

**Technical:** Worker should use same definition of “expected earnings” as payout calculation (e.g. same period, same job set, same deductions). Tolerance: 0 or small (e.g. rounding); document tolerance in code or config. Idempotent upsert (ON CONFLICT) so re-run doesn’t duplicate flags. Resolve requires admin and note (or allow “ignored” with note). Keep flag_history for audit. Gaps: document exact expected-vs-actual formula; ensure worker runs after payouts are final (e.g. Stripe transfer completed); consider alert when new flag created.

**Simple (like for a 10-year-old):** The worker should use the same “expected” math as when we calculated the payout. We might allow a tiny difference (rounding). We update the same flag if we run again so we don’t get duplicates. Only admins can resolve and we want a note. We keep history. We could write down exactly how we compute “expected” and make sure the job runs after payouts are done; we could also alert when a new flag appears.

### 8. Other relevant info

**Technical:** payout_reconciliation_flags.payout_id is PK; one flag per payout. delta_cents can be positive (we paid more than expected) or negative (we paid less). operationalMetricsService uses LEFT JOIN payout_reconciliation_flags to compute reconciliationFlagRate and reconciliation status. status/summary (status.ts) includes open reconciliation flags in alerts. FOUNDER_PAYOUT_FLOW.md for how payouts are computed and sent; reconciliation compares that result to our internal earnings view.

**Simple (like for a 10-year-old):** Each payout has at most one flag. The difference can be “we paid too much” or “we paid too little.” The metrics and status page use the flags to show rate and ok/warning/error. The payout doc explains how we compute and send payouts; reconciliation checks that against what we think they earned.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Detect mismatches between payout amount and expected earnings, store them as flags for admin review, and support resolution (resolved/ignored) with audit history so we can correct errors and explain exceptions.

**Simple (like for a 10-year-old):** Find “we paid the wrong amount,” put it on a list for an admin, and let them mark it fixed or ignore it with a note so we have a record.

### 10. What does "done" or "success" look like?

**Technical:** Worker runs and creates/updates flags when delta exceeds tolerance; getPayoutReconciliationFlags returns correct open list; resolve updates flag and inserts history; metrics and status show correct reconciliation state and unresolved count. Success = flags reflect real mismatches and admin can resolve with audit trail.

**Simple (like for a 10-year-old):** Success means the job finds the mismatches, the list is right, and when an admin resolves we update the flag and write history. The status page and metrics show the right picture.

### 11. What would happen if we didn't have it?

**Technical:** No systematic detection of payout vs earnings mismatch; errors could go unnoticed; no audit trail for corrections. Financial and operational risk would increase.

**Simple (like for a 10-year-old):** We wouldn’t know when we paid the wrong amount, and we wouldn’t have a list or history for admins to fix and explain. We’d have more risk.

### 12. What is it not responsible for?

**Technical:** Not responsible for: computing payout amount (payoutsService); sending the transfer (Stripe); computing expected earnings (that’s in the worker or shared with payout logic). It only stores flags and resolution; the worker computes delta and calls upsertReconciliationFlag. Payout execution and ledger are separate.

**Simple (like for a 10-year-old):** It doesn’t figure out the payout or send the money—it just stores “this payout doesn’t match” and “admin resolved it.” The worker does the “expected vs actual” math and creates the flag.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** Worker: payouts table (or Stripe), earnings source (jobs/ledger for period/cleaner), tolerance (e.g. 0). upsertReconciliationFlag: payoutId, cleanerId, deltaCents. resolvePayoutReconciliationFlag: payoutId, status (resolved|ignored), note?, resolvedBy. getPayoutReconciliationFlags: no args (returns all flagged). Env: none required; worker schedule in scheduler.

**Simple (like for a 10-year-old):** The worker needs the list of payouts and how we compute “expected earnings,” and a tolerance. To create a flag we need payout id, cleaner id, and the difference. To resolve we need payout id, status, optional note, and who resolved. We don’t need special env; the job schedule is in the scheduler.

### 14. What it produces or changes

**Technical:** Inserts/updates payout_reconciliation_flags; inserts payout_reconciliation_flag_history on resolve. Returns: list of flags (payout_id, cleaner_id, delta_cents, status, note). Does not change payouts table or Stripe; only flags and resolution state.

**Simple (like for a 10-year-old):** It writes and updates the flags table and writes a history row when someone resolves. It returns the list of open flags. It doesn’t change the payout or Stripe—only our “reconciliation” tables.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: payout reconciliation worker (upsertReconciliationFlag), admin (get flags, resolve), operational metrics and status (read flags for rate and status). Flow: worker computes delta → upsertReconciliationFlag; admin GET → resolve with status/note → UPDATE + INSERT history. Rules: only status 'flagged' returned by get; resolve requires valid status (resolved|ignored) and resolvedBy; one row per payout_id.

**Simple (like for a 10-year-old):** The worker and admin and status page use this. The worker creates/updates flags; the admin gets the list and resolves with a status and note. We only return “flagged” ones; resolve must have a valid status and who did it; there’s one flag per payout.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** Scheduled worker (payout reconciliation); admin GET/POST (flags, resolve). Metrics and status read on each request. No user-driven trigger for creating flags (only worker).

**Simple (like for a 10-year-old):** The reconciliation job runs on a schedule and creates/updates flags. Admins look at the list and resolve. The status page and metrics read the flags when they load.

### 19. What could go wrong

**Technical:** Worker uses different “expected” formula than payout (false positives/negatives); worker not scheduled or fails (no flags); tolerance too loose (miss real errors) or too tight (noise). Ensure worker logic matches payout logic; worker runs after payouts final; tolerance documented.

**Simple (like for a 10-year-old):** If the worker’s “expected” math isn’t the same as the payout math we might flag wrong things or miss real errors. If the job doesn’t run we get no flags. If we allow too big a difference we might miss problems; if we allow none we might get lots of noise. We need to keep the formula the same and run the job after payouts are done.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for worker (start, completed, failed, counts); admin resolve logged (payout_reconciliation_resolved). Metrics: reconciliationFlagRate, reconciliation status. Depends on DB, payouts table, earnings source (jobs/ledger). Config: tolerance in worker; optional threshold for status error/warning.

**Simple (like for a 10-year-old):** We log when the job starts and finishes and when someone resolves. We have metrics for “how many payouts have flags” and “ok/warning/error.” We need the DB and the payout and earnings data. The tolerance and thresholds are in the worker or config.

### 26. Security or privacy

**Technical:** Flags and history contain payout id, cleaner id, delta (financial); restrict to admin. Don’t log full flag rows in plaintext in app logs. Audit history supports compliance.

**Simple (like for a 10-year-old):** The flags and history are sensitive (who, how much). Only admins should see them. We don’t put full rows in logs. The history helps us show we reviewed and resolved.

### 33. How it interacts with other systems

**Technical:** Worker reads payouts (and possibly Stripe) and earnings (jobs/ledger); calls reconciliationService.upsertReconciliationFlag. Admin routes call getPayoutReconciliationFlags and resolvePayoutReconciliationFlag. operationalMetricsService and status/summary read flags. alerting may fire on resolve. Does not modify payouts or Stripe; does not publish job events. FOUNDER_PAYOUT_FLOW.md for payout computation and transfer.

**Simple (like for a 10-year-old):** The worker reads payouts and earnings and creates flags. Admins read and resolve. The metrics and status page read the flags. We might send an alert when something is resolved. We don’t change the payout or Stripe—we only store and resolve flags. The payout doc explains how we pay.

---

**See also:** FOUNDER_PAYOUT_FLOW.md, FOUNDER_QUEUE.md (worker), operational metrics, status/summary.
