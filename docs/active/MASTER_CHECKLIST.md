# PureTask — Master Execution Checklist & Status

**Purpose:** Single source of truth for the PureTask hardening program: what’s done (design/policy), what’s left, and the execution checklist. Use this in Cursor to drive implementation.

---

## Critical Findings (Why This Exists)

From the ZIP/repo review:

1. **Secrets in repo** — .env with real credentials (Stripe, etc.) was present; if ever pushed or shared, treat as compromised. **→ Section 1.**
2. **Production auth breakage** — Multiple routes use legacy auth middleware that blocks in production; Stripe/payment routes can 401 in prod. **→ Section 2.**
3. **Stripe webhook raw body** — Signature verification can fail if body is mutated (e.g. `JSON.stringify(req.body)` on a Buffer). **→ Section 4.**

Additional risks addressed across sections: migration sprawl, duplicate webhook processing, no durable job model, auth drift, PII in logs, IC misclassification language, missing admin audit trail.

---

## Expert Evaluation Frameworks (Reference)

The program was designed using these lenses:

| # | Lens | Question |
|---|------|----------|
| 1 | Software Architecture | Is this built correctly at a system level? |
| 2 | Production Readiness / DevOps | Could this survive real users tomorrow? |
| 3 | Security & Trust | Where could this get you burned legally or financially? |
| 4 | Database & Data Modeling | Is the data model future-proof or fragile? |
| 5 | Product Logic & Marketplace | Does this actually solve the business problem? |
| 6 | AI / Automation Architecture | Is this ready for agents & automation? |
| 7 | Maintainability & Velocity | Will future-you hate this? |
| 8 | Cost & Efficiency | What will this cost at scale? |
| 9 | Founder / CTO Sanity Check | Is this the right thing to be building right now? |

**Lens → Section map (design traceability):**

| Lens | Primary sections |
|------|------------------|
| 1 — Software Architecture | 2, 5, 7 |
| 2 — Production Readiness / DevOps | 1, 3, 6 |
| 3 — Security & Trust | 1, 2, 4, 8 |
| 4 — Database & Data Modeling | 5 |
| 5 — Product Logic & Marketplace | 11, 12 |
| 6 — AI / Automation Architecture | 6 |
| 7 — Maintainability & Velocity | 9 |
| 8 — Cost & Efficiency | 10 |
| 9 — Founder / CTO Sanity Check | 13, 14 |

**Section dependencies (order / critical path):** 1 → 2; 1,2 → 3; 2,3 → 4; 4 → 5,6; 5,6 → 7,8; 7,8 → 9,10; 4,12 → 11; 11,12 → 13; 1–13 → 14. Do **not** parallelize money + auth (Sections 1, 2, 4).

---

## Status Overview: Accomplished vs Remaining

### Design & policy complete (implementation = checklist below)

| Section | Status | Outcome |
|---------|--------|---------|
| 1 — Secrets & Incident Response | ✅ COMPLETE (design) | Platform is no longer fragile or leaky. |
| 2 — Auth Consistency & Route Protection | ✅ COMPLETE (design) | No silent prod breakage, no auth drift. |
| 3 — Guardrails, CI & Repo Hygiene | ✅ COMPLETE (design) | Mistakes are structurally prevented. |
| 4 — Stripe, Webhooks & Integrations | ✅ COMPLETE (design) | Double charges & ghost payouts become impossible. |
| 5 — Database & Migration Hygiene | ✅ COMPLETE (design) | Data corruption risk massively reduced. |
| 6 — Workers, Crons & Background Jobs | ✅ COMPLETE (design) | System self-heals instead of silently failing. |
| 7 — API Contracts & Client Safety | ✅ COMPLETE (design) | Clients can integrate without surprises. |
| 8 — Security Hardening (Beyond Auth) | ✅ COMPLETE (design) | Strong baseline security posture. |
| 9 — Maintainability & Velocity | ✅ COMPLETE (design) | Ship fast without fear. |
| 10 — Cost, Scale & Performance | ✅ COMPLETE (design) | Growth won’t surprise or bankrupt you. |
| 11 — Admin Ops & Support | ✅ COMPLETE (design) + IC-AUDITED | You can actually run the marketplace. |
| 12 — Trust, Quality & Dispute Evidence | ✅ COMPLETE (design) + IC-SAFE | Disputes drop without misclassification risk. |

### Legal & IC classification (done as deliverables)

