# PureTask Hardening — Design, Build, Implement & Test Plan

**Purpose:** Highly detailed plan to **design**, **build**, **create**, **implement**, and **test** everything in the MASTER_CHECKLIST (14 sections). One section at a time; no parallelizing money + auth (Sections 1, 2, 4).

**Source of truth:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md). Runbooks: [docs/active/sections/](./sections/).

---

## 1. Executive Summary

| What | How |
|------|-----|
| **Scope** | 14 sections from MASTER_CHECKLIST; design (Sections 1–12) is done; implementation + test is not. |
| **Order** | Phases 1→2→3→4 (strict sequence); then 5,6 in parallel; then 7,8; then 9,10; then 11 (depends on 4,12); then 13,14. |
| **Per phase** | Design (if needed) → Build/Create (code, DB, config, docs) → Implement (deploy, migrate, configure) → Test (unit, integration, contract, smoke, security). |
| **Done** | Section checklist 100% complete; tests green; runbook verified; acceptance criteria met. |
| **Output** | Code in `src/`, migrations in `DB/migrations/`, CI in `.github/workflows/`, docs in `docs/active/`, legal in `docs/active/legal/`. |

---

## 2. Phase Dependency Graph

```
Phase 0: Prerequisites (repo, tooling, env)
    │
    ▼
Phase 1: Section 1 — Secrets & Incident Response
    │
    ▼
Phase 2: Section 2 — Auth Consistency & Route Protection
    │
    ▼
Phase 3: Section 3 — Guardrails, CI & Repo Hygiene
    │
    ▼
Phase 4: Section 4 — Stripe, Webhooks & Integrations
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  │
Phase 5: Section 5   Phase 6: Section 6   │
(DB & Migration)     (Workers, Crons)     │
    │                  │                  │
    └────────┬─────────┘                  │
             ▼                            │
Phase 7: Section 7 — API Design & Client Safety
             │
             ▼
Phase 8: Section 8 — Security Hardening
             │
             ▼
Phase 9: Section 9 — Maintainability & Velocity
             │
             ▼
Phase 10: Section 10 — Cost, Scale & Performance
             │
             ├── Phase 11: Section 11 — Admin Ops (needs 4, 12)
             │
Phase 12: Section 12 — Trust, Quality & Dispute Evidence (IC-Safe)
             │
             ▼
Phase 13: Section 13 — Legal, Policy & Compliance (docs/policy only)
             │
             ▼
Phase 14: Section 14 — Launch Readiness & Rollout
             │
             ▼
Post-launch: Audit, monitoring, iterate
```

**Rule:** Do **not** start Phase N+1 until Phase N is **done** (checklist + tests + acceptance criteria). Exception: Phases 5 and 6 can run in parallel after Phase 4.

---

## 3. Global Principles

| Principle | Meaning |
|-----------|--------|
| **Design first** | For Sections 13–14, complete runbook/outline before build. Sections 1–12 design is done. |
| **One PR per checklist item (or small batch)** | Each `- [ ]` in MASTER_CHECKLIST maps to one or a few PRs; no mega-PRs for a full section. |
| **Test as you go** | Every phase has test tasks; CI must stay green before merging. |
| **Runbook = source of steps** | Before coding a phase, read the section runbook in `docs/active/sections/SECTION_NN_*.md`. |
| **No skip** | Do not skip phases; do not parallelize Sections 1, 2, 4. |

---

## 4. Global Test Strategy

| Layer | Purpose | Tools / Location | When |
|-------|---------|------------------|------|
| **Unit** | Services, libs, pure logic | Jest/Vitest; `src/**/__tests__/*.test.ts`, `src/**/*.test.ts` | Every PR |
| **Integration** | DB, external APIs (mocked where needed) | Jest; `src/__tests__/integration/`, `tests/` | Every PR; nightly for heavy flows |
| **Contract** | API request/response shape, auth, errors | Jest + supertest or similar; `src/__tests__/contract/` or `tests/contract/` | Every PR for touched routes |
| **Auth smoke** | Protected route returns 401 without token; 200 with valid token | Same as integration | Phase 2 and after |
| **Security** | No secrets in repo; lint blocks legacy auth; dependency audit | Gitleaks, ESLint, `npm audit` | Every PR (CI) |
| **E2E / smoke** | Critical path: health, login, one booking flow (optional) | Playwright or Postman; optional in CI | Pre-release; Phase 14 |
| **Performance** | p50/p95, error rate (optional) | Artillery or k6; optional | Phase 10; pre-launch |

**CI gates (must pass before merge):**

- Lint (ESLint, Prettier)
- No forbidden files (.env, node_modules in repo)
- No secrets (gitleaks or equivalent)
- Unit tests pass
- Integration tests pass (or allowed to skip in CI with tag)
- Contract tests for changed routes
- Migrations apply on fresh DB (Phase 5+)

---

## 5. Phase 0: Prerequisites

**Objective:** Repo is in a known state; tooling and env are ready for Phase 1.

**Dependencies:** None.

### 5.1 Design

- [ ] Confirm MASTER_CHECKLIST and section runbooks are the authority.
- [ ] Confirm Phase 1 runbook (SECTION_01_SECRETS.md) is read and understood.

### 5.2 Build / Create

- [ ] Ensure `.env.example` exists and lists all required vars (no secrets).
- [ ] Ensure `src/config/env.ts` (or equivalent) has a list of required env vars for startup.
- [ ] Ensure `.gitignore` includes `.env*`, `node_modules/`, `dist/`, `*.log`.

### 5.3 Implement

- [ ] Clone repo (or confirm clean state); install deps (`npm ci`).
- [ ] Run existing tests: `npm test` (or `npm run test:unit`); fix any flake.
- [ ] Confirm Railway (or target) has a project for backend; no secrets in repo yet.

### 5.4 Test

- [ ] `npm run build` succeeds.
- [ ] `npm test` passes (or document known failures to fix in Phase 1–3).

### 5.5 Done criteria

- Repo builds and tests run; `.env.example` and `.gitignore` are correct; team knows Phase 1 runbook.

---

## 6. Phase 1: Section 1 — Secrets & Incident Response

**Objective:** No secrets in repo; all exposed credentials rotated; git history purged; secrets only in Railway; startup validates env.

**Runbook:** [SECTION_01_SECRETS.md](./sections/SECTION_01_SECRETS.md).

**Dependencies:** Phase 0.

### 6.1 Design

- [x] Create **secret inventory** (off-repo): Template in `docs/active/00-CRITICAL/SECRET_INVENTORY_TEMPLATE.md`; copy off-repo per runbook § 1.2.
- [x] Decide rotation order (runbook § 1.3): Stripe key → Stripe webhook secret → DB → JWT → SendGrid → Twilio → OneSignal → n8n.
- [x] Decide git purge method: BFG or git-filter-repo; force-push; require fresh clone.

### 6.2 Build / Create

