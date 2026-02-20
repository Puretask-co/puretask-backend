# Master Checklist — Completion Guide

**Purpose:** Step-by-step guide to solve and complete every remaining item in [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md). Use this with the section runbooks and phase status docs.

**Dependency order (do not skip):** 1 → 2 → 3 → 4 → 5,6 → 7,8 → 9,10; 4,12 → 11; 11,12 → 13; 1–13 → 14. Do **not** parallelize Sections 1, 2, 4 (secrets, auth, money).

---

## How to Use This Guide

- Work **one section at a time** in the order below.
- For each item: do the **Steps**, verify **Acceptance criteria**, then check off in MASTER_CHECKLIST.md.
- **Runbooks** have full procedures: `docs/active/sections/SECTION_NN_*.md` and `docs/active/00-CRITICAL/PHASE_N_STATUS.md`.
- When an item is **policy/legal** (13, 14), complete the doc/checklist first; implementation follows.

---

## SECTION 1 — Secrets & Incident Response (Must Do First)

**Runbook:** [SECTION_01_SECRETS.md](./sections/SECTION_01_SECRETS.md). **User runbook:** [00-CRITICAL/PHASE_1_USER_RUNBOOK.md](./00-CRITICAL/PHASE_1_USER_RUNBOOK.md).

### 1.1 Identify all exposed credentials

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Identify exposed credentials** | 1. Copy [SECRET_INVENTORY_TEMPLATE.md](./00-CRITICAL/SECRET_INVENTORY_TEMPLATE.md) to an **off-repo** location (e.g. secure note). 2. List every secret the app uses: Stripe (secret + webhook), DB, JWT_SECRET, SendGrid, Twilio, OneSignal, n8n. 3. For each, note: where it was exposed (e.g. .env in repo), when, and whether it was ever pushed/shared. 4. Treat any pushed secret as **compromised** until rotated. | Off-repo only; do not put inventory in repo. | Inventory complete; every secret has a row and exposure status. |

### 1.2 Rotate all exposed secrets

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Rotate secrets in order** | 1. Follow [PHASE_1_USER_RUNBOOK.md](./00-CRITICAL/PHASE_1_USER_RUNBOOK.md) exactly. 2. Order: Stripe API keys → Stripe webhook secret → DATABASE_URL (if exposed) → JWT_SECRET → SendGrid → Twilio → OneSignal → n8n. 3. Per provider: create new key/secret in provider dashboard, update **only** in Railway (or env store), restart app, then revoke old key. 4. Do not commit new values anywhere. | Railway (or your env store); provider dashboards. | All rotated; old keys revoked; app runs on new secrets only. |

### 1.3 Invalidate old tokens / webhooks

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Invalidate old tokens & webhooks** | 1. After JWT_SECRET rotation: all existing JWTs are invalid; users must log in again (expected). 2. Stripe: delete or disable old webhook endpoint in Stripe Dashboard; add new endpoint with new signing secret. 3. n8n: regenerate webhook URL if exposed; update N8N_WEBHOOK_URL in env. | Stripe Dashboard; n8n; env. | No traffic to old webhooks; only new signing secret in use. |

### 1.4 Remove secrets from git history

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Purge secrets from history** | 1. Use BFG Repo-Cleaner or git filter-repo (see [SECURITY_INCIDENT_RESPONSE.md](./00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md)). 2. Target: .env, .env.local, any file containing literal secrets. 3. Force-push (coordinate with team); then **everyone** must do a fresh clone — no pull over contaminated history. | Repo root; backup repo first. | History rewritten; `git log -p` does not show .env or secret values. |

### 1.5 Force fresh clone for all contributors

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Fresh clone for everyone** | 1. After history rewrite: document in team channel/wiki that everyone must delete local repo and re-clone. 2. Verify no one pushes from an old clone (would re-introduce history). | Team process. | All contributors on fresh clone. |

