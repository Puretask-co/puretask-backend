# PureTask — Production Problems & Solutions (Detailed Outline)

**Purpose:** For each production-readiness area: what the problems are and how we solve them.

---

## 1. Secrets & Incident Response

### Problems
- **Exposed credentials:** If Stripe, DB, JWT, or other secrets were ever committed or shared, they are compromised. Attackers can drain funds, access data, or impersonate users.
- **No rotation plan:** Stale secrets increase blast radius after a breach; old keys may still work.
- **Secrets in git history:** Even if removed from current files, history may contain them. Clones and forks carry the risk.
- **No incident runbook:** When a breach or leak happens, unclear who does what, in what order, or how to communicate.

### Solutions
- **Identify:** Use SECRET_INVENTORY_TEMPLATE (off-repo) to list every credential: where it lives, who has access, last rotated.
- **Rotate:** Follow PHASE_1_USER_RUNBOOK in order: Stripe → Stripe webhook → DB → JWT → SendGrid → Twilio → OneSignal → n8n. Invalidate old tokens and webhooks as you go.
- **Purge history:** Use BFG Repo-Cleaner or git filter-repo to remove secrets from history; force-push; require fresh clones.
- **Vault:** Store all secrets only in Railway Variables (or a secret manager); never commit `.env` or real credentials.
- **Runbook:** Document incident response (SECURITY_INCIDENT_RESPONSE.md): detect → contain → rotate → notify → post-mortem.
- **Drill:** Run an annual rotation drill to validate the process.

---

## 2. Auth & Route Protection

### Problems
- **Bypass paths:** New routes might forget `requireAuth` or use wrong middleware, allowing unauthenticated access.
- **Role drift:** Admin-only endpoints could be reachable by clients or cleaners if role checks are missing.
- **Webhook confusion:** Webhook routes must not use JWT; they use signature verification. Mixing them causes 401s or security gaps.

### Solutions
- **Audit:** Review every route in ROUTE_PROTECTION_TABLE; ensure each protected route has `requireAuth` and correct `requireRole`.
- **Integration tests:** Add tests that call protected endpoints without token → expect 401; with wrong-role token → expect 403; with valid token → expect 200/404.
- **Lint/CI:** Use existing security-scan workflow to block legacy auth imports and enforce authCanonical usage.
- **Document:** Keep Route Protection Table updated when adding routes.

---

## 3. Guardrails & CI

### Problems
- **ESLint config breaks pre-commit:** The `no-restricted-imports` rule has invalid config (paths/patterns format), so lint fails and developers may bypass pre-commit.
- **No branch protection:** Anyone can push to main; PRs may merge without review or tests.
- **CI gaps:** Lint, typecheck, or tests might not run on every PR, so broken code can land.
- **Doc sprawl:** Old/duplicate docs create confusion about what’s canonical.

### Solutions
- **Fix ESLint:** Update `.eslintrc.json` so `no-restricted-imports` uses valid ESLint 8 format (paths array of strings or objects with correct schema). Run `npm run lint` to verify.
- **Branch protection:** In GitHub → Settings → Branches, require PR review and status checks (lint, test, build) before merge.
- **CI workflow:** Ensure `.github/workflows/ci.yml` runs on pull_request and push to main; runs lint, typecheck, test, build.
- **Archive:** Move non-active docs to `docs/archive/`; keep only active docs in `docs/active/`.

---

## 4. Stripe, Webhooks & Integrations

### Problems
- **Wrong webhook URL:** Stripe Dashboard may point to staging or wrong path; prod events go nowhere or fail.
- **Replay risk:** If idempotency is incomplete, duplicate webhooks could double-credit or double-payout.
- **Connect unclear:** Cleaners need Stripe Connect; the onboarding flow and edge cases are not fully documented.

### Solutions
- **Verify URL:** In Stripe Dashboard → Webhooks, confirm prod endpoint matches deployed URL (e.g. `https://api.puretask.com/api/webhooks/stripe/webhook`).
- **Test replay:** Use Stripe CLI or Dashboard to resend an event; verify we return 200 and do not reprocess (webhook_events idempotency).
- **Document Connect:** Write step-by-step doc: cleaner clicks connect → redirect → webhook receives `account.updated` → we store stripe_account_id; include failure and re-link scenarios.

