# Section 14 — Launch Readiness & Rollout (Full Runbook)

**Objective:** Add feature flags, staged rollout plan, kill switches (payments, bookings, payouts), incident runbook, support training, and launch KPIs — so “ready” becomes “live safely.”

**Exit condition:** You can turn off money or bookings or payouts in one action; incidents are handled by a clear runbook; support and monitoring are aligned with launch.

**Status:** Design/outline; full detail to be expanded when proceeding with Section 14.

---

## 14.1 Scope (What This Section Covers)

- Feature flags (enable/disable features without deploy)  
- Staged rollout plan (who gets access when)  
- Kill switches: payment, booking, payout  
- Incident response runbook  
- Support workflow training  
- Launch KPIs and monitoring  
- Post-launch audit  

---

## 14.2 Feature Flags

- **Purpose:** Enable/disable features without full deploy; A/B or gradual rollout.  
- **Examples:** New booking flow; new payout schedule; new dispute UI.  
- **Implementation:** Config or DB-driven flags; checked at runtime; no secrets in flags.  
- **Deliverable:** Feature flag system (or plan) and list of launch-critical flags.

---

## 14.3 Staged Rollout Plan

- **Phases:** e.g. internal only → beta cleaners/clients → limited geo → full.  
- **Criteria per phase:** Success metrics; rollback triggers; who has access.  
- **Deliverable:** Written rollout plan with phases and criteria.

---

## 14.4 Kill Switches

| Switch | Effect | Use Case |
|--------|--------|----------|
| **Payment kill switch** | Disable new payment intents / charges | Critical bug in payments; fraud spike |
| **Booking kill switch** | Disable new bookings | Capacity or integrity issue |
| **Payout kill switch** | Pause payouts | Dispute surge; reconciliation failure |

- **Implementation:** Env flag or admin toggle; checked in payment/booking/payout code; immediate effect (no deploy).  
- **Status (2026-02-02):** Implemented via `env.BOOKINGS_ENABLED`, `env.PAYOUTS_ENABLED`, `env.CREDITS_ENABLED` in `src/config/env.ts`. See `jobsService`, `payoutsService`, `creditsService`, `featureFlags.ts`. Set in Railway or .env.

---

## 14.5 Incident Response Runbook

- **Triggers:** Payment failures; webhook backlog; payout errors; security alert; data breach suspicion.  
- **Steps:** Who to notify; how to enable kill switch; how to rollback deploy; how to escalate; how to communicate (internal + external if needed).  
- **Deliverable:** Incident runbook document (and link from dashboard/admin).

---

## 14.6 Support Workflow Training

- **Topics:** How to use admin dispute UI; how to issue refund/credit; when to escalate; IC-safe language; playbook usage.  
- **Deliverable:** Training material or session; support team can resolve common scenarios.

**Support training checklist (run before launch):**

| Topic | What to train |
|-------|----------------|
| Dispute playbook | Categories (missed area, quality, damages, etc.); evidence review; resolution options (refund, credit, deny, hold payout); when to escalate. SECTION_11 playbooks; RUNBOOK § 3.7. |
| Refund/credit flow | Refund limits by role; ledger + audit reason; RUNBOOK § 3.7 refund/credit flows. |
| Payout hold/release | When to hold; how to release; idempotent endpoints; audit reason required. RUNBOOK § 3.7. |
| IC-safe language | No “required procedures,” “performance correction,” “warnings,” “PIP.” Use “platform status adjustment,” “risk indicators,” “participation conditions.” [IC_LANGUAGE_AUDIT.md](../IC_LANGUAGE_AUDIT.md). |
| Kill switches | What BOOKINGS_ENABLED, PAYOUTS_ENABLED, REFUNDS_ENABLED do; when to use; who can flip. RUNBOOK § 3.2. |
| Support macros | RUNBOOK § 4.2 — “Why is my progress paused?”, “Why didn’t my message count?”, etc. Copy-paste answers for cleaners. |
| Ops summary & webhooks | GET /admin/ops/summary; GET /admin/webhooks/events; when to check failed webhooks or payout backlog. RUNBOOK § 3.1, § 3.7. |

---

## 14.7 Launch KPIs & Monitoring

- **Technical:** Error rate, p95 latency, webhook success rate, queue lag, payout success rate.  
- **Business:** Bookings per day; dispute rate; refund rate; payout volume.  
- **Alerts:** Thresholds that trigger runbook or escalation.  
- **Deliverable:** Dashboard or checklist of launch KPIs; alerts configured.

---

## 14.8 Post-Launch Audit

- **Timing:** e.g. 1 week and 1 month after full launch.  
- **Content:** What went wrong; what went right; checklist of Sections 1–13 compliance; kill switch usage; incident count.  
- **Deliverable:** Post-launch audit report template or first run.

**Post-launch audit template (fill when you launch):**

- **Audit date:** _______________
- **Period covered:** e.g. First 7 days / First 30 days after launch

**Checklist (Sections 1–13):**

- [ ] Section 1 — Secrets & incident response: no leaks; rotation runbook known.
- [ ] Section 2 — Auth: no prod breakage; canonical auth on all protected routes.
- [ ] Section 3 — CI/repo: migrations check; no stray secrets.
- [ ] Section 4 — Stripe/webhooks: no double charges; webhook idempotency; failed events reviewed.
- [ ] Section 5 — DB: migrations applied; schema aligned.
- [ ] Section 6 — Workers: crons/durable jobs running; no silent failures.
- [ ] Section 7 — API: contracts stable; validation in place.
- [ ] Section 8 — Security: rate limits, hardening in place.
- [ ] Section 9 — Maintainability: tests, docs, velocity acceptable.
- [ ] Section 10 — Cost/scale: within budget; no surprise load.
- [ ] Section 11 — Admin/support: dispute resolution, webhook viewer, case management used; audit reasons present.
- [ ] Section 12 — Trust/IC: outcomes and evidence; IC-language audit followed; no misclassification risk.
- [ ] Section 13 — Legal: TOS, Privacy, Cleaner Agreement, liability, legal review checklist completed.

**Operational:**

- Kill switches used? (Y/N) If yes: which, when, outcome. _______________
- Incident count (payment, auth, outage, security): _______________
- What went well: _______________
- What went wrong: _______________
- Follow-up actions: _______________

---

## 14.9 Done Checklist

- [ ] Feature flags added for launch-critical features  
- [ ] Staged rollout plan defined and documented  
- [ ] Payment kill switch implemented and documented  
- [ ] Booking kill switch implemented and documented  
- [ ] Payout kill switch implemented and documented  
- [ ] Incident runbook created and accessible  
- [ ] Support workflows trained  
- [ ] Launch KPIs and monitoring in place  
- [ ] Post-launch audit completed (or template ready)  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 14 checklist.
