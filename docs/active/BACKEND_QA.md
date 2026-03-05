# Backend Q&A — All questions and answers in one place

**Purpose:** Single document with what’s already set up, the backend build checklist (✅/🟡/❌), the key deliverable to request from backend dev, and immediate alignment items. Use with your backend dev; mark each row as you confirm or build.

---

## 0) What you ALREADY have set up (backend/ops side)

### n8n workflows & ops automations (already defined)

- **Stripe disputes webhook** → stores webhook payload in `webhook_events` + sends Slack alert to ops channel.
- **Refund dispatcher pattern:** receives refund request → finds PaymentIntent → creates Stripe refund → writes a ledger debit for refund.
- **Daily finance snapshot** (cron at 01:00) inserting into `finance_snapshots` using sums from `ledger_entries`.
- **Core Stripe webhook ingest event set** (payment success/fail, refunds, disputes, transfer.paid/failed) + recommended endpoint URL + env setup checklist.

### Required n8n credentials + env vars (already specified)

- **Credentials:** `PURETASK_DB`, `OPS_SLACK`, optional `BACKUP_S3`, etc.
- **Env vars:** `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `API_BASE`, `FRONTEND_URL`, `OPS_SLACK_CHANNEL`, `DATABASE_URL` (backup), etc.

### Notion automation fabric (planned / specified)

- Notion integration creds + required Notion DB IDs + example “Sync Cleaners DB → Notion” workflow skeleton.

---

## 1) Backend Question List — Answers & Build Checklist

**Mark each row:** ✅ exists, 🟡 partial, ❌ to build (use with your backend dev, like the frontend doc).

---

### A) Auth + identity

| Question | Build checklist |
|----------|-----------------|
| Do we have `POST /auth/login`, `POST /auth/register`, `GET /auth/me` working in prod? | ✅ Auth endpoints your frontend references |
| What roles exist and how are they enforced (client/cleaner/admin)? | ✅ Role guard middleware + RBAC matrix |
| Do we support: password reset, email verification, phone verification? | ❌ Password reset + verify flows if not live |

---

### B) Core domain objects (the “tables that power every page”)

| Question | Build checklist |
|----------|-----------------|
| What are the canonical objects? (User, CleanerProfile, Booking, Job, Credits Wallet / Ledger, Payout, Dispute, Photos/Media) | — |
| Which tables are immutable ledgers vs editable records? | ✅ Schema includes `ledger_entries` / finance snapshots patterns (n8n queries assume it) |
| Confirm final table names | ✅ Canonical names: `credit_ledger` (not ledger_entries), `webhook_events`, `finance_snapshots`, `payouts`, `job_events`, `job_photos`, `disputes`. See § “Canonical table names” below. |

---

### C) Credits & ledger (client wallet + escrow hold)

| Question | Build checklist |
|----------|-----------------|
| What is the source of truth for credit balance: computed from ledger, or stored balance with ledger backing? | — |
| What ledger entry types exist: purchase, hold, charge, release, refund, reversal? | — |
| What does “25% hold buffer” look like in DB terms? | — |
| What happens on cancel, dispute, job ends early? | — |
| **Checklist** | ✅ Ledger snapshot job exists (daily) |
| | ✅ `GET /credits/balance`, `GET /credits/ledger` exist (client); Trust API: `GET /api/credits/balance`, `GET /api/credits/ledger`. 🟡 Purchase: `POST /credits/checkout` (packages); hold/release via job flow. |

---

### D) Booking → Job lifecycle (status machine)

| Question | Build checklist |
|----------|-----------------|
| What are the allowed statuses and transitions? | — |
| What triggers: job creation, cleaner acceptance, check-in, in-progress, completion, awaiting approval, approved vs disputed? | — |
| Single `POST /jobs/:id/transition` (frontend references it) or multiple endpoints? | ✅ Frontend assumes status transitions exist (accept, check-in, complete, etc.) |
| **Checklist** | ✅ Status enum + transitions in one place: `src/state/jobStateMachine.ts`, `src/constants/jobStatus.ts`; `GET /config/job-status` returns canonical JSON. |

---

### E) Approval + dispute (your #1 frontend gap)

| Question | Build checklist |
|----------|-----------------|
| Exact backend contract for `POST /jobs/:id/approve`, `POST /jobs/:id/dispute` (or `POST /client/disputes`)? | — |
| What dispute fields are required: reason code, description, photo evidence, refund request? | — |
| Admin resolution actions: partial refund, full refund, deny? | — |
| **Checklist** | ✅ Dispute webhook monitor exists in n8n (Stripe disputes) |
| | ❌ Client dispute creation endpoint + DB records if not built |
| | ✅ Admin disputes queue exists on frontend; backend must support list/filter/detail/resolve |

---

### F) Stripe integration (money movement)

| Question | Build checklist |
|----------|-----------------|
| Are we using Stripe Connect? (Express vs Custom) | — |
| Where do we store Stripe IDs: payment_intent_id, charge_id, transfer_id, connected_account_id? | — |
| Which webhook events are enabled in Stripe and mapped in n8n? | Recommended: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `transfer.paid`, `transfer.failed`, `charge.dispute.*` |
| **Checklist** | ✅ Webhook ingest and event routing exists in n8n exports (pattern) |
| | 🟡 Ensure signature validation is enforced (Stripe signing secret) |
| | ❌ Ensure every event writes to `webhook_events` for audit |

---

### G) Payouts (weekly + instant)

| Question | Build checklist |
|----------|-----------------|
| Weekly payout schedule: what day/time and min threshold? | — |
| Instant payout policy: fee, max amount, cooldown? | — |
| What happens on payout failure? Retry? DLQ? | — |
| **Checklist** | ✅ Weekly vs instant payout concept + enablement steps exist |
| | ❌ Endpoints: `POST /payouts/request`, `GET /cleaner/payouts` |
| | ❌ Add retry/DLQ workflow if you want robust ops (DLQ skeleton idea in docs) |

---

### H) Photos/media storage

| Question | Build checklist |
|----------|-----------------|
| Where are job photos stored (S3/Cloudinary/etc.)? | — |
| Are we using signed URLs? | — |
| Requirements: min before/after count? file size limits? compression? | — |
| **Checklist** | 🟡 Frontend has upload call; backend needs secure storage + validation |
| | ❌ Add server-side MIME checks + virus scanning optional |

---

### I) Real-time tracking (polling → websockets later)

| Question | Build checklist |
|----------|-----------------|
| What is `GET /tracking/:id` returning (events, location, status)? | — |
| Is location stored as points with timestamps? | — |
| Do we plan websocket events later? If yes, name the channels now. | — |
| **Checklist** | ✅ Frontend polling approach exists |
| | 🟡 Backends often missing the “event timeline feed”; define it now |

---

### J) Admin + ops

| Question | Build checklist |
|----------|-----------------|
| Admin endpoints: `GET /admin/bookings`, `GET /admin/disputes`, `GET /admin/users`, `GET /admin/finance/*`? | — |
| Do we have audit logs for admin actions? | — |
| What KPIs are computed daily/weekly? | — |
| **Checklist** | ✅ Daily finance snapshot exists (so finance views can be powered) |
| | ❌ Add “admin_actions” / audit log if not done |

---

### K) Notion (optional but powerful)

| Question | Build checklist |
|----------|-----------------|
| What Notion databases do we want as the operational mirror? (Cleaners, Jobs, Payouts, Events/disputes/refunds, Snapshots, Ops tasks) | — |
| **Checklist** | ✅ Notion credential + DB-ID env pattern exists |
| | 🟡 Decide which DBs are actually created in Notion today |

---

## 2) The single most important output to request from your backend dev

**Have them return this as a doc:**

**“Screen → Endpoint → DB tables → n8n workflows”**

For every frontend screen in your Cursor doc, list:

- **Endpoint(s)** it calls  
- **Tables** it reads/writes  
- **Which n8n workflows** get triggered (if any)  
- **Notifications** sent  

That gives you perfect certainty on what pages/sections you can safely build.

**Filled “Screen → Endpoint → DB → n8n” (one row per main frontend screen):**

| Screen / page | Endpoint(s) | DB tables | n8n workflows triggered | Notifications |
|---------------|-------------|-----------|--------------------------|---------------|
| **Login / Register** | POST /auth/login, POST /auth/register | users | — | — |
| **Auth me / Profile** | GET /auth/me, PATCH /users/me | users, cleaner_profiles (if cleaner) | — | — |
| **Credits balance & ledger** | GET /credits/balance, GET /credits/ledger | credit_ledger | — | — |
| **Client: My bookings** | GET /bookings/me | jobs, users, cleaner_profiles (via bookings) | — | — |
| **Client: Job details** | GET /jobs/:id/details, GET /jobs/:id/timeline, GET /tracking/:id | jobs, job_photos, job_events, credit_ledger, payment_intents, payouts, cleaner_profiles, job_checkins | — | — |
| **Client: Live appointment** | GET /client/jobs/:bookingId/live-status (or GET /tracking/:id) | jobs, job_events, job_photos, cleaner_profiles | — | — |
| **Client: Approve job** | POST /tracking/:id/approve | jobs, job_events, credit_ledger | n8n webhook (event: client_approved) | n8n-driven (e.g. cleaner “Job approved”) |
| **Client: Dispute job** | POST /tracking/:id/dispute | jobs, job_events, disputes | n8n webhook (event: client_disputed) | n8n-driven (e.g. ops alert, client confirmation) |
| **Client: Invoices** | GET /client/invoices, GET /client/invoices/:id | invoices, invoice_line_items | — | — |
| **Cleaner: Job tracking / check-in-out** | GET /tracking/:id, POST /tracking/:id/check-in, POST /tracking/:id/check-out | jobs, job_events, job_photos, job_checkins | n8n webhook (cleaner_on_my_way, job_started, job_completed, etc.) | n8n-driven (client notifications) |
| **Cleaner: Job photo upload (S3/R2)** | POST /uploads/sign, PUT to putUrl, POST /jobs/:id/photos/commit | job_photos, job_events | — (timeline events: before_photos_uploaded, after_photos_uploaded) | — |
| **Cleaner: Schedule** | GET /cleaner/schedule?from=&to= | jobs, cleaner_availability, availability_blocks | — | — |
| **Cleaner: Earnings / payouts** | GET /cleaner/earnings, GET /cleaner/payouts | cleaner_earnings, payouts, payout_items | — | — |
| **Search / browse cleaners** | GET /cleaners/search, GET /cleaners/:id, GET /cleaners/:id/reviews | cleaner_profiles, users, reviews | — | — |
| **Admin: Disputes queue** | GET /admin/disputes, GET /admin/disputes/:id, POST /admin/jobs/:id/resolve-dispute | disputes, jobs, job_events, credit_ledger | n8n webhook (dispute_resolved_*) | n8n-driven |
| **Admin: Finance / KPIs** | GET /admin/finance/*, GET /admin/ops/summary | credit_ledger, finance_snapshots, payouts, jobs | — | — |
| **Client: Dashboard / insights** | GET /client/dashboard/insights, GET /client/dashboard/recommendations | jobs, cleaner_profiles, reviews | — | — |
| **Cleaner: Dashboard** | GET /cleaner/dashboard/analytics, GET /cleaner/level/progress, GET /cleaner/next-best-actions | jobs, cleaner_*, job_events, cleaner_level_* | — | — |
| **Forgot / reset password** | POST /auth/forgot-password, GET /auth/verify-reset-token, POST /auth/reset-password | users (password_reset_token) | — | SendGrid or n8n |
| **Config (job status)** | GET /config/job-status (no auth) | — | — | — |

*All job state changes that call `publishEvent` are forwarded to the n8n webhook (eventName + payload); n8n workflows then send email/SMS/push. Notifications column = “n8n-driven” where the backend does not send directly.*

---

## 3) Immediate alignment: top frontend gaps require these backend endpoints

Based on the frontend checklist, the backend must **confirm or build**:

| Endpoint / capability | Status | Notes |
|----------------------|--------|--------|
| Client Approve | ✅ Exists | `POST /tracking/:jobId/approve` (not /jobs). Use this from frontend. |
| Client Dispute | ✅ Exists | `POST /tracking/:jobId/dispute` (not /jobs). Use this from frontend. |
| “Credits held / top-up required” on job details | ✅ Done | `GET /jobs/:jobId/details` now returns `credits`: `{ credits_held, balance_after_hold, top_up_required }` when job has client and CREDITS_ENABLED. |

These are the **blockers** for: Client Approve/Dispute block, Held credits + top-up modal, Final charge/refund tag.

---

### Canonical table names (single source of truth)

Use these names in n8n, docs, and frontend contracts:

| Purpose | Table name |
|--------|------------|
| Client credit ledger | `credit_ledger` |
| Job timeline / events | `job_events` |
| Job photos | `job_photos` |
| Webhook audit | `webhook_events` |
| Daily finance sums | `finance_snapshots` |
| Cleaner payouts | `payouts` |
| Disputes | `disputes` |
| Admin audit trail | `admin_audit_log` |
| General audit (credits adjust, etc.) | `audit_logs` |

---

## 4) Next steps (suggestions)

**Backend / ops**

1. ~~**Run migration 062**~~ — Done. Run on other DBs if needed: `node scripts/run-migration.js DB/migrations/062_job_photos_client_dispute_type.sql`
2. ~~**Credits-held on job details**~~ — Done. `GET /jobs/:jobId/details` returns `credits: { credits_held, balance_after_hold, top_up_required }`.
3. ~~**S3/R2 storage check**~~ — Done. `/uploads/sign` returns 503 with `code: STORAGE_NOT_CONFIGURED` when STORAGE_* env is missing.
4. ~~**Screen → Endpoint → DB → n8n**~~ — Done. Table in §2 filled for main screens; extend per your frontend pages as needed.

**Frontend**

5. **Use existing approve/dispute** — Point the Client Approve and Dispute blocks to `POST /tracking/:jobId/approve` and `POST /tracking/:jobId/dispute` (with `Authorization: Bearer <token>` and job ownership). No new backend routes needed.
6. **Upload flow** — For job photos: (1) `POST /uploads/sign` with jobId, kind, contentType, fileName, bytes → get putUrl, key, publicUrl; (2) PUT file to putUrl; (3) `POST /jobs/:jobId/photos/commit` with key, kind, contentType, bytes (and publicUrl if you have it). Use `GET /jobs/:jobId/timeline` for the stepper in ASC order.

**Product / alignment**

7. ~~**Lock status enum and transitions**~~ — Done. Canonical source: `src/state/jobStateMachine.ts` and `src/constants/jobStatus.ts`; ARCHITECTURE §3.4a. Frontend/n8n should consume `JOB_STATUS_CANONICAL` or the same constants.
8. ~~**Admin audit log**~~ — Done. `logAdminAction` in `src/lib/adminAuditLog.ts` writes to `admin_audit_log`. Used for job status override and dispute resolve; credit adjust already logged via `audit_logs`.