| Deliverable | Status |
|-------------|--------|
| Full TOS sections (IC, evidence, disputes, admin) | ✅ Written & merged. |
| Independent Contractor Safeguards appendix | ✅ Written. |
| California AB5 / ABC Test pass | ✅ Prongs A, B, C satisfied. |
| Lawyer review notes (why each clause) | ✅ Written. |
| In-app copy (cleaner + client) | ✅ Written. |
| Section 11 Admin IC-safety audit | ✅ Done. |
| Section 12 line-by-line IC-safe rewrite | ✅ Done. |

### Remaining (not yet done)

| Section | Status | Notes |
|---------|--------|------|
| 13 — Legal, Policy & Compliance | ⏳ NOT DONE | Full TOS consolidation, Privacy Policy, Cleaner Agreement, evidence retention, liability, legal review. |
| 14 — Launch Readiness & Rollout | ⏳ NOT DONE | Feature flags, staged rollout, kill switches, incident runbook, support training, launch KPIs. |
| **Implementation phase** | ⏳ NEXT | Code migrations, route refactors, CI setup, admin UI, workers, tests, dashboards — i.e. executing the checklists below. |

---

## Master Outline (Final, Locked)

Canonical order of the program:

1. Secrets & Incident Response  
2. Auth Consistency & Route Protection  
3. Guardrails, CI & Repo Hygiene  
4. Stripe, Webhooks & Integrations  
5. Database & Migration Hygiene  
6. Workers, Crons & Background Jobs  
7. API Design & Client Safety  
8. Security Hardening (Beyond Auth)  
9. Maintainability & Velocity  
10. Cost, Scale & Performance  
11. Admin Ops & Support Tooling  
12. Trust, Quality & Dispute Evidence (IC-Safe)  
13. Legal, Policy & Compliance  
14. Launch Readiness & Rollout  

---

## How to Use This Checklist

- Work **top to bottom**; complete **one section at a time**.  
- **Do not skip**; do not parallelize **money + auth** work.  
- Treat each `- [ ]` as a **PR or task**.  
- Once design is complete (Sections 1–12), the **next mode is implementation**: code changes, CI, tests, admin UI, workers — using the checklists below.

**Full execution plan (design → build → implement → test):** [HARDENING_EXECUTION_PLAN.md](./HARDENING_EXECUTION_PLAN.md) — phases 0–14 with dependencies, per-phase design/build/implement/test breakdown, global test strategy, done criteria, and appendices (file map, test matrix, risk mitigation).

---

## Section Runbooks (Detailed)

Full runbooks (objectives, exit conditions, **tables**, **step-by-step procedures**, and **provider runbooks**) live in separate docs under `docs/active/sections/`. Use them for implementation and incident response. Each section below also links to its runbook inline.

| Section | Outcome | Runbook |
|---------|---------|---------|
| 1 — Secrets & Incident Response | Platform is no longer fragile or leaky. | [SECTION_01_SECRETS.md](./sections/SECTION_01_SECRETS.md) |
| 2 — Auth Consistency & Route Protection | No silent prod breakage, no auth drift. | [SECTION_02_AUTH.md](./sections/SECTION_02_AUTH.md) |
| 3 — Guardrails, CI & Repo Hygiene | Mistakes are structurally prevented. | [SECTION_03_GUARDRAILS.md](./sections/SECTION_03_GUARDRAILS.md) |
| 4 — Stripe, Webhooks & Integrations | Double charges & ghost payouts impossible. | [SECTION_04_STRIPE_WEBHOOKS.md](./sections/SECTION_04_STRIPE_WEBHOOKS.md) |
| 5 — Database & Migration Hygiene | Data corruption risk massively reduced. | [SECTION_05_DATABASE.md](./sections/SECTION_05_DATABASE.md) |
| 6 — Workers, Crons & Background Jobs | System self-heals instead of silently failing. | [SECTION_06_WORKERS.md](./sections/SECTION_06_WORKERS.md) |
| 7 — API Design & Client Safety | Clients can integrate without surprises. | [SECTION_07_API.md](./sections/SECTION_07_API.md) |
| 8 — Security Hardening (Beyond Auth) | Strong baseline security posture. | [SECTION_08_SECURITY.md](./sections/SECTION_08_SECURITY.md) |
| 9 — Maintainability & Velocity | Ship fast without fear. | [SECTION_09_MAINTAINABILITY.md](./sections/SECTION_09_MAINTAINABILITY.md) |
| 10 — Cost, Scale & Performance | Growth won't surprise or bankrupt you. | [SECTION_10_COST_SCALE.md](./sections/SECTION_10_COST_SCALE.md) |
| 11 — Admin Ops & Support | You can actually run the marketplace. | [SECTION_11_ADMIN_OPS.md](./sections/SECTION_11_ADMIN_OPS.md) |
| 12 — Trust, Quality & Dispute Evidence | Disputes drop without misclassification risk. | [SECTION_12_TRUST_IC_SAFE.md](./sections/SECTION_12_TRUST_IC_SAFE.md) |
| 13 — Legal, Policy & Compliance | Policies and compliance in place. | [SECTION_13_LEGAL.md](./sections/SECTION_13_LEGAL.md) |
| 14 — Launch Readiness & Rollout | Safe rollout and incident readiness. | [SECTION_14_LAUNCH.md](./sections/SECTION_14_LAUNCH.md) |

