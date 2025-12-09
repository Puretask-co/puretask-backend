# Job Reassignment Spec
(Job Lifecycle Spec #8)

## 0. Scope & Purpose
Defines how a job moves from one cleaner to another before work starts, ensuring escrow integrity, status correctness, and reliability/fairness handling.

## 1. When Reassignment Is Allowed
- Job in `created` or `assigned` or `accepted` (but not yet in_progress).
- Not canceled, not disputed, not approved.
- Within allowable time window before scheduled_start (configurable).

## 2. Triggering Reassignment
- Cleaner cancels/unavailable.
- Admin/manual reassignment.
- System auto-reassign (e.g., no confirmation within SLA).
- Client requests different cleaner (policy-controlled).

## 3. Core Flow
1) Validate job is eligible (state/time/policy).
2) Unassign current cleaner:
   - job.cleaner_id cleared or replaced.
   - If cleaner had accepted, record reliability penalty (late cancel) per policy.
3) Assign new cleaner:
   - Set job.cleaner_id = new cleaner.
   - Set status:
     - If previous status was accepted → downgrade to `assigned` (new cleaner must accept).
     - If previously assigned/created → remain `assigned`.
   - Reset acceptance/check-in timestamps for new cleaner.
4) Notify both parties (old/new cleaner, client if applicable).

## 4. Financial Handling
- Escrow: unchanged; remains tied to the job (client side only).
- No earnings created/affected (reassignment pre in_progress).
- If reassignment fails and job is canceled → follow Cancellation Rules for refund/penalty.

## 5. Reliability & Policy
- Cleaner who drops after acceptance: negative reliability event.
- If reassigned because of system/assignment timeout: no cleaner penalty; optional platform flag.
- Limit on reassign attempts per job (configurable) before fallback/cancel.

## 6. State & Data Updates
- job.cleaner_id updated to new cleaner.
- job.status set to `assigned` (new cleaner must accept).
- Clear/overwrite acceptance timestamps and any prior check-in/prep data.
- Audit/log entry of reassignment (who/why/when).

## 7. Sub-Scenarios
- Cleaner cancels 12h before start → job reassigned → new cleaner accepts → normal flow.
- Cleaner cancels last-minute; no replacement available → job canceled → full client refund; cleaner penalty.
- System auto-reassigns due to no acceptance within SLA; new cleaner accepts; old cleaner not penalized (configurable).
- Client requests different cleaner; policy allows; reassigned if time permits.

## 8. Failure Handling
- No available cleaner: escalate to manual or cancel with refund.
- Duplicate reassignment requests: idempotent on same target cleaner.
- Attempt to reassign after in_progress: reject; use dispute/ops path instead.

## 9. Dependencies
- Job Status Machine (status reset to assigned)
- Escrow Lifecycle (escrow stays with job)
- Cancellation Rules (if reassignment fails)
- Reliability Score (penalties for late cleaner cancel)

