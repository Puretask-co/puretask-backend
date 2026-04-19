# PureTask System Build Status Matrix (Granular)

Purpose: one-row-per-document execution matrix for system ownership, implementation status, and next actions.

Legend (Current implementation status):

- Built = implemented and operationally documented
- In progress = partially implemented or partially enforced
- Planned = documented intent with incomplete or unverified implementation

Priority scale:

- P0 = immediate risk / blocker
- P1 = high leverage near-term completion
- P2 = important but not blocking
- P3 = reference / maintenance

Last reviewed: 2026-03-04

---

| Document | System | What it controls | Current implementation status | Evidence path | Owner | Priority | Next action |
|---|---|---|---|---|---|---|---|
| `docs/active/README.md` | Documentation governance | Canonical entry routing and doc priority | Built | `docs/active/README.md` | Eng Platform | P1 | Keep rankings synced with active usage |
| `docs/active/SETUP.md` | Developer experience | Local setup, env bootstrap, dev run/test flow | Built | `docs/active/SETUP.md` | Backend | P1 | Add final environment matrix cross-check |
| `docs/active/ARCHITECTURE.md` | Core architecture | Layering, auth model, system topology | In progress | `docs/active/ARCHITECTURE.md` | Backend | P0 | Close remaining route->service extraction items |
| `docs/active/RUNBOOK.md` | Operations | Deploy, rollback, incidents, worker mode, kill switches | Built | `docs/active/RUNBOOK.md` | Ops + Backend | P0 | Execute production validation checklist and record outcomes |
| `docs/active/DEPLOYMENT.md` | Production delivery | Deployment commands, process model, migration handling | Built | `docs/active/DEPLOYMENT.md` | Ops + Backend | P0 | Finalize real prod env + post-deploy checks |
| `docs/active/TROUBLESHOOTING.md` | Support/incident response | Known issue diagnosis and fixes | Built | `docs/active/TROUBLESHOOTING.md` | Ops Support | P1 | Add newly discovered warning patterns |
| `docs/active/DECISIONS.md` | Architectural governance | Why key decisions were made | In progress | `docs/active/DECISIONS.md` | Tech Lead | P1 | Log final gamification-path decision |
| `docs/active/PROJECT_ISSUES_AND_REMEDIATION.md` | Remediation program | Open issues and concrete fixes | In progress | `docs/active/PROJECT_ISSUES_AND_REMEDIATION.md` | Backend | P0 | Update after each route extraction batch |
| `docs/active/MASTER_CHECKLIST.md` | Program governance | Sections 1-14 status, closure criteria | In progress | `docs/active/MASTER_CHECKLIST.md` | Tech Lead | P0 | Flip remaining in-progress items to complete with proof |
| `docs/active/MASTER_CHECKLIST_EXECUTION.md` | Delivery sequencing | How to execute checklist tasks | Built | `docs/active/MASTER_CHECKLIST_EXECUTION.md` | Tech Lead | P1 | Add latest execution ordering notes |
| `docs/active/DOCUMENT_INVENTORY_FULL_REVIEW.md` | Documentation audit | Full inventory and review tracking | In progress | `docs/active/DOCUMENT_INVENTORY_FULL_REVIEW.md` | Eng Platform | P1 | Mark reviewed/unreviewed rows explicitly |
| `docs/active/SYSTEM_BUILD_STATUS_AND_DOC_BREAKDOWN.md` | System status synthesis | Narrative of built/in-progress/not-started by domain | Built | `docs/active/SYSTEM_BUILD_STATUS_AND_DOC_BREAKDOWN.md` | Tech Lead | P1 | Keep synced with this matrix |
| `docs/active/BACKEND_ENDPOINTS.md` | API contract | Canonical endpoint inventory | In progress | `docs/active/BACKEND_ENDPOINTS.md` | Backend API | P1 | Reconcile with latest route refactors |
| `docs/active/API_REFERENCE.md` | API specification | Request/response reference and API behavior | In progress | `docs/active/API_REFERENCE.md` | Backend API | P1 | Refresh for auth and route-layer updates |
| `docs/active/BACKEND_UI_SPEC.md` | Frontend-backend contract | UI data/actions/states expected by backend | Planned | `docs/active/BACKEND_UI_SPEC.md` | Backend + Frontend | P2 | Re-validate against live endpoints |
| `docs/active/DATA_MODEL_REFERENCE.md` | Data architecture | Schema model and table intent | In progress | `docs/active/DATA_MODEL_REFERENCE.md` | DB Owner | P1 | Align with latest migration decisions |
| `docs/active/MASTER_MIGRATIONS.md` | DB change governance | Canonical migration order/path | Built | `docs/active/MASTER_MIGRATIONS.md` | DB Owner | P0 | Verify order remains consistent with deployment doc |
| `DB/migrations/README.md` | DB operations | Fresh vs incremental vs patch run paths | Built | `DB/migrations/README.md` | DB Owner | P0 | Keep decision tree current with new migrations |
| `docs/active/BACKUP_RESTORE.md` | Data resilience | Backup and restore procedures | Built | `docs/active/BACKUP_RESTORE.md` | Ops | P1 | Run/record next restore drill evidence |
| `docs/active/CI_CD_SETUP.md` | Delivery automation | CI/CD setup and guardrails | In progress | `docs/active/CI_CD_SETUP.md` | Platform | P1 | Add route-lint baseline retirement plan |
| `docs/active/AUDIT_TICKETS.md` | Quality/risk | Ticketized audit findings | In progress | `docs/active/AUDIT_TICKETS.md` | Backend | P1 | Close resolved tickets and prune stale |
| `docs/active/PR_AUDIT_RUBRIC.md` | Code review governance | PR review risk rubric | Built | `docs/active/PR_AUDIT_RUBRIC.md` | Tech Lead | P2 | Add checks for route-layer policy |
| `docs/active/SYSTEM_AUDIT_CHECKLIST.md` | Audit operations | Full-system verification checklist | In progress | `docs/active/SYSTEM_AUDIT_CHECKLIST.md` | Tech Lead | P1 | Re-run audit after route extraction wave |
| `docs/active/BACKEND_QA.md` | QA operations | Build/test verification and QA flow | In progress | `docs/active/BACKEND_QA.md` | QA + Backend | P1 | Expand with no-skip enforcement evidence |
| `docs/active/NOTIFICATIONS.md` | Messaging system | Notification architecture and channel behavior | In progress | `docs/active/NOTIFICATIONS.md` | Backend | P2 | Update with service extraction completion |
| `docs/active/GAMIFICATION_BACKEND_SPEC.md` | Gamification core | Backend gamification rules and behavior | In progress | `docs/active/GAMIFICATION_BACKEND_SPEC.md` | Gamification Team | P0 | Reconcile with active runtime path decision |
| `docs/active/GAMIFICATION_FRONTEND_BACKEND_SPEC.md` | Gamification integration | Client/backend contract for gamification | In progress | `docs/active/GAMIFICATION_FRONTEND_BACKEND_SPEC.md` | Backend + Frontend | P1 | Validate every endpoint/field against current API |
| `docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md` | Gamification delivery | Stepwise implementation guidance | In progress | `docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md` | Gamification Team | P1 | Mark completed steps and remaining deltas |
| `docs/active/GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md` | Gamification integration | Bundle insertion and integration sequencing | In progress | `docs/active/GAMIFICATION_BUNDLE_INTEGRATION_GUIDE.md` | Gamification Team | P1 | Update for current production-safe path |
| `docs/active/AI_ONBOARDING_BUNDLE.md` | AI assistant enablement | AI onboarding context for engineering | Planned | `docs/active/AI_ONBOARDING_BUNDLE.md` | AI/Backend | P2 | Add live status and endpoint validation table |
| `docs/active/FOUNDER_BACKEND_REFERENCE.md` | Founder architecture index | Index to founder deep dives | Built | `docs/active/FOUNDER_BACKEND_REFERENCE.md` | Tech Lead | P1 | Keep links and topic summaries aligned |
| `docs/active/FOUNDER_REFERENCE_CANDIDATES.md` | Founder doc planning | Candidate topics and expansion priorities | In progress | `docs/active/FOUNDER_REFERENCE_CANDIDATES.md` | Tech Lead | P2 | Convert remaining candidates to finalized docs |
| `docs/active/CONSOLIDATION_GUIDE.md` | Doc lifecycle | Consolidation and archival policy | Built | `docs/active/CONSOLIDATION_GUIDE.md` | Eng Platform | P2 | Add latest consolidation actions |
| `docs/active/PROD_TEST_SCHEMA_REFERENCE.md` | Environment parity | Prod vs test schema comparison | In progress | `docs/active/PROD_TEST_SCHEMA_REFERENCE.md` | DB Owner | P1 | Re-verify after production patching |
| `docs/active/MIGRATIONS_ANALYSIS_VS_MASTER.md` | Migration integrity | Diff and analysis against master path | In progress | `docs/active/MIGRATIONS_ANALYSIS_VS_MASTER.md` | DB Owner | P1 | Recompute after migration additions |
| `docs/active/FRONTEND_JOB_STATUS_CONFIG.md` | Client state mapping | Frontend job status constants/config alignment | Built | `docs/active/FRONTEND_JOB_STATUS_CONFIG.md` | Frontend + Backend | P2 | Confirm no drift with job transition logic |
| `docs/active/BACKEND_ALIGNMENT_CHECKLIST.md` | Cross-team alignment | Backend alignment task list | In progress | `docs/active/BACKEND_ALIGNMENT_CHECKLIST.md` | Backend | P1 | Re-run checklist post refactors |
| `docs/active/BACKEND_ALIGNMENT_SOURCES.md` | Traceability | Source references for alignment decisions | Built | `docs/active/BACKEND_ALIGNMENT_SOURCES.md` | Backend | P2 | Add newly canonical docs |