---

## SECTION 1 — Secrets & Incident Response

**Outcome (when done):** Platform is no longer fragile or leaky.  
**Runbook:** [SECTION_01_SECRETS.md](./sections/SECTION_01_SECRETS.md) — full runbook, rotation order, provider steps, purge, incident response.  
**User runbook (manual steps):** [00-CRITICAL/PHASE_1_USER_RUNBOOK.md](./00-CRITICAL/PHASE_1_USER_RUNBOOK.md) — rotate, purge, verify.  
**Secret inventory template:** [00-CRITICAL/SECRET_INVENTORY_TEMPLATE.md](./00-CRITICAL/SECRET_INVENTORY_TEMPLATE.md) — copy off-repo to track rotation.

- [ ] Identify all exposed credentials (Stripe, Twilio, SendGrid, JWT, DB) — *use SECRET_INVENTORY_TEMPLATE off-repo*
- [ ] Rotate all exposed secrets (order: Stripe → Stripe webhook → DB → JWT → SendGrid → Twilio → OneSignal → n8n) — *follow PHASE_1_USER_RUNBOOK*
- [ ] Invalidate old tokens / webhooks
- [ ] Remove secrets from git history (BFG or git filter-repo; force-push; fresh clone)
- [ ] Force fresh clone for all contributors
- [ ] Store secrets only in Railway
- [x] Add startup env validation (fail fast if missing) — *`src/config/env.ts`*
- [x] Document incident response steps — **See also:** [SECURITY_INCIDENT_RESPONSE.md](./00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md)
- [x] .gitignore includes .env*, node_modules/, dist/
- [x] CI secret scan (Gitleaks + forbidden files) — *`.github/workflows/security-scan.yml`*

---

## SECTION 2 — Auth Consistency & Route Protection

**Outcome (when done):** No silent prod breakage, no auth drift.  
**Runbook:** [SECTION_02_AUTH.md](./sections/SECTION_02_AUTH.md). **Status:** [00-CRITICAL/PHASE_2_STATUS.md](./00-CRITICAL/PHASE_2_STATUS.md).

- [x] Define canonical JWT middleware (single source: `authCanonical` — requireAuth, requireRole, requireAdmin)
- [x] Remove all legacy auth implementations from routes (all use authCanonical)
- [x] Enforce requireAuth on all protected routes
- [x] Add role-based guards (requireRole) where needed
- [x] Isolate webhook routes (no JWT; signature-only) — `/stripe/webhook`, `/n8n/events`
- [x] Build Route Protection Table (route → category → auth → role) — **Artifact:** [ROUTE_PROTECTION_TABLE.md](./ROUTE_PROTECTION_TABLE.md)
- [x] Add auth smoke tests (no token → 401; valid JWT → 200/403) — *unit: `src/middleware/__tests__/authCanonical.test.ts`*
- [x] Build fails if legacy auth is reintroduced (lint/CI) — `.github/workflows/security-scan.yml`

---

## SECTION 3 — Guardrails, CI & Repo Hygiene

**Outcome (when done):** Mistakes are structurally prevented.  
**Runbook:** [SECTION_03_GUARDRAILS.md](./sections/SECTION_03_GUARDRAILS.md). **Status:** [00-CRITICAL/PHASE_3_STATUS.md](./00-CRITICAL/PHASE_3_STATUS.md).

