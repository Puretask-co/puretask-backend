# System-Wide Review + File-by-File Audit Checklist

How to search the codebase(s) to confirm each item exists, is correct, and is tested. Go down the checklist to finish frontend completion + verification.

**Context:** Backend is broad/complete; frontend has good foundations (API client, auth, React Query, WebSocket, monitoring). Remaining work: connect UIs to canonical endpoints and ensure lifecycle + ledger correctness is enforced by tests.

---

## 1) Canonical API contract + endpoint coverage map

**Goal:** Every frontend call maps to a backend route that exists and matches payload shape.

**Where to inspect**
- Backend route mount map: `src/index.ts` (truth for what exists).
- Frontend API base + auth: `src/lib/api.ts`, `src/lib/config.ts`, `src/contexts/AuthContext.tsx`.
- Gap doc: BACKEND_FRONTEND_GAP_ANALYSIS.md (if present).

**Search commands (repo root)**

Frontend:
```bash
rg "apiClient\.(get|post|put|patch|delete)\(" src
rg "NEXT_PUBLIC_API_(BASE_URL|URL)" -n
rg "/(jobs|payments|credits|messages|notifications)" src -n
```

Backend:
```bash
rg "apiRouter\.use\(\"/(jobs|payments|credits|messages|notifications)" src/index.ts -n
ls src/routes  # then open each mounted file
```

**Pass/Fail**
- **PASS** if every FE endpoint string matches a backend mounted route and expected auth model.
- **FAIL** if FE calls “phantom” endpoints or backend expects headers/body FE doesn’t send (e.g. idempotency).

---

## 2) Job lifecycle correctness (state machine + transitions)

**Goal:** Booking/job status transitions are valid, enforced server-side, and reflected in UI.

**Backend anchor:** `src/routes/jobs.ts` (transition handling, ownership, idempotency).

**Search**
```bash
# Backend
rg "transition" src/routes/jobs.ts src/services -n
rg "applyStatusTransition" -n
rg "requireIdempotency" src/routes/jobs.ts -n

# Frontend
rg "/jobs" src/app src/components src/lib -n
rg "accept|decline|complete|photos|transition" src -n
```

**Pass/Fail**
- **PASS** if FE uses canonical endpoints (create, accept/decline, upload photos, complete, transition) and backend rejects illegal transitions.
- **FAIL** if FE assumes status changes locally without server confirmation.

---

## 3) Credit ledger invariants + lifecycle tests (escrow/release/refund)

**Goal:** Prove ledger correctness after every critical event.

**Backend anchor:** Credits endpoints, ledger alias, payments pricing + wallet logic.

**Search**
```bash
# Backend
rg "credits_ledger|ledger|balance_after|escrow|release|refund" src -n
rg "CENTS_PER_CREDIT|NON_CREDIT_SURCHARGE_PERCENT" src -n
rg "payment_intents" src -n

# Tests
rg "ledger|credits|escrow|release|refund" (tests|src/tests) -n
rg "job-lifecycle-test|k6" tests -n
```

**Pass/Fail**
- **PASS** if you have: (1) integration test that creates job → funds/escrow → completion → release → verifies balances/ledger; (2) refund/dispute path verifying compensating ledger entries.
- **FAIL** if tests only check HTTP 200 without verifying ledger state.

---

## 4) Payment flows (wallet top-up + job charge) + idempotency enforcement

**Goal:** No double-charges; FE uses correct flow for wallet vs job charge.

**Backend anchor:** `/payments/*`, wallet vs job charge explicit, idempotency on credits purchase.

**Search**
```bash
# Backend
rg "Idempotency-Key|requireIdempotency" src/routes/payments.ts src/routes/jobs.ts -n
rg "wallet_topup|job_charge|purpose" src -n

# Frontend
rg "/payments/(credits|job|pricing|history|balance)" src -n
rg "Idempotency-Key" src -n
```

**Pass/Fail**
- **PASS** if FE sends Idempotency-Key for any “charge money” action (topup, job pay, checkout).
- **FAIL** if FE can retry a POST and accidentally charge twice.

---

## 5) Messaging + realtime (Socket.IO + read receipts)

**Goal:** Chat consistent across devices; unread counts from server.

**Backend anchor:** Message endpoints (unread totals, conversations, send, mark read); Socket.IO server + rooms (e.g. join_booking).

