# What to Give an AI So It Knows Everything About PureTask

**Purpose:** Checklist of docs and code to attach or point an AI at so it has full context on the PureTask backend. Use when starting a new chat, onboarding a new agent, or working in a separate repo that calls the API.

---

## 1. Start here (minimum for any task)

Give these first so the AI knows structure, conventions, and where to look.

| Item | Path | Why |
|------|------|-----|
| Doc index | `docs/active/README.md` | Entry point; points to setup, architecture, ops, reference |
| Setup | `docs/active/SETUP.md` | Env, DB, run, test; how to run locally |
| Architecture | `docs/active/ARCHITECTURE.md` | Stack, layering, key flows, Trust API, gamification pointers |
| Documentation rules | `.cursor/rules/documentation.mdc` | Where docs live (active/archive only), where to append new info |

**Convention:** All canonical docs live under `docs/active/`. Do not create new `.md` outside `docs/active/` or `docs/archive/`. Append to SETUP, ARCHITECTURE, RUNBOOK, etc., per that rule.

---

## 2. Domain and alignment (jobs, credits, payments)

For work on jobs, status, credits, ledger, or payments, add:

| Item | Path | Why |
|------|------|-----|
| Backend alignment checklist | `docs/active/BACKEND_ALIGNMENT_CHECKLIST.md` | Job status enum, transitions, ledger schema, payments routes, verdict |
| Backend alignment sources | `docs/active/BACKEND_ALIGNMENT_SOURCES.md` | Paste-ready snippets; exact file/table/route refs |
| Job state machine | `src/state/jobStateMachine.ts` | Allowed transitions, event types, role permissions |
| Job status constants | `src/constants/jobStatus.ts` | Canonical statuses and events (JSON-safe for frontend/n8n) |
| DB types (core) | `src/types/db.ts` | JobStatus, CreditReason, Job, CreditLedgerEntry, PaymentIntent, Payout, Dispute, JobEvent, etc. |
| Data model reference | `docs/active/DATA_MODEL_REFERENCE.md` | DB schemas (enums, users, jobs, credit_ledger), TS types, API shapes |

---

## 3. Decisions and ops

So the AI respects existing choices and knows how to deploy/debug:

| Item | Path | Why |
|------|------|-----|
| Decisions | `docs/active/DECISIONS.md` | Architectural and product decisions (Neon, Railway, n8n, layering, idempotency, etc.) |
| Runbook | `docs/active/RUNBOOK.md` | Ops commands, health checks, incident playbooks, gamification support |
| Troubleshooting | `docs/active/TROUBLESHOOTING.md` | Known issues and fixes |
| Deployment | `docs/active/DEPLOYMENT.md` | Railway, production, rollback |

---

## 4. Code entry points (when changing behavior)

| Item | Path | Why |
|------|------|-----|
| App entry / route mount | `src/index.ts` | How routes are mounted (/payments, /credits, /stripe, /jobs, /tracking, /api/v1, webhooks) |
| DB client | `src/db/client.ts` | query, withTransaction, pool — no Prisma |
| Auth (canonical) | `src/middleware/authCanonical.ts` | requireAuth, requireRole, requireAdmin |
| Validation | `src/lib/validation.ts` | validateBody, validateQuery, validateParams (Zod) |
| Jobs service | `src/services/jobsService.ts` | createJob, getJob, applyStatusTransition (state machine path) |
| Job tracking service | `src/services/jobTrackingService.ts` | checkIn, checkOut, approveJob, disputeJob (tracking path; direct status updates) |
| Credits service | `src/services/creditsService.ts` | getUserBalance, addLedgerEntry, escrowJobCredits, releaseJobCreditsToCleaner, refundJobCreditsToClient |
| Payment service | `src/services/paymentService.ts` | createWalletTopupIntent, createJobPaymentIntent, handleStripeEvent |
| Events | `src/lib/events.ts` | publishEvent → job_events + n8n |
| Idempotency | `src/lib/idempotency.ts` | Idempotency-Key header, idempotency_keys table |

---

## 5. API and frontend contract

| Item | Path | Why |
|------|------|-----|
| Backend endpoints | `docs/active/BACKEND_ENDPOINTS.md` | Endpoint list and grouping |
| Backend UI spec | `docs/active/BACKEND_UI_SPEC.md` | What screens to build, what data/actions/states from API |
| API reference | `docs/active/API_REFERENCE.md` | Swagger/OpenAPI, endpoint list |
| Frontend job status config | `docs/active/FRONTEND_JOB_STATUS_CONFIG.md` | Frontend alignment with job status/events |

---

## 6. Deep dives (by topic)