- [x] Finalize .gitignore (env, dist, node_modules, logs)
- [x] Create .env.example (no secrets)
- [x] Add pre-commit (block .env, run lint) — *`.githooks/pre-commit`; enable: `git config core.hooksPath .githooks`*
- [x] Add CI secret scanning (fail on secrets / forbidden files) — *`.github/workflows/security-scan.yml`*
- [x] Fail CI on forbidden files (.env, node_modules, dist)
- [x] Block legacy auth imports via lint — *security-scan.yml*
- [x] Document branch protection — *CONTRIBUTING.md; enable in GitHub Settings → Branches*
- [ ] Archive non-active docs outside workspace (optional)

---

## SECTION 4 — Stripe, Webhooks & Integrations

**Outcome (when done):** Double charges & ghost payouts impossible.  
**Runbook:** [SECTION_04_STRIPE_WEBHOOKS.md](./sections/SECTION_04_STRIPE_WEBHOOKS.md). **Status:** [00-CRITICAL/PHASE_4_STATUS.md](./00-CRITICAL/PHASE_4_STATUS.md).

- [x] Validate raw webhook signatures (raw body; Buffer passed to Stripe constructEvent) — *handler requires Buffer; 400 if not*
- [x] Enforce idempotency on all webhook handlers (unique event_id) — *webhook_events ON CONFLICT DO NOTHING; return 200 if duplicate*
- [x] Store webhook events durably (webhook_events table) before processing — *`DB/migrations/042_webhook_events.sql`; insert before handleStripeEvent*
- [x] Implement payment state machine (documented + enforced) — *[PAYMENT_STATE_MACHINE.md](./sections/PAYMENT_STATE_MACHINE.md); updates only in paymentService/payoutsService*
- [x] Implement financial ledger tables (append-only) — *credit_ledger + 902 constraints; payout_items 903*
- [x] Enforce payout idempotency (unique operation keys) — *Stripe transfer idempotencyKey; uniq_payout_items_ledger_entry*
- [x] Log webhook delivery attempts (delivery_log for outbound) — *message_delivery_log (026); extend for email/SMS as needed*
- [x] Add webhook replay support (idempotent) — *same event_id → 200, no reprocess*
- [x] Handler returns 200 quickly — *verify → store → process; 200 on duplicate or after process*

---

## SECTION 5 — Database & Migration Hygiene

**Outcome (when done):** Data corruption risk massively reduced.  
**Runbook:** [SECTION_05_DATABASE.md](./sections/SECTION_05_DATABASE.md). **Status:** [00-CRITICAL/PHASE_5_STATUS.md](./00-CRITICAL/PHASE_5_STATUS.md).

- [x] Choose canonical schema strategy (e.g. consolidated baseline + forward migrations) — *000_CONSOLIDATED for fresh; 001+ forward; policy in DB/migrations/README + PHASE_5_STATUS*
- [x] Standardize schema naming & migration order (NNN_description.sql) — *001_init … 042_webhook_events; hardening/ 9NN_*
- [x] Add NOT NULL + FK constraints where appropriate — *907; webhook_events/durable_jobs/idempotency_keys from 042/906/039*
- [x] Add unique constraints for idempotency (event_id, idempotency_key) — *042 UNIQUE(provider,event_id); 906 uniq_durable_jobs_type_key*
- [x] Create safe migration workflow (no manual prod SQL) — *PHASE_5_STATUS + DB/migrations/README*
- [x] Add rollback strategy for risky migrations — *PHASE_5_STATUS: rollback SQL or IRREVERSIBLE*
- [x] Index hot query paths (index map + justification) — *DB/docs/INDEX_MAP.md; 030_performance_indexes.sql*
- [x] Enable backups + restore testing — *BACKUP_RESTORE.md; run restore test periodically*
- [x] Add audit tables where needed (admin actions, ledger) — *admin_audit_log (019); webhook_events; credit_ledger*
- [x] CI: fresh DB + apply migrations + smoke queries — *`.github/workflows/migrations.yml`*

---

## SECTION 6 — Workers, Crons & Background Jobs

**Outcome (when done):** System self-heals instead of silently failing.  
**Runbook:** [SECTION_06_WORKERS.md](./sections/SECTION_06_WORKERS.md). **Status:** [00-CRITICAL/PHASE_6_STATUS.md](./00-CRITICAL/PHASE_6_STATUS.md).