### 1.6 Store secrets only in Railway

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Secrets only in Railway** | 1. Ensure zero secrets in repo (no .env in tree; .env.example has placeholders only). 2. All production and staging env (including JWT_SECRET, Stripe, DB, etc.) set in Railway Variables (or equivalent). 3. Local dev: each dev has own .env (gitignored), never committed. | Railway Dashboard → Project → Variables; .env.example in repo. | No secret value lives in repo or in any committed file. |

---

## SECTION 3 — Guardrails, CI & Repo Hygiene

**Runbook:** [SECTION_03_GUARDRAILS.md](./sections/SECTION_03_GUARDRAILS.md). **Status:** [PHASE_3_STATUS.md](./00-CRITICAL/PHASE_3_STATUS.md).

### 3.1 Archive non-active docs (optional)

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Archive non-active docs** | 1. Identify docs **not** in `docs/active/` that are obsolete or duplicate (e.g. old guides under `docs/guides/`, `docs/deployment/`, `docs/testing/`). 2. Move to `docs/archive/raw/` with a clear name (e.g. `docs/archive/raw/legacy-DeployToRailway.md`). 3. Do not move anything referenced from MASTER_CHECKLIST or RUNBOOK. | `docs/` tree; [documentation rules](.cursor/rules/documentation.mdc) say archive in `docs/archive/`. | Optional: completed when you have a single source of truth under docs/active and no duplicate procedures. |

---

## SECTION 6 — Workers, Crons & Background Jobs

**Runbook:** [SECTION_06_WORKERS.md](./sections/SECTION_06_WORKERS.md). **Status:** [PHASE_6_STATUS.md](./00-CRITICAL/PHASE_6_STATUS.md).

### 6.1 Make crons enqueue jobs only

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Crons enqueue only** | 1. Find all cron/scheduler entry points (e.g. `worker:scheduler`, cron routes, or in-process timers). 2. Change each so it **only** inserts rows into `durable_jobs` (or your job table) with `job_type` + `idempotency_key` + payload; no business logic in the cron process. 3. Ensure a separate worker process (e.g. `worker:durable-jobs:loop`) claims and executes jobs. 4. Document the "enqueue only" contract in SECTION_06 and in code comments. | Scheduler code; `src/workers/`; `durable_jobs` table (906). | No cron path runs payout/dispute/email logic directly; all work goes through durable job queue. |

---

## SECTION 7 — API Design & Client Safety

**Runbook:** [SECTION_07_API.md](./sections/SECTION_07_API.md). **Status:** [PHASE_7_STATUS.md](./00-CRITICAL/PHASE_7_STATUS.md).

### 7.1 Create DTOs for all endpoints

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **DTOs for request/response/error** | 1. List all public API routes (use ROUTE_PROTECTION_TABLE or OpenAPI at `/api-docs`). 2. For each route: define a request type (body/query/params) and response type (success + error shape). 3. Add types in `src/types/` or next to routes (e.g. `dto/jobs.ts`, `dto/auth.ts`). 4. Use consistent error shape: `{ error: { code, message, details?, requestId? } }` (already in `src/lib/errors.ts`). | `src/types/`, route files; OpenAPI spec. | Every documented endpoint has a defined request/response/error DTO; OpenAPI reflects them. |

### 7.2 Validate params/query/body everywhere

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Zod (or equivalent) validation** | 1. For each route that accepts body, query, or params: add a Zod schema and run `schema.parse()` (or validate) before handler logic. 2. Reuse existing helpers: `validateBody` in `src/lib/validation.ts`; add `validateQuery`, `validateParams` if missing. 3. On parse failure return 400 with consistent error format. 4. Start with money/auth routes (payments, bookings, auth), then high-traffic (search, list jobs). | Route handlers; `src/lib/validation.ts`; existing Zod usage in cleaner.ts, holidays.ts. | No handler reads req.body/query/params without going through a validator. |

