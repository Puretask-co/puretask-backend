# PureTask n8n Pack — Verification

**Purpose:** Verify whether the “PureTask n8n Pack” (workflow skeletons, switch cases, idempotency, template schemas) works for PureTask, whether to use it, if it contradicts existing behavior, and what (if anything) to build for it to be true and work correctly.

**Bottom line:** **Yes, use it.** It aligns with our backend and docs. No contradictions. One **payload enrichment** gap: our event payloads do not currently include `clientName`, `cleanerName`, `clientEmail`, etc. — either n8n enriches by calling our API (e.g. GET job + users) or we optionally add those fields for key events. If you use **Postgres idempotency (Option B)**, add the `n8n_event_log` migration (provided below).

---

## 1. Will it work for PureTask?

**Yes.** The pack matches how we send events and how we want n8n to behave.

| Pack item | Backend / docs | Verdict |
|-----------|-----------------|--------|
| **Incoming event body** | We send `jobId`, `actorType`, `actorId`, `eventName`, `payload`, `timestamp` (see `N8N_FULL_REFERENCE.md`, `n8nClient.ts`). | ✅ Matches. |
| **Webhook path** `/puretask/events` | Backend POSTs to whatever URL is in `N8N_WEBHOOK_URL`. The path is defined in n8n (e.g. `https://n8n.example.com/webhook/puretask/events`). | ✅ No conflict. |
| **Canonical ID keys** | We do **not** send `payload.eventId` today. Pack uses fallback: `jobId + eventName + timestamp` (or hash). | ✅ Works as-is. Optional: add `payload.eventId` later for best idempotency. |
| **NormalizeEvent / idempotency_key** | Derivation `evt:${eventName}|job:${jobId\|\|"none"}|ts:${ts}` is correct. | ✅ Works. |
| **Switch cases** | All listed events (`job_created`, `job_accepted`, … `payment_succeeded`) are events we publish (see `N8N_WORKFLOWS_AND_EVENTS.md`). | ✅ Matches. We also send more (e.g. `payment_failed`, `job.cleaner_en_route`, `payout_created`, `reschedule.*`, `cancellation.*`) — add cases when you add those workflows. |
| **Workflow skeletons** | All are **notification/audit** (notify client/cleaner, audit, escalate). No “settle payout” or “issue refund” in n8n. | ✅ Aligned with `N8N_AGENT_PACKAGE_VERIFICATION.md` (backend does money; n8n notifies). |
| **Idempotency Option A (Data Store)** | No backend change. n8n-only. | ✅ Use as-is. |
| **Idempotency Option B (Postgres)** | We do **not** have `n8n_event_log` in the repo today. | ⚠️ Add migration when you adopt Option B (see Section 4). |

---

## 2. Should we use it?

**Yes.** It gives you:

- A single **event router** (PT.EventRouter) with validate → idempotency → switch → execute child.
- **Consistent naming** (PT.Notify.*, PT.Audit.*) and **canonical switch cases**.
- **Idempotency** (Data Store or Postgres) so the same event is not processed twice.
- **Template variable schemas** and a reusable **BuildVars**-style function (with the enrichment caveat below).
- **Build order** (EventRouter → UnknownEvent + AdminOverride → JobCompleted → rest → Postgres upgrade).

It does not contradict our architecture (backend = source of truth; n8n = notifications and audit).

---

## 3. Does it contradict anything we already have?

**No.** Details:

- **Event shape:** Same as in `N8N_FULL_REFERENCE.md` and `src/lib/n8nClient.ts` (`N8nEventPayload`).
- **Webhook URL:** We only care that `N8N_WEBHOOK_URL` points to your n8n webhook; the path (`/puretask/events` or other) is configured in n8n.
- **Routing:** Pack routes financial events to **Notify** workflows (e.g. `client_approved` → PT.Notify.JobApproved, `payment_succeeded` → PT.Notify.PaymentSucceeded). That matches `N8N_AGENT_PACKAGE_VERIFICATION.md` (no n8n settlement/refund execution).
- **Existing docs:** `N8N_WORKFLOWS_AND_EVENTS.md`, `N8N_FULL_REFERENCE.md`, `ARCHITECTURE_AUTOMATION.md`, `N8N_AGENT_PACKAGE_VERIFICATION.md` all stay valid; the pack is an implementation guide for n8n that respects them.

**One gap (not a contradiction):**