## Founder docs matrix

| Document | System | What it controls | Current implementation status | Evidence path | Owner | Priority | Next action |
|---|---|---|---|---|---|---|---|
| `docs/active/founder/FOUNDER_AUTH.md` | Identity and access | Login/register/JWT/role authorization strategy | Built | `src/middleware/authCanonical.ts`, `docs/active/ARCHITECTURE.md` | Auth Owner | P0 | Remove any lingering legacy auth dependencies |
| `docs/active/founder/FOUNDER_PAYMENT_FLOW.md` | Payments | Payment intent and charge lifecycle | In progress | `src/routes/payments.ts`, `src/services/paymentService.ts` | Payments Owner | P0 | Verify all edge-case retries and docs parity |
| `docs/active/founder/FOUNDER_PAYOUT_FLOW.md` | Payouts | Cleaner payout lifecycle and safeguards | In progress | `src/services/payoutsService.ts`, `src/routes/admin/finance.ts` | Finance/Backend | P0 | Complete production payout runbook verification |
| `docs/active/founder/FOUNDER_WEBHOOKS.md` | Integrations | Incoming webhook verification and handling | Built | `src/routes/stripe.ts`, `webhook_events` migration/docs | Integrations Owner | P0 | Add operational replay drill evidence |
| `docs/active/founder/FOUNDER_STRIPE_WRAPPER.md` | Stripe integration | Stripe SDK abstraction and usage pattern | In progress | `src/lib/stripe*.ts`, `src/services/paymentService.ts` | Payments Owner | P1 | Standardize wrapper usage across all routes/services |
| `docs/active/founder/FOUNDER_IDEMPOTENCY.md` | Safety/reliability | Duplicate prevention for write operations | Built | `src/lib/idempotency.ts`, `idempotency_keys` docs | Backend Core | P0 | Extend idempotency coverage review to all mutation endpoints |
| `docs/active/founder/FOUNDER_QUEUE.md` | Background processing | Queue/durable jobs model | In progress | `src/workers/*`, `durable_jobs` docs/migrations | Backend Core | P1 | Validate dead-letter and retry operations in prod-like env |
| `docs/active/founder/FOUNDER_CIRCUIT_BREAKER_RETRY.md` | Resilience | Retry/backoff and circuit-breaker behavior | Planned | `docs/active/00-CRITICAL/ERROR_RECOVERY_CIRCUIT_BREAKERS.md` | Platform/Backend | P1 | Ensure concrete code references are fully documented |
| `docs/active/founder/FOUNDER_RECONCILIATION.md` | Financial controls | Reconciliation process for ledgers/payments | In progress | `src/routes/status.ts`, finance/admin services | Finance/Backend | P0 | Add recurring reconciliation checklist evidence |
| `docs/active/founder/FOUNDER_CREDIT_ECONOMY.md` | Credits ledger | Credit balances, escrow, adjustments | In progress | `src/services/creditsService.ts`, ledger migrations/docs | Payments Owner | P1 | Verify docs vs live ledger behaviors and edge cases |
| `docs/active/founder/FOUNDER_PRICING.md` | Pricing | Price and credit calculation strategy | In progress | `src/services/pricing*`, `docs/active/GAMIFICATION_*` | Product + Backend | P2 | Add explicit algorithm/version references |
| `docs/active/founder/FOUNDER_DISPUTES.md` | Trust/disputes | Dispute opening, review, and resolution | In progress | `src/routes/admin/disputes*`, `docs/active/RUNBOOK.md` | Trust Ops | P1 | Add unresolved edge-case matrix |
| `docs/active/founder/FOUNDER_GDPR.md` | Compliance | Data rights, export/delete, consent handling | Planned | `docs/active/legal/*.md`, related services | Legal + Backend | P1 | Add implementation verification checklist |
| `docs/active/founder/FOUNDER_EVENTS.md` | Event architecture | Domain event model and propagation | In progress | `src/lib/events*`, `src/routes/*` | Backend Core | P2 | Document event schema versioning decisions |
| `docs/active/founder/FOUNDER_JOB_EVENTS_FLOW.md` | Job lifecycle | Job status/event progression flow | In progress | `src/services/job*`, `src/routes/jobs.ts` | Backend Core | P0 | Finish route layering and update event map |
| `docs/active/founder/FOUNDER_TRACKING.md` | Job tracking | Clock-in/out and tracking process | In progress | `src/routes/tracking*`, tests and runbook references | Backend | P1 | Validate real-world telemetry edge cases |
| `docs/active/founder/FOUNDER_MESSAGE_HISTORY.md` | Messaging | Message persistence and retrieval behavior | In progress | `src/routes/message-history.ts`, messaging services | Backend | P1 | Extract remaining DB logic to service layer |
| `docs/active/founder/FOUNDER_NOTIFICATIONS.md` | Notifications | Notification dispatch model and channels | In progress | `src/routes/notifications.ts`, notification services | Backend | P1 | Complete route-layer extraction and update docs |
| `docs/active/founder/FOUNDER_RATE_LIMITING.md` | Security controls | Per-endpoint throttling and abuse prevention | Built | `src/lib/security.ts`, middleware usage | Security Owner | P1 | Add explicit endpoint class table |
| `docs/active/founder/FOUNDER_REQUEST_CONTEXT.md` | Observability | Request-scoped context and correlation | Built | `src/middleware/requestContextMiddleware.ts` | Backend Core | P2 | Add examples for cross-service propagation |
| `docs/active/founder/FOUNDER_SENTRY.md` | Monitoring | Error tracking and performance telemetry | Built | `src/instrument.ts`, `src/lib/sentry*` | Platform | P1 | Confirm prod DSN and alert routing |
| `docs/active/founder/FOUNDER_GRACEFUL_SHUTDOWN.md` | Runtime reliability | Process shutdown/drain semantics | Planned | server bootstrap and worker docs | Platform | P2 | Add explicit implementation hooks and tests |
| `docs/active/founder/FOUNDER_FILE_UPLOAD.md` | Storage/security | Upload handling, constraints, and safety | In progress | upload routes/services, security docs | Backend | P1 | Add MIME/size policy verification logs |
| `docs/active/founder/FOUNDER_PHOTO_PROOF.md` | Trust evidence | Before/after photo evidence semantics | In progress | gamification/tracking/disputes paths | Trust Ops + Backend | P1 | Add strict evidence rule matrix by flow |
| `docs/active/founder/FOUNDER_BACKGROUND_CHECK.md` | Provider trust | Background check process for cleaners | Planned | onboarding/admin docs and routes | Trust Ops | P2 | Link to active backend endpoints and statuses |
| `docs/active/founder/FOUNDER_CLEANER_ONBOARDING.md` | Onboarding | Cleaner onboarding progression and gating | In progress | `src/routes/cleanerOnboarding.ts`, tests | Onboarding Owner | P1 | Finish skipped test remediation for onboarding |
| `docs/active/founder/FOUNDER_CALENDAR_AVAILABILITY.md` | Scheduling | Availability windows and booking constraints | In progress | calendar/availability routes and services | Scheduling Owner | P2 | Add DST/holiday edge-case verification |
| `docs/active/founder/FOUNDER_HOLIDAYS.md` | Scheduling policy | Holiday rule effects on booking/availability | Planned | docs and scheduling config paths | Scheduling Owner | P3 | Add explicit code/config linkage |
| `docs/active/founder/FOUNDER_MANAGER_DASHBOARD.md` | Manager analytics | Manager dashboard metrics and controls | In progress | `src/routes/manager.ts`, related services | Ops Analytics | P1 | Validate role controls and metric parity |
| `docs/active/founder/FOUNDER_ADMIN_DASHBOARD.md` | Admin ops | Admin operational dashboard and controls | In progress | `src/routes/admin*.ts`, runbook | Ops Analytics | P1 | Complete remaining route service extraction |
| `docs/active/founder/FOUNDER_N8N_CLIENT.md` | Automation integration | n8n webhook/event integration model | In progress | `src/lib/n8nClient.ts`, status routes | Integrations Owner | P2 | Add production endpoint and retry evidence |
| `docs/active/founder/FOUNDER_MCP_SERVERS.md` | AI tooling integration | MCP server interaction model | Planned | MCP/tooling docs and workflows | AI Platform | P3 | Add project-specific active usage examples |
| `docs/active/founder/FOUNDER_SUBSCRIPTIONS.md` | Billing lifecycle | Subscription states and billing process | Planned | subscription routes/services/docs | Billing Owner | P2 | Add implementation truth table by state |
| `docs/active/founder/FOUNDER_REFERRALS.md` | Growth incentives | Referral tracking and incentive rules | Planned | referral-related docs/routes | Growth + Backend | P3 | Add current implementation status details |
| `docs/active/founder/FOUNDER_URL_BUILDER.md` | Routing hygiene | Role-correct URL generation behavior | Planned | frontend/backend URL helper references | Backend + Frontend | P3 | Add concrete utility references |
| `docs/active/founder/FOUNDER_GAMIFICATION.md` | Gamification domain | Founder-level gamification architecture | In progress | gamification docs/contracts/routes/services | Gamification Team | P0 | Finalize canonical runtime path decision |
| `docs/active/founder/FOUNDER_AI_ASSISTANT.md` | AI assistant domain | Founder-level AI assistant architecture | Planned | AI docs set and integration paths | AI/Backend | P2 | Add endpoint-by-endpoint implementation evidence |
| `docs/active/founder/FOUNDER_METRICS.md` | Observability/KPI | Metric strategy and monitoring model | In progress | status/analytics routes + runbook | Ops Analytics | P1 | Add KPI ownership and alert thresholds table |

