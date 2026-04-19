# Full Document Inventory — Systematic Review

**Purpose:** Every document in `docs/active/` (and key docs elsewhere) in one table. Use this to review each doc and confirm everything it says has been done.  
**How to use:** Work through the table top to bottom (or by section). For each row: open the doc, note what it says to do or verify, then mark **Review status** (e.g. ✅ Done, 🟡 Partial, ❌ Not done, N/A).

**Convention:** Paths are relative to repo root. **Review status** is for you to fill.

---

## 1. Root docs (docs/active/*.md) — by priority

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 0 | docs/active/DOCUMENT_INVENTORY_FULL_REVIEW.md | This file: full doc inventory for systematic review; tick each row when done. | [ ] |
| 1 | docs/active/README.md | Entry point; links to all docs; document priority table. | [ ] |
| 2 | docs/active/SETUP.md | Run locally: clone, env, DB, migrate, run app, tests; "what to do next" guide. | [ ] |
| 3 | docs/active/ARCHITECTURE.md | How system fits together (layers, auth, flows, DB, workers, gamification, Trust API). | [ ] |
| 4 | docs/active/RUNBOOK.md | Ops: health checks, deploy, rollback, incidents, idempotency TTL. | [ ] |
| 5 | docs/active/TROUBLESHOOTING.md | Known issues and fixes. | [ ] |
| 6 | docs/active/DEPLOYMENT.md | Railway / production deploy and rollback. | [ ] |
| 7 | docs/active/PROJECT_ISSUES_AND_REMEDIATION.md | All known problems (routes→DB, auth, migrations, lint, tests) and how to fix them. | [ ] |
| 8 | docs/active/AUDIT_TICKETS.md | Bug and risk tickets from PR rubric (many done). | [ ] |
| 9 | docs/active/PR_AUDIT_RUBRIC.md | PR audit checklist (15 sections); top-3 risks; evidence key. | [ ] |
| 10 | docs/active/DECISIONS.md | Architectural and product decisions (why we did X). | [ ] |
| 11 | docs/active/BACKEND_ENDPOINTS.md | Canonical list of API endpoints. | [ ] |
| 12 | docs/active/API_REFERENCE.md | Swagger/OpenAPI and spec comparison. | [ ] |
| 13 | docs/active/DATA_MODEL_REFERENCE.md | Schema and data model. | [ ] |
| 14 | docs/active/BACKEND_UI_SPEC.md | Backend → frontend UI contract (screens, data, actions, states). | [ ] |
| 15 | docs/active/MASTER_MIGRATIONS.md | Canonical migration order; which SQL to run. | [ ] |
| 16 | docs/active/BACKUP_RESTORE.md | Backup strategy and restore procedures. | [ ] |
| 17 | docs/active/CI_CD_SETUP.md | CI/CD pipelines, env vars, migrations in CI. | [ ] |
| 18 | docs/active/GAMIFICATION_BACKEND_SPEC.md | Gamification backend spec (levels, goals, rewards, governor). | [ ] |
| 19 | docs/active/GAMIFICATION_FRONTEND_BACKEND_SPEC.md | Gamification frontend–backend contract. | [ ] |
| 20 | docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md | Step-by-step implementation (paths, code, verification). | [ ] |
| 21 | docs/active/GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md | How to add the bundle into the current system. | [ ] |
| 22 | docs/active/NOTIFICATIONS.md | Notification system (sender flow, dedupe, templates). | [ ] |
| 23 | docs/active/BACKEND_QA.md | Backend Q&A and build checklist (n8n, Stripe, alignment). | [ ] |
| 24 | docs/active/FOUNDER_BACKEND_REFERENCE.md | Index to founder-level deep dives (founder/*). | [ ] |
| 25 | docs/active/FRONTEND_JOB_STATUS_CONFIG.md | Job status config for frontend. | [ ] |
| 26 | docs/active/SYSTEM_AUDIT_CHECKLIST.md | System audit checklist. | [ ] |
| 27 | docs/active/MASTER_CHECKLIST.md | V1–V5 master checklist. | [ ] |
| 28 | docs/active/MASTER_CHECKLIST_EXECUTION.md | How to complete each master checklist task. | [ ] |
| 29 | docs/active/BACKEND_ALIGNMENT_CHECKLIST.md | Backend alignment checklist. | [ ] |
| 30 | docs/active/BACKEND_ALIGNMENT_SOURCES.md | Sources for alignment. | [ ] |
| 31 | docs/active/PROD_TEST_SCHEMA_REFERENCE.md | Prod vs test schema reference. | [ ] |
| 32 | docs/active/MIGRATIONS_ANALYSIS_VS_MASTER.md | Migration analysis vs master file. | [ ] |
| 33 | docs/active/CONSOLIDATION_GUIDE.md | Which docs were combined and how. | [ ] |
| 34 | docs/active/FOUNDER_REFERENCE_CANDIDATES.md | List of systems to document in founder style. | [ ] |
| 35 | docs/active/CONTRIBUTING.md | Contribution guidelines. | [ ] |
| 36 | docs/active/AI_ONBOARDING_BUNDLE.md | AI onboarding bundle. | [ ] |
| 36a | docs/active/SYSTEM_INVENTORY_EVIDENCE.md | Pre-audit inventory (routes, services, schema). *Referenced in README; file may not exist.* | [ ] |
| 36b | docs/active/EVIDENCE_MAP_AUDIT.md | Evidence map (where to check, fix). *Referenced in README; file may not exist.* | [ ] |

---

## 2. 00-CRITICAL (docs/active/00-CRITICAL/)

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 37 | docs/active/00-CRITICAL/ERROR_RECOVERY_CIRCUIT_BREAKERS.md | Error recovery and circuit breakers. | [ ] |
| 38 | docs/active/00-CRITICAL/MONITORING_SETUP.md | Monitoring setup. | [ ] |
| 39 | docs/active/00-CRITICAL/PHASE_0_1_STATUS.md | Phase 0.1 status. | [ ] |
| 40 | docs/active/00-CRITICAL/PHASE_1_USER_RUNBOOK.md | Phase 1 user runbook. | [ ] |
| 41 | docs/active/00-CRITICAL/PHASE_2_STATUS.md | Phase 2 status. | [ ] |
| 42 | docs/active/00-CRITICAL/PHASE_3_STATUS.md | Phase 3 status. | [ ] |
| 43 | docs/active/00-CRITICAL/PHASE_4_STATUS.md | Phase 4 status. | [ ] |
| 44 | docs/active/00-CRITICAL/PHASE_5_STATUS.md | Phase 5 status. | [ ] |
| 45 | docs/active/00-CRITICAL/PHASE_6_STATUS.md | Phase 6 status. | [ ] |
| 46 | docs/active/00-CRITICAL/PHASE_7_STATUS.md | Phase 7 status. | [ ] |
| 47 | docs/active/00-CRITICAL/PHASE_8_STATUS.md | Phase 8 status. | [ ] |
| 48 | docs/active/00-CRITICAL/PHASE_9_STATUS.md | Phase 9 status. | [ ] |
| 49 | docs/active/00-CRITICAL/PHASE_10_STATUS.md | Phase 10 status. | [ ] |
| 50 | docs/active/00-CRITICAL/PHASE_11_STATUS.md | Phase 11 status. | [ ] |
| 51 | docs/active/00-CRITICAL/PHASE_12_STATUS.md | Phase 12 status. | [ ] |
| 52 | docs/active/00-CRITICAL/PHASE_13_STATUS.md | Phase 13 status. | [ ] |
| 53 | docs/active/00-CRITICAL/PHASE_14_STATUS.md | Phase 14 status. | [ ] |
| 54 | docs/active/00-CRITICAL/PRODUCTION_READINESS_ROADMAP.md | Production readiness roadmap. | [ ] |
| 55 | docs/active/00-CRITICAL/SECRET_INVENTORY_TEMPLATE.md | Secret inventory template. | [ ] |
| 56 | docs/active/00-CRITICAL/SECURITY_AUDIT_SUMMARY.md | Security audit summary. | [ ] |
| 57 | docs/active/00-CRITICAL/SECURITY_GUARDRAILS.md | Security guardrails. | [ ] |
| 58 | docs/active/00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md | Security incident response. | [ ] |

---

## 3. 01-HIGH (docs/active/01-HIGH/)

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 59 | docs/active/01-HIGH/DATABASE_RECOVERY.md | Database recovery procedures. | [ ] |
| 60 | docs/active/01-HIGH/GDPR_COMPLIANCE.md | GDPR compliance. | [ ] |
| 61 | docs/active/01-HIGH/RATE_LIMITING.md | Rate limiting. | [ ] |

---

## 4. 02-MEDIUM (docs/active/02-MEDIUM/)

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 62 | docs/active/02-MEDIUM/ADDRESS_REMAINING_GAPS.md | Address remaining gaps. | [ ] |
| 63 | docs/active/02-MEDIUM/ARCHITECTURE.md | Architecture (medium-priority view). | [ ] |
| 64 | docs/active/02-MEDIUM/COMPREHENSIVE_GAP_ANALYSIS.md | Comprehensive gap analysis. | [ ] |
| 65 | docs/active/02-MEDIUM/CRON_JOBS_AND_NOTIFICATIONS.md | Cron jobs and notifications. | [ ] |
| 66 | docs/active/02-MEDIUM/GAP_COMPLETION_ROADMAP.md | Gap completion roadmap. | [ ] |
| 67 | docs/active/02-MEDIUM/N8N_EVENT_ROUTER.md | n8n event router. | [ ] |
| 68 | docs/active/02-MEDIUM/PERFORMANCE_TESTING.md | Performance testing. | [ ] |
| 69 | docs/active/02-MEDIUM/REMAINING_ISSUES_STEPS.md | Remaining issues and steps. | [ ] |
| 70 | docs/active/02-MEDIUM/WORKER_HARDENING.md | Worker hardening. | [ ] |

---

## 5. 03-LOW (docs/active/03-LOW/)

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 71 | docs/active/03-LOW/CLEANUP_SUMMARY.md | Cleanup summary. | [ ] |
| 72 | docs/active/03-LOW/CONTRIBUTING.md | Contributing (low-priority copy). | [ ] |
| 73 | docs/active/03-LOW/README.md | 03-LOW folder readme. | [ ] |
| 74 | docs/active/03-LOW/SERVER_STARTUP_ANALYSIS.md | Server startup analysis. | [ ] |

---

## 6. founder/ (docs/active/founder/)

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 75 | docs/active/founder/FOUNDER_ADMIN_DASHBOARD.md | Admin dashboard deep dive. | [ ] |
| 76 | docs/active/founder/FOUNDER_AI_ASSISTANT.md | AI assistant deep dive. | [ ] |
| 77 | docs/active/founder/FOUNDER_AUTH.md | Auth deep dive. | [ ] |
| 78 | docs/active/founder/FOUNDER_BACKGROUND_CHECK.md | Background check deep dive. | [ ] |
| 79 | docs/active/founder/FOUNDER_CALENDAR_AVAILABILITY.md | Calendar/availability deep dive. | [ ] |
| 80 | docs/active/founder/FOUNDER_CIRCUIT_BREAKER_RETRY.md | Circuit breaker and retry deep dive. | [ ] |
| 81 | docs/active/founder/FOUNDER_CLEANER_ONBOARDING.md | Cleaner onboarding deep dive. | [ ] |
| 82 | docs/active/founder/FOUNDER_CREDIT_ECONOMY.md | Credit economy deep dive. | [ ] |
| 83 | docs/active/founder/FOUNDER_DISPUTES.md | Disputes deep dive. | [ ] |
| 84 | docs/active/founder/FOUNDER_EVENTS.md | Events deep dive. | [ ] |
| 85 | docs/active/founder/FOUNDER_FILE_UPLOAD.md | File upload deep dive. | [ ] |
| 86 | docs/active/founder/FOUNDER_GAMIFICATION.md | Gamification deep dive. | [ ] |
| 87 | docs/active/founder/FOUNDER_GDPR.md | GDPR deep dive. | [ ] |
| 88 | docs/active/founder/FOUNDER_GRACEFUL_SHUTDOWN.md | Graceful shutdown deep dive. | [ ] |
| 89 | docs/active/founder/FOUNDER_HOLIDAYS.md | Holidays deep dive. | [ ] |
| 90 | docs/active/founder/FOUNDER_IDEMPOTENCY.md | Idempotency deep dive. | [ ] |
| 91 | docs/active/founder/FOUNDER_JOB_EVENTS_FLOW.md | Job events flow deep dive. | [ ] |
| 92 | docs/active/founder/FOUNDER_MANAGER_DASHBOARD.md | Manager dashboard deep dive. | [ ] |
| 93 | docs/active/founder/FOUNDER_MCP_SERVERS.md | MCP servers deep dive. | [ ] |
| 94 | docs/active/founder/FOUNDER_MESSAGE_HISTORY.md | Message history deep dive. | [ ] |
| 95 | docs/active/founder/FOUNDER_METRICS.md | Metrics deep dive. | [ ] |
| 96 | docs/active/founder/FOUNDER_N8N_CLIENT.md | n8n client deep dive. | [ ] |
| 97 | docs/active/founder/FOUNDER_NOTIFICATIONS.md | Notifications deep dive. | [ ] |
| 98 | docs/active/founder/FOUNDER_PAYMENT_FLOW.md | Payment flow deep dive. | [ ] |
| 99 | docs/active/founder/FOUNDER_PAYOUT_FLOW.md | Payout flow deep dive. | [ ] |
| 100 | docs/active/founder/FOUNDER_PHOTO_PROOF.md | Photo proof deep dive. | [ ] |
| 101 | docs/active/founder/FOUNDER_PRICING.md | Pricing deep dive. | [ ] |
| 102 | docs/active/founder/FOUNDER_QUEUE.md | Queue deep dive. | [ ] |
| 103 | docs/active/founder/FOUNDER_RATE_LIMITING.md | Rate limiting deep dive. | [ ] |
| 104 | docs/active/founder/FOUNDER_RECONCILIATION.md | Reconciliation deep dive. | [ ] |
| 105 | docs/active/founder/FOUNDER_REFERRALS.md | Referrals deep dive. | [ ] |
| 106 | docs/active/founder/FOUNDER_REQUEST_CONTEXT.md | Request context deep dive. | [ ] |
| 107 | docs/active/founder/FOUNDER_SENTRY.md | Sentry deep dive. | [ ] |
| 108 | docs/active/founder/FOUNDER_STRIPE_WRAPPER.md | Stripe wrapper deep dive. | [ ] |
| 109 | docs/active/founder/FOUNDER_SUBSCRIPTIONS.md | Subscriptions deep dive. | [ ] |
| 110 | docs/active/founder/FOUNDER_TRACKING.md | Tracking deep dive. | [ ] |
| 111 | docs/active/founder/FOUNDER_URL_BUILDER.md | URL builder deep dive. | [ ] |
| 112 | docs/active/founder/FOUNDER_WEBHOOKS.md | Webhooks deep dive. | [ ] |

---

## 7. gamification_bundle (docs/active/gamification_bundle/)

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 113 | docs/active/gamification_bundle/README.md | Gamification bundle overview; canonical spec. | [ ] |
| 114 | docs/active/gamification_bundle/docs/admin_ui_wireframe_spec.md | Admin UI wireframe spec for gamification. | [ ] |
| 115 | docs/active/gamification_bundle/docs/BUNDLE_README.md | Bundle readme. | [ ] |
| 116 | docs/active/gamification_bundle/docs/CURSOR_PROMPTS.md | Cursor prompts for gamification. | [ ] |
| 117 | docs/active/gamification_bundle/docs/event_contract_v1.md | Event contract v1 (canonical event types). | [ ] |
| 118 | docs/active/gamification_bundle/docs/metrics_contract_test_checklist_v1.md | Metrics contract test checklist v1. | [ ] |
| 119 | docs/active/gamification_bundle/docs/metrics_contract_v1.md | Metrics contract v1. | [ ] |
| 120 | docs/active/gamification_bundle/docs/MIGRATION_RUN_ORDER.md | Migration run order for bundle. | [ ] |
| 121 | docs/active/gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md | PureTask gamification cursor context (lead doc). | [ ] |
| 122 | docs/active/gamification_bundle/docs/README.md | Bundle docs readme. | [ ] |
| 123 | docs/active/gamification_bundle/docs/reward_meanings_and_fairness.md | Reward meanings and fairness. | [ ] |
| 124 | docs/active/gamification_bundle/docs/runtime_config_loading.md | Runtime config loading. | [ ] |
| 125 | docs/active/gamification_bundle/docs/spec_enforcement_matrix_v1.md | Spec enforcement matrix v1. | [ ] |

---

## 8. legal (docs/active/legal/)

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 126 | docs/active/legal/README.md | Legal docs index. | [ ] |
| 127 | docs/active/legal/AB5_ANALYSIS.md | AB5 (contractor/employee) analysis. | [ ] |
| 128 | docs/active/legal/CLEANER_AGREEMENT.md | Cleaner agreement. | [ ] |
| 129 | docs/active/legal/COUNSEL_REVIEW_RATIONALE.md | Counsel review rationale. | [ ] |
| 130 | docs/active/legal/IC_SAFEGUARDS_APPENDIX.md | In-app copy safeguards appendix. | [ ] |
| 131 | docs/active/legal/IN_APP_COPY_CLIENT.md | In-app copy for clients. | [ ] |
| 132 | docs/active/legal/IN_APP_COPY_CLEANER.md | In-app copy for cleaners. | [ ] |
| 133 | docs/active/legal/PRIVACY_POLICY.md | Privacy policy. | [ ] |
| 134 | docs/active/legal/TOS_CONSOLIDATED.md | Terms of service (consolidated). | [ ] |

---

## 9. DB/migrations and docs/versions (outside docs/active)

| # | Path | Purpose / What the doc says to do | Review status |
|---|------|-----------------------------------|---------------|
| 135 | DB/migrations/README.md | Which migrations to run (fresh vs existing); quick start; common issues. | [ ] |
| 136 | DB/migrations/archive/README.md | Archive of migrations. | [ ] |
| 137 | DB/migrations/archive/README_CONSOLIDATED_SCHEMAS.md | Consolidated schemas archive. | [ ] |
| 138 | DB/migrations/README_CONSOLIDATED_SCHEMAS.md | Consolidated schemas (root). | [ ] |
| 139 | DB/migrations/bundle_reference/README.md | Bundle reference migrations. | [ ] |
| 140 | docs/versions/MASTER_CHECKLIST.md | Master checklist (versioned). | [ ] |
| 141 | docs/versions/PRIORITIZED_BACKLOG.md | Prioritized backlog (versioned). | [ ] |

---

## Summary

| Section | Count |
|---------|-------|
| Root docs (incl. this inventory + 2 README-refs) | 39 |
| 00-CRITICAL | 22 |
| 01-HIGH | 3 |
| 02-MEDIUM | 9 |
| 03-LOW | 4 |
| founder/ | 38 |
| gamification_bundle/ | 13 |
| legal/ | 9 |
| DB/migrations + docs/versions | 7 |
| **Total** | **144** |

Use **Review status** to mark: ✅ Done, 🟡 Partial, ❌ Not done, or N/A. When a doc says "do X" or "verify Y", complete that and then tick the row.
