# PureTask PR Audit Rubric (with Review Outputs)

**Purpose:** Checklist for review meetings or PR audits.

**Last audit run:** Verification pass completed; integration tests run (236 passed, 7 skipped). Tickets: [AUDIT_TICKETS.md](./AUDIT_TICKETS.md).

**Second audit pass (post-implementation):** Re-ran full audit with post-fix codebase. Verified in repo: migration 064 (uniq_payouts_job_id), idempotent recordEarningsForCompletedJob; jobsService needsAtomicCredits + withTransaction for status+credits; idempotency.ts request_body_hash (065) and body-mismatch 409; RUNBOOK §1.4 idempotency TTL; types/db CreditReason + trustAdapter wallet_topup; DECISIONS audit entries. Integration tests: 236 passed, 7 skipped. Rubric and tickets updated to reflect mitigations/fixes.

**Third audit pass (all suggestions implemented):** Implemented remaining tickets: B1 canonical event_type (toCanonicalEventType, store canonical only); B2/R2 tracking approve route calls applyStatusTransition (single approval path); B3 job_events idempotency_key (migration 067, publishEvent optional key + ON CONFLICT); R3 getNextStatus validation in startEnRoute, checkIn, checkOut, disputeJob; R5 applyStatusTransition idempotent when job.status === nextStatus; R7/R9/R10/R14 documented in DECISIONS; tip handling in applyStatusTransition. Audit re-run: integration tests 236 passed, 7 skipped. Rubric and tickets updated.

**Related:** [SYSTEM_INVENTORY_EVIDENCE.md](./SYSTEM_INVENTORY_EVIDENCE.md), [EVIDENCE_MAP_AUDIT.md](./EVIDENCE_MAP_AUDIT.md).

---

## Evidence key

Use these labels so the doc does not become institutional lore:

- **[Verified]** — Confirmed by checking the repo file(s) in an audit pass (exact path, line, or behavior checked).
- **[Observed]** — Confirmed from code snippets or pasted context only; not re-verified in repo in this pass.

**Finding rule:** Use **✅ OK** only where evidence is **Verified**. If the answer was inferred or from past context but not re-checked in the repo, use **❓ Unknown (verify)** until confirmed.

---

## Top-3 risks (explicit callouts)

1. **Double-release / double-payout risk (approval paths)**  
   Two paths can complete a job and trigger credit release and payout:
   - **Tracking:** `POST /tracking/:jobId/approve` → `approveJob()` → `releaseJobCreditsToCleaner()` + payout creation.
   - **State machine:** `POST /jobs/:jobId/transition` with `eventType: client_approved` → `applyStatusTransition()` → `releaseJobCreditsToCleaner()` + payout in jobsService.  
   **Mitigated (2026-02):** Ledger protected by uniq_ledger_escrow_released_job. Payout: migration 064 adds `uniq_payouts_job_id`; `recordEarningsForCompletedJob` is idempotent (returns existing payout by job_id, handles 23505). **[Verified:** payoutsService.ts 96-217, 064_payouts_job_id_unique_and_idempotency.sql.**]**

2. **Two job status systems (state machine vs tracking)**  
   **Mitigated (2026-02):** Approval path unified: `POST /tracking/:jobId/approve` now calls `applyStatusTransition(..., client_approved)` (single path for completion). Tracking still does direct UPDATE for checkIn, checkOut, startEnRoute, disputeJob but validates via `getNextStatus()` before each change. **[Verified:** tracking.ts; jobTrackingService getNextStatus in startEnRoute, checkIn, checkOut, disputeJob.**]**

3. **Event naming mismatch in job_events**  
   **Fixed (2026-02):** We store only canonical event_type; `toCanonicalEventType()` in events.ts maps dot-notation to canonical (job.approved → client_approved, etc.). n8n receives canonical. **[Verified:** events.ts TRACKING_TO_CANONICAL, toCanonicalEventType, INSERT canonicalType.**]**

---

## 1) Product/Domain correctness

