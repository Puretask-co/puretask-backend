# n8n Event Router — Switch by eventType

**Purpose:** Reference for building n8n workflows that consume PureTask backend events. Our API sends events to n8n; this doc maps **eventType** → suggested actions.

**What this doc is for:** Use it when you build or change n8n workflows that react to PureTask events (e.g. job_created, client_approved). It explains (1) how events reach n8n, (2) the JSON body shape, and (3) which **eventType** / **eventName** to switch on and what action to take (e.g. send email, push notification).

**Why it matters:** One place to see all event types and suggested actions so n8n workflows stay in sync with the backend and don't miss or mishandle events.

**In plain English:** n8n is a tool that reacts to events (e.g. "job created," "payment succeeded"). Our backend sends those events to n8n. This doc is a map: "when you see event X, do action Y" (e.g. send email, push notification). Use it when you build or change n8n workflows so you don't miss an event or send the wrong message.

---

## New here? Key terms (plain English)

**What it is:** A glossary of backend/DevOps terms used in this doc.  
**What it does:** Lets new readers understand Idempotency, Migration, n8n, etc.  
**How we use it:** Refer to this table when you see an unfamiliar term below.

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## How events reach n8n

- **Backend → n8n:** Backend calls your n8n webhook URL (configured via `N8N_WEBHOOK_URL`) with a JSON body after job/payment/payout events.
- **n8n → Backend (optional):** n8n can call `POST /events` or `POST /n8n/events` with HMAC signature to push events into our system.

---

## Event body (our shape)

**What it is:** The JSON structure we send to n8n and accept from n8n (eventType, jobId, actorType, payload).  
**What it does:** Defines the canonical event payload so n8n workflows can switch on eventType/eventName.  
**How we use it:** Use eventType (or eventName when we send to n8n) as the Switch key in n8n.

When **backend sends to n8n**, payload is like:

```json
{
  "jobId": "uuid",
  "actorType": "client" | "cleaner" | "admin" | "system",
  "actorId": "uuid",
  "eventName": "job_created",
  "payload": { ... }
}
```

When **n8n sends to backend** (`POST /events` or `POST /n8n/events`), we expect:

```json
{
  "eventType": "string",
  "jobId": "uuid (optional)",
  "actorType": "client" | "cleaner" | "admin" | "system",
  "actorId": "uuid (optional)",
  "payload": { ... }
}
```

Use **eventType** (or **eventName** when we send to you) as the Switch key in n8n.

---

## Router logic (n8n Switch node)

Use a **Switch** node on `{{ $json.eventName }}` or `{{ $json.eventType }}` with cases below.

### Jobs

| eventType | Suggested action |
|-----------|------------------|
| `job_created` | Client: booking confirmation; Cleaner: invite / match notification |
| `job_accepted` | Client: “Cleaner confirmed” |
| `cleaner_on_my_way` | Client: “Cleaner on the way” |
| `job_started` | Client: “Cleaner arrived” / check-in |
| `job_completed` | Client: “Approve & pay” reminder |
| `client_approved` | Receipt + review request; Cleaner: earnings notice |
| `client_disputed` | Admin alert + dispute email |
| `dispute_resolved_refund` / `dispute_resolved_no_refund` | Notify client/cleaner as needed |
| `job_cancelled` | Client + cleaner: cancellation notice |
| `job_auto_cancelled` | Same as cancelled |
| `job_overridden` | Admin override notice |
| `payment_succeeded` | Client: payment receipt |

### Wallet / credits (if we send such events)

**What it is:** Optional Switch cases for wallet/credits events (credits_purchased, credits_held, credits_released).  
**What it does:** Lets n8n send receipts and confirmations when we send wallet events.  
**How we use it:** Add these cases in n8n when backend starts sending wallet events.

If backend sends wallet events (e.g. after Stripe webhook), add cases:

- `wallet.credits_purchased` → SendGrid receipt + push
- `wallet.credits_held` → Client booking confirmation
- `wallet.credits_released` → Release notice (optional)

### Payouts (if we send such events)

- `payout.initiated` → Cleaner: “Payout processing”
- `payout.paid` → Cleaner: “Paid”
- `payout.failed` → Admin alert + Cleaner: “Update bank”

---

## Idempotency in n8n

**What it is:** A pattern to avoid processing the same backend event twice in n8n (e.g. n8n_event_log by event_id).  
**What it does:** Prevents duplicate emails/actions when webhooks retry or events are re-sent.  
**How we use it:** Before the Switch, insert into n8n_event_log; on conflict, stop the workflow.

To avoid processing the same event twice:

1. **Before the Switch:** Insert into a log table (e.g. `n8n_event_log(event_id)`) with a unique constraint on `event_id`.
2. **On conflict:** Stop the workflow (already processed).
3. **Optional table:**

```sql
CREATE TABLE IF NOT EXISTS n8n_event_log (
  event_id uuid PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);
```

If the backend sends a stable `event_id` (or you derive one from `jobId + eventName + timestamp`), use it as the primary key.

---

## Signature verification (n8n → backend)

**What it is:** HMAC-SHA256 verification of the request body when n8n calls our events endpoints.  
**What it does:** Ensures events from n8n are authentic and not forged.  
**How we use it:** Configure the same secret in backend and n8n; we verify x-n8n-signature header.

When n8n calls `POST /events` or `POST /n8n/events`, we verify the **x-n8n-signature** header (HMAC-SHA256 of the JSON body). Configure the same secret in backend and n8n.

---

*See **API_EXACT_ENDPOINTS.md** for exact paths and **API_SPEC_COMPARISON.md** for how this compares to the external spec.*