## Gamification bundle docs matrix

| Document | System | What it controls | Current implementation status | Evidence path | Owner | Priority | Next action |
|---|---|---|---|---|---|---|---|
| `docs/active/gamification_bundle/README.md` | Gamification governance | Canonical bundle index and source-of-truth map | Built | `docs/active/gamification_bundle/README.md` | Gamification Team | P0 | Keep synced with real runtime architecture |
| `docs/active/gamification_bundle/docs/README.md` | Bundle orchestration | Bundle-step orientation and integration notes | In progress | `docs/active/gamification_bundle/docs/README.md` | Gamification Team | P1 | Update to current backend integration state |
| `docs/active/gamification_bundle/docs/BUNDLE_README.md` | Bundle package structure | Bundle artifact grouping and expectations | In progress | `docs/active/gamification_bundle/docs/BUNDLE_README.md` | Gamification Team | P2 | Add explicit references to active code paths |
| `docs/active/gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md` | Product rules | Locked product truths/constants and design intent | Built | `docs/active/gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md` | Product + Gamification | P0 | Keep constants aligned with contracts/config |
| `docs/active/gamification_bundle/docs/event_contract_v1.md` | Contract integrity | Event schema/types/source constraints | In progress | `src/config/cleanerLevels/contracts/event_contract_v1.json` | Gamification Team | P0 | Enforce strict mode in intended environments |
| `docs/active/gamification_bundle/docs/metrics_contract_v1.md` | Metric integrity | Metric keys and calculation semantics | In progress | `src/config/cleanerLevels/contracts/metrics_contract_v1.json` | Gamification Team | P0 | Validate all metric consumers against contract |
| `docs/active/gamification_bundle/docs/metrics_contract_test_checklist_v1.md` | QA | Contract compliance test criteria | In progress | gamification tests + verify scripts | QA + Gamification | P1 | Convert checklist items to automated tests |
| `docs/active/gamification_bundle/docs/spec_enforcement_matrix_v1.md` | Release governance | Spec->config->code->API->test enforcement gates | In progress | `docs/active/gamification_bundle/docs/spec_enforcement_matrix_v1.md` | Tech Lead + QA | P0 | Run full gate audit and mark pass/fail |
| `docs/active/gamification_bundle/docs/runtime_config_loading.md` | Runtime controls | Config loading, poll, rollback semantics | In progress | runtime loader/service references | Gamification Team | P0 | Verify rollback path in staging |
| `docs/active/gamification_bundle/docs/reward_meanings_and_fairness.md` | Product fairness | Meaning and fairness boundaries of rewards | Built | fairness doc + runbook support macros | Product + Trust | P1 | Add fairness KPI monitoring hooks |
| `docs/active/gamification_bundle/docs/admin_ui_wireframe_spec.md` | Admin control plane | Expected admin UI for tuning/governor/audit | Planned | admin routes + UI backlog references | Product + Admin Tools | P1 | Map each wireframe element to endpoint status |
| `docs/active/gamification_bundle/docs/MIGRATION_RUN_ORDER.md` | DB rollout | Bundle migration sequencing reference | Built | migration docs and deployment guidance | DB Owner | P1 | Confirm sequence vs canonical master path |
| `docs/active/gamification_bundle/docs/CURSOR_PROMPTS.md` | Delivery tooling | Prompting playbook for consistent implementation | Built | prompt doc itself | Eng Platform | P3 | Refresh prompt set for latest architecture |