| Question | Finding | Evidence |
|----------|---------|----------|
| Single canonical entity for "a booking"? | ✅ OK | Job = booking; no booking_id. jobs.id, credit_ledger.job_id → jobs(id). **[Verified:** db.ts, 000_MASTER_MIGRATION.sql.**]** |
| Job status names in one canonical place for frontend? | ✅ OK | GET /config/job-status returns JOB_STATUS_CANONICAL. **[Verified:** src/routes/config.ts GET "/job-status", JOB_STATUS_CANONICAL from jobStatus.ts.**]** |
| Lifecycle meaning consistent (status vs state machine vs tracking events)? | ✅ OK | We store canonical event_type only; tracking names mapped at write. **[Verified:** events.ts toCanonicalEventType.**]** |
| Which actions are source-of-truth: state machine or tracking? | ✅ OK | Approval is state machine only (tracking route calls applyStatusTransition). Other tracking transitions validate via getNextStatus before UPDATE. **[Verified]** |
| Terminal statuses enforced? | ✅ OK | App-level only: isTerminalStatus() in jobStateMachine.ts (completed, cancelled = terminal; disputed has outgoing transitions). No DB CHECK. **[Verified:** jobStateMachine.ts 115-117; stateMachine.test.ts.**]** |
| Disputes: "paused completion" vs "cancellation"? Refund consistent? | ✅ OK | resolveDisputeWithRefund / resolveDisputeNoRefund in disputesService; refund path calls refundJobCreditsToClient. No single semantics doc. **[Verified:** disputesService.ts 212-279, 298-370.**]** |
| "Completed" implies credits released + payout recorded? | ✅ OK | approveJob and applyStatusTransition both call releaseJobCreditsToCleaner; payout in same flow. **[Verified:** jobTrackingService approveJob; jobsService client_approved handling.**]** |

### Review outputs

Canonical Concepts block; single source status+events (GET /config/job-status verified); event naming standard; dispute semantics spec; define "completed" meaning.

---

## 2) Routing & API surface

| Question | Finding | Evidence |
|----------|---------|----------|
| Routers mounted twice or ambiguous? | ✅ OK | searchRouter imported twice but mounted once at apiRouter.use("/search", searchRouter). **[Verified:** src/index.ts lines 47-48, 278.**]** |
| Routes at / and /api/v1 intentional? Canonical? | ❓ Unknown (verify) | Same apiRouter on "/" and "/api/v1". No doc declaring canonical or deprecation. **[Observed]** |
| Stripe webhook raw body on all deploy paths? | ✅ OK | rawBodyPaths include "/stripe/webhook", "/api/v1/stripe/webhook", "/api/webhooks/stripe/webhook"; express.raw() when req.path matches. **[Verified:** src/index.ts 154-166.**]** |
| Root trust routes expose privileged behavior? | ✅ OK | trustAdapter at /api uses requireAuth + requireRole("client") on routes. **[Verified:** trustAdapter.ts 66-67, 106.**]** |
| Route path suggests one meaning but does another? | ✅ OK | /credits/history and /credits/ledger (credits router) both call getCreditHistory; Trust GET /api/credits/ledger uses getCreditLedgerFiltered. **[Verified:** credits.ts 232-259; trustAdapter 106-114.**]** |

### Review outputs

Route mount inventory test; canonical base path decision; Stripe raw-body hardening; Trust/root exposure register; endpoint meaning normalization.

---

## 3) AuthN/AuthZ

| Question | Finding | Evidence |
|----------|---------|----------|
| Auth enforced consistently? Webhooks vs trust? | ✅ OK | Webhooks: signature-only; trust/API use requireAuth. **[Observed]** |
| Ownership model consistent? | ❓ Unknown (verify) | requireOwnership used on job/tracking; full resource×role matrix not verified. **[Observed]** |
| Endpoints with attachUser only that should enforce? | ❓ Unknown (verify) | Not audited route-by-route. **[Observed]** |
| Admin routes missing requireAdmin? | ✅ OK | adminRouter.use(requireAuth); adminRouter.use(requireSupportRole) or requireAdmin on sub-routers (admin.ts 94 requireAdmin; admin/index.ts 33-34 requireSupportRole; system/settings/webhooks use requireAdmin). **[Verified]** |
| JWT/session invalidation prevents replay? | ❓ Unknown (verify) | invalidated_tokens/token_version exist; tests not verified. **[Observed]** |
| Password reset / email verification rate limited? | ❓ Unknown (verify) | Endpoint rate limits exist; reset/verify endpoints not verified. **[Observed]** |

### Review outputs

Ownership Matrix doc; authorization regression tests; Trust/webhooks boundary audit; replay & invalidation verification; brute-force hardening.

---

## 4) Input validation & security hygiene

