# Job Status Machine Spec
(Job Lifecycle Spec #3)

## 0. Scope & Purpose
Defines allowed job states and transitions, enforcing sequencing and preventing invalid jumps. Ties to escrow, reliability, earnings, cancellation, and payout eligibility.

## 1. States (canonical)
- `created`
- `assigned`
- `accepted`
- `in_progress`
- `completed`
- `approved`
- Terminal variants:
  - `canceled_by_client`
  - `canceled_by_cleaner`
  - `no_show`
  - `disputed`
  - `refunded`

## 2. Allowed Transitions
- created → assigned (matching/assignment)
- assigned → accepted (cleaner accepts)
- accepted → in_progress (check-in)
- in_progress → completed (cleaner finishes)
- completed → approved (client approves or admin approves)
- completed → disputed (client denies, dispute opened)
- Any pre-approved state → canceled_by_client / canceled_by_cleaner (policy-dependent)
- assigned/accepted → no_show (system mark if cleaner absent after grace)
- approved → refunded (if later refund/dispute after payout path)

Invalid transitions must be blocked (examples):
- approved → in_progress
- completed → accepted
- approved → created

## 3. Preconditions per Transition
- assigned → accepted: cleaner must be the assignee; job active; not canceled/disputed.
- accepted → in_progress: check-in with GPS/time within allowed window.
- in_progress → completed: before/after photos present (or at least before; after can be validated at completion), job actions done.
- completed → approved: completion verified; photos; check-in exists; escrow held.
- completed → disputed: client initiated within dispute window (configurable).

## 4. Side-Effects & Hooks
- On accept: reliability event (acceptance); may set SLA timers.
- On in_progress: record check-in GPS/time; reliability event (on-time/late).
- On completed: record completion time; ensure media uploaded; reliability event.
- On approved: triggers escrow_release and earnings creation (per Earnings spec).
- On canceled/no_show/disputed: triggers escrow reversal/refund paths; reliability penalties as per rules.

## 5. Concurrency & Idempotency
- Repeat requests for the same transition should be idempotent (e.g., approving twice → no double earnings).
- State updates should be transactional with side-effects (ledger/reliability) to avoid partial updates.

## 6. Sub-Scenarios
- Standard flow: created → assigned → accepted → in_progress → completed → approved.
- Client cancels before accepted: created/assigned → canceled_by_client.
- Cleaner cancels after assigned: assigned/accepted → canceled_by_cleaner.
- Cleaner no-show: assigned/accepted → no_show.
- Client disputes after completion: completed → disputed.

## 7. Failure Handling
- If required data missing (no check-in, no photos), block progression to completed/approved.
- If job already terminal (canceled/no_show/refunded), block further transitions.

## 8. Validation & Integrity
- Every job has exactly one current status; transitions follow the allowed graph.
- Terminal jobs cannot return to active states.
- States that imply financial actions (approved/refunded) must align with ledger/earnings records.

## 9. Dependencies
- Escrow Lifecycle (hold, release, reversal)
- Approval → Earnings (for approved transition)
- Cancellation Rules (for cancel states)
- No-Show Detection (for no_show transition)
- Dispute Resolution (for disputed → refund paths)

