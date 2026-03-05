# PureTask — 100% Production Readiness Checklist

**Purpose:** Long list of everything required to reach full production readiness. Work through this list systematically.

---

## 1. Secrets & Incident Response

- [ ] Identify all exposed credentials (Stripe, Twilio, SendGrid, JWT, DB) — use SECRET_INVENTORY_TEMPLATE off-repo
- [ ] Rotate all exposed secrets (order: Stripe → Stripe webhook → DB → JWT → SendGrid → Twilio → OneSignal → n8n)
- [ ] Invalidate old tokens / webhooks
- [ ] Remove secrets from git history (BFG or git filter-repo; force-push; fresh clone)
- [ ] Force fresh clone for all contributors
- [ ] Store secrets only in Railway (or secure vault)
- [ ] Document and test incident response runbook
- [ ] Run secret rotation drill annually

---

## 2. Auth & Route Protection

- [x] Canonical JWT middleware (authCanonical)
- [x] All routes use requireAuth / requireRole
- [x] Webhook routes isolated (signature-only)
- [x] Route Protection Table
- [ ] Verify no auth bypass paths in new routes
- [x] Add auth integration tests for protected routes (401/403/200)

---

## 3. Guardrails & CI

- [x] .gitignore, .env.example, pre-commit
- [x] CI secret scanning
- [x] Fix ESLint config (no-restricted-imports) so pre-commit passes
- [ ] Enable branch protection (require PR review, status checks)
- [ ] CI runs on all PRs (lint, typecheck, test, build)
- [ ] Archive or consolidate non-active docs

---

## 4. Stripe, Webhooks & Integrations

- [x] Raw body for Stripe webhook signature verification
- [x] Idempotency on webhook handlers
- [x] webhook_events table, durable storage
- [ ] Verify Stripe webhook URL in prod matches deployed URL
- [ ] Test webhook replay handling end-to-end
- [ ] Document Stripe Connect onboarding flow for cleaners

---

## 5. Database & Migrations

- [x] Canonical schema, migrations, indexes
- [ ] Run all migrations on production DB (or verify current state)
- [ ] Test backup restore on staging
- [ ] Document rollback procedure for risky migrations
- [x] Verify DATABASE_URL has sslmode=require in prod (startup warning; ENV_VARS_CHECKLIST)
- [ ] Set up Neon (or Postgres) connection pooling if needed

---

## 6. Workers & Background Jobs

- [x] Durable jobs table, locking, retry, dead-letter
- [ ] Fully migrate crons to enqueue-only (CRONS_ENQUEUE_ONLY=true) and verify durable job worker runs
- [ ] Register handlers for all QUEUE_NAMES in use (or deprecate unused)
- [ ] Add queue depth / dead-letter metrics and alerts
- [ ] Schedule cleanupOldJobs and lock recovery
- [x] Document which worker runs when (scheduler vs durable worker) — RUNBOOK, DEPLOYMENT

---

## 7. API Design & Client Safety

- [x] Route structure, error format, idempotency, versioning
- [ ] Create DTOs for all endpoints (request/response/error)
- [ ] Validate params/query/body everywhere (Zod)
- [ ] Standardize pagination (cursor, limit, sort) across list endpoints
- [ ] Export OpenAPI spec as file for SDK generation
- [ ] Add contract tests for all public endpoints

---

## 8. Security Hardening

- [x] Input sanitization, CORS, security headers, rate limits, SSRF protection, file upload, log redaction, admin audit
- [ ] Enforce ownership checks on all resource reads/writes (audit every route)
- [ ] Add CSRF protection for state-changing requests (if applicable)
- [x] Verify no PII in error responses in production (sendError, global handler; contract test)
- [x] Dependency audit (npm audit) — fix critical/high; CI runs audit --audit-level=critical
- [ ] Penetration test or security review (optional but recommended)

---

## 9. Maintainability & Velocity

- [x] Response helpers, logging, lint, PR template, developer docs
- [ ] Enforce project layering (routes → services → db)
- [ ] Refactor oversized files (break up god files)
- [ ] Implement test pyramid (unit, integration, contract, smoke)
- [x] Add slow query logging and requestId to all logs (db/client SLOW_QUERY_MS; logger uses requestContext)
- [x] Document how to add a new route, service, worker (CONTRIBUTING)