### 7.3 Standardize pagination/filtering

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Pagination (cursor, limit, sort)** | 1. Choose a standard: e.g. `limit` (max 100), `cursor` (opaque string or `created_at` + id), `sort` (allowlisted fields + asc/desc). 2. Document in SECTION_07 and in OpenAPI. 3. Add a small helper: `parsePagination(req.query)` returning `{ limit, cursor, sort }`. 4. Apply to list endpoints: jobs, cleaners, admin lists, etc. | List routes; `src/lib/pagination.ts` (create if needed); OpenAPI. | All list endpoints accept the same pagination params and document them. |

---

## SECTION 8 — Security Hardening

**Runbook:** [SECTION_08_SECURITY.md](./sections/SECTION_08_SECURITY.md). **Status:** [PHASE_8_STATUS.md](./00-CRITICAL/PHASE_8_STATUS.md).

### 8.1 Enforce ownership checks on all resource reads/writes

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Ownership checks** | 1. List all routes that access a resource by ID (job, booking, cleaner profile, client profile, etc.). 2. For each: after loading the resource, assert that `resource.user_id` or `resource.cleaner_id` (or equivalent) matches `req.user.id` or the resolved cleaner/client for that user. 3. If no match → 403 Forbidden. 4. Add a shared helper if useful: e.g. `assertOwnership(resource, req.user)`. | Route handlers that fetch by id; `src/middleware/` or `src/lib/ownership.ts`. | No user can read or mutate another user's resources via ID manipulation. |

---

## SECTION 9 — Maintainability & Velocity

**Runbook:** [SECTION_09_MAINTAINABILITY.md](./sections/SECTION_09_MAINTAINABILITY.md). **Status:** [PHASE_9_STATUS.md](./00-CRITICAL/PHASE_9_STATUS.md).

### 9.1 Enforce project layering

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Layering: routes → services → repos** | 1. Document the rule: routes call services only; services call repos (DB) and other services; no DB in routes. 2. Add a lint rule or layer-check script that forbids imports of `../db/` or `query` from route files. 3. Refactor any route that currently imports DB client to go through a service. | All route files; `src/routes/`; ARCHITECTURE.md. | Routes have no direct DB access; layering is documented and enforced. |

### 9.2 Refactor oversized files

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Break up god files** | 1. Identify files > ~500 lines (e.g. `cleanerEnhanced.ts`, `admin.ts`, `clientEnhanced.ts`). 2. Split by domain: e.g. cleaner dashboard vs cleaner availability vs cleaner payouts into separate modules; mount under same router. 3. Extract shared logic into services or lib. 4. Keep each file under a target (e.g. 400 lines) where practical. | `src/routes/`; `src/services/`. | No single route file is overwhelmingly large; new logic has a clear home. |

### 9.3 Implement test pyramid

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **Unit, integration, contract tests** | 1. **Unit:** critical business logic (payments, idempotency, auth helpers) in `src/**/__tests__/` or `tests/unit/`. 2. **Integration:** API + DB tests against test DB (e.g. `src/tests/integration/`); use existing Vitest/Jest. 3. **Contract:** error format, auth (401/403), and key response shapes (see existing `src/tests/contract/errorFormat.test.ts`). 4. Document in CONTRIBUTING or TESTING.md: when to add which kind. | `src/tests/`; `tests/`; CI. | You have unit tests for core logic, integration tests for critical paths, contract tests for API shape. |

### 9.4 Improve observability

| What | Steps | Where | Done when |
|------|--------|-------|-----------|
| **requestId, slow query log, dashboards** | 1. **requestId:** already in requestContextMiddleware; ensure it's in every log line and in error responses. 2. **Slow query log:** wrap DB `query()` to log when duration > threshold (e.g. 500ms); include requestId. 3. **Dashboards:** define a small set of metrics (request count by route, p95 latency, error rate, queue lag) and add them to your monitoring (e.g. Sentry, Datadog, or Railway metrics). Document in RUNBOOK. | `src/lib/logger.ts`; DB client wrapper; RUNBOOK.md. | Every request has requestId in logs; slow queries are visible; dashboard exists for health/latency/errors. |

---

## SECTION 10 — Cost, Scale & Performance