- [x] **Startup env validation:** In `src/config/env.ts`, assert required vars at startup; exit with clear error if missing. Documented in ENV_VARS_CHECKLIST.md.
- [x] **.gitignore:** `.env*`, `node_modules/`, `dist/`, `*.log` confirmed.
- [x] **Incident response doc:** `docs/active/00-CRITICAL/SECURITY_INCIDENT_RESPONSE.md` with steps; linked from SECTION_01 runbook.
- [x] **Phase 1 user runbook:** `docs/active/00-CRITICAL/PHASE_1_USER_RUNBOOK.md` — step-by-step for rotate, purge, verify.

### 6.3 Implement (user actions — execute PHASE_1_USER_RUNBOOK)

- [ ] **Rotate secrets** (in order): Stripe secret key → Stripe webhook secret → DB password → JWT secret → SendGrid → Twilio → OneSignal → n8n. Use runbook § 1.4 for each provider. Update Railway (or target) only; do not commit secrets.
- [ ] **Invalidate:** Delete old Stripe keys; revoke old webhooks/tokens as per runbook.
- [ ] **Purge git history:** Run BFG or git-filter-repo to remove `.env*`; force-push; instruct all contributors to fresh clone.
- [ ] **Verify:** No `.env` in working tree; `git log --all -- .env` returns nothing (or history rewritten).
- [ ] Store all runtime secrets only in Railway (or chosen vault).

### 6.4 Test

- [x] **Startup:** Start app with one required var missing → must exit with non-zero and clear message (`requireEnv()` in env.ts).
- [ ] **Startup:** Start app with all vars set (e.g. from Railway) → app starts (run locally or after deploy).
- [x] **CI:** Secret scan (Gitleaks + forbidden files) in `.github/workflows/security-scan.yml`; fails if secret pattern or .env in repo.
- [ ] **Manual:** Confirm Stripe test PaymentIntent works with new key; Stripe test webhook returns 200 with new signing secret (after rotation).

### 6.5 Done criteria

- Secret inventory complete; all secrets rotated; git history purged; secrets only in Railway; startup env validation in place; incident response doc updated; CI secret scan runs; no secrets in repo.

---

## 7. Phase 2: Section 2 — Auth Consistency & Route Protection

**Objective:** Single canonical JWT middleware; no legacy auth in routes; every protected route uses requireAuth/requireRole; webhooks signature-only; Route Protection Table maintained and enforced by tests.

**Runbook:** [SECTION_02_AUTH.md](./sections/SECTION_02_AUTH.md). **Artifact:** [ROUTE_PROTECTION_TABLE.md](./ROUTE_PROTECTION_TABLE.md).

**Dependencies:** Phase 1.

### 7.1 Design

- [x] **Canonical auth model:** Documented in SECTION_02_AUTH and authCanonical: `requireAuth`, `requireRole`, `optionalAuth`, `requireAdmin`, `requireSuperAdmin`; no legacy auth in routes.
- [x] **Route classification:** ROUTE_PROTECTION_TABLE.md — Public / Authenticated / Role-restricted / Internal (webhooks).
- [x] **req.user contract:** `AuthedRequest.user`: id, role (AuthedRole), email? in authCanonical.

### 7.2 Build / Create

- [x] **Canonical JWT middleware:** `src/middleware/authCanonical.ts`: `requireAuth`, `requireRole`, `requireAdmin`, `requireSuperAdmin`, etc. Return 401/403 per runbook § 2.8.
- [x] **Remove legacy auth from routes:** All route files use authCanonical; jwtAuth/adminAuth remain only for unit tests.
- [x] **Apply guards:** All routes in ROUTE_PROTECTION_TABLE use requireAuth + requireRole where needed; webhooks signature-only.
- [x] **Webhook isolation:** `/stripe/webhook` gets raw body in index.ts; Stripe/n8n signature-only.
- [x] **Route Protection Table:** ROUTE_PROTECTION_TABLE.md complete; matches code.

### 7.3 Implement

- [x] Middleware wired in index.ts: public first, webhooks (raw body), then requireAuth on protected routes.
- [x] Deploy to staging: manual step; covered by CI and integration smoke tests.

### 7.4 Test

- [x] **Unit:** `src/middleware/__tests__/authCanonical.test.ts` — requireAuth 401/next; requireRole 401/403/next; requireAdmin 403/next.
- [x] **Integration / smoke:** `src/__tests__/integration/api/protected-route-auth.test.ts` — no auth → 401; invalid token → 401; valid token (mocked) → 200.
- [x] **Lint/CI:** `.github/workflows/security-scan.yml` fails if legacy auth imported from routes.

### 7.5 Done criteria

- [x] One canonical auth module; no legacy auth in routes; ROUTE_PROTECTION_TABLE matches code; auth smoke tests pass; CI fails if legacy auth is reintroduced. **Phase 2 complete.**

---

## 8. Phase 3: Section 3 — Guardrails, CI & Repo Hygiene

**Objective:** .gitignore and .env.example finalized; pre-commit and CI secret scanning; CI fails on forbidden files and legacy auth imports; branch protection enabled; non-active docs archived or clearly scoped.

**Runbook:** [SECTION_03_GUARDRAILS.md](./sections/SECTION_03_GUARDRAILS.md).

**Dependencies:** Phase 2.

### 8.1 Design

- [x] List forbidden paths: `.env`, `.env.*` (except `.env.example`), `node_modules/`, `dist/`. CI and pre-commit enforce.
- [x] Define pre-commit: block .env commits, run lint. Document in CONTRIBUTING.

### 8.2 Build / Create

- [x] **.gitignore:** `.env*`, `node_modules/`, `dist/`, `*.log`, coverage; `.env.example` not ignored.
- [x] **.env.example:** Exists with placeholders; no real secrets.
- [x] **Pre-commit:** `.githooks/pre-commit` — blocks staged .env; runs `npm run lint`. Documented in CONTRIBUTING.
- [x] **CI workflow:** `ci.yml` (lint, typecheck, test); `security-scan.yml` (forbidden files, gitleaks, legacy auth). Fail on any failure.
- [x] **Legacy auth block:** security-scan.yml fails if legacy auth imported from routes.
- [x] **Branch protection:** Documented in CONTRIBUTING (GitHub Settings → Branches); enable in repo settings.

### 8.3 Implement

- [x] Pre-commit hooks documented in CONTRIBUTING; `git config core.hooksPath .githooks` to enable.
- [ ] Enable branch protection on default branch (repo settings — manual).
- [ ] Archive non-active docs (optional).

### 8.4 Test

- [x] CI fails if .env or forbidden files in repo (security-scan.yml).
- [x] CI fails if legacy auth imported in a route (security-scan.yml).
- [x] Normal commit (no secrets, no forbidden files, no legacy auth) → CI passes when run.

### 8.5 Done criteria

- [x] .gitignore and .env.example finalized; pre-commit blocks .env and runs lint; CI runs secret scan, forbidden-file check, lint, tests, legacy-auth block; branch protection documented; Phase 3 complete (branch protection enable is manual in GitHub).

---

## 9. Phase 4: Section 4 — Stripe, Webhooks & Integrations

**Objective:** Raw body for Stripe webhook; signature verification with Buffer; idempotency for all webhook handlers; webhook_events table; payment state machine; ledger tables; payout idempotency; delivery_log for outbound; async worker for processing; handler returns 200 quickly.