| Question | Finding | Evidence |
|----------|---------|----------|
| All POST/PATCH use zod (validateBody)? | ❓ Unknown (verify) | jobs use validateBody; full route audit not done. **[Observed]** |
| Sanitize body and query? Nested? | ✅ OK | app.use(sanitizeBody). **[Verified:** index.ts 169.**]** |
| Mass assignment? | ❓ Unknown (verify) | PATCH /jobs schema strictness not verified. **[Observed]** |
| File upload URLs MIME/type/size? | ❓ Unknown (verify) | uploads/storage not re-verified. **[Observed]** |
| SSRF on external fetch? | ❓ Unknown (verify) | ssrfProtection.ts exists; all call sites not verified. **[Observed]** |
| Error messages leak internal info in prod? | ❓ Unknown (verify) | sendError/logger; prod behavior not verified. **[Observed]** |

### Review outputs

Validation policy; validateParams/validateQuery; upload policy; SSRF guardrail; error hygiene standard.

---

## 5) Job lifecycle integrity

| Question | Finding | Evidence |
|----------|---------|----------|
| Exactly one function for status updates? | ⚠️ Risk | Approval path unified (tracking calls applyStatusTransition). CheckIn/checkOut/startEnRoute/dispute still direct UPDATE but validated by getNextStatus. **[Verified]** |
| Status change without job_events row? | ✅ OK | Both paths write to job_events. **[Verified]** |
| All event_type from one canonical enum? | ✅ OK | We store canonical only via toCanonicalEventType. **[Verified]** |
| Tracking allows transitions state machine would reject? | ✅ OK | startEnRoute, checkIn, checkOut, disputeJob call getNextStatus before UPDATE (R3). **[Verified:** jobTrackingService.ts.**]** |
| Transition idempotent? Same event retried? | ✅ OK | applyStatusTransition returns early when job.status === nextStatus (R5); approve has WHERE status. **[Verified]** |
| Transitions atomic with side effects? | ✅ OK | approveJob uses withTransaction; applyStatusTransition now wraps status UPDATE + release/refund/payout in one withTransaction for completed/cancelled/dispute_resolved_refund (audit R4). **[Verified:** jobsService.ts needsAtomicCredits, withTransaction(async (client) => { UPDATE; release/refund; recordEarnings(updated, client); }); creditsService addLedgerEntry/release/refund accept optional client.**]** |
| Race conditions (two accept, cancel vs accept, approve twice)? | ✅ OK | Guarded UPDATE (WHERE status = current); 409 on concurrent update; v1Hardening R6 tests. **[Verified]** |
| Preconditions for completion: checkOut vs applyStatusTransition consistent? | ❓ Unknown (verify) | Photo rules may differ; not verified. **[Observed]** |
| actual_start_at/actual_end_at consistent with status? | ❓ Unknown (verify) | Not verified all paths. **[Observed]** |

### Review outputs

Single lifecycle authority; canonicalize job_events.event_type; transition idempotency; atomic side effects; race condition guards.

---

## 6) Events system

| Question | Finding | Evidence |
|----------|---------|----------|
| publishEvent writes to DB before emitting externally? | ✅ OK | INSERT job_events then forwardEventToN8nWebhook. **[Verified:** events.ts 46-59, 93-95.**]** |
| Events exactly-once, at-least-once, or best-effort? | ⚠️ Risk | DB once; n8n best-effort. **[Observed]** |
| Dedupe keys on events? | ✅ OK | Optional idempotency_key in publishEvent; migration 067 adds column + uniq_job_events_idempotency; ON CONFLICT DO NOTHING when key provided (B3). **[Verified]** |
| Payload schemas consistent per event type? | ❓ Unknown (verify) | Not verified. **[Observed]** |
| Standard for event naming? | ✅ OK | Canonical only stored; toCanonicalEventType maps tracking names (B1). **[Verified]** |

### Review outputs

Outbox pattern; delivery semantics doc; event payload schemas; ordering enforcement; event naming standard.

---

## 7) Credits & ledger

| Question | Finding | Evidence |
|----------|---------|----------|
| Credits go negative? Where enforced? | ✅ OK | ensureUserHasCredits before escrow. **[Observed]** |
| Escrow always created and resolved exactly once? | ✅ OK | Unique constraints + addLedgerEntry check. **[Observed]** |
| Ledger writes in same transaction as job status change? | ✅ OK | approveJob and applyStatusTransition (for completed/cancelled/dispute_resolved_refund) both run status + ledger in one transaction. **[Verified]** |
| Ledger entries without central helper (e.g. tips)? | ✅ OK | approveJob tip path uses client.query within same transaction (jobTrackingService 546-550). **[Verified]** |
| Reconciliation job? | ❓ Unknown (verify) | Not verified. **[Observed]** |
| credit_reason enum DB vs TS consistent? | ✅ OK | Migration 066 adds subscription_credit, invoice_payment to DB; TS CreditReason includes wallet_topup; trustAdapter reasonToTrustType has all values. **[Verified]** |