**Runbook:** [SECTION_10_COST_SCALE.md](./sections/SECTION_10_COST_SCALE.md). **Status:** [PHASE_10_STATUS.md](./00-CRITICAL/PHASE_10_STATUS.md).

Complete these in order; each builds on the previous.

| # | Item | Steps | Done when |
|---|------|--------|-----------|
| 1 | **Define scaling tiers** | Document MVP / Growth / Scale (e.g. MVP: single region, 1 app instance; Growth: Redis, worker split; Scale: replicas, read replicas). Put targets (RPS, DB connections, job throughput). | SECTION_10 or COST_MAP has tiers and targets. |
| 2 | **Map cost centers** | List: infra (Railway/Neon), Stripe, SendGrid, Twilio, storage, any third-party. Add rough cost per unit (e.g. per 1k emails). | Cost map doc exists. |
| 3 | **Performance budgets** | Set p50/p95 latency and error-rate targets for key endpoints (e.g. /health, /auth/login, /jobs). | Documented; CI or alerts can compare. |
| 4 | **Optimize hot DB queries** | Use existing index map (030_performance_indexes.sql; DB/docs/INDEX_MAP.md). Add cursor pagination where you have large lists. | Hot paths use indexes; no full table scans on large tables. |
| 5 | **Caching allowed list + TTL** | Define what may be cached (e.g. public config, list of holidays) and TTL; document what must not be cached (user-specific, money). | RUNBOOK or SECTION_10 has caching policy. |
| 6 | **Worker priority queues** | If you have multiple job types, define critical vs standard vs low; implement via separate queues or priority column and worker ordering. | Durable job processing respects priority. |
| 7 | **SMS/email spend control** | Channel policy: when to use SMS vs email; batching rules; rate limits per user. | Documented and enforced in notification code. |
| 8 | **Rate limits for cost control** | Beyond auth protection: per-IP or per-user limits on expensive operations (e.g. search, bulk export). | Rate limits applied and documented. |
| 9 | **Performance dashboards** | Latency, errors, queue lag visible in your monitoring tool. | Dashboard exists and is linked in RUNBOOK. |
| 10 | **Upgrade triggers** | Document when to add Redis, when to split workers, when to add replicas (e.g. queue depth > X, p95 > Y). | SECTION_10 or RUNBOOK has upgrade triggers. |

---

## SECTION 11 — Admin Ops & Support

**Runbook:** [SECTION_11_ADMIN_OPS.md](./sections/SECTION_11_ADMIN_OPS.md). **Status:** [PHASE_11_STATUS.md](./00-CRITICAL/PHASE_11_STATUS.md). **IC-safe language:** Use "platform status adjustment," "risk indicators," not "override completion," "warnings."

| # | Item | Steps | Done when |
|---|------|--------|-----------|
| 1 | **Admin RBAC roles** | Define roles: e.g. support_agent, support_lead, ops_finance, admin. Map to permissions (read-only vs refund vs payout hold). Store in DB or config. | Roles defined and enforced. |
| 2 | **Admin auth guards** | Use requireRole('admin' or role); require audit reason on sensitive actions (refund, payout hold, status change). | All admin routes gated; sensitive actions require reason. |
| 3 | **Audit reason required** | For every mutation that affects money or status: require `reason` in body; write to admin_audit_log (who, what, target, reason, timestamp). | No sensitive admin action without audit log entry. |
| 4 | **Ops dashboard** | Build a dashboard (or dedicated admin UI) for: open disputes, recent webhooks, payout queue, risk flags. Read-only where possible. | Ops can see disputes, webhooks, payouts, risk in one place. |
| 5 | **Dispute resolution UI** | UI to view dispute, evidence, playbooks; record outcome (e.g. refund partial/full, close, escalate). All actions audited. | Disputes can be resolved via UI with audit trail. |
| 6 | **Refund/credit flows** | Implement refund and credit grant flows that update ledger and audit log; guard with role + reason. | Refunds/credits are consistent with ledger and audited. |
| 7 | **Payout holds/releases** | Idempotent endpoints to hold and release payouts; audit log; no double-release. | Finance can hold/release payouts safely. |
| 8 | **Webhook + delivery log viewer** | Admin view of webhook_events and delivery logs (read-only; replay only via existing idempotent replay). | Ops can inspect webhooks and delivery status. |
| 9 | **Case management** | Notes, resolution status, assignee per dispute or support case. | Cases are trackable and assignable. |
| 10 | **IC-safe language everywhere** | Audit all admin-facing copy and API messages: no "required procedures," "performance correction," "mandatory re-cleans." Use Section 11/12 language. | Admin UI and API use only IC-safe terms. |