---

## 10. Cost, Scale & Performance

- [x] Scaling tiers, upgrade triggers, rate limits
- [ ] Create cost map doc (unit cost per tool: Stripe, SendGrid, Twilio, Neon, Railway, storage)
- [ ] Wire performance budgets into alerts (p50 < 200ms, p95 < 800ms, error rate < 0.5%)
- [ ] Document hot-path vs index map
- [ ] Implement cursor pagination for high-cardinality list endpoints
- [ ] Create caching allowed list + TTL policy doc
- [ ] Map queue names to priority (critical / standard / low) and document backpressure
- [ ] Create notification channel policy table (type → channel, avoid SMS unless …)
- [ ] Document storage/bandwidth policy (compression, lifecycle, CDN, no proxy)
- [ ] Build or wire performance dashboards (p95, error rate, queue lag)
- [ ] Build or wire cost dashboards (Twilio, SendGrid, Stripe, storage)

---

## 11. Admin Ops & Support

- [ ] Define and implement admin RBAC roles (support_agent, support_lead, ops_finance, admin)
- [ ] Implement requireRole + requireAuditReason for all sensitive admin actions
- [ ] Build ops dashboard (disputes, webhooks, payouts, risk flags)
- [ ] Implement dispute resolution UI (evidence, playbooks, outcomes)
- [ ] Implement refund/credit flows (guarded; ledger + audit)
- [ ] Implement payout holds/releases (idempotent)
- [ ] Build webhook + delivery log viewer (replay safe)
- [ ] Add case management (notes, resolution, assignee)
- [ ] Use IC-safe language everywhere (“platform status adjustment” not “override”)

---

## 12. Trust, Quality & Dispute Evidence

- [ ] Define service outcomes (what was purchased), not methods
- [ ] Store outcome definitions structurally (versioned)
- [ ] Implement optional evidence submission (required for certain protections)
- [ ] Link evidence to dispute protection / payout eligibility
- [ ] Enforce review window + auto-accept logic
- [ ] Implement structured client feedback (categories)
- [ ] Implement auto-resolution logic (explainable; evidence-based)
- [ ] Implement reliability signals (visibility, payout timing)
- [ ] Enforce transparency (cleaners/clients see how decisions work)
- [ ] Validate IC-safe language everywhere (no “required procedures,” “performance correction”)

---

## 13. Legal, Policy & Compliance

- [ ] Finalize full Terms of Service (consolidate all sections)
- [ ] Publish Independent Contractor Safeguards (TOS appendix + in-app)
- [ ] Create Cleaner Agreement (separate document)
- [ ] Create Privacy Policy (GDPR/CPRA framing)
- [ ] Define refund & cancellation policy (user-facing)
- [ ] Define evidence retention & deletion rules
- [ ] Define liability boundaries (cap, exclusions, indemnification)
- [ ] Legal review pass (counsel sign-off)

---

## 14. Launch Readiness & Rollout

- [ ] Add feature flags for launch-critical features
- [ ] Define staged rollout plan (phases, criteria, rollback triggers)
- [ ] Verify payment kill switch (PAYOUTS_ENABLED, CREDITS_ENABLED)
- [ ] Verify booking kill switch (BOOKINGS_ENABLED)
- [ ] Create incident runbook (triggers, steps, escalation, communication)
- [ ] Train support on dispute UI, refund flows, IC-safe language
- [ ] Define launch KPIs (technical + business)
- [ ] Configure alerts (error rate, latency, webhook failures, payout failures)
- [ ] Create post-launch audit template
- [ ] Run pre-launch smoke tests against staging

---

## 15. Environment & Deployment

- [ ] All required env vars set in Railway (or prod platform)
- [ ] NODE_ENV=production
- [ ] SENTRY_DSN set for error/performance monitoring
- [ ] REDIS_URL + USE_REDIS_RATE_LIMITING=true if using multiple instances
- [ ] DATABASE_URL with sslmode=require
- [ ] Stripe live keys (not test) in production
- [ ] N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET configured for event forwarding
- [ ] SendGrid, Twilio, OneSignal configured (or explicitly disabled)
- [ ] Health check endpoint monitored (UptimeRobot, etc.)
- [ ] Railway (or platform) auto-deploy on push to main
- [ ] Rollback procedure tested

---