## AI assistant docs matrix

| Document | System | What it controls | Current implementation status | Evidence path | Owner | Priority | Next action |
|---|---|---|---|---|---|---|---|
| `docs/active/AI_ONBOARDING_BUNDLE.md` | AI onboarding | In-repo AI onboarding context | Planned | `docs/active/AI_ONBOARDING_BUNDLE.md` | AI/Backend | P2 | Add active endpoint and workflow map |
| `docs/active/founder/FOUNDER_AI_ASSISTANT.md` | AI architecture | Founder-level assistant design and rationale | Planned | founder doc + ai-assistant docs | AI/Backend | P2 | Add implementation verification references |
| `docs/ai-assistant/AI_ASSISTANT_COMPLETE_GUIDE.md` | AI user/technical guide | End-to-end assistant usage and setup | Planned | `docs/ai-assistant/AI_ASSISTANT_COMPLETE_GUIDE.md` | AI/Backend | P2 | Reconcile with active canonical docs |
| `docs/ai-assistant/AI_ASSISTANT_SETUP_STATUS.md` | AI rollout tracking | Setup completeness and readiness checkpoints | In progress | `docs/ai-assistant/AI_ASSISTANT_SETUP_STATUS.md` | AI/Backend | P1 | Update with latest environment checks |
| `docs/ai-assistant/AI_ASSISTANT_VERIFICATION_REPORT.md` | AI validation | Verification results and test outcomes | In progress | `docs/ai-assistant/AI_ASSISTANT_VERIFICATION_REPORT.md` | QA + AI | P1 | Re-run and update pass/fail status |
| `docs/ai-assistant/AI_ASSISTANT_BEST_PRACTICES.md` | AI ops quality | Usage guardrails and quality recommendations | Built | `docs/ai-assistant/AI_ASSISTANT_BEST_PRACTICES.md` | AI/Backend | P2 | Add production incident learnings |
| `docs/ai-assistant/AI_ASSISTANT_READY_TO_USE.md` | AI readiness | Operational readiness claim | Planned | `docs/ai-assistant/AI_ASSISTANT_READY_TO_USE.md` | AI/Backend | P1 | Re-validate before asserting readiness |
| `docs/ai-assistant/AI_ASSISTANT_LIVE_AND_WORKING.md` | AI live status | Live functionality confirmation | Planned | `docs/ai-assistant/AI_ASSISTANT_LIVE_AND_WORKING.md` | AI/Backend | P1 | Confirm against current deployed environment |
| `docs/ai-assistant/AI_ASSISTANT_COMPLETE_MIGRATION_SUMMARY.md` | AI migration closure | Migration completion summary | In progress | `docs/ai-assistant/AI_ASSISTANT_COMPLETE_MIGRATION_SUMMARY.md` | AI/Backend | P1 | Mark unresolved migration gaps explicitly |
| `docs/ai-assistant/USER_GUIDE_CLEANER_AI_ASSISTANT.md` | AI user operations | Cleaner-facing assistant usage | Planned | `docs/ai-assistant/USER_GUIDE_CLEANER_AI_ASSISTANT.md` | Product + AI | P2 | Validate UX steps against current app |
| `docs/ai-assistant/TEST_AI_ASSISTANT_PAGE.md` | AI test harness | Test page process and expected results | In progress | `docs/ai-assistant/TEST_AI_ASSISTANT_PAGE.md` | QA + AI | P2 | Automate test page checks where possible |