---

## SECTION 12 — Trust, Quality & Dispute Evidence (IC-Safe)

**Runbook:** [SECTION_12_TRUST_IC_SAFE.md](./sections/SECTION_12_TRUST_IC_SAFE.md). **Status:** [PHASE_12_STATUS.md](./00-CRITICAL/PHASE_12_STATUS.md).

| # | Item | Steps | Done when |
|---|------|--------|-----------|
| 1 | **Define service outcomes** | Document "what was purchased" (outcomes) not "how to do the work" (methods). Store in config or DB. | Outcome definitions exist and are used in disputes. |
| 2 | **Store outcome definitions structurally** | Versioned outcome definitions (e.g. job type → expected outcomes); link to evidence requirements. | Schema or config has versioned outcomes. |
| 3 | **Optional evidence submission** | Evidence required only where policy says (e.g. for certain dispute types or protections). Document when it's optional vs required. | Evidence rules are clear and implemented. |
| 4 | **Link evidence to dispute protection** | When deciding dispute or payout eligibility, use evidence + outcomes; document logic. | Dispute/payout logic references evidence and outcomes. |
| 5 | **Review window + auto-accept** | Define review window (e.g. 48h) and auto-accept rules; implement in job completion flow. | Time-bound review and auto-accept work. |
| 6 | **Structured client feedback** | Categories (not only free-text) for client feedback; link to outcomes where possible. | Feedback is structured and queryable. |
| 7 | **Auto-resolution logic** | Explainable, evidence-based auto-resolution for clear cases; document rules. | Auto-resolution exists and is auditable. |
| 8 | **Reliability signals** | Access-based (visibility, payout timing); no "productivity" or "performance" language. Implement per Section 12. | Reliability is defined as access/signals only. |
| 9 | **Transparency rules** | Cleaners and clients see how decisions work (no black box); document in-app. | Transparency doc and in-app copy in place. |
| 10 | **Validate IC-safe language** | Audit all dispute, evidence, and reliability copy; remove "required procedures," "performance correction," "mandatory re-cleans." | All user-facing and admin copy is IC-safe. |

---

## SECTION 13 — Legal, Policy & Compliance

**Runbook:** [SECTION_13_LEGAL.md](./sections/SECTION_13_LEGAL.md). **Status:** [PHASE_13_STATUS.md](./00-CRITICAL/PHASE_13_STATUS.md).  
**Reference:** [legal/README.md](./legal/README.md) — artifact index.

| # | Item | Steps | Done when |
|---|------|--------|-----------|
| 1 | **Finalize full TOS** | Merge all TOS sections into one canonical doc (e.g. TOS_CONSOLIDATED.md). Include: platform role, IC relationship, evidence, disputes, admin actions, reservation of rights. | Single TOS document is the source of truth. |
| 2 | **Publish IC Safeguards** | Appendix + in-app: what PureTask does/does not control; evidence & verification; no exclusivity. Use existing [IC_SAFEGUARDS_APPENDIX](./legal/IC_SAFEGUARDS_APPENDIX.md). | Appendix published; in-app copy linked. |
| 3 | **Cleaner Agreement** | Separate agreement for cleaners (IC relationship, payment, platform rules). Create CLEANER_AGREEMENT.md; link from signup/onboarding. | Cleaner agreement exists and is presented to cleaners. |
| 4 | **Privacy Policy** | GDPR/CPRA framing: what you collect, why, retention, rights (access, delete, portability). Create PRIVACY_POLICY.md. | Privacy policy published and linked. |
| 5 | **Refund & cancellation policy** | Define refund windows, cancellation fees, and how they align with TOS and ledger. | Documented and consistent with code. |
| 6 | **Evidence retention rules** | How long you keep evidence (photos, logs); when you delete; legal hold. | Documented in policy and RUNBOOK. |
| 7 | **Liability boundaries** | Limitation of liability, indemnification (platform vs user), as in TOS. | Reflected in TOS and legal docs. |
| 8 | **Legal review pass** | Send TOS, Privacy Policy, Cleaner Agreement, and key in-app copy to counsel; incorporate feedback. | Legal sign-off or tracked review. |

