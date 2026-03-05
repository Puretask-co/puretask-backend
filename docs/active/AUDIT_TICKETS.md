# Audit Tickets — ❌ Bugs and High-Priority ⚠️ Risks

Generated from [PR_AUDIT_RUBRIC.md](./PR_AUDIT_RUBRIC.md). One line per ticket: **Title** | Source | **Action**.

**Implemented (2026-02):** R1 (payout idempotency + migration 064), R4 (atomic applyStatusTransition), B4 (idempotency body hash + migration 065), R8 (credit_reason enum + migration 066, TS type + trustAdapter), R11 (doc in RUNBOOK §1.4), event naming (DECISIONS). Remaining tickets are still open.

**Second audit pass:** Full rubric re-run post-implementation; all mitigations/fixes verified in repo; integration tests 236 passed, 7 skipped. PR_AUDIT_RUBRIC updated with latest Verified/findings and Mitigated/Fixed status.

**Third audit pass (all suggestions implemented):** B1 (canonical event_type only, toCanonicalEventType), B2/R2 (tracking approve → applyStatusTransition, single path), B3 (job_events idempotency_key + migration 067), R3 (getNextStatus in startEnRoute, checkIn, checkOut, disputeJob), R5 (applyStatusTransition idempotent when status === nextStatus), R7/R9/R10/R14 (DECISIONS). Audit re-run: integration tests 236 passed, 7 skipped. Rubric and tickets updated.

---

## ❌ Bug tickets

| # | Title | Rubric source | Action |
|---|--------|----------------|--------|
| B1 | **Event naming / lifecycle two namespaces** | §1 Lifecycle meaning; §5 event_type; §6 Standard for event naming; §15 job_events canonical | ✅ **Done.** Canonical only stored; `toCanonicalEventType()` in events.ts; n8n receives canonical. |
| B2 | **Two status update paths (state machine vs tracking)** | §5 Exactly one function for status updates | ✅ **Done.** Tracking approve route calls `applyStatusTransition(client_approved)`; single completion path. |
| B3 | **No dedupe on job_events (retry = duplicate rows)** | §6 Dedupe keys on events | ✅ **Done.** Migration 067 + optional `idempotency_key` in publishEvent; ON CONFLICT DO NOTHING when key provided. |
| B4 | **Idempotency store missing request body hash** | §9 Idempotency store includes request body hash? | ✅ **Done.** Store request body hash (SHA-256); reject 409 when same key with different body. Migration 065 adds column; `src/lib/idempotency.ts` updated. |

---

## ⚠️ High-priority risk tickets

| # | Title | Rubric source | Action |
|---|--------|----------------|--------|
| R1 | **Double-payout: payouts table allows multiple rows per job** | Top-3 #1; Summary #1 | ✅ **Done.** Migration 064 adds `uniq_payouts_job_id`; `recordEarningsForCompletedJob` is idempotent (returns existing payout, handles 23505). |
| R2 | **Two job status systems (state machine vs tracking)** | Top-3 #2; §1 Which actions source-of-truth | ✅ **Done.** Same as B2: tracking approve → applyStatusTransition; other tracking transitions validate via getNextStatus. |
| R3 | **Tracking does not use getNextStatus (can bypass state machine)** | §5 Tracking allows transitions state machine would reject | ✅ **Done.** startEnRoute, checkIn, checkOut, disputeJob call getNextStatus before UPDATE. |
| R4 | **applyStatusTransition path not atomic with ledger** | §5 Transitions atomic; §7 Ledger in same transaction | ✅ **Done.** Status UPDATE + release/refund/payout run in one transaction for completed/cancelled/dispute_resolved_refund; event publish after commit. |
| R5 | **Transition path idempotency (same event retried)** | §5 Transition idempotent? | ✅ **Done.** applyStatusTransition returns early when job.status === nextStatus. |
| R6 | **Race conditions (two accept, cancel vs accept, approve twice)** | §5 Race conditions; §14 Two cleaners accept, Client cancels while accept | ✅ **Done.** Guarded UPDATE (WHERE status = current); 409 CONCURRENT_UPDATE on no row; v1Hardening R6 tests (second accept 409, cancel vs accept race). |
| R7 | **Events: DB once, n8n best-effort** | §6 Events exactly-once, at-least-once | ✅ **Done.** Documented in DECISIONS. |
| R8 | **credit_reason enum DB vs TS mismatch** | §7 credit_reason; §12 DB enums | ✅ **Done.** Migration 066 adds subscription_credit, invoice_payment to DB enum; TS type includes wallet_topup; trustAdapter map updated. |
| R9 | **Idempotency key scope (global key only)** | §9 Key scope: endpoint + method? | ✅ **Done.** Documented in DECISIONS (key-only scope; document in API). |
| R10 | **Idempotency: first attempt fails after side effects** | §9 First attempt fails before response stored | ✅ **Done.** Documented in DECISIONS (no pending state; best-effort). |
| R11 | **Idempotency TTL/cleanup** | §9 TTL/cleanup for idempotency_keys | ✅ **Done.** Worker `idempotency-cleanup` runs hourly (scheduler.ts); RUNBOOK §1.4 updated. |
| R12 | **Endpoints missing idempotency** | §9 Endpoints that need idempotency | ✅ **Done.** requireIdempotency on POST /jobs/:jobId/transition; DECISIONS documents full list (jobs create, pay, transition, approve, payments/credits, Trust buy). |
| R13 | **Try-to-break: check-in/out twice, PI succeeds then crash, escrow fails** | §14 Check-in/out twice; PI succeeds server crashes; Job created escrow fails | ✅ **Done.** v1Hardening R13 test: second job_started fails BAD_TRANSITION; TROUBLESHOOTING documents escrow-in-transaction (R4) and check-in twice. |
| R14 | **Single documented transition contract (tracking bypasses)** | §15 Single documented transition contract | ✅ **Done.** Documented in DECISIONS; tracking validates via getNextStatus. |

---

## Test run note

- **Integration tests (both audit passes):** `npm run test:integration` — 236 passed, 7 skipped (stateMachine, jobLifecycle, v1Hardening, stripeWebhook, disputeFlow, credits, etc.).
- Rubric scenarios “Approve called twice” and “Webhook/refund delivered twice” verified by v1Hardening and stripeWebhook tests; concurrency/chaos tests not fully covered.
- **Third pass:** `npm run test:integration` — 236 passed, 7 skipped (full suite).
- Second pass: same suite run after rubric update; all passed.

---

*Use this list to create issues in your tracker; expand “Action” into acceptance criteria and tasks as needed.*
