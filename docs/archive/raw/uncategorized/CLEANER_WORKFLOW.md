# Cleaner Workflow Spec
(Job Lifecycle Spec #4)

## 0. Scope & Purpose
Defines the cleaner’s operational steps on a job: accept, travel, check-in, work, photos, complete. Ensures data needed for reliability, approvals, and payouts is captured.

## 1. Core Steps
1) Accept job (or auto-assigned and accepted).
2) Travel/arrive within allowed window.
3) Check-in (GPS/time) → job moves to `in_progress`.
4) Capture before photos.
5) Perform work; optional during photos.
6) Capture after photos.
7) Mark job completed → job moves to `completed`.

## 2. Requirements per Step
- Accept: must be assigned cleaner; job active.
- Check-in: GPS within configured radius; within time window; record timestamp/location.
- Photos: minimum counts (e.g., before >= MIN_BEFORE, after >= MIN_AFTER); stored with job_id, type.
- Completion: allowed only if check-in exists and photos meet minimums.

## 3. Data Captured
- GPS: lat/long, accuracy, timestamp at check-in.
- Photos: URLs/ids, type (before/after/during), timestamps.
- Timestamps: accepted_at, check_in_at, completed_at.
- Optional: notes/issue flags from cleaner.

## 4. Business Rules
- Late arrival: allowed but triggers reliability penalty.
- Offsite check-in: block or flag if outside radius.
- Missing photos: block completion or flag for manual review.
- Multiple check-ins: first valid sets in_progress; duplicates ignored.
- Offline mode (optional): if supported, queue check-in/photos and sync later; timestamps preserved.

## 5. Sub-Scenarios
- On-time arrival, valid check-in, full photos → normal completion.
- Late but within grace → allowed; reliability hit.
- No check-in → cannot complete; job at risk of no-show.
- Missing after photos → cannot complete (or requires override).
- Cleaner cancels after accept → cancellation flow.

## 6. Failure Handling
- Check-in fails (GPS or network): surface error; allow retry; do not advance state.
- Photo upload fails: allow retry; do not complete until minimum photos stored.
- Duplicate completion attempts: idempotent; no double events.

## 7. Validation & Integrity
- A completed job must have: check_in_at, completed_at, required photos.
- Durations must be non-negative; completed_at >= check_in_at >= accepted_at.
- Reliability events logged once per phase (accept, check-in, completion, photos).

## 8. Dependencies
- Job Status Machine (states)
- Photo Verification (counts/types)
- Reliability Score rules (on-time, no-show, photo compliance)

