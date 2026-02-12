# Photo Verification Spec
(Job Lifecycle Spec #5)

## 0. Scope & Purpose
Defines photo requirements and validation for jobs to prevent fraud and support approvals/disputes. Feeds reliability, approval, and dispute evidence.

## 1. Requirements
- Minimum counts (configurable):
  - Before photos: MIN_BEFORE (e.g., 2–3)
  - After photos: MIN_AFTER (e.g., 2–3)
- Types: before, after, optional during.
- Association: each photo links to job_id, cleaner_id, type, timestamp.

## 2. Workflow Integration
- Before photos: required before or at check-in/start.
- After photos: required before completion is accepted.
- Completion is blocked until after-photo minimum met (unless admin override).

## 3. Validation Rules
- Presence: must meet min counts.
- Uniqueness: allow duplicates but do not count the same file twice if detectable (optional).
- Order: before taken prior to completion; after taken at/after completion time.
- Size/type: enforce acceptable formats; reject corrupted uploads.
- Storage success: must confirm persisted URL/id before counting toward minimum.

## 4. Reliability Impacts
- Missing before/after photos: reliability penalty; block approval.
- Complete photos on time: positive reliability event (photo_compliance).

## 5. Sub-Scenarios
- All required photos present → approval unblocked.
- Missing after photos → cannot complete job (or flagged for manual review).
- Minimal before photos present; extra optional during photos stored.
- Upload errors → retries until min met.

## 6. Failure Handling
- Upload fails: return error; do not advance state.
- If min not met at completion attempt: reject completion request.
- Admin override (optional): allow completion with fewer photos, but flag for review.

## 7. Data Model
- job_photos (or equivalent): id, job_id, cleaner_id, type (before/after/during), url/path, created_at.
- Integrity: job must exist; cleaner must match assignment.

## 8. Dependencies
- Cleaner Workflow (photo steps)
- Job Status Machine (completion gating)
- Reliability Score (photo compliance event)
- Disputes (evidence)

