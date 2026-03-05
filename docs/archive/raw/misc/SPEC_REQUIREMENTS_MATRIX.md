# PureTask Gamification — Spec → Requirements Matrix

> Maps every requirement from the Final Canonical Spec (v1.0) to config keys, DB fields, APIs, and tests.
> Use this as the merge gate: no PR merges until its matrix rows are satisfied.

## Legend

| Column | Meaning |
|--------|---------|
| **Spec** | Section in the final spec |
| **Requirement** | Exact statement to implement |
| **Config Key** | JSON/DB key or env var |
| **DB/Fields** | Tables and columns involved |
| **API** | Endpoints that read/write |
| **Test** | Test file + describe/it name |
| **Status** | pending / in_progress / done |

---

## 1. Core Philosophy (No code; principle only)

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 1 | Levels never decrease | — | — | — | integration: level never demotes | pending |
| 1 | Maintenance pauses rewards/progress, never revokes levels | maintenance_paused | cleaner_level_progress | — | integration: maintenance pause | pending |
| 1 | Customer always chooses cleaner | — | — | ranking | — | — |

---

## 2. On-Time Definition

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 4.4 | Clock-in 15 min before to 15 min after scheduled start | ON_TIME_EARLY_MINUTES, ON_TIME_LATE_MINUTES | job_checkins.created_at, jobs.scheduled_start_at | — | unit: on-time window ±15 | done |
| 4.4 | Clock-in GPS within 250m | GPS_CHECKIN_RADIUS_METERS | job_checkins.is_within_radius | — | unit: GPS 250m | pending |

**Env:** `ON_TIME_EARLY_MINUTES=15`, `ON_TIME_LATE_MINUTES=15`, `GPS_CHECKIN_RADIUS_METERS=250`

---

## 3. Clock-In/Out Success

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 4.5 | Both clock-in and clock-out within 250m | GPS_CHECKIN_RADIUS_METERS | job_checkins (check_in, check_out, is_within_radius) | — | unit: clock-in/out both in radius | done |
| 4.5 | No minimum duration rule | — | — | — | unit: no duration check | done |

---

## 4. Photo Verification

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 4.3 | ≥1 before, ≥1 after | — | job_photos.type | — | unit: photos 1 before + 1 after | done |
| 4.3 | Timestamps within clock-in/out window | — | job_photos.created_at, jobs.actual_start_at, actual_end_at | — | unit: photo timestamps in job window | done |
| 4.3 | No room/angle requirements | — | — | — | — | done |

---

## 5. Meaningful Login

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 4.1 | Action within 15 min of session start | meaningful_action_window_minutes | cleaner_meaningful_actions, cleaner_login_days | — | unit: meaningful login window | pending |
| 4.1 | Actions: open job, accept/decline, message, confirm status, upload photos, update availability | goodFaithDeclines / rules | — | — | unit: action list | pending |

**Config:** `rules.meaningful_login` in gamification config

---

## 6. Meaningful Messages

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 4.2 | Template used → counts | quickTemplates | messages.template_id | POST /messages | unit: template counts | pending |
| 4.2 | ≥25 chars → counts | meaningfulMessageMinChars | messages.body | — | unit: 25 char threshold | pending |
| 4.2 | Customer replies within 24h → counts | — | messages (reply thread) | — | unit: reply validation | pending |

**Config:** `quickTemplates.json`, `meaningfulMessageMinChars: 25`

---

## 7. Quick Templates

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 4.2 | On my way, Arrived, Starting now, Finished, Focus areas | quickTemplates | message_templates | GET /templates | — | done |
| 4.2 | Thank you, Reschedule, Review request, Tip request | quickTemplates | message_templates | — | — | done |

---

## 8. Good Faith Declines

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 5A | Distance ≥11 mi (max 10) | max_travel_miles, good_faith_if_job_distance_miles_gte | cleaner_profiles.max_travel_miles, job distance calc | — | unit: distance good-faith | pending |
| 5B | Time conflict: outside availability | — | cleaner_availability, jobs.scheduled_start_at | — | unit: time conflict | pending |
| 5C | Job mismatch: service not offered | — | cleaner preferences, job requirements | — | unit: job mismatch | pending |
| 5D | Safety: optional photo; note required if no photo (min 20 chars) | optional_photo, note_required_if_no_photo, min_note_chars | safety_reports, job_offers.decline_reason | POST /decline | unit: safety optional photo | pending |
| 5E | Access/logistics mismatch | — | — | — | — | pending |
| 5F | Short notice <18 hours | short_notice_hours | — | — | unit: 18h short notice | pending |
| 5 | Limit 6 per 7 days; beyond counts toward acceptance | good_faith_per_7_days | — | — | unit: good-faith limit | pending |
| 5 | Acceptance rate = accepted / (accepted + declined_non_good_faith) | — | — | — | unit: acceptance formula | pending |

