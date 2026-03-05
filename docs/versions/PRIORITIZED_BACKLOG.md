# Full List of All TODOs (Consolidated)

Consolidated from repo + docs. No duplicates, grouped by impact. Use this with [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) for version gates and [MASTER_CHECKLIST_EXECUTION.md](../active/MASTER_CHECKLIST_EXECUTION.md) for how to execute tasks.

**Legend:** ⬜ Not started | 🟡 In progress | ✅ Done

---

## Critical (Must Fix Before Launch) — 6 items

| # | File / Location | TODO | Why critical |
|---|------------------|------|--------------|
| 1 | `src/services/paymentService.ts` | Payment method management (Stripe API calls commented as TODO) | Blocks full billing flow |
| 2 | `src/workers/subscriptionJobs.ts` | Subscription dunning flag/notification | Prevents churn from failed renewals |
| 3 | `src/lib/errors.ts` + external integrations | Error recovery/retry logic for Stripe, SendGrid, Twilio | Risk of lost payments/notifications |
| 4 | `src/lib/circuitBreaker.ts` (missing) | Implement circuit breakers for external APIs | Cascading failures on outage |
| 5 | `src/services/notifications/notificationService.ts` | Dead letter queue for failed jobs | Lost notifications on failure |
| 6 | `.github/workflows/ci.yml` | Add error alerting integration (PagerDuty/Sentry alerts) | No production alerting |

---

## High (Core Features — Fix in Week 1) — 8 items

| # | File / Location | TODO | Why high |
|---|------------------|------|----------|
| 1 | `src/workers/scheduler.ts` | Schedule retry-notifications (every 10 min) | Notifications can be lost |
| 2 | `src/workers/scheduler.ts` | Schedule webhook-retry (every 5 min) | Stripe webhooks can fail |
| 3 | `src/workers/scheduler.ts` | Schedule reliability-recalc (daily 3 AM) | Matching becomes inaccurate |
| 4 | `src/workers/scheduler.ts` | Schedule auto-expire (hourly) | Jobs stuck in awaiting_approval |
| 5 | `src/workers/scheduler.ts` | Schedule photo-cleanup (daily 5 AM) | Storage bloat + compliance |
| 6 | `src/services/jobTrackingService.ts` | Enforce GPS speed check (<5 m/s) on check-in | Spoofing risk |
| 7 | `src/services/photosService.ts` | Add server-side photo hash validation on upload | Tampering risk |
| 8 | `src/services/reliabilityService.ts` | Add anomaly detection (impossible GPS jumps) | Gaming risk |

---

## Medium (UX / Docs — Fix in Week 2) — 12 items

| # | Area | TODO |
|---|------|------|
| 1 | Short link service | SMS short links (noShowDetection.ts, jobReminders.ts) |
| 2 | Timezone | Timezone handling (hardcoded "local time" in multiple workers) |
| 3 | Notifications | Calendar sync notifications |
| 4 | Notifications | Background check result notifications |
| 5 | Notifications | Invoice notifications |
| 6 | Notifications | Team invitation notifications |
| 7 | Cron + notification | Job reminder (24h before) — new notification + cron |
| 8 | Cron + notification | Job reminder (2h before) — new notification + cron |
| 9 | Cron + notification | No-show warning — new notification |
| 10 | Notifications | Weekly cleaner performance report |
| 11 | Notifications | Monthly client summary |
| 12 | Notifications | Referral bonus earned notification |

---

## Low (Nice-to-Have — Post-Launch) — 10+ items

| # | Area | TODO |
|---|------|------|
| 1 | Engagement | Inactive user re-engagement |
| 2 | Notifications | Job rating reminder |
| 3 | Notifications | Tier upgrade notification |
| 4 | Support | Dispute escalation (to admin) |
| 5 | Ops | Database cleanup (old logs >90 days) |
| 6 | API | API versioning strategy |
| 7 | API | SDK generation (TypeScript) |
| 8 | Docs | Contributing guidelines |
| 9 | Docs | Architecture decision records (ADRs) |
| 10 | QA | Visual regression / accessibility tests |

---

## Summary

| Tier | Count |
|------|-------|
| Critical | 6 |
| High | 8 |
| Medium | 12 |
| Low | 10 |
| **Total** | **36** |

Update this doc as items are completed or reprioritized.