## 16. Monitoring & Observability

- [ ] Sentry DSN set; errors and traces flowing
- [ ] Configure Sentry alerts (error spike, new issue)
- [ ] Add p95 latency tracking (Sentry or custom)
- [ ] Log aggregation (e.g. Railway logs, Datadog, Papertrail)
- [ ] Uptime monitoring for /health, /health/ready
- [ ] Dashboard for key metrics (or single pane)
- [ ] RequestId in all log lines
- [ ] No PII in logs (redaction verified)

---

## 17. Testing

- [ ] All smoke tests pass
- [ ] All integration tests pass (with test DB)
- [ ] Fix any failing tests (auth, job lifecycle, etc.)
- [x] Contract tests for error format, auth (errorFormat.test, protected-route-auth.test)
- [ ] Load test critical paths (k6 or similar)
- [ ] Run tests in CI on every PR
- [x] Document test setup (SETUP.md: Run tests, env vars)

---

## 18. Frontend & E2E

- [ ] Frontend deployed and pointed at production API
- [ ] CORS allowlist includes production frontend origin
- [ ] E2E tests pass against staging (if applicable)
- [ ] Login, booking, payment flows work end-to-end

---

## 19. n8n & Notifications

- [ ] N8N_WEBHOOK_URL points to production n8n workflow
- [ ] N8N_WEBHOOK_SECRET matches n8n HMAC secret
- [ ] Event forwarding tested (job.created, etc.)
- [ ] SendGrid templates created and IDs in env
- [ ] Twilio configured (or SMS disabled)
- [ ] OneSignal configured (or push disabled)
- [ ] Notification delivery tested (email, SMS, push)
- [ ] Verify event-to-notification mapping for all 24 types

---

## 20. Data & Storage

- [x] uploads/ excluded from git (added to .gitignore)
- [ ] Move uploads to S3/R2 for production (optional)
- [ ] Image compression on upload (or client-side)
- [ ] Lifecycle rules for old photos (expire after X months)
- [ ] CDN for static assets (if applicable)
- [ ] Backup schedule verified (Neon/Railway)

---

## 21. Documentation

- [ ] README has setup, env vars, run commands
- [ ] ARCHITECTURE.md up to date
- [ ] RUNBOOK.md has common ops tasks
- [ ] DEPLOYMENT.md has deploy and rollback steps
- [ ] TROUBLESHOOTING.md has known issues and fixes
- [ ] API docs at /api-docs accurate
- [ ] CONTRIBUTING.md has PR process, branch protection

---

## 22. Final Pre-Launch

- [ ] Run full regression test suite
- [ ] Verify kill switches work (toggle BOOKINGS_ENABLED, etc.)
- [ ] Verify Stripe webhook receives events in prod
- [ ] Verify n8n receives events
- [ ] Verify payout flow (if PAYOUTS_ENABLED)
- [ ] Verify dispute flow
- [ ] Verify refund flow
- [ ] Security scan (npm audit, Gitleaks) passes
- [ ] No secrets in repo, env, or logs
- [ ] Legal docs (TOS, Privacy, Cleaner Agreement) published and linked

---

## Summary Count

| Category | Approx. items |
|----------|---------------|
| 1. Secrets | 8 |
| 2. Auth | 2 |
| 3. Guardrails | 5 |
| 4. Stripe/Webhooks | 4 |
| 5. Database | 5 |
| 6. Workers | 6 |
| 7. API | 5 |
| 8. Security | 5 |
| 9. Maintainability | 5 |
| 10. Cost/Scale | 11 |
| 11. Admin Ops | 9 |
| 12. Trust/Disputes | 10 |
| 13. Legal | 8 |
| 14. Launch | 10 |
| 15. Environment | 11 |
| 16. Monitoring | 8 |
| 17. Testing | 6 |
| 18. Frontend | 4 |
| 19. n8n/Notifications | 8 |
| 20. Data/Storage | 6 |
| 21. Documentation | 7 |
| 22. Final Pre-Launch | 10 |

**Total: ~150+ checklist items**

---

**See also:** [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md), [SECTION_14_LAUNCH.md](./sections/SECTION_14_LAUNCH.md), [PROJECT_AUDIT_QUESTIONS_ANSWERS.md](./PROJECT_AUDIT_QUESTIONS_ANSWERS.md).