---

## 5. Database & Migrations

### Problems
- **Prod schema drift:** Production DB might be missing migrations or have manual changes; schema and code can diverge.
- **No restore test:** If backup restore has never been tested, we don’t know if we can recover from a failure.
- **Risky migrations:** Some migrations are hard to undo; we need a clear rollback strategy.
- **Unencrypted connection:** DATABASE_URL without `sslmode=require` can allow insecure connections in prod.

### Solutions
- **Verify state:** Run `db:setup:test` or equivalent against a prod-like DB; compare schema (e.g. `pg_dump --schema-only`) to expected migrations.
- **Restore drill:** Use BACKUP_RESTORE_PROCEDURE; restore from Neon/Railway backup to a temp DB; verify app connects and queries work.
- **Rollback doc:** For each irreversible or risky migration, document rollback SQL or “IRREVERSIBLE” and manual steps in PHASE_5_STATUS or DB/migrations/README.
- **SSL:** Ensure DATABASE_URL includes `?sslmode=require` (or equivalent) in production.

---

## 6. Workers & Background Jobs

### Problems
- **Cron vs durable mismatch:** When CRONS_ENQUEUE_ONLY=true, scheduler enqueues but the durable job worker must run separately. If it doesn’t, jobs never execute.
- **Unregistered queues:** Some QUEUE_NAMES have no handler in queueProcessor; jobs stay stuck.
- **No visibility:** Queue depth and dead-letter count are not tracked; we can’t alert when things back up.
- **Stale jobs:** `cleanupOldJobs` and lock recovery may not run on a schedule; old or stuck jobs accumulate.

### Solutions
- **Enqueue-only flow:** Set CRONS_ENQUEUE_ONLY=true; run `worker:durable-jobs` (or equivalent) as a separate Railway process/cron. Verify scheduler enqueues and worker processes.
- **Register or deprecate:** For each QUEUE_NAME in use, add a handler in queueProcessor. For unused names, remove or mark deprecated.
- **Metrics:** Add queue depth and dead-letter count to workerMetrics or operational metrics; expose via /status or metrics endpoint.
- **Schedule:** Add lock recovery and cleanupOldJobs to scheduler (or a daily cron); document in SECTION_06_WORKERS.

---

## 7. API Design & Client Safety

### Problems
- **Inconsistent validation:** Some routes validate with Zod; others don’t. Invalid input can cause 500s or unexpected behavior.
- **Offset pagination at scale:** `LIMIT 10 OFFSET 10000` is slow; high-cardinality lists need cursor pagination.
- **No DTOs:** Request/response shapes are implicit; clients and frontend can drift from backend.
- **Missing contract tests:** We don’t automatically verify error format, auth behavior, or schema across endpoints.

### Solutions
- **Zod everywhere:** Use `validateBody(schema)` (or similar) on every route that accepts JSON; validate params and query where applicable.
- **Cursor pagination:** For jobs, messages, admin lists, etc., add `?cursor=...&limit=20`; use indexed column (e.g. `id`, `created_at`) for stable ordering.
- **DTOs:** Define TypeScript interfaces (or Zod schemas) for request/response per endpoint; export from a shared types module.
- **Contract tests:** Extend contract test suite to cover error format, 401/403 behavior, and response schema for key endpoints.

---

## 8. Security Hardening

### Problems
- **Ownership gaps:** Some routes may return or modify resources the user doesn’t own; need systematic audit.
- **PII in errors:** In dev, detailed errors help; in prod, stack traces or user data in responses can leak info.
- **Vulnerable deps:** `npm audit` may report critical/high vulnerabilities in dependencies.
- **CSRF:** If the API is used by browser forms (not only SPA with token), CSRF could be a risk.