- [x] Define job taxonomy (cron, event, retry, maintenance) — *SECTION_06_WORKERS § 6.1*
- [x] Create durable jobs table (status, attempt_count, locked_at, idempotency_key) — *hardening/906_durable_jobs.sql*
- [x] Enforce job idempotency keys (unique per job_type + key) — *UNIQUE (job_type, idempotency_key)*
- [x] Implement job locking + crash recovery (FOR UPDATE SKIP LOCKED or advisory locks) — *durableJobService.claim + releaseStaleLocks; durableJobWorker*
- [x] Add retry/backoff strategy (exponential + jitter; max attempts) — *durableJobService.fail() backoff → dead*
- [x] Add dead-letter handling (alert; manual retry where safe) — *durableJobWorker alert; GET/POST admin/jobs/dead*
- [ ] Make crons enqueue jobs only (no work in cron process) — *Hybrid: durable jobs + inline workers; path to enqueue-only documented*
- [x] Implement payout + dispute jobs safely (atomic; idempotent) — *Phase 4 idempotency; payout 903*
- [x] Add worker observability (logs, metrics, alerts) — *durableJobWorker: recordMetric, incrementCounter; dead-letter alert*

---

## SECTION 7 — API Design & Client Safety

**Outcome (when done):** Clients can integrate without surprises.  
**Runbook:** [SECTION_07_API.md](./sections/SECTION_07_API.md). **Status:** [00-CRITICAL/PHASE_7_STATUS.md](./00-CRITICAL/PHASE_7_STATUS.md).

- [x] Standardize route structure (/api/v1; /api/admin; /api/webhooks) — *apiRouter at /api/v1; /api/webhooks/stripe*
- [ ] Create DTOs for all endpoints (request/response/error)
- [ ] Validate params/query/body everywhere (Zod or equivalent)
- [x] Enforce consistent error format (code, message, details, requestId) — *src/lib/errors.ts ErrorCode + sendError*
- [x] Add idempotency headers for risky actions (payment, payout, booking) — *requireIdempotency on jobs, payments, tracking*
- [x] Implement API versioning (e.g. /api/v1) — *app.use("/api/v1", apiRouter)*
- [ ] Standardize pagination/filtering (cursor, limit, sort)
- [x] Generate OpenAPI spec — *Swagger at /api-docs*
- [x] Add contract tests (schema, errors, auth) — *src/tests/contract/errorFormat.test.ts*

---

## SECTION 8 — Security Hardening

**Outcome (when done):** Strong baseline security posture.  
**Runbook:** [SECTION_08_SECURITY.md](./sections/SECTION_08_SECURITY.md). **Status:** [00-CRITICAL/PHASE_8_STATUS.md](./00-CRITICAL/PHASE_8_STATUS.md).

- [x] Sanitize all inputs (whitelist sort/filter; no raw SQL interpolation) — *validation.ts sanitizeSort, sanitizeFilterKeys; admin validSortColumns; sanitizeBody*
- [ ] Enforce ownership checks on all resource reads/writes
- [x] Lock down CORS allowlist (no wildcard with credentials) — *index.ts allowlist*
- [x] Add security headers (Helmet: X-Content-Type-Options, X-Frame-Options, etc.) — *Helmet + securityHeaders*
- [x] Add route-class rate limits (auth strict; webhooks moderate) — *endpointRateLimiter / Redis*
- [x] Secure webhook endpoints (signature + replay protection) — *Phase 4*
- [x] Block SSRF outbound calls (allowlist; block private IPs) — *ssrfProtection.ts; httpClient uses validateOutboundUrl; OUTBOUND_ALLOWED_HOSTS*
- [x] Secure file upload flow (MIME allowlist; size; signed URLs preferred) — *fileUploadService PROFILE_PHOTO_TYPES, ID_DOCUMENT_TYPES, validateFile; 10MB limit*
- [x] Redact PII from logs (centralized logger; no secrets) — *logRedaction.ts; logger uses redactSensitiveFields; redactHeaders*
- [x] Add admin audit logging (who, what, target, reason, timestamp) — *admin_audit_log (019)*
- [x] Enable dependency monitoring (lockfile; advisories) — *CI: npm audit --audit-level=critical*

---

## SECTION 9 — Maintainability & Velocity

**Outcome (when done):** Ship fast without fear.  
**Runbook:** [SECTION_09_MAINTAINABILITY.md](./sections/SECTION_09_MAINTAINABILITY.md). **Status:** [00-CRITICAL/PHASE_9_STATUS.md](./00-CRITICAL/PHASE_9_STATUS.md).