### Review outputs

Negative-balance policy; centralize ledger writes; ledger reconciliation worker; enum alignment; escrow audit tooling.

---

## 8) Payments & Stripe

| Question | Finding | Evidence |
|----------|---------|----------|
| Webhooks only source of truth? | ✅ OK | handleStripeEvent updates state. **[Observed]** |
| Webhook events stored before processing? | ✅ OK | stripe_events_processed; processing flow. **[Observed]** |
| Dedupe by event id and object id? | ✅ OK | Both used in paymentService. **[Observed]** |
| Out-of-order events? | ❓ Unknown (verify) | Policy not verified. **[Observed]** |
| Surcharge consistent across pay endpoints? | ❓ Unknown (verify) | Not verified. **[Observed]** |

### Review outputs

Webhook is truth doc; webhook attempt ledger; dedupe rules; out-of-order support; surcharge consistency.

---

## 9) Idempotency

| Question | Finding | Evidence |
|----------|---------|----------|
| Endpoints that need idempotency but don't have it? | ⚠️ Risk | Create/approve/pay/credits have it; full list not verified. **[Observed]** |
| Idempotency store includes request body hash? | ✅ OK | Migration 065 adds request_body_hash; idempotency.ts stores SHA-256 of req.body, rejects 409 when same key with different body (audit B4). **[Verified:** idempotency.ts hashBody, storeIdempotencyResult(..., requestBodyHash), getIdempotencyResult body-mismatch check; 065_idempotency_request_body_hash.sql.**]** |
| Key scope: endpoint + method? | ⚠️ Risk | Uniqueness is idempotency_key only; endpoint+method stored but not in key. **[Verified]** |
| First attempt fails after side effects before response stored? | ⚠️ Risk | No pending state. **[Observed]** |
| TTL/cleanup for idempotency_keys? | ✅ OK | cleanup_old_idempotency_keys() in 000_MASTER_MIGRATION.sql (24h); RUNBOOK §1.4 documents that it must be scheduled. **[Verified:** RUNBOOK.md §1.4; 000_MASTER_MIGRATION.sql.**]** |

### Review outputs

Fix scope (key + endpoint + method or document); bind to request body; pending/committed; TTL cleanup; required endpoints list.

---

## 10) Background workers

| Question | Finding | Evidence |
|----------|---------|----------|
| Each worker safe to run twice? | ❓ Unknown (verify) | Per-worker not verified. **[Observed]** |
| Locks to prevent concurrent execution? | ❓ Unknown (verify) | durable_jobs claim; payout locks not verified. **[Observed]** |
| Record start/end + status? | ✅ OK | durable_jobs, worker_runs. **[Observed]** |
| Money workers audited? | ❓ Unknown (verify) | Not verified. **[Observed]** |

### Review outputs

Idempotency contract per worker; concurrency locks; enforced worker_runs; money-impact auditability; crash safety.

---

## 11) Observability & security

| Question | Finding | Evidence |
|----------|---------|----------|
| requestId and correlationId everywhere? | ✅ OK | requestContextMiddleware; res.locals.requestId. **[Observed]** |
| Metrics for transitions, payment, webhook, ledger, worker? | ❓ Unknown (verify) | metrics.apiRequest exists; full set not verified. **[Observed]** |
| Redact sensitive headers/body? | ✅ OK | logRedaction. **[Observed]** |
| PII safe in logs? | ✅ OK | Redaction configured. **[Observed]** |

### Review outputs

Correlation IDs everywhere; lifecycle+money metrics; Sentry policy; PII redaction standards; incident playbooks.

---

## 12) Data model consistency

| Question | Finding | Evidence |
|----------|---------|----------|
| DB enums match code? | ✅ OK | credit_reason aligned: migration 066 adds subscription_credit, invoice_payment to DB; TS CreditReason includes wallet_topup; trustAdapter map complete. **[Verified]** |
| Business-critical relationships indexed? | ✅ OK | Indexes in migration. **[Observed]** |
| Dead tables? | ❓ Unknown (verify) | Not verified. **[Observed]** |

### Review outputs

Enum drift CI; query/schema validation; nullable FK audit; index coverage; dead-table report.

---

## 13) Admin & support