### Solutions
- **Ownership audit:** For each route that reads/writes a resource (job, user, payout, etc.), verify `requireOwnership` or equivalent is used. Fix any gaps.
- **Error sanitization:** In production, ensure `sendError` and global handler never return stack traces or PII. Use generic “Internal server error” for 500s.
- **Dependency audit:** Run `npm audit`; fix critical/high. Add `npm audit --audit-level=critical` to CI.
- **CSRF:** If API is form-posted from same-origin pages, add CSRF tokens. If API is only called by SPA with JWT in header, CSRF risk is lower; document the model.

---

## 9. Maintainability & Velocity

### Problems
- **God files:** Some services or route files are very large; hard to navigate and test.
- **No layering:** Routes sometimes call DB directly instead of services; logic is scattered.
- **Test pyramid inverted:** Heavy integration tests, few unit tests; slow feedback.
- **No onboarding doc:** New devs don’t know how to add a route, service, or worker.

### Solutions
- **Refactor:** Split large files (e.g. admin.ts) into smaller modules per domain; extract shared logic into services.
- **Layering:** Enforce routes → services → db; routes only call services; services contain business logic and DB access.
- **Test pyramid:** Add unit tests for pure functions (validation, calculations); use integration tests for API flows; keep smoke tests for critical paths.
- **Onboarding doc:** Add “How to add a route” / “How to add a worker” to CONTRIBUTING or ARCHITECTURE.

---

## 10. Cost, Scale & Performance

### Problems
- **Unknown costs:** We don’t have a cost map; Twilio/SendGrid/etc. can spike without warning.
- **No performance enforcement:** p95 and error-rate targets exist on paper but are not wired to alerts.
- **Cache ambiguity:** No clear policy on what can be cached; risk of caching balances or other critical data.
- **SMS overuse:** SMS is expensive; we may send SMS when email/push would suffice.

### Solutions
- **Cost map:** Create doc with unit cost per tool (e.g. Twilio $/SMS, SendGrid $/email, Neon/Railway tiers), what drives cost, and reduction tactics.
- **Alerts:** Use Sentry or metrics backend to alert when p95 > 800ms, error rate > 0.5%, or queue lag > threshold.
- **Caching policy:** Document allowed list (config, pricing rules) and forbidden list (balances, job state, payouts); set TTL per cache type.
- **Channel policy:** Create table: notification type → preferred channel(s); “SMS only when…” rules; enforce in notification service.

---

## 11. Admin Ops & Support

### Problems
- **No RBAC:** All admins may have same power; we need support_agent vs support_lead vs admin.
- **Sensitive actions unguarded:** Refunds, payout holds, dispute resolution might not require audit reason.
- **No ops dashboard:** Support can’t see disputes, webhook status, or risk flags in one place.
- **IC-unsafe language:** Using “override,” “performance correction,” or “required procedures” can create employment risk.

### Solutions
- **RBAC:** Implement roles in DB (admin_rbac migration); add `requireRole` and `requireDisputeResolveRole` where needed; map permissions per role.
- **Audit reason:** Use `requireAuditReason` middleware on refund, payout hold, dispute resolve; log to admin_audit_log.
- **Ops dashboard:** Build admin UI or dedicated endpoints for disputes queue, webhook failures, payout status, risk flags.
- **Language review:** Replace IC-unsafe phrases with “platform status adjustment,” “risk indicators,” “optional best practices”; document in Section 11/12 runbooks.

---

## 12. Trust, Quality & Dispute Evidence

### Problems
- **Outcomes vs methods:** If we define “how” cleaners work (methods), we risk employment classification. We must define “what” was purchased (outcomes).
- **Evidence not linked:** Dispute protections and payout eligibility should tie to evidence; unclear if that’s enforced.
- **Free-text chaos:** Unstructured client feedback is hard to analyze and may contain IC-unsafe language.
- **Opaque decisions:** Cleaners and clients don’t see how decisions (e.g. dispute resolution) are made.

### Solutions
- **Outcome definitions:** Store structured outcome definitions (versioned); e.g. “clean space per agreed scope” not “follow checklist.” Use in dispute logic.
- **Evidence linking:** In dispute/payout logic, require evidence (or explicit waiver) for certain protections; document in Section 12.
- **Structured feedback:** Use categories (e.g. cleanliness, timeliness, communication) instead of pure free-text; guide UI.
- **Transparency:** Surface decision factors to users (e.g. “resolved based on evidence X, policy Y”); avoid black-box language.