When the AI needs depth on one system, point it at the founder doc for that topic. Index:

| Topic | Doc |
|-------|-----|
| Index | `docs/active/FOUNDER_BACKEND_REFERENCE.md` |
| Auth | `docs/active/founder/FOUNDER_AUTH.md` |
| Credit economy | `docs/active/founder/FOUNDER_CREDIT_ECONOMY.md` |
| Idempotency | `docs/active/founder/FOUNDER_IDEMPOTENCY.md` |
| Payment flow | `docs/active/founder/FOUNDER_PAYMENT_FLOW.md` |
| Payout flow | `docs/active/founder/FOUNDER_PAYOUT_FLOW.md` |
| Job events flow | `docs/active/founder/FOUNDER_JOB_EVENTS_FLOW.md` |
| Events (pub/sub) | `docs/active/founder/FOUNDER_EVENTS.md` |
| Tracking | `docs/active/founder/FOUNDER_TRACKING.md` |
| Disputes | `docs/active/founder/FOUNDER_DISPUTES.md` |
| Webhooks | `docs/active/founder/FOUNDER_WEBHOOKS.md` |
| n8n client | `docs/active/founder/FOUNDER_N8N_CLIENT.md` |
| Notifications | `docs/active/founder/FOUNDER_NOTIFICATIONS.md` |
| Gamification | `docs/active/founder/FOUNDER_GAMIFICATION.md` |
| (Full list) | See FOUNDER_BACKEND_REFERENCE.md |

---

## 7. Gamification (when working on levels, goals, rewards)

| Item | Path | Why |
|------|------|-----|
| Bundle index | `docs/active/gamification_bundle/README.md` | Entry to gamification bundle |
| Cursor context (lead) | `docs/active/gamification_bundle/docs/PURETASK_GAMIFICATION_CURSOR_CONTEXT.md` | Canonical spec for rules and constants |
| Event contract | `docs/active/gamification_bundle/docs/event_contract_v1.md` | Event stream and payloads |
| Metrics contract | `docs/active/gamification_bundle/docs/metrics_contract_v1.md` | Metrics and evaluation |
| Spec enforcement | `docs/active/gamification_bundle/docs/spec_enforcement_matrix_v1.md` | Enforcement checklist |
| ARCHITECTURE §3 | `docs/active/ARCHITECTURE.md` (sections 3, 3.1–3.4) | Code/schema paths, reward effects, admin control plane |

---

## 8. Schema and migrations

| Item | Path | Why |
|------|------|-----|
| Master migration | `DB/migrations/000_MASTER_MIGRATION.sql` | Single consolidated schema (jobs, job_events, credit_ledger, payment_intents, payouts, idempotency_keys, stripe_events_processed, etc.) |
| Migrations readme | `DB/migrations/README.md` | How migrations are run and what lives where |

---

## 9. Suggested “paste order” when context is limited

If you can only attach a few things, use this order:

1. **docs/active/README.md** — so it knows the doc map  
2. **docs/active/ARCHITECTURE.md** — stack, layers, flows  
3. **docs/active/BACKEND_ALIGNMENT_CHECKLIST.md** + **BACKEND_ALIGNMENT_SOURCES.md** — job/credits/payments truth  
4. **src/types/db.ts** (or at least the type names and enums) — domain types  
5. **src/state/jobStateMachine.ts** + **src/constants/jobStatus.ts** — status and transitions  
6. **.cursor/rules/documentation.mdc** — doc rules  

Then add by task: founder docs for that topic, RUNBOOK/DEPLOYMENT for ops, DATA_MODEL_REFERENCE for schema detail, index.ts for routes.

---

## 10. What *not* to rely on

- **Old or duplicate docs** — Prefer `docs/active/`. Do not use stray `.md` in repo root or old paths unless archived.
- **Prisma** — There is no Prisma; the app uses raw SQL and `src/db/client.ts`.
- **booking_id** — Canonical entity is **job_id** (one job = one booking). No separate booking_id in schema.
- **Status/events** — Use the 8 statuses and 10 event types from `jobStateMachine.ts` / `jobStatus.ts`; tracking uses dot-notation event names (e.g. job.approved) in job_events but canonical names are client_approved, etc.

---

**Summary:** Give an AI the **README + ARCHITECTURE + alignment docs + db types + state machine + documentation rule** first. Then add **founder docs**, **RUNBOOK/DEPLOYMENT**, **DATA_MODEL_REFERENCE**, and **index.ts** (and other code) by task. For gamification, add the **gamification_bundle** lead doc and contracts. This bundle is enough for the AI to know everything about PureTask that the codebase and canonical docs define.
