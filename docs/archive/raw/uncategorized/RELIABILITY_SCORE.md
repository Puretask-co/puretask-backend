# Reliability Score Spec
(Micro/Unit Spec #6)

## Scope
Defines reliability events and scoring impacts (unit-level). Full scoring model can build on this.

## Events (examples)
- job_accepted (positive)
- check_in_on_time (positive)
- check_in_late (negative)
- no_show (heavy negative)
- missing_photos (negative/block)
- job_completed (neutral/positive)
- dispute_client_wins (negative)

## Rules
- Each event has a defined weight and decay/window (e.g., last 60 days or last N jobs).
- No duplicate events for the same phase of a job.
- Certain events block progression (no_show, missing_photos).

## Data
- reliability_events: id, cleaner_id, job_id, type, weight, created_at.
- Snapshot/rollup (optional) to store computed score and tier.

## Validation
- Event must reference existing job/cleaner.
- No double-count of the same reliability-critical event per job.
- Score recalculation uses windowed data; outputs deterministic score/tier.