---

## 13. Legal, Policy & Compliance

### Problems
- **TOS fragmented:** Multiple TOS sections exist; no single consolidated document for users and counsel.
- **No Privacy Policy:** GDPR/CPRA require clear disclosure of what we collect and how we use it.
- **No Cleaner Agreement:** Cleaners need a separate agreement covering IC status and platform rules.
- **Refund/cancellation unclear:** User-facing policy and internal playbook may not align.
- **Evidence retention undefined:** How long we keep photos, logs, disputes affects compliance and storage costs.
- **No counsel review:** Legal docs should be reviewed by a lawyer before production.

### Solutions
- **Consolidate TOS:** Merge all TOS sections into one document; add IC Safeguards appendix; publish at standard URL.
- **Privacy Policy:** Draft policy covering: data collected, purposes, retention, sharing (Stripe, SendGrid, etc.), user rights (access, deletion, portability); GDPR/CPRA framing.
- **Cleaner Agreement:** Create separate doc for cleaners: IC status, no employment, platform rules, payouts, disputes, termination.
- **Refund policy:** Define refund windows, cancellation rules, fees; align user-facing policy with internal playbook.
- **Retention policy:** Define retention for job photos, dispute evidence, audit logs; document deletion process for user requests.
- **Legal review:** Send TOS, Privacy Policy, Cleaner Agreement, refund policy to counsel; incorporate feedback; get sign-off.

---

## 14. Launch Readiness & Rollout

### Problems
- **No feature flags:** Can’t disable a feature without deploying.
- **No rollout plan:** Unclear who gets access when; no rollback criteria.
- **Kill switches untested:** BOOKINGS_ENABLED, PAYOUTS_ENABLED exist but may not be tested in prod-like env.
- **No incident runbook:** When things break, no documented steps for who does what.
- **Support untrained:** Support may not know how to use dispute UI or use IC-unsafe language.

### Solutions
- **Feature flags:** Use env vars or DB flags for launch-critical features; check at runtime; document in featureFlags or similar.
- **Rollout plan:** Define phases (e.g. internal → beta → limited geo → full); success criteria and rollback triggers per phase.
- **Kill switch test:** In staging, toggle BOOKINGS_ENABLED=false; verify new bookings rejected; repeat for PAYOUTS_ENABLED, CREDITS_ENABLED.
- **Incident runbook:** Document triggers (payment failures, webhook backlog, etc.), steps (enable kill switch, rollback, notify), escalation, and communication.
- **Support training:** Session on dispute UI, refund flows, IC-safe language; provide playbook for common scenarios.

---

## 15. Environment & Deployment

### Problems
- **Missing or wrong env vars:** Production may lack SENTRY_DSN, N8N_WEBHOOK_URL, or have wrong Stripe keys.
- **Test keys in prod:** Stripe test keys in production mean no real payments.
- **No health monitoring:** If the app is down, we may not know until users complain.
- **Rollback untested:** We may not know how to roll back or whether it works.

### Solutions
- **Env checklist:** Use ENV_VARS_CHECKLIST; verify every required var is set in Railway (or prod platform). Use `src/config/env.ts` validation at startup.
- **Key audit:** Ensure STRIPE_SECRET_KEY starts with `sk_live_` in production; log warning if `sk_test_` in prod.
- **Health monitoring:** Configure UptimeRobot (or similar) to ping /health and /health/ready; alert on failure.
- **Rollback drill:** Document rollback in DEPLOYMENT.md; perform a rollback on staging to verify it works.

---

## 16. Monitoring & Observability

### Problems
- **No error visibility:** Without Sentry (or similar), we rely on logs; hard to aggregate and alert.
- **No latency tracking:** We don’t know which endpoints are slow.
- **Logs scattered:** Railway logs, local logs; no single place to search.
- **PII in logs:** Emails, names, or tokens might be logged; compliance risk.