- [ ] Enforce project layering (routes → controllers/services → repos)
- [ ] Refactor oversized files (break up god files)
- [x] Standardize response helpers (ok, created, error) — *src/lib/response.ts, errors.ts*
- [x] Standardize logging (requestId; structured; no console.log) — *requestContextMiddleware, logger*
- [x] Choose single test framework (Jest or Vitest) — *Jest*
- [ ] Implement test pyramid (unit, integration, contract)
- [x] Enforce lint + formatting rules (ESLint, Prettier) — *CI*
- [x] Add PR templates (what, why, test, rollback notes) — *.github/PULL_REQUEST_TEMPLATE.md*
- [x] Create developer docs (README, ARCHITECTURE, CONTRIBUTING, RUNBOOK) — *docs/active/ARCHITECTURE.md; CONTRIBUTING.md*
- [ ] Improve observability (requestId, slow query log, dashboards)

---

## SECTION 10 — Cost, Scale & Performance

**Outcome (when done):** Growth won’t surprise or bankrupt you.  
**Runbook:** [SECTION_10_COST_SCALE.md](./sections/SECTION_10_COST_SCALE.md). **Status:** [00-CRITICAL/PHASE_10_STATUS.md](./00-CRITICAL/PHASE_10_STATUS.md).

- [ ] Define scaling tiers (MVP / Growth / Scale) with targets
- [ ] Map cost centers (infra, Stripe, SendGrid, Twilio, storage)
- [ ] Set performance budgets (p50/p95 latency; error rate)
- [ ] Optimize hot DB queries (indexes; cursor pagination)
- [ ] Define caching allowed list + TTL policy
- [ ] Define worker priority queues (critical / standard / low)
- [ ] Control SMS/email spend (channel policy; batching)
- [ ] Add rate limits for cost control
- [ ] Build performance dashboards (latency, errors, queue lag)
- [ ] Document upgrade triggers (Redis, queue, replicas, split services)

---

## SECTION 11 — Admin Ops & Support

**Outcome (when done):** You can actually run the marketplace. (IC-safe admin language.)  
**Runbook:** [SECTION_11_ADMIN_OPS.md](./sections/SECTION_11_ADMIN_OPS.md). **Status:** [00-CRITICAL/PHASE_11_STATUS.md](./00-CRITICAL/PHASE_11_STATUS.md).

- [ ] Define admin RBAC roles (support_agent, support_lead, ops_finance, admin)
- [ ] Implement admin auth guards (requireRole; audit reason required)
- [ ] Require audit reason for all sensitive actions
- [ ] Build ops dashboard (disputes, webhooks, payouts, risk flags)
- [ ] Implement dispute resolution UI (evidence, playbooks, outcomes)
- [ ] Implement refund/credit flows (guarded; ledger + audit)
- [ ] Implement payout holds/releases (idempotent)
- [ ] Build webhook + delivery log viewer (replay safe)
- [ ] Add case management (notes, resolution, assignee)
- [ ] Use IC-safe language (“platform status adjustment” not “override completion”; “risk indicators” not “warnings”)

---

## SECTION 12 — Trust, Quality & Dispute Evidence (IC-Safe)

**Outcome (when done):** Disputes drop without misclassification risk.  
**Runbook:** [SECTION_12_TRUST_IC_SAFE.md](./sections/SECTION_12_TRUST_IC_SAFE.md). **Status:** [00-CRITICAL/PHASE_12_STATUS.md](./00-CRITICAL/PHASE_12_STATUS.md).

- [ ] Define service outcomes (what was purchased), not methods
- [ ] Store outcome definitions structurally (versioned)
- [ ] Implement optional evidence submission (required only for certain protections)
- [ ] Link evidence to dispute protection / payout eligibility
- [ ] Enforce review window + auto-accept
- [ ] Implement structured client feedback (categories, not free-text chaos)
- [ ] Implement auto-resolution logic (explainable; evidence-based)
- [ ] Implement reliability signals (access-based: visibility, payout timing)
- [ ] Enforce transparency rules (cleaners/clients see how decisions work)
- [ ] Validate IC-safe language everywhere (no “required procedures,” “performance correction,” or “mandatory re-cleans”)

---

## SECTION 13 — Legal, Policy & Compliance

**Status:** ⏳ NOT DONE (design not yet fully written out in same detail).  
**Runbook:** [SECTION_13_LEGAL.md](./sections/SECTION_13_LEGAL.md)