- **BuildVars / template schemas** assume `payload` (or a `vars` object) contains fields like `clientName`, `cleanerName`, `clientEmail`, `cleanerEmail`, `scheduledStart`, `addressShort`, `priceDisplay`, etc.
- **Our backend** today sends **event-specific** payloads (e.g. `job_created`: `scheduled_start_at`, `address`, `credit_amount`; `payment_succeeded`: `purpose`, `credits`, `amount`, `clientId`, `jobId`). We do **not** routinely include display names, emails, or phones in every event payload.
- So for the pack’s “Set Vars” and templates to work as written, you need **enrichment**:
  - **Option A (recommended):** In n8n, after receiving the event, call our API (e.g. GET job by `jobId`, then resolve client/cleaner and their contact info) and build `vars` from API response + `$json.payload`. No backend change.
  - **Option B:** Backend optionally adds to `payload` for key events (e.g. `clientEmail`, `cleanerEmail`, `addressShort`) when publishing. Requires small changes in `publishEvent` call sites or a wrapper that enriches before forward.

---

## 4. What do we need to build for it to be true and work correctly?

### 4.1 Backend (optional)

| Item | Required? | What to do |
|------|-----------|------------|
| **payload.eventId** | Optional | If you want the “best” idempotency key, add a stable `eventId` (e.g. UUID) to the payload when we call `forwardEventToN8nWebhook` (e.g. in `events.ts`). Then n8n can use `payload.eventId` in NormalizeEvent. Not required for the pack to work; fallback `jobId+eventName+timestamp` is fine. |
| **Payload enrichment** | Optional | If you prefer backend to supply contact/display data: in the services that call `publishEvent`, add to `payload` (e.g. `clientEmail`, `cleanerEmail`, `addressShort`, `clientName`, `cleanerName`) for the events that need them. Otherwise, n8n enriches via API (Option A above). |

### 4.2 Database (if you use Idempotency Option B)

| Item | Required? | What to do |
|------|-----------|------------|
| **n8n_event_log table** | Only if you use Postgres idempotency (Option B) | Add migration `041_n8n_event_log.sql` (see below). Run it in Neon (or your Postgres). n8n then uses this table for idempotency and audit. |

### 4.3 n8n (you build)

- **PT.EventRouter** with Webhook → NormalizeEvent → Idempotency (Data Store or Postgres) → Switch → Execute Workflow per case.
- **PT.Audit.UnknownEvent** and **PT.Audit.AdminOverride**.
- **PT.Notify.*** workflows (JobCreated, JobAccepted, CleanerOnMyWay, JobStarted, JobCompleted, JobApproved, DisputeOpened, DisputeResolvedRefund, DisputeResolvedNoRefund, JobCancelled, JobAutoCancelled, PaymentSucceeded).
- In each notify workflow: validate → build vars (from payload + optional API enrichment) → send email/SMS/push → audit → return.

No backend change is **required** for the pack to work; enrichment can be done entirely in n8n via your existing APIs.

---

## 5. Migration: n8n_event_log (Option B idempotency)

Create this file and run it when you adopt Postgres idempotency for n8n:

**File:** `DB/migrations/041_n8n_event_log.sql`

```sql
-- Idempotency and audit log for n8n event processing (backend → n8n).
-- Use when n8n uses Postgres for idempotency (Option B) per N8N_PACK_VERIFICATION.md.

create table if not exists n8n_event_log (
  id bigserial primary key,
  idempotency_key text not null unique,
  event_name text not null,
  job_id uuid null,
  received_at timestamptz not null default now(),
  source text not null default 'backend_to_n8n',
  status text not null default 'processed',
  workflow_name text null,
  message text null,
  payload jsonb not null
);

create index if not exists n8n_event_log_event_name_idx on n8n_event_log(event_name);
create index if not exists n8n_event_log_job_id_idx on n8n_event_log(job_id);
create index if not exists n8n_event_log_received_at_idx on n8n_event_log(received_at);
```

Status values: `processed` | `skipped_duplicate` | `failed`. n8n sets `workflow_name` (e.g. `PT.Notify.JobCreated`) when known.

---

## 6. Summary

| Question | Answer |
|----------|--------|
| **Will the pack work for PureTask?** | Yes. Event shape, routing, and workflows align with our backend and docs. |
| **Should we use it?** | Yes. It gives a clear router, idempotency, naming, and build order. |
| **Does it contradict what we have?** | No. No conflicts with N8N_FULL_REFERENCE, N8N_WORKFLOWS_AND_EVENTS, ARCHITECTURE_AUTOMATION, or N8N_AGENT_PACKAGE_VERIFICATION. |
| **What must we build?** | **n8n:** PT.EventRouter + PT.Notify.* + PT.Audit.* (you build in n8n). **Backend:** Nothing required. **Optional:** payload.eventId; payload enrichment for vars; migration `041_n8n_event_log.sql` if you use Postgres idempotency. |
| **Payload enrichment** | Pack’s BuildVars/template schemas expect vars like clientName, clientEmail. Our payloads are event-specific and often don’t include those. Either enrich in n8n via API (GET job + users) or add optional fields to backend payloads. |

**Last updated:** 2026-01-31