**Search**
```bash
# Backend
rg "SocketIOServer|join_booking|booking:" src/index.ts -n
rg "markMessagesAsRead|getUnreadCount" src -n

# Frontend
rg "socket\.io-client|WebSocketProvider|join_booking" src -n
rg "/messages" src -n
```

**Pass/Fail**
- **PASS** if FE joins the right room at the right time, calls mark-read on open thread, and unread counters use server source-of-truth.
- **FAIL** if unread state is only local.

---

## 6) Ops automation is real (workers are deployed + governed)

**Goal:** Background jobs actually run in production.

**Backend anchor:** Worker schedule, CRONS_ENQUEUE_ONLY, durable job queue.

**Search**
```bash
rg "WORKER_SCHEDULES|CRONS_ENQUEUE_ONLY|enqueue\(" src/workers -n
rg "worker:" package.json -n
```

**Infra (non-code):** Confirm Railway cron (or equivalent) is configured OR internal scheduler is running; confirm Redis if rate limiting is Redis-backed.

**Pass/Fail**
- **PASS** if you can point to “what runs where” and alarms/logs exist for failures.
- **FAIL** if workers exist but nothing calls them in prod.

---

## 7) Observability + safety rails (Sentry, metrics, security headers, rate limiting)

**Goal:** Detect issues fast and reduce abuse surface.

**Backend anchor:** Sentry-first init, metrics, security middleware, rate limiting.  
**Frontend anchor:** Sentry/monitoring in layout.

**Search**
```bash
# Backend
rg "@sentry|Sentry" src -n
rg "rate_limiting|endpointRateLimiter|helmet|securityHeaders" src -n

# Frontend
rg "initSentry|initPerformanceMonitoring|initErrorTracking" src -n
```

**Pass/Fail**
- **PASS** if errors include requestId/correlationId, rate limiting is on and tuned, Sentry has releases/environments.
- **FAIL** if Sentry exists but is not configured or has no actionable tagging.

---

---

## Backend audit results (puretask-backend)

*Run: 2026-02 — backend repo only. Frontend checks require puretask-frontend.*

| # | Area | Backend status | Notes |
|---|------|----------------|-------|
| 1 | **API contract / coverage** | ✅ PASS | `apiRouter.use` mounts `/jobs`, `/payments`, `/credits`, `/messages`, `/notifications` in `src/index.ts`. Trust adapter at `/api`. |
| 2 | **Job lifecycle** | ✅ PASS | `jobs.ts`: `applyStatusTransition`, `requireIdempotency` on create and transition; transition route `/:jobId/transition`. |
| 3 | **Credit ledger / tests** | 🟡 PARTIAL | Ledger/escrow/release/refund logic in creditsService, jobsService, disputeFlow, jobLifecycle, credits.test, refundChargebackProcessors. Verify tests assert ledger state (not just 200). |
| 4 | **Payment + idempotency** | ✅ PASS | `requireIdempotency` on jobs (create, transition), payments, tracking. `Idempotency-Key` documented; wallet_topup/job_charge/purpose in paymentService. |
| 5 | **Messaging + Socket.IO** | ✅ PASS | `SocketIOServer`, `join_booking`, `booking:${bookingId}` in index. Messages: `markMessagesAsRead`, `getUnreadCount`, `getUnreadCountByJob` in messagesService + routes. |
| 6 | **Workers** | ✅ PASS | `CRONS_ENQUEUE_ONLY` + `enqueue()` in scheduler; `worker:*` scripts in package.json (scheduler, durable-jobs, auto-cancel, etc.). Confirm prod runs scheduler or cron. |
| 7 | **Observability** | ✅ PASS | Sentry in instrument.ts + index; `endpointRateLimiter`, `helmet`, `securityHeaders` in index. Request IDs/correlation in middleware. |

**Next:** Run frontend searches in puretask-frontend for #1, #2, #4, #5, #7; add ledger-assertion tests for #3 if missing.

---

## Related docs

- [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) — Full endpoint list
- [BACKEND_UI_SPEC.md](./BACKEND_UI_SPEC.md) — Backend → frontend UI mapping
- [TRUST_BACKEND_INTEGRATION.md](./TRUST_BACKEND_INTEGRATION.md) — Auth, CORS, errors