### Solutions
- **Sentry:** Set SENTRY_DSN in prod; verify errors and traces appear; configure alerts for new issues and error spikes.
- **Latency:** Use Sentry transactions or custom middleware to record duration per route; track p50/p95.
- **Log aggregation:** Use Railway’s log aggregation or ship logs to Datadog/Papertrail; ensure requestId in every line.
- **Redaction:** Verify logRedaction and logger never emit PII; audit log statements for email, phone, tokens.

---

## 17. Testing

### Problems
- **Failing tests:** Some smoke or integration tests fail (e.g. auth, job lifecycle); reduces confidence.
- **No load test:** We don’t know how the system behaves under load.
- **CI gaps:** Tests may not run on every PR; broken code can merge.
- **Test setup unclear:** New devs don’t know how to run tests (DB, mocks, env).

### Solutions
- **Fix failures:** Debug each failing test; fix schema, auth, or test data; target 100% pass for smoke and integration.
- **Load test:** Use k6 (or similar) to hit critical paths (login, list jobs, create job); establish baseline; add to CI or run periodically.
- **CI:** Ensure test workflow runs on PR; block merge if tests fail.
- **Test docs:** Add “Running tests” to README or SETUP: DATABASE_URL, TEST_DATABASE_URL, env mocks, `npm run test`.

---

## 18. Frontend & E2E

### Problems
- **CORS mismatch:** Production frontend origin may not be in CORS allowlist; API calls fail.
- **E2E gaps:** Critical flows (login, booking, payment) may not be covered by E2E tests.
- **Frontend not deployed:** Backend may be ready but frontend not live.

### Solutions
- **CORS:** Add production frontend URL (e.g. `https://app.puretask.com`) to `cors({ origin: [...] })` in index.ts.
- **E2E:** Add or extend E2E tests for login, create job, transition, payment; run against staging.
- **Deploy:** Ensure frontend is deployed and points to production API URL.

---

## 19. n8n & Notifications

### Problems
- **Wrong webhook URL:** N8N_WEBHOOK_URL may point to staging or wrong workflow.
- **Secret mismatch:** N8N_WEBHOOK_SECRET must match n8n’s HMAC secret; mismatch causes 401.
- **Templates missing:** SendGrid template IDs may be unset; emails fail or look broken.
- **Delivery untested:** We may not have verified that job.created (etc.) triggers correct emails/SMS/push.

### Solutions
- **Verify URL and secret:** Confirm N8N_WEBHOOK_URL is production n8n workflow; N8N_WEBHOOK_SECRET matches n8n config.
- **Templates:** Create SendGrid templates for all 12+ types; set IDs in env; test send for each.
- **Delivery test:** Trigger job.created (or equivalent) in staging; verify n8n receives event and sends email/SMS/push; verify event-to-notification mapping for all 24 types.

---

## 20. Data & Storage

### Problems
- **User photos in git:** `uploads/` was committed; repo contains user data; bloats repo and creates retention risk.
- **No compression:** Large images increase storage and bandwidth cost.
- **No lifecycle:** Old photos accumulate; no policy for expiry.
- **Backup unclear:** Unclear if Neon/Railway backups are configured and tested.

### Solutions
- **Exclude uploads:** Add `uploads/` to .gitignore; remove from tracking (`git rm -r --cached uploads/`); consider moving to S3/R2 for production.
- **Compression:** Add server-side or client-side image compression (resize, quality); enforce max dimensions.
- **Lifecycle:** Define policy (e.g. expire job photos after 12 months); implement via Neon/Railway or object storage lifecycle rules.
- **Backup:** Verify Neon/Railway backup schedule; document restore procedure; run restore test periodically.

---

## 21. Documentation

### Problems
- **README outdated:** Setup steps, env vars, or commands may be wrong.
- **Architecture drift:** ARCHITECTURE.md may not reflect current structure.
- **No runbook:** Ops tasks (restart, rollback, kill switch) not documented.
- **API docs incomplete:** /api-docs may be missing endpoints or have wrong schemas.

