# PureTask Gamification — Engineering Tickets (v1.0)

> Scope: Implement the complete Cleaner Progression & Incentive System spec.
> See [SPEC_REQUIREMENTS_MATRIX.md](./SPEC_REQUIREMENTS_MATRIX.md) for spec → test mapping.

## EPIC A — Data Model & Config

### A1 — Core tables
- [x] `safety_reports` (migration 046)
- [x] `message_templates`, `job_offers.decline_reason`, `cleaner_profiles.max_travel_miles` (045)
- [x] `jobs.has_addons`, `addons_count` (045)
- [ ] `gamification_config_versions` (optional future versioning)

### A2 — Config loader
- [x] getGoodFaithDeclines, getBadges, getQuickTemplates, getBestPractices, getSeasonalRules
- [ ] Config version pinning with effective_at (future)

---

## EPIC B — Metrics Contract & Anti-Gaming

### B1 — Metric calculators
- [x] On-time ±15 min (env-driven)
- [x] Clock-in/out within 250m
- [x] Photo: 1 before + 1 after + timestamp in job window
- [x] Pure functions in `src/lib/gamificationMetrics.ts`

### B2 — Meaningful login
- [ ] Session + meaningful action tracking (cleaner_meaningful_actions from 044)
- [ ] Streak uses meaningful actions within 15 min

### B3 — Meaningful messages
- [ ] template_id set when sending via quick template
- [ ] Count only if template OR ≥25 chars OR reply within 24h

---

## EPIC C — Good-Faith Declines

### C1 — Decline reasons + validation
- [x] Config: distance, time_conflict, job_mismatch, safety_concern, access_logistics, too_short_notice
- [x] short_notice_hours = 18
- [x] safety: optional photo, note required if no photo
- [ ] API: record decline_reason on job_offers; create safety_reports when safety_concern
- [ ] Acceptance rate formula (exclude good-faith until limit exceeded)

### C2 — Limit 6 per 7 days
- [ ] Enforce in decline flow; beyond limit counts toward acceptance

---

## EPIC D — Progression Engine

### D1 — Goal evaluation
- [x] cleanerLevelService evaluateGoalComplete / evaluateGoalProgress
- [x] addons_completed, photos_valid, clock_in_out (GPS), on_time (GPS + window)

### D2 — Level up + pause
- [x] Level never decreases
- [x] maintenance_paused pauses rewards/progress

### D3 — Reward grants
- [x] Add-on rewards (Spotlight, Preferred, Premium) in config
- [ ] Choice reward selection endpoint
- [ ] Stacking rules (extend_duration, etc.)

---

## EPIC E — Visibility & Matching

### E1 — Ranking integration
- [ ] Apply visibility multipliers from active rewards
- [ ] Add-on boosts only when job.has_addons=true
- [ ] Guardrails: within candidate pool only

---

## EPIC F — Admin & Governor

### F1 — Admin endpoints
- [ ] Goals/rewards/seasons CRUD
- [ ] Governor region override
- [ ] Audit log
- [ ] Pause rewards for abuse (never levels)

---

## EPIC G — QA & Tests

### G1 — Unit tests
- [x] gamificationMetrics: isOnTime, isShortNotice, isMeaningfulMessage, isPhotoWithinJobWindow
- [x] good-faith limit constant

### G2 — Integration tests
- [ ] Level 1→4 progression
- [ ] Maintenance pause/recovery
- [ ] Golden dataset assertions

---

## Config Files (Current)

| File | Purpose |
|------|---------|
| goodFaithDeclines.json | Reasons, limits, short_notice 18h, safety optional photo |
| badges.json | Core + fun badges (reduced, meaningful) |
| quickTemplates.json | 9 templates incl. Thank you, Reschedule, Review, Tip |
| bestPractices.json | Non-gating guidance cards |
| seasonalRules.json | Spring Refresh, Move-Out Rush, etc. |
| goals.json | Level goals incl. add-on core L4/5/6 |
| rewards.json | Add-on Spotlight, Preferred, Premium |

## Env Vars

| Var | Default | Purpose |
|-----|---------|---------|
| ON_TIME_EARLY_MINUTES | 15 | On-time window start |
| ON_TIME_LATE_MINUTES | 15 | On-time window end |
| GPS_CHECKIN_RADIUS_METERS | 250 | Clock-in/out + on-time GPS |
| GOOD_FAITH_SHORT_NOTICE_HOURS | 18 | Short notice threshold |