- [ ] Finalize full Terms of Service (merge all TOS sections)
- [ ] Publish Independent Contractor Safeguards (appendix + in-app)
- [ ] Create Cleaner Agreement (separate from TOS)
- [ ] Create Privacy Policy (GDPR/CPRA framing)
- [ ] Define refund & cancellation policy
- [ ] Define evidence retention rules
- [ ] Define liability boundaries
- [ ] Legal review pass

---

## SECTION 14 — Launch Readiness & Rollout

**Status:** ⏳ NOT DONE (design not yet fully written out in same detail).  
**Runbook:** [SECTION_14_LAUNCH.md](./sections/SECTION_14_LAUNCH.md). **Status:** [00-CRITICAL/PHASE_14_STATUS.md](./00-CRITICAL/PHASE_14_STATUS.md).

- [ ] Add feature flags
- [ ] Define staged rollout plan
- [ ] Add payment kill switch
- [ ] Add booking kill switch
- [ ] Add payout kill switch
- [ ] Create incident runbook
- [ ] Train support workflows
- [ ] Monitor launch KPIs
- [ ] Post-launch audit

---

## Legal & IC Deliverables (Reference)

These were produced in the program and should be merged or referenced as you implement:

- **TOS sections (merged):** Platform role, Independent Contractor relationship, No control over performance, No exclusivity, Service descriptions & outcomes, Evidence & verification, Job completion & payments, Client review & disputes, Platform trust signals & access, Administrative actions, Reservation of rights.
- **Independent Contractor Safeguards appendix:** What PureTask does not control; what it does define; evidence & verification; platform access; no exclusivity; final statement.
- **California AB5 / ABC Test:** Prong A (control), B (outside usual course), C (independently established trade) — all satisfied with current design.
- **Lawyer review notes:** Rationale for each TOS clause (for counsel).
- **In-app copy:** Cleaner app + Client app (short, IC-safe bullets).
- **Section 11 admin IC-safety audit:** Safe as designed; watch language (“platform status adjustment,” “risk indicators”); do not add PIPs, mandatory re-cleans, or productivity targets.
- **Section 12 line-by-line IC-safe rewrite:** Outcomes not methods; evidence as protection; reliability as access; no time tracking or supervision language.

**Legal artifact index:** [docs/active/legal/README.md](./legal/README.md) — create TOS_CONSOLIDATED.md, IC_SAFEGUARDS_APPENDIX.md, AB5_ANALYSIS.md, LAWYER_REVIEW_NOTES.md, IN_APP_COPY_CLEANER.md, IN_APP_COPY_CLIENT.md as you implement.

---

## Implementation Phase (Next Mode)

After design/policy approval, the next phase is **execution**:

- Code migrations (auth, routes, webhooks, DB, workers)
- Route refactors (legacy auth removal, role guards)
- CI setup (secret scan, lint, tests, branch protection)
- Admin UI implementation (dashboard, dispute UI, refunds, webhook viewer)
- Worker/job code (durable table, locking, retry, dead-letter)
- Tests & dashboards (contract tests, smoke, performance/cost alerts)

Switch from **design & policy mode** to **section-by-section build mode** using this checklist.

---

## Next Steps (Choose One)

- **Proceed with Section 13** — Legal, policy & compliance (full outline + checklist expansion). → [SECTION_13_LEGAL.md](./sections/SECTION_13_LEGAL.md)
- **Proceed with Section 14** — Launch readiness & rollout (full outline + checklist expansion). → [SECTION_14_LAUNCH.md](./sections/SECTION_14_LAUNCH.md)
- **Switch to implementation** — Start with Section 1 code changes (rotation runbook, purge, guardrails).
- **Use this doc as-is** — Work through the checklists above in order.

**Extraction & improvements:** See [EXTRACTION_ANALYSIS_AND_IMPROVEMENTS.md](./EXTRACTION_ANALYSIS_AND_IMPROVEMENTS.md) for what we capture from the prior output and suggested improvements.

---

**Verification:** See [MASTER_CHECKLIST_VERIFICATION_REPORT.md](./MASTER_CHECKLIST_VERIFICATION_REPORT.md) for comprehensive code-verified status (2026-02-02).

**Cross-doc tracker:** See [DOCUMENT_EXECUTION_TRACKER.md](./DOCUMENT_EXECUTION_TRACKER.md) for consolidated status across all 9 canonical docs.

**Last updated:** 2026-02-02