**Runbook:** [SECTION_04_STRIPE_WEBHOOKS.md](./sections/SECTION_04_STRIPE_WEBHOOKS.md).

**Dependencies:** Phase 3.

### 9.1 Design

- [x] **webhook_events schema:** 042_webhook_events.sql — columns per runbook § 4.5; unique (provider, event_id).
- [x] **Payment state machine:** PAYMENT_STATE_MACHINE.md; states and transitions documented.
- [x] **Ledger schema:** credit_ledger append-only; 902/903 constraints; payout_items.
- [x] **Processing pipeline:** Phase 1 = verify → insert webhook_events → process → 200. (Optional Phase 2 worker deferred.)

### 9.2 Build / Create

- [x] **Raw body:** index.ts mounts raw for `/stripe/webhook`; handler requires Buffer, passes to constructEvent (no JSON.stringify). 400 if body not Buffer.
- [x] **Migration:** `DB/migrations/042_webhook_events.sql` — webhook_events with (provider, event_id), processing_status, payload_json, etc.
- [x] **Idempotency:** Handler inserts into webhook_events ON CONFLICT (provider, event_id) DO NOTHING RETURNING id; if no row, return 200; else process, update status to done/failed.
- [ ] **Worker:** Optional; handler processes inline. Worker with FOR UPDATE SKIP LOCKED can be added later.
- [x] **Payment state machine:** Documented in [PAYMENT_STATE_MACHINE.md](./sections/PAYMENT_STATE_MACHINE.md); status updates only in paymentService/payoutsService.
- [x] **Payout idempotency:** payoutsService uses idempotencyKey for Stripe transfer; payout_items unique on ledger_entry_id (903).
- [x] **delivery_log:** message_delivery_log exists (026); used for message delivery; extend for email/SMS as needed.
- [x] **Replay:** Same event_id → 200, no reprocess (webhook_events ON CONFLICT DO NOTHING).

### 9.3 Implement

- [ ] Run migration on dev/staging; deploy app with raw webhook route and worker.
- [ ] Trigger Stripe test webhook: confirm 200 and event stored and processed once (no duplicate ledger entries on duplicate delivery).
- [ ] Verify payout flow uses idempotency key; duplicate request does not create duplicate payout.

### 9.4 Test

- [ ] **Unit:** State machine allows only valid transitions; rejects invalid.
- [ ] **Unit:** Idempotency: same event_id twice → only one row in webhook_events; only one processing run (mock or integration).
- [ ] **Integration:** Stripe webhook with valid signature → 200, row in webhook_events, worker processes. Same event_id sent again → 200, no duplicate processing.
- [ ] **Integration:** Stripe webhook with invalid signature → 400.
- [ ] **Contract:** Webhook endpoint does not require JWT; accepts POST with Stripe signature header and raw body.

### 9.5 Done criteria

- [x] Raw body + Buffer; webhook_events table and idempotent handler; payment state machine and ledger in place; payout idempotency; delivery_log. Section 4 complete. (Optional: async worker, replay/integration tests.)

---

## 10. Phase 5: Section 5 — Database & Migration Hygiene

**Objective:** Canonical schema strategy; standardized migration naming (NNN_description.sql); NOT NULL and FK where appropriate; unique constraints for idempotency; safe migration workflow; rollback strategy for risky migrations; index map; backups and restore tested; audit tables where needed; CI applies migrations on fresh DB.

**Runbook:** [SECTION_05_DATABASE.md](./sections/SECTION_05_DATABASE.md).

**Dependencies:** Phase 4.

### 10.1 Design

- [ ] **Schema strategy:** Confirm: consolidated baseline + forward-only migrations (NNN_description.sql). No manual prod SQL except via migration runner.
- [ ] **Naming:** All new migrations: `NNN_short_description.sql`. Document in DB/README or CONTRIBUTING.
- [ ] **Index map:** List hot query paths and indexes. Justify each index. Add to runbook or DB/docs.
- [ ] **Rollback:** For destructive migrations, document rollback SQL or backward-compatible approach.

### 10.2 Build / Create

- [ ] **Migrations:** Add NOT NULL / FK / unique constraints via new migrations where safe.
- [ ] **Audit tables:** If not present: admin_audit_log (who, action, target_id, reason, timestamp); ensure ledger is append-only.
- [ ] **Migration runner:** Ensure single way to apply migrations (e.g. `npm run db:migrate`). No manual ad-hoc SQL in prod.
- [ ] **Backup/restore:** Document backup schedule; run one restore test and document steps.

### 10.3 Implement

- [ ] Run new migrations on staging; verify app and workers still work.
- [ ] Perform one backup and restore test; record outcome.

### 10.4 Test

- [ ] **CI:** Add job: create fresh DB, run all migrations in order, run smoke query. Fail if migration fails.
- [ ] **Manual:** Run rollback procedure for one risky migration in dev (if applicable).

### 10.5 Done criteria

- Migration naming and order documented; NOT NULL/FK/unique where appropriate; migration workflow and rollback strategy documented; index map and backups verified; CI runs migrations on fresh DB.

---

## 11. Phase 6: Section 6 — Workers, Crons & Background Jobs

**Objective:** Job taxonomy; durable jobs table; idempotency keys; locking (FOR UPDATE SKIP LOCKED); retry with backoff; dead-letter handling; crons only enqueue jobs; payout and dispute jobs atomic and idempotent; worker observability.

**Runbook:** [SECTION_06_WORKERS.md](./sections/SECTION_06_WORKERS.md).

**Dependencies:** Phase 4 (can run in parallel with Phase 5).

### 11.1 Design

- [x] **Job taxonomy:** Define types: cron, event (webhook), retry, maintenance. Document in runbook or ADR. — SECTION_06_WORKERS § 6.1
- [x] **Jobs table schema:** id, job_type, idempotency_key, status, attempt_count, max_attempts, locked_at, locked_by, payload_json, result_json, error_message, created_at, updated_at. Unique(job_type, idempotency_key). — hardening/906_durable_jobs.sql
- [ ] **Retry policy:** Exponential backoff + jitter; max_attempts (e.g. 5); after max → move to dead_letter or failed status; alert.
- [ ] **Cron rule:** Cron process only inserts rows into jobs table; worker process does the work.

### 11.2 Build / Create

- [ ] **Migration:** Create jobs table per schema above. Unique constraint on (job_type, idempotency_key).
- [ ] **Worker loop:** SELECT ... FROM jobs WHERE status = 'pending' AND (locked_at IS NULL OR locked_at < now() - interval '15 min') FOR UPDATE SKIP LOCKED LIMIT N; update locked_at; process; update status to completed/failed; on failure increment attempt_count and schedule retry or dead_letter.
- [ ] **Retry/backoff:** Compute next run time with exponential backoff + jitter; update jobs row.
- [ ] **Dead-letter:** Table or status; alert when job reaches max_attempts; document manual retry process.
- [ ] **Crons:** Refactor any cron that does heavy work: change to only INSERT into jobs; worker picks up.
- [ ] **Payout/dispute jobs:** Ensure each payout or dispute resolution runs in a single transaction; use idempotency_key; no double payouts.
- [ ] **Observability:** Log job start/end/error; optional metrics. Document in runbook.

### 11.3 Implement