## Blueprint docs matrix

| Document | System | What it controls | Current implementation status | Evidence path | Owner | Priority | Next action |
|---|---|---|---|---|---|---|---|
| `docs/blueprint/PURETASK_FINAL_BLUEPRINT_OVERVIEW.md` | Strategic architecture | Final-form product/system doctrine and 12-engine model | Planned | `docs/blueprint/PURETASK_FINAL_BLUEPRINT_OVERVIEW.md` | Founder/CTO | P1 | Create engine-by-engine implementation scorecard |

## Runbooks and specs matrix

| Document | System | What it controls | Current implementation status | Evidence path | Owner | Priority | Next action |
|---|---|---|---|---|---|---|---|
| `docs/active/00-CRITICAL/PHASE_1_USER_RUNBOOK.md` | Security operations | Secret rotation and incident user-run steps | Built | `docs/active/00-CRITICAL/PHASE_1_USER_RUNBOOK.md` | Security + Ops | P0 | Complete/record if any secret exposure occurred |
| `docs/active/00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md` | Incident response | Security incident flow and actions | Built | `docs/active/00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md` | Security | P0 | Run tabletop drill and document results |
| `docs/active/00-CRITICAL/MONITORING_SETUP.md` | Observability operations | Monitoring and alert setup guidance | In progress | `docs/active/00-CRITICAL/MONITORING_SETUP.md` | Platform/Ops | P1 | Confirm all alerts are live and routed |
| `docs/active/00-CRITICAL/ERROR_RECOVERY_CIRCUIT_BREAKERS.md` | Failure recovery | Error recovery and circuit-breaker procedures | Planned | `docs/active/00-CRITICAL/ERROR_RECOVERY_CIRCUIT_BREAKERS.md` | Platform/Ops | P1 | Add runbook-to-code mapping |
| `docs/active/00-CRITICAL/PHASE_2_STATUS.md` | Auth program tracking | Auth hardening status evidence | In progress | `docs/active/00-CRITICAL/PHASE_2_STATUS.md` | Auth Owner | P1 | Refresh after any auth-related change |
| `docs/active/00-CRITICAL/PHASE_3_STATUS.md` | Guardrails tracking | CI/guardrail status evidence | In progress | `docs/active/00-CRITICAL/PHASE_3_STATUS.md` | Platform | P1 | Track lint baseline retirement progress |
| `docs/active/00-CRITICAL/PHASE_4_STATUS.md` | Stripe/webhooks tracking | Payments/webhooks hardening status | In progress | `docs/active/00-CRITICAL/PHASE_4_STATUS.md` | Payments Owner | P0 | Add latest webhook replay test results |
| `docs/active/00-CRITICAL/PHASE_5_STATUS.md` | DB tracking | Migration/schema hygiene status | In progress | `docs/active/00-CRITICAL/PHASE_5_STATUS.md` | DB Owner | P0 | Confirm production verification completion |
| `docs/active/00-CRITICAL/PHASE_6_STATUS.md` | Workers tracking | Worker/durable-job status and gaps | In progress | `docs/active/00-CRITICAL/PHASE_6_STATUS.md` | Backend Core | P1 | Attach dry-run and failure-recovery evidence |
| `docs/active/00-CRITICAL/PHASE_7_STATUS.md` | API tracking | API contract and safety status | In progress | `docs/active/00-CRITICAL/PHASE_7_STATUS.md` | Backend API | P1 | Reconcile with current endpoint behavior |
| `docs/active/00-CRITICAL/PHASE_8_STATUS.md` | Security tracking | Hardening status and security controls | In progress | `docs/active/00-CRITICAL/PHASE_8_STATUS.md` | Security | P1 | Re-run security checklist and update |
| `docs/active/00-CRITICAL/PHASE_9_STATUS.md` | Maintainability tracking | Layering/refactor quality status | In progress | `docs/active/00-CRITICAL/PHASE_9_STATUS.md` | Backend | P0 | Close remaining route->service gaps |
| `docs/active/00-CRITICAL/PHASE_10_STATUS.md` | Cost/scale tracking | Performance and cost controls status | In progress | `docs/active/00-CRITICAL/PHASE_10_STATUS.md` | Platform + Ops | P1 | Add current KPI baselines |
| `docs/active/00-CRITICAL/PHASE_11_STATUS.md` | Admin ops tracking | Admin support tooling status | In progress | `docs/active/00-CRITICAL/PHASE_11_STATUS.md` | Ops Tools | P1 | Update with unresolved admin feature gaps |
| `docs/active/00-CRITICAL/PHASE_12_STATUS.md` | Trust tracking | Trust/evidence/IC-safe status | In progress | `docs/active/00-CRITICAL/PHASE_12_STATUS.md` | Trust Ops | P1 | Add dispute-evidence outcome metrics |
| `docs/active/00-CRITICAL/PHASE_13_STATUS.md` | Legal tracking | Legal compliance artifact status | Built | `docs/active/00-CRITICAL/PHASE_13_STATUS.md` | Legal + Product | P1 | Confirm counsel sign-off timestamps |
| `docs/active/00-CRITICAL/PHASE_14_STATUS.md` | Launch readiness tracking | Launch gates, rollout readiness status | In progress | `docs/active/00-CRITICAL/PHASE_14_STATUS.md` | Ops + Tech Lead | P0 | Run final go-live checklist and evidence capture |
| `docs/active/GAMIFICATION_BACKEND_SPEC.md` | Spec | Gamification backend behavior contract | In progress | `docs/active/GAMIFICATION_BACKEND_SPEC.md` | Gamification Team | P0 | Reconcile with implemented routes/services |
| `docs/active/GAMIFICATION_FRONTEND_BACKEND_SPEC.md` | Spec | Gamification FE/BE interaction contract | In progress | `docs/active/GAMIFICATION_FRONTEND_BACKEND_SPEC.md` | Backend + Frontend | P1 | Validate endpoint payload contract line-by-line |
| `docs/active/BACKEND_UI_SPEC.md` | Spec | UI-facing backend behavior contract | Planned | `docs/active/BACKEND_UI_SPEC.md` | Backend + Frontend | P2 | Add implemented-vs-specified matrix |
| `docs/active/API_REFERENCE.md` | Spec | API requests/responses and endpoint reference | In progress | `docs/active/API_REFERENCE.md` | Backend API | P1 | Update for latest auth and route changes |

---

## Ownership defaults (when not explicitly assigned)

- Auth/Payments/Payouts/Credits: Backend domain owners
- Docs governance/checklists: Tech lead + platform
- Legal/trust docs: Legal + trust ops + backend partner
- AI assistant docs: AI/backend owner

## Execution note

Use this matrix as a living tracker. For each row, closure requires:

1) implementation evidence in code/tests,
2) status update in doc,
3) next action either completed or moved to a tracked backlog item.