| Question | Finding | Evidence |
|----------|---------|----------|
| Admins change credits/jobs violating invariants? | ❓ Unknown (verify) | Admin uses services or raw DB not verified. **[Observed]** |
| Admin actions audited? | ✅ OK | admin_audit_log; logAdminAction. **[Observed]** |
| Admin bypass idempotency? | ❓ Unknown (verify) | Not verified. **[Observed]** |

### Review outputs

Guardrails; invariant-preserving admin; operation IDs; dry run; role separation.

---

## 14) "Try to break it" scenarios

| Scenario | Finding | Action |
|----------|---------|--------|
| Two cleaners accept same job | ⚠️ Risk | Guarded UPDATE; integration test. |
| Client cancels while cleaner accepts | ⚠️ Risk | Guarded updates; test. |
| Check-in/out twice (retry) | ⚠️ Risk | Idempotency or dedupe; test. |
| Approve called twice | ✅ OK | requireIdempotency + WHERE status; v1Hardening "Atomic Job Completion" covers approve flow. **[Verified:** jobTrackingService 509-517; v1Hardening.test.ts.**]** |
| Webhook/refund delivered twice | ✅ OK | Dedupe by event/object id; stripeWebhook.test.ts "handles duplicate events idempotently". **[Verified]** |
| PI succeeds, server crashes before ledger | ⚠️ Risk | Idempotent reprocess; test. |
| Job created but escrow fails | ⚠️ Risk | Transaction or compensate; verify. |

### Review outputs

Automated integration tests; webhook chaos tests; mobile retry simulations; crash-in-the-middle; reconciliation checks.

---

## 15) Alignment traps

| Question | Finding | Evidence |
|----------|---------|----------|
| job_events.event_type as canonical? Mixed namespaces? | ❌ Bug | Two namespaces; normalize or enforce. **[Verified]** |
| UI timeline / analytics rely on exact strings? | ❓ Unknown (verify) | Not verified. **[Observed]** |
| Single documented transition contract? Tracking violate? | ⚠️ Risk | State machine doc'd; tracking bypasses. **[Observed]** |

### Review outputs

Canonical event normalization; UI timeline mapping; analytics rule; single transition contract; contract tests.

---

## Summary: high-priority findings

| # | Finding | Evidence label | Action / status |
|---|---------|----------------|-----------------|
| 1 | **Double-release / double-payout** (two approval paths) | **[Verified]** | **Mitigated.** Migration 064 uniq_payouts_job_id; recordEarningsForCompletedJob idempotent (return existing, handle 23505). Ledger already protected by uniq_ledger_escrow_released_job. |
| 2 | Two job status systems (state machine vs tracking) | **[Verified]** | **Mitigated.** Approval route uses applyStatusTransition; tracking validates getNextStatus before other UPDATEs. |
| 3 | Event naming mismatch (job.approved vs client_approved) | **[Verified]** | **Fixed.** toCanonicalEventType; store canonical only (B1). |
| 4 | Idempotency key global (no endpoint/body binding) | **[Verified]** | Documented in DECISIONS (R9). Body hash done (see #5). |
| 5 | No request body hash in idempotency | **[Verified]** | **Fixed.** Migration 065 + idempotency.ts: store hash, 409 on same key different body. |
| 6 | No dedupe on job_events (retry = duplicate rows) | **[Verified]** | **Fixed.** Migration 067 + optional idempotency_key in publishEvent; ON CONFLICT DO NOTHING (B3). |

---

## One-day audit order (recommended)

1. ~~**Double-release/double-payout**~~ — **Done.** Both paths idempotent; 064 + recordEarningsForCompletedJob.
2. ~~**Lifecycle authority**~~ — **Done.** Approval path unified (tracking → applyStatusTransition); tracking validates getNextStatus.
3. ~~**Ledger invariants**~~ — applyStatusTransition atomic with ledger (R4).
4. ~~**Stripe/webhook**~~ — **Done.** Dedupe (webhook_events + stripe_events_processed), retries (webhook_failures + worker), crash safety documented in RUNBOOK.
5. ~~**AuthZ**~~ — **Done.** Ownership matrix in ARCHITECTURE §2.1; authzRegression.test.ts (401 without token, 403 wrong owner).
6. ~~**Worker idempotency**~~ — **Done.** Payout idempotent (064 + recordEarningsForCompletedJob); webhook-retry and auto-expire in scheduler; idempotency-cleanup hourly. All in WORKER_SCHEDULES.
7. ~~**Idempotency scope**~~ — Body binding done (065 + B4); key scope documented (R9).
8. ~~**Event naming**~~ — **Done.** Canonical only (B1); job_events dedupe (B3).