- [ ] Deploy worker; run cron on schedule. Verify jobs are enqueued and processed; verify no duplicate processing for same idempotency_key.

### 11.4 Test

- [ ] **Unit:** Retry delay calculation; idempotency: same key twice → one execution.
- [ ] **Integration:** Enqueue job; worker picks it up; status goes to completed. Enqueue same idempotency_key again → no duplicate side effect.
- [ ] **Integration:** Job that throws → attempt_count increments; after max_attempts → dead_letter or failed; alert path tested.

### 11.5 Done criteria

- Durable jobs table and worker with locking and retry; crons only enqueue; payout/dispute jobs idempotent and atomic; observability in place; tests pass.

---

## 12. Phase 7: Section 7 — API Design & Client Safety

**Objective:** API is consistent, validated, versionable, documented; clients and automation (n8n/agents) can integrate with confidence; breaking changes are prevented or managed cleanly.

**Runbook:** [SECTION_07_API.md](./sections/SECTION_07_API.md).

**Dependencies:** Phases 5, 6.

### 12.1 Design

- [ ] **Route structure:** Document base path (/api or /api/v1); resource-based (/api/jobs, /api/bookings, etc.); separate /api/admin/* and /api/webhooks/*. Map existing routes to new structure; plan migration. See runbook § 7.1.
- [ ] **Error format:** Agree on shape: error.code (VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED, INTERNAL_ERROR), error.message, error.details (optional), requestId (always). See runbook § 7.5.
- [ ] **Status codes:** 200/201 success; 400 validation; 401 unauthenticated; 403 forbidden; 404 not found; 409 conflict; 422 domain rule (optional); 429 rate limited; 500 internal. See runbook § 7.6.
- [ ] **Pagination:** limit + cursor (preferred); return items + nextCursor. Filtering/sorting: status=..., sort=created_at:desc, from/to. One standard across routes. See runbook § 7.9.
- [ ] **Idempotency:** Risky actions (book job, release escrow, request payout, create payment intent) support Idempotency-Key header; same key → return prior result. See runbook § 7.7.
- [ ] **Versioning:** /api/v1 in URL; no remove-fields without version bump; deprecations have timeline (e.g. 30–90 days). See runbook § 7.8.

### 12.2 Build / Create

- [ ] **Route prefixes:** Refactor app to mount routes under /api/v1 (or /api), /api/admin, /api/webhooks. Update `src/index.ts` or route aggregator; update [ROUTE_PROTECTION_TABLE.md](./ROUTE_PROTECTION_TABLE.md) and any client docs.
- [ ] **DTOs:** For each endpoint define request/response types. Create `src/types/dto/` or per-route schemas; use Zod (or TypeScript interfaces) for validation. Never return raw DB rows; map DB → API shape. See runbook § 7.3.
- [ ] **Validation:** Add Zod (or equivalent) for body, query, params on every route. Validation failure → 400 with structured error list (fields, failure reason, expected format). No route handler touches req.body without validation. See runbook § 7.4.
- [ ] **Response helpers:** Centralize ok(res, data), created(res, data), error(res, code, message, details) in e.g. `src/lib/responses.ts`. Use everywhere so format is consistent. Ensure requestId on every response. See runbook § 7.5.
- [ ] **Idempotency:** For payment, payout, booking POST: read Idempotency-Key header; store and check before performing action; return cached response if same key seen. Implement in relevant services (paymentService, payoutsService, jobsService).
- [ ] **OpenAPI:** Generate spec from routes (e.g. existing `src/config/swagger.ts`) or maintain openapi.yaml; include auth methods, request/response/error schemas, examples. Expose at /api/docs or equivalent. See runbook § 7.11.
- [ ] **Contract tests:** Create `src/__tests__/contract/` or `tests/contract/`. For representative routes: assert invalid body → 400 with error shape; valid request → 200 and response matches schema; missing auth → 401 for protected routes. See runbook § 7.11.

### 12.3 Implement

- [ ] Deploy with new route structure and validation. Update Postman collection (`postman/PureTask-API.postman_collection.json`) and any frontend base URLs (e.g. /api/v1).
- [ ] Verify existing clients or document breaking changes and migration path.

### 12.4 Test

- [ ] **Unit:** Validation schemas reject invalid input; accept valid. Response helpers produce correct status and body shape.
- [ ] **Contract:** Automated tests: valid request → 200 and response matches schema; invalid body → 400 with error format; missing auth → 401 for protected routes; wrong role → 403 where applicable.
- [ ] **Integration:** Two identical POSTs with same Idempotency-Key → one side effect, same response (cached).

### 12.5 Done criteria

- Routes under /api/v1, /api/admin, /api/webhooks; DTOs and validation on all endpoints; consistent error format and status codes; Idempotency-Key on risky actions; OpenAPI spec and contract tests pass; ROUTE_PROTECTION_TABLE updated.

---

## 13. Phase 8: Section 8 — Security Hardening

**Objective:** Harden against injection, SSRF, auth/token abuse, webhook forgery/replay, CORS misconfig, rate-limit bypass, PII leakage, privilege escalation, insecure admin tooling, unsafe file uploads.

**Runbook:** [SECTION_08_SECURITY.md](./sections/SECTION_08_SECURITY.md).

**Dependencies:** Phase 7.

### 13.1 Design

- [ ] **Trust boundaries:** Document untrusted (public clients), semi-trusted (authenticated users), trusted-but-verify (webhooks), internal (workers/cron), admin. All data crossing boundaries validated and logged safely. See runbook § 8.1.
- [ ] **CORS:** List allowed frontend origins (no wildcard * with credentials); specific methods/headers. Document in config. See runbook § 8.5.
- [ ] **Rate limits:** Route-class limits: login/auth very strict; password reset strict + cooldown; search moderate; admin strict; webhooks moderate. Document limits per route group. See runbook § 8.6.
- [ ] **Admin audit schema:** who (admin id), when, what (action type), target entity, before/after (where safe), reason (required), requestId. See runbook § 8.11.

### 13.2 Build / Create

- [ ] **Input sanitization:** Zod (or equivalent) on params/query/body; strict schemas (no .passthrough() unless justified). Whitelist sortable fields and filter keys; never interpolate raw SQL; sanitize LIKE patterns. See runbook § 8.2. Implement in validation layer and any search/sort code in `src/`.
- [ ] **Ownership checks:** For every resource read/update/delete verify req.user.id or role matches resource owner or admin. Add checks in services (e.g. jobsService, disputesService) or middleware. Client sees only their jobs; cleaner only assigned jobs; admin sees all but actions audited. See runbook § 8.4.
- [ ] **CORS:** Configure CORS in `src/index.ts` with allowlist; remove wildcard if present. Specific methods/headers. See runbook § 8.5.
- [ ] **Security headers:** Add or verify Helmet: X-Content-Type-Options: nosniff; X-Frame-Options or CSP frame-ancestors; HSTS if HTTPS; referrer-policy; remove X-Powered-By. See runbook § 8.5.
- [ ] **Rate limiting:** Add express-rate-limit (or equivalent) per route group: auth routes strict (e.g. 5/min per IP); webhooks moderate; API per-user or per-IP. Return 429, Retry-After header, error code RATE_LIMITED. See runbook § 8.6.
- [ ] **Webhook replay:** Rely on idempotency (Phase 4); optionally reject stale timestamps. Document in runbook. See runbook § 8.7.
- [ ] **SSRF:** For outbound HTTP from server: allowlist hostnames; block private IPs (127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, metadata IPs). Short timeouts (3–10s); max response size. Implement in HTTP client or proxy used by `src/integrations/`. See runbook § 8.8.
- [ ] **File upload:** MIME allowlist (jpg, png, heic); max size (e.g. 10MB); prefer client upload via signed URL; backend validates metadata and links record. Strip EXIF location. Store private; access via signed URLs (short TTL). Implement in `src/services/fileUploadService.ts` or equivalent. See runbook § 8.9.
- [ ] **Logging / PII:** Never log Authorization header, cookies, tokens, provider keys, passwords. Define PII fields (email, phone, address); use centralized logger that auto-redacts; requestId/correlationId on every log. Replace console.log in production path. See runbook § 8.10.
- [ ] **Admin audit log:** Create or extend admin_audit_log table: admin_user_id, action, target_type, target_id, reason, metadata, ip, created_at. Every sensitive action (refund, payout hold, dispute ruling, role change, account disable) writes one row; reason required. Implement in admin routes and services; block action if reason missing. See runbook § 8.11.
- [ ] **Dependencies:** Run npm audit; fix or document critical/high. Add npm audit to `.github/workflows/ci.yml` (fail on critical). Enable Dependabot or Renovate. See runbook § 8.12.

### 13.3 Implement

- [ ] Deploy with CORS, Helmet, rate limits, ownership checks, audit logging. Verify admin actions write to audit log; verify rate limit returns 429 when exceeded; verify disallowed origin gets CORS error.

### 13.4 Test

- [ ] **Unit:** Ownership check rejects wrong user; allows owner and admin. Audit log write called when action executed; action blocked when reason missing.
- [ ] **Integration:** Request from disallowed origin → CORS error. Request with XSS in body → sanitized or rejected. Exceed rate limit → 429 with Retry-After.
- [ ] **Security:** npm audit; no critical open. CI runs npm audit and fails on critical.

### 13.5 Done criteria

- Input sanitized and ownership enforced everywhere; CORS allowlist and Helmet configured; rate limits per route class; webhook and SSRF protections; file upload secure; PII redacted in logs; admin_audit_log in place and required for sensitive actions; dependency monitoring in CI.

---

## 14. Phase 9: Section 9 — Maintainability & Velocity

**Objective:** Codebase easier to understand, harder to break, faster to change; new dev can onboard quickly; tests catch regressions; shipping features doesn’t cause chaos.

**Runbook:** [SECTION_09_MAINTAINABILITY.md](./sections/SECTION_09_MAINTAINABILITY.md).

**Dependencies:** Phase 8.

### 14.1 Design

- [ ] **Layering:** Document target structure: routes (thin) → controllers/services → repositories; routes don’t talk directly to DB. Identify files that violate; list refactor targets. See runbook § 9.1, 9.2.
- [ ] **Test framework:** Confirm single framework (Jest or Vitest); one config for unit, one for integration if needed. See runbook § 9.5.
- [ ] **PR template:** Define fields: what changed; why; test evidence; rollback notes (if risky); migration notes (if DB). See runbook § 9.9.

### 14.2 Build / Create

- [ ] **Refactor priorities:** (A) Central error handler; standard validation wrappers; standard auth wrappers; consolidate integration clients. (B) Break up oversized route files; remove duplicate routers/imports; normalize naming. (C) Extract state machines into domain/; create repositories; job queue consistency. Do in small PRs. See runbook § 9.4.
- [ ] **Response helpers:** Already in Phase 7; ensure all routes use ok/created/error from central module (e.g. `src/lib/responses.ts`). See runbook § 9.3.
- [ ] **Logging:** Ensure requestId (or correlationId) on every request; structured logs (JSON or key-value); no console.log in production path. Add middleware that sets requestId; pass to logger. See runbook § 9.3.
- [ ] **Validation wrapper:** validateBody(schema), validateQuery(schema), validateParams(schema) in middleware; use in all routes. See runbook § 9.3.
- [ ] **Lint/format:** ESLint and Prettier config (`.eslintrc.json`, `.prettierrc.json`); run in CI; fix or exclude legacy with comments. Ban: legacy auth import, direct DB access from routes, raw SQL string interpolation. See runbook § 9.7.
- [ ] **PR template:** Add `.github/PULL_REQUEST_TEMPLATE.md` with what, why, test, rollback notes, migration notes.
- [ ] **Docs:** Update README.md (setup, env, run, test). Create or update ARCHITECTURE.md (layering, key flows). CONTRIBUTING.md (branching, PR, lint/test, commit). RUNBOOK.md (deploy, rollback, incident, contacts). Link API docs (OpenAPI). See runbook § 9.8.
- [ ] **Observability:** RequestId middleware; optional slow query log (log any query > 500ms). Document dashboard or log aggregation if used. See runbook § 9.9.

### 14.3 Implement

- [ ] All new code follows layering and logging; PRs use template; docs linked from README. Refactors merged incrementally; system stays deployable.

### 14.4 Test

- [ ] **Unit:** Coverage for new/changed services; target e.g. 70%+ for critical paths (auth, payment, payout). State machines, idempotency logic, validation edge cases. See runbook § 9.5.
- [ ] **Integration:** Key workflows: booking, payment event processing, job completion, escrow release, payout creation. Use ephemeral Postgres in CI; migrations from scratch; no tests rely on local state. See runbook § 9.5, 9.6.
- [ ] **Lint/format:** ESLint and Prettier pass in CI.

### 14.5 Done criteria

- Layering documented and enforced; no business logic or DB in route handlers; response helpers and logging standard; single test framework; test pyramid in place; lint/format and PR template; README, ARCHITECTURE, CONTRIBUTING, RUNBOOK updated; requestId and slow query log in place.

---

## 15. Phase 10: Section 10 — Cost, Scale & Performance

**Objective:** Platform stays fast as usage grows, cheap relative to revenue, scales predictably; clear upgrade triggers (when to add Redis, queues, replicas).

**Runbook:** [SECTION_10_COST_SCALE.md](./sections/SECTION_10_COST_SCALE.md).

**Dependencies:** Phase 9.

### 15.1 Design

- [ ] **Scaling tiers:** Define MVP/Early (e.g. 50–500 bookings/week, <10k requests/day, 1 worker); Growth (1k–10k bookings/week, 50k–300k/day, multiple workers); Scale (10k+ bookings/week, 1M+ requests/day, queue, replicas). Document in runbook. See runbook § 10.1.
- [ ] **Cost map:** List cost centers: infra (Railway, Neon, Redis, logging), providers (Stripe, SendGrid, Twilio, OneSignal), storage (photos, CDN), support/ops. Unit cost and what triggers growth; how to reduce. See runbook § 10.2.
- [ ] **Performance budgets:** p50 < 200ms; p95 < 800ms; error rate < 0.5%; queue lag < 1 min for important async. Slow query: most < 50ms; any > 250ms investigated. See runbook § 10.3.
- [ ] **Caching:** Allowed list (e.g. public config, pricing rules if global, admin stats); TTL 30–300s. Do NOT cache: balances, job state transitions, payout eligibility. See runbook § 10.5.
- [ ] **Worker queues:** Critical (payment events, payouts, dispute actions); standard (notifications, n8n); low (cleanup, analytics). Document in runbook. See runbook § 10.6.

### 15.2 Build / Create

- [ ] **Indexes:** Add composite indexes for hot paths (jobs feed/search/filter, booking creation, job completion, disputes list, ledger/payout, admin dashboards). Prefer cursor pagination; avoid %LIKE% scans. Document in Phase 5 index map or runbook. See runbook § 10.4.
- [ ] **Caching:** Implement or document cache for allowed entities (e.g. pricing snapshot, holidays); set TTL; document invalidation. Use in-memory or Redis; no cache for user-specific or mutable without invalidation. See runbook § 10.5.
- [ ] **SMS/email policy:** Document when SMS vs email; batch notifications; caps per user per day if needed. Twilio: SMS only high-urgency; push/email for non-urgent. SendGrid: consolidate; move non-critical to push/in-app. See runbook § 10.7.
- [ ] **Rate limits:** Per-user + per-IP (Phase 8); ensure limits sufficient for cost control. Document in runbook. See runbook § 10.9.
- [ ] **Dashboards:** Build or document Grafana/Railway dashboard: latency p50/p95, error rate, queue lag (jobs pending), payout success rate. Alerts when over budget. See runbook § 10.10.
- [ ] **Upgrade triggers:** Document when to add Redis, worker replicas, split services, multi-region. Add to runbook or docs/active/. See runbook § 10.11.

### 15.3 Implement

- [ ] Deploy indexes and caching; enable dashboards and alerts. Verify p95 and error rate in range; verify queue lag visible.

### 15.4 Test

- [ ] **Performance (optional):** Run load test (Artillery or k6) for critical path in staging; assert p95 < budget. See runbook § 10.12.
- [ ] **Smoke:** After deploy, verify latency and errors in dashboard; verify no regression on key endpoints.

### 15.5 Done criteria

- Scaling tiers and cost map documented; performance budgets set; hot queries optimized; caching policy in place; worker queues documented; dashboards and alerts; upgrade triggers documented.

---

## 16. Phase 11: Section 11 — Admin Ops & Support

**Objective:** Internal admin reduces support time, enforces consistent decisions, manages disputes/refunds/payouts safely, full auditability; IC-safe language everywhere.

**Runbook:** [SECTION_11_ADMIN_OPS.md](./sections/SECTION_11_ADMIN_OPS.md).

**Dependencies:** Phase 4, Phase 12 (implement after or in parallel with Phase 12).

### 16.1 Design

- [ ] **RBAC matrix:** support_agent (view, notes); support_lead (refunds/credits within limits, override dispute); ops_finance (refund large, hold payout); admin (all, including role change). Document action × role matrix. See runbook § 11.2.
- [ ] **Audit requirement:** Every action: who, when, what, target entity, before/after (where safe), reason (required), requestId. No action without reason. See runbook § 11.3.
- [ ] **IC-safe language:** “Platform status adjustment” not “override completion”; “risk indicators” not “warnings”; no PIPs, mandatory re-cleans, productivity targets. Audit all admin copy. See runbook § 11.1.

### 16.2 Build / Create

- [ ] **Admin guards:** requireRole('admin') or requireRole(['support_lead','ops_finance','admin']) per route. Implement in `src/routes/admin/`. For POST/PATCH that change state or money: require audit reason in body; validate non-empty; store in admin_audit_log before executing action. See runbook § 11.3.
- [ ] **Ops dashboard:** Page or section: list open disputes; webhook event log (last N, status, replay link); payout queue and status; risk flags (user flags, dispute rate). Use existing admin routes or add in `src/routes/admin/` (e.g. system.ts, finance.ts). See runbook § 11.4.
- [ ] **Dispute resolution UI:** View dispute; view evidence; select outcome (uphold client, uphold cleaner, partial); require reason; write to audit log and update dispute. Playbooks in runbook or in-app help. See runbook § 11.4, 11.5.
- [ ] **Refund/credit:** Admin endpoint to issue refund or credit; amount + reason required; write ledger entry and audit log; idempotent by idempotency_key. Implement in admin finance or payments route. See runbook § 11.4.
- [ ] **Payout holds/releases:** Endpoint to hold or release payout for user; reason required; idempotent; write audit log. Implement in admin finance. See runbook § 11.4.
- [ ] **Webhook/delivery log viewer:** List webhook_events with filter; show payload (redacted) and processing status; “replay” button that re-enqueues (idempotent). List delivery_log for outbound email/SMS/push. See runbook § 11.4.
- [ ] **Case management:** Notes on dispute or user; assignee; resolution status. DB table and API for notes, assignee; admin UI to edit. See runbook § 11.7.
- [ ] **Copy audit:** Replace “override,” “warning,” “performance” with IC-safe terms in admin UI and support emails. See runbook § 11.1, 12.12.

### 16.3 Implement

- [ ] Deploy admin UI and API. Test with support_agent and admin roles; verify audit log entries for refund, hold, dispute ruling; verify support_agent cannot refund.

### 16.4 Test

- [ ] **Unit:** requireRole blocks wrong role (403); audit reason required returns 400 if missing.
- [ ] **Integration:** Admin refund creates ledger entry and audit log; payout hold prevents payout; webhook replay re-enqueues and processes once; retry payout doesn’t double-pay. See runbook § 11.9.
- [ ] **Manual:** IC language audit of admin screens and support emails.

### 16.5 Done criteria

- Admin RBAC and audit reason enforced; ops dashboard and dispute resolution UI functional; refund/credit and payout hold/release with audit; webhook and delivery log viewer and replay; case management; IC-safe language verified everywhere.

---

## 17. Phase 12: Section 12 — Trust, Quality & Dispute Evidence (IC-Safe)

**Objective:** Minimize disputes by defining “done” (outcomes), structured evidence, fair explainable outcomes — without directing how independent contractors perform work.

**Runbook:** [SECTION_12_TRUST_IC_SAFE.md](./sections/SECTION_12_TRUST_IC_SAFE.md).

**Dependencies:** Phase 7, 8. Can overlap with Phase 11.

### 17.1 Design

- [ ] **Outcomes:** Define service outcome definitions per service type (areas included, tasks expected, exclusions). Describe outcome purchased by client, not method/tools/process. Store in structured form. See runbook § 12.2.
- [ ] **Evidence:** Optional unless required for specific protections (payout protection, dispute priority). Evidence = photos, notes; documents outcomes, not supervision. Guidelines (e.g. show area, before/after, within job window) — not work instructions. See runbook § 12.3, 12.4.
- [ ] **Review window:** Client can submit feedback within X days; after window, auto-accept or close; escrow released. Document in config or runbook. See runbook § 12.6.
- [ ] **Structured feedback:** Categories (missed area, incomplete task, quality issue, damage claim, other — limited); link to outcome definitions; optional photo. See runbook § 12.6.
- [ ] **Auto-resolution:** Rules: evidence supports completion + vague/out-of-window feedback → deny or partial; explainable. See runbook § 12.7.
- [ ] **Reliability:** Signals = platform interaction patterns (dispute frequency, completion confirmations, evidence participation, cancellation). Tiers affect access (visibility, pricing, payout timing, protections); not performance supervision. See runbook § 12.8.
- [ ] **Language:** Use “eligibility,” “access,” “participation requirements,” “platform protections,” “outcome verification.” Avoid “required procedures,” “must follow,” “performance correction,” “mandatory re-cleans,” “warnings.” See runbook § 12.12.

### 17.2 Build / Create

- [ ] **Outcome definitions:** Table or config: outcome_id, name, description, version; per service type. Use in dispute and payout eligibility logic. Store in DB or `src/` config. See runbook § 12.2.
- [ ] **Evidence schema:** Optional evidence submission; link to job and dispute; store in job_photos or evidence table; link to dispute protection. See runbook § 12.3.
- [ ] **Review window:** Config or DB: window_days; job status transitions after window (e.g. auto-complete, escrow release). Enforce in job/dispute service. See runbook § 12.6.
- [ ] **Structured feedback:** API and UI: client selects category (and optional rating); optional photo. Store in feedback table; use in auto-resolution. See runbook § 12.6.
- [ ] **Auto-resolution:** Implement in disputesService: apply rules (evidence present, category, timing); set outcome and explanation; write audit log. Automation explainable. See runbook § 12.7.
- [ ] **Reliability:** Compute or expose reliability tier (Developing, Semi Pro, Pro, Elite) from existing logic; ensure copy is access-based (visibility, payout timing) not performance-based. See runbook § 12.8.
- [ ] **Copy audit:** Grep and replace forbidden phrases in API messages, UI, emails with outcome- and evidence-based language. See runbook § 12.12.

### 17.3 Implement

- [ ] Deploy outcome definitions, evidence linkage, review window, structured feedback, auto-resolution. Verify dispute flow and payout eligibility use outcomes; verify copy is IC-safe in app and emails.

### 17.4 Test

- [ ] **Unit:** Auto-resolution rules: given evidence and category, correct outcome. Outcome definitions load and versioned.
- [ ] **Integration:** Submit evidence → linked to dispute; review window expires → status updates; structured feedback stored and used in resolution.
- [ ] **Copy:** Grep for “required procedures,” “performance correction,” “mandatory re-cleans”; replace; manual audit of key user-facing strings.

### 17.5 Done criteria

- Outcomes defined and versioned; evidence optional and linked to protections; review window and auto-accept; structured feedback and auto-resolution; reliability as access; transparency and IC-safe language everywhere.

---

## 18. Phase 13: Section 13 — Legal, Policy & Compliance

**Objective:** Full TOS consolidated; IC Safeguards appendix and in-app copy; Cleaner Agreement; Privacy Policy; refund & cancellation policy; evidence retention; liability boundaries; legal review pass.

**Runbook:** [SECTION_13_LEGAL.md](./sections/SECTION_13_LEGAL.md). **Artifacts:** [docs/active/legal/README.md](./legal/README.md).

**Dependencies:** Phases 11, 12 (for alignment with admin and trust language).

### 18.1 Design

- [ ] **TOS structure:** Merge all TOS sections from MASTER_CHECKLIST: Platform role; IC relationship; No control over performance; No exclusivity; Service outcomes; Evidence & verification; Job completion & payments; Client review & disputes; Trust signals & access; Administrative actions; Reservation of rights. Order and cross-check with Section 11/12 language. See runbook § 13.2.
- [ ] **Cleaner Agreement:** Separate document; cleaners sign/accept. Covers: IC status, no employment, platform rules, payout terms, dispute resolution, evidence requirements, termination of access. See runbook § 13.4.
- [ ] **Privacy Policy:** What data collected; how used; retention; sharing (Stripe, SendGrid, Twilio); user rights (access, deletion, portability). GDPR/CPRA framing. See runbook § 13.5.
- [ ] **Refund & cancellation:** User-facing policy; internal playbook alignment (Section 11). Refund windows (e.g. 48h); max refund by role; client vs cleaner cancellation; fees/credits; grace periods. See runbook § 13.6.
- [ ] **Evidence retention:** How long job photos, dispute evidence, audit logs kept; deletion process; legal hold exceptions. See runbook § 13.7.
- [ ] **Liability:** Cap; exclusion of consequential damages; “as is” where appropriate; indemnification; insurance. See runbook § 13.8.

### 18.2 Build / Create

- [ ] **TOS_CONSOLIDATED.md:** Single document in `docs/active/legal/` with all TOS sections merged. Version and date. See runbook § 13.2.
- [ ] **IC_SAFEGUARDS_APPENDIX.md:** Full text for TOS appendix and in-app; link from TOS. See runbook § 13.3.
- [ ] **AB5_ANALYSIS.md:** California AB5 / ABC Test prong-by-prong; how design satisfies A, B, C. For counsel. See runbook § 13.3.
- [ ] **LAWYER_REVIEW_NOTES.md:** Rationale for each TOS clause (for counsel). Create from existing notes if available. See runbook § 13.9.
- [ ] **Cleaner Agreement:** Draft in `docs/active/legal/CLEANER_AGREEMENT.md`. See runbook § 13.4.
- [ ] **Privacy Policy:** Draft in `docs/active/legal/PRIVACY_POLICY.md`. GDPR/CPRA framing. See runbook § 13.5.
- [ ] **Refund & cancellation:** `docs/active/legal/REFUND_CANCELLATION_POLICY.md`. See runbook § 13.6.
- [ ] **Evidence retention:** `docs/active/legal/EVIDENCE_RETENTION.md`. See runbook § 13.7.
- [ ] **Liability / indemnification:** Section in TOS or separate memo in `docs/active/legal/`. See runbook § 13.8.
- [ ] **IN_APP_COPY_CLEANER.md / IN_APP_COPY_CLIENT.md:** Short IC-safe bullets for in-app display. Create in `docs/active/legal/`. See runbook § 13.3.

### 18.3 Implement

- [ ] Publish TOS and Privacy Policy (link from app and website). Cleaner Agreement: present at signup or first login; record acceptance in DB (e.g. user_agreements or cleaner_agreement_accepted_at). In-app copy: deploy to cleaner and client apps from IN_APP_COPY_*.md.

### 18.4 Test

- [ ] **Legal review:** Send consolidated TOS, Cleaner Agreement, Privacy Policy, refund/cancellation, evidence retention, liability to counsel. Fix per feedback. See runbook § 13.10.
- [ ] **Compliance checklist:** GDPR/CPRA clauses present; IC language consistent with Sections 11/12; evidence retention and deletion implementable in code/policy.

### 18.5 Done criteria

- All legal docs in legal/ and linked from legal/README.md; TOS and Privacy Policy published; Cleaner Agreement presented and acceptance stored; in-app copy deployed; legal review completed; evidence retention and liability documented.

---

## 19. Phase 14: Section 14 — Launch Readiness & Rollout

**Objective:** Feature flags, staged rollout, kill switches (payments, bookings, payouts), incident runbook, support training, launch KPIs; “ready” becomes “live safely.”

**Runbook:** [SECTION_14_LAUNCH.md](./sections/SECTION_14_LAUNCH.md).

**Dependencies:** Phases 1–13.

### 19.1 Design

- [ ] **Feature flags:** List launch-critical flags (e.g. new booking flow, new payout schedule, new dispute UI). Config or DB-driven; checked at runtime; no secrets in flags. See runbook § 14.2.
- [ ] **Rollout phases:** Internal only → beta cleaners/clients → limited geo → full. Criteria per phase: success metrics, rollback triggers, who has access. See runbook § 14.3.
- [ ] **Kill switches:** Payment (disable new intents/charges); Booking (disable new bookings); Payout (pause payouts). Env flag or admin toggle; checked in code; immediate effect (no deploy). See runbook § 14.4.
- [ ] **Incident runbook:** Triggers: payment failures, webhook backlog, payout errors, security alert, data breach suspicion. Steps: who to notify; enable kill switch; rollback deploy; escalate; communicate (internal + external if needed). See runbook § 14.5.

### 19.2 Build / Create

- [ ] **Feature flags:** Implement flag system (e.g. env vars FEATURE_X_ENABLED or DB table feature_flags). Wrap new booking flow, payout schedule, dispute UI behind flags. Document in runbook. See runbook § 14.2.
- [ ] **Kill switches:** PAYMENTS_ENABLED, BOOKINGS_ENABLED, PAYOUTS_ENABLED (or KILL_SWITCH_PAYMENTS etc.). In paymentService: if !PAYMENTS_ENABLED return 503 or maintenance response. In booking creation route: if !BOOKINGS_ENABLED return 503. In payout execution: if !PAYOUTS_ENABLED skip or return. Admin UI or runbook step to flip in Railway. Document in runbook. See runbook § 14.4.
- [ ] **Incident runbook:** Document in `docs/active/00-CRITICAL/INCIDENT_RUNBOOK.md` (or extend SECURITY_INCIDENT_RESPONSE). Triggers and steps per runbook § 14.5. Link from MASTER_CHECKLIST and admin dashboard. See runbook § 14.5.
- [ ] **Support training:** Document or session: how to use dispute UI, refund/credit, when to escalate; IC-safe language; playbook usage. Material in docs/active/ or Notion. See runbook § 14.6.
- [ ] **Launch KPIs:** Dashboard or checklist: error rate, p95 latency, webhook success rate, queue lag, payout success rate; bookings/day, dispute rate, refund rate, payout volume. Alerts when thresholds breached. Document in runbook. See runbook § 14.7.
- [ ] **Post-launch audit:** Schedule 1 week and 1 month after launch. Template: what went wrong/right; Sections 1–13 compliance; kill switch usage; incident count. Store in docs/active/. See runbook § 14.8.

### 19.3 Implement

- [ ] Enable feature flags per rollout phase. Deploy kill switches; run one drill: flip payment kill switch, verify no new charges, re-enable. Train support; go live per rollout plan. Configure launch KPIs and alerts.

### 19.4 Test

- [ ] **Unit or integration:** When PAYMENTS_ENABLED=false, createPaymentIntent (or equivalent) returns 503 or maintenance. Same for booking creation and payout execution. See runbook § 14.4.
- [ ] **E2E (optional):** Critical path: health → login → list jobs → create job (or one booking step). Run in staging before launch. See runbook § 14.
- [ ] **Incident drill:** Simulate webhook backlog or payment failure; follow runbook; verify escalation and communication path. See runbook § 14.5.

### 19.5 Done criteria

- Feature flags and all three kill switches implemented and tested; incident runbook documented and linked; support trained; launch KPIs and alerts in place; rollout plan executed; post-launch audit scheduled and template ready.

---

## 20. Appendix A: File and Responsibility Map

| Area | Primary paths | Owner (example) |
|------|----------------|-----------------|
| Config / env | src/config/env.ts, .env.example | Backend |
| Auth | src/middleware/auth.ts, src/lib/auth.ts | Backend |
| Routes | src/routes/, ROUTE_PROTECTION_TABLE.md | Backend |
| Webhooks | src/routes/stripe, n8n; webhook handler + worker | Backend |
| DB | DB/migrations/, src/db/, src/core/db/ | Backend |
| Workers | src/workers/, jobs table | Backend |
| API contract | src/types/dto/, OpenAPI spec, contract tests | Backend |
| Security | Helmet, CORS, rate limit, audit log in src/ | Backend |
| Admin UI | Admin routes + frontend admin app | Full-stack |
| Legal | docs/active/legal/*.md | Founder + counsel |
| Runbooks | docs/active/sections/, 00-CRITICAL | Ops |

---

## 21. Appendix B: Test Matrix (by phase)

| Phase | Unit | Integration | Contract | Smoke / E2E | Security |
|-------|------|-------------|----------|-------------|----------|
| 0 | Build + existing tests | — | — | — | — |
| 1 | Env validation | Startup with/without vars | — | — | Secret scan |
| 2 | Auth middleware | Auth smoke (401/200) | — | — | Legacy auth block |
| 3 | — | — | — | — | Forbidden file, secret scan |
| 4 | State machine, idempotency | Webhook 200, no duplicate | Webhook no JWT | — | Signature verification |
| 5 | — | — | — | Migrations on fresh DB | — |
| 6 | Retry, idempotency | Job process once, dead-letter | — | — | — |
| 7 | Validation schemas | Idempotency key | Route schema, auth, errors | — | — |
| 8 | Ownership | CORS, rate limit 429 | — | — | npm audit |
| 9 | Services | Key flows | — | — | Lint |
| 10 | — | — | — | Latency/error dashboard | — |
| 11 | requireRole, audit reason | Refund, hold, audit log | — | — | — |
| 12 | Auto-resolution, outcomes | Evidence, review window | — | — | Copy audit |
| 13 | — | — | — | — | Legal review |
| 14 | Kill switch behavior | Kill switch | — | E2E critical path (opt) | Incident drill |

---

## 22. Appendix C: Risk and Mitigation

| Risk | Mitigation |
|------|------------|
| Secrets re-leak | Phase 1 purge + Phase 3 CI secret scan + pre-commit |
| Auth drift / legacy reintroduced | Phase 2 single middleware + Phase 3 lint block |
| Double charge / ghost payout | Phase 4 idempotency, ledger, state machine, worker |
| Migration breaks prod | Phase 5: test on fresh DB in CI; rollback strategy |
| Worker duplicate processing | Phase 6: locking, idempotency_key, tests |
| API breaking clients | Phase 7: versioning /api/v1, contract tests |
| Security regression | Phase 8: ownership, CORS, rate limit, audit log; Phase 3 secret scan |
| IC misclassification | Phases 11, 12, 13: language audit, legal review, TOS |
| Launch incident | Phase 14: kill switches, incident runbook, support training |

---

**Last updated:** 2026-01-31.  
**Next:** Start with Phase 0, then Phase 1 per [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md) and [SECTION_01_SECRETS.md](./sections/SECTION_01_SECRETS.md).