---

## SECTION 14 — Launch Readiness & Rollout

**Runbook:** [SECTION_14_LAUNCH.md](./sections/SECTION_14_LAUNCH.md). **Status:** [PHASE_14_STATUS.md](./00-CRITICAL/PHASE_14_STATUS.md).  
Do this **after** Sections 1–13 are complete or explicitly deferred.

| # | Item | Steps | Done when |
|---|------|--------|-----------|
| 1 | **Feature flags** | Add feature flags (e.g. admin_feature_flags table or env) for: new booking flow, payouts, gamification. Document in RUNBOOK. | Flags exist; toggling doesn't require deploy. |
| 2 | **Staged rollout plan** | Document: staging → dogfood → pilot (e.g. one city) → full launch. Criteria to move each stage. | RUNBOOK or SECTION_14 has rollout stages. |
| 3 | **Payment kill switch** | Env or flag to disable payment processing (e.g. BOOKINGS_ENABLED=false or PAYMENTS_ENABLED=false). Document in RUNBOOK. | You can turn off payments without code deploy. |
| 4 | **Booking kill switch** | Same idea for new bookings. | New bookings can be disabled via config. |
| 5 | **Payout kill switch** | Same for payout processing. | Payouts can be paused via config. |
| 6 | **Incident runbook** | Document: who is on-call, how to detect (alerts), how to mitigate (kill switches, rollback), how to communicate. See RUNBOOK § 3.1. | Incident runbook exists and is accessible. |
| 7 | **Support training** | Train support on dispute playbooks, refund flows, and IC-safe language. | Support can run playbooks and use correct language. |
| 8 | **Launch KPIs** | Define: error rate, latency, conversion, support volume. Monitor post-launch. | KPIs defined and tracked. |
| 9 | **Post-launch audit** | After first production week: review logs, disputes, payouts, and checklist; fix gaps. | Audit done and follow-ups tracked. |

---

## Execution Order Summary

| Phase | Sections | Focus |
|-------|----------|--------|
| 1 | **1** | Secrets: inventory → rotate → purge history → Railway-only. |
| 2 | **3** | Optional doc archive. |
| 3 | **6** | Crons enqueue only. |
| 4 | **7** | DTOs, validation, pagination. |
| 5 | **8** | Ownership checks. |
| 6 | **9** | Layering, refactor, test pyramid, observability. |
| 7 | **10** | Cost map, scaling tiers, budgets, dashboards. |
| 8 | **11** | Admin RBAC, dashboard, dispute UI, refunds, payouts, IC language. |
| 9 | **12** | Outcomes, evidence, reliability signals, transparency, IC language. |
| 10 | **13** | TOS, Privacy, Cleaner Agreement, retention, legal review. |
| 11 | **14** | Feature flags, kill switches, runbook, rollout, KPIs. |

---

## Where to Update When Done

- **Check off items:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) — change `- [ ]` to `- [x]` for each completed item.
- **Status docs:** Update the corresponding `docs/active/00-CRITICAL/PHASE_N_STATUS.md` when a section is fully complete.
- **Runbooks:** If you change a procedure, update the section runbook in `docs/active/sections/SECTION_NN_*.md`.
- **This doc:** Add a short "Completed on" note or move completed sections to a "Done" list at the bottom if you want to keep the guide as a single living doc.

**Last updated:** 2026-02-09