**Config:** `goodFaithDeclines.json` — `short_notice_hours: 18`, `safety_concern.optional_photo: true`, `note_required_if_no_photo: true`

---

## 9. Ratings

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 6 | Cleaner UX: stars only (e.g. 4.8/5) | ratings.cleaner_ui | jobs.rating | GET /progression | — | done |
| 6 | Admin: stars + optional normalized % | ratings.internal_normalized_percent | — | admin API | — | — |

---

## 10. Add-Ons

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 7.1 | Add-ons selected during booking, after hours estimate | — | jobs.has_addons, addons_count | booking flow | — | pending |
| 7.2 | Add-on price by cleaner reliability tier | — | — | — | — | pending |
| 7.3 | L4: 30 add-ons, L5: 45, L6: 60 | goals.json | cleaner_level_goals | — | integration: add-on goals | done |
| 7.4 | L4: Add-on Spotlight 14d; L5: Preferred 30d; L6: Premium permanent | rewards.json | — | — | — | done |

---

## 11. Badges

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 10 | Core badges: First Job, 5-Star, Repeat, On-Time 10, Dispute-Free, etc. | badges.json (core) | cleaner_badge_awards | GET /badges | — | pending |
| 10 | Fun badges: Booked & Busy, Back-to-Back, The Closer, etc. | badges.json (fun) | — | — | — | pending |
| 10 | Badges never affect ranking | — | — | ranking service | — | — |

---

## 12. Seasonal Challenges

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 9 | Spring Refresh, Move-Out Rush, Holiday Prep, End-of-Year | seasonalRules.json | season_definitions | — | — | done |
| 9 | Weekend Warrior Month, 5-Star Sprint, Perfect Week | seasonalRules.json | — | — | — | done |
| 9 | No level resets; only rewards rotate | — | — | — | — | — |

---

## 13. Best Practices

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 8 | Non-gating; may unlock badges | bestPractices.json | — | GET /best-practices | — | done |

---

## 14. Marketplace Health Governor

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 14 | Region-level tuning (multipliers, exposure) | region_governor_configs | region_governor_configs | admin | — | pending |
| 14 | Manual override + audit | — | audit_log | — | — | pending |

---

## 15. Admin Controls

| Spec | Requirement | Config | DB | API | Test | Status |
|------|-------------|--------|-----|-----|------|--------|
| 13 | Goals, rewards, seasons CRUD with effective_at | — | gamification tables | admin endpoints | — | pending |
| 13 | Pause rewards for abuse (never levels) | — | cleaner_reward_grants | admin | — | pending |
| 13 | Audit log + rollback | audit_log | audit_log | admin | — | pending |

---

## Test Suite Mapping

| Test File | Coverage |
|-----------|----------|
| `cleanerLevelService.metrics.test.ts` | On-time, clock-in/out, photos, add-ons, acceptance rate |
| `goodFaithDeclines.test.ts` | All good-faith reasons, 18h, safety optional photo, limit 6 |
| `meaningfulLogin.test.ts` | 15 min window, action list |
| `meaningfulMessages.test.ts` | Template, 25 chars, reply |
| `gamification.integration.test.ts` | Level 1→4 progression, maintenance pause, no demotion |
| `badges.test.ts` | Core + fun badge triggers |

---

## Config Keys Summary

| Key | Default | Location |
|-----|---------|----------|
| ON_TIME_EARLY_MINUTES | 15 | env |
| ON_TIME_LATE_MINUTES | 15 | env |
| GPS_CHECKIN_RADIUS_METERS | 250 | env |
| GOOD_FAITH_SHORT_NOTICE_HOURS | 18 | env (new) |
| meaningfulMessageMinChars | 25 | quickTemplates.json |
| good_faith_per_7_days | 6 | goodFaithDeclines.json |
| short_notice_hours | 18 | goodFaithDeclines.json (reasons.too_short_notice) |
| safety_concern.optional_photo | true | goodFaithDeclines.json |
| safety_concern.note_required_if_no_photo | true | goodFaithDeclines.json |
| safety_concern.min_note_chars | 20 | goodFaithDeclines.json |