### Solutions
- **README:** Update with current setup, env vars (or link to ENV_VARS_CHECKLIST), run commands, test commands.
- **ARCHITECTURE:** Review and update; reflect routes, services, workers, event flow.
- **RUNBOOK:** Add common ops tasks: restart service, rollback, enable kill switch, check webhook status, run migrations.
- **API docs:** Audit Swagger annotations; ensure all public endpoints are documented with request/response schemas.

---

## 22. Final Pre-Launch

### Problems
- **Assumptions:** We assume kill switches work, webhooks deliver, legal docs are published; we may not have verified.
- **Secrets in logs:** Last-minute check for accidental logging of secrets.
- **Legal not live:** TOS, Privacy Policy, Cleaner Agreement may exist but not be linked or published.

### Solutions
- **Regression suite:** Run full test suite (smoke, integration, contract) before launch.
- **Kill switch verify:** Toggle each kill switch in staging; confirm behavior.
- **Webhook verify:** Confirm Stripe and n8n receive events in prod (or prod-like).
- **Flow verify:** Manually test payout, dispute, refund flows in staging.
- **Security scan:** Run npm audit, Gitleaks; fix critical/high.
- **Secrets audit:** Grep logs and code for patterns (e.g. sk_live_, whsec_); ensure none logged.
- **Legal publish:** Ensure TOS, Privacy, Cleaner Agreement are at public URLs and linked from app.

---

## Summary: Problem → Solution Mapping

| Area | Core Problem | Core Solution |
|------|--------------|---------------|
| 1. Secrets | Credentials exposed or stale | Rotate, purge history, vault, runbook, drill |
| 2. Auth | Bypass or role gaps | Audit routes, add integration tests |
| 3. Guardrails | ESLint broken, no branch protection | Fix ESLint, enable branch protection, CI on PR |
| 4. Stripe | Wrong URL, replay risk | Verify prod URL, test idempotency, document Connect |
| 5. Database | Drift, no restore test, no SSL | Verify schema, test restore, document rollback, enforce SSL |
| 6. Workers | Enqueue/process mismatch, no visibility | Run durable worker, register handlers, add metrics |
| 7. API | Validation gaps, offset pagination | Zod everywhere, cursor pagination, DTOs, contract tests |
| 8. Security | Ownership gaps, PII, vulns | Audit ownership, sanitize errors, npm audit |
| 9. Maintainability | God files, no layering | Refactor, enforce layering, test pyramid, onboarding doc |
| 10. Cost/Scale | Unknown costs, no alerts | Cost map, wire alerts, caching policy, channel policy |
| 11. Admin Ops | No RBAC, unguarded actions | RBAC, audit reason, ops dashboard, IC-safe language |
| 12. Trust/Disputes | Outcomes vs methods, opacity | Outcome definitions, evidence linking, structured feedback, transparency |
| 13. Legal | Fragmented docs, no counsel | Consolidate TOS, Privacy, Cleaner Agreement, retention, legal review |
| 14. Launch | No flags, no runbook | Feature flags, rollout plan, test kill switches, incident runbook, training |
| 15. Environment | Missing/wrong vars | Checklist, key audit, health monitoring, rollback drill |
| 16. Monitoring | No errors/latency visibility | Sentry, latency tracking, log aggregation, redaction |
| 17. Testing | Failing tests, no load test | Fix tests, load test, CI, test docs |
| 18. Frontend | CORS, E2E gaps | CORS allowlist, E2E, deploy frontend |
| 19. n8n | Wrong URL, templates missing | Verify URL/secret, create templates, delivery test |
| 20. Data | uploads in git, no lifecycle | Exclude uploads, compression, lifecycle, backup verify |
| 21. Documentation | Outdated, incomplete | Update README, ARCHITECTURE, RUNBOOK, API docs |
| 22. Final Pre-Launch | Unverified assumptions | Regression, kill switch, webhook, flow verify, security scan, legal publish |

---

**See also:** [PRODUCTION_100_PERCENT_CHECKLIST.md](./PRODUCTION_100_PERCENT_CHECKLIST.md), [MASTER_CHECKLIST.md](./MASTER_CHECKLIST.md).
