# Exact Endpoint List — PureTask Backend (REST paths + request/response)

**Source of truth for API paths and shapes.** Use this for frontend, SDKs, and n8n.  
For Swagger/OpenAPI, see `/api-docs` and **API_DOCUMENTATION.md**.

**What this doc is for:** A single list of every REST endpoint (method + path), with request and response shapes in short form. Use it when (1) integrating the API from the frontend or n8n, (2) writing tests or Postman collections, or (3) comparing against an external spec. For full request/response schemas and try-it-out, use `/api-docs` (Swagger UI).

**Why it matters:** One place to see "what endpoints exist and what to send/expect" without opening the codebase or Swagger. Keeps frontend and backend in sync.

**In plain English:** This is a simple list: "POST /auth/login, send email + password, get back token + user." Use it when the frontend or a partner needs to know "what URL to call and what body to send" without opening the interactive docs. For trying requests in the browser, use `/api-docs` instead.

---

## New here? Key terms (plain English)

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

## Auth

**What it is:** Auth endpoints (register, login, me).  
**What it does:** Handles user identity and session.  
**How we use it:** Use POST /auth/login to get token; GET /auth/me for current user; send Bearer token on protected requests.

**POST /auth/register**

- Req: `{ "email": "a@b.com", "password": "string", "role": "client" | "cleaner" }`
- Res: `{ "user": { "id": "uuid", "email": "...", "role": "..." }, "token": "jwt" }` (or similar)

**POST /auth/login**

- Req: `{ "email": "a@b.com", "password": "string" }`
- Res: `{ "token": "jwt", "user": { "id": "uuid", "role": "..." } }`

**GET /auth/me** — current user (Bearer required)

---

## Credits / Wallet (we use `/credits` not `/wallet`)

**What it is:** Endpoints for credit packages, balance, checkout, history.  
**What it does:** Handles client credits and Stripe checkout.  
**How we use it:** Use /credits/balance for balance; /credits/checkout for purchase; /credits/history for ledger.

**GET /credits/packages** — list credit packages (public)

**GET /credits/balance** — client credit balance (Bearer, client role)

- Res: `{ "balance": number }`

**POST /credits/checkout** — create Stripe Checkout Session for credit purchase

- Req: `{ "packageId": "string", "successUrl": "string", "cancelUrl": "string" }`
- Res: `{ "sessionId": "...", "url": "..." }` (or redirect URL)

**GET /credits/history** — ledger/history (Bearer, client)

**GET /credits/purchases** — purchase history (Bearer, client)

**POST /payments/credits** — payment success/callback handling (depends on flow)

---

## Jobs (client)

**What it is:** Client-facing job endpoints (create, list, get, update, pay).  
**What it does:** Handles job lifecycle and payment.  
**How we use it:** Use POST /jobs to create; GET /jobs for list; POST /jobs/:id/pay for payment.

**POST /jobs** — create job (holds credits / escrow)

- Req: body with cleaner_id, cleaning type, estimated_hours, start_time, address, etc.
- Res: `{ "job": { "id": "uuid", "status": "...", ... } }`

**GET /jobs/:jobId** — get job

**PUT /jobs/:jobId** — update job

**DELETE /jobs/:jobId** — delete/cancel (or use cancellations)

**POST /cancellations/jobs/:jobId** — cancel job (client)

- Req: `{ "reason": "string", ... }`
- Res: `{ "cancelled": true, "job": { ... } }`

**POST /jobs/:jobId/transition** — status transition (e.g. client approve)

- Req: `{ "eventType": "client_approved" }` (or similar)
- Res: `{ "job": { ... } }`

**POST /jobs/:jobId/pay** — pay for job (client)

---

## Jobs (cleaner) — tracking & lifecycle

**What it is:** Cleaner-facing endpoints (tracking, check-in, check-out, approve).  
**What it does:** Handles cleaner job lifecycle and status.  
**How we use it:** Use tracking endpoints for check-in/out; jobs endpoints for approve/dispute.

**GET /tracking/:jobId** — get job tracking state

**POST /tracking/:jobId/check-in** — cleaner check-in (Idempotency-Key supported)

- Req: `{ "lat": number, "lng": number, "occurred_at": "ISO", ... }`
- Res: `{ "status": "in_progress", "checkin_at": "ISO" }`

**POST /tracking/:jobId/check-out** — cleaner check-out (Idempotency-Key supported)

- Req: `{ "lat", "lng", "occurred_at", "worked_minutes", ... }`
- Res: `{ "status": "awaiting_client", "checkout_at": "ISO", "worked_minutes": number }`

**POST /jobs/:jobId/transition** — approve / dispute (e.g. `eventType`: `client_approved`, `job_disputed`)

**POST /jobs/:jobId/photos** (or under /tracking or /photos) — before/after photos

- Req: `{ "type": "before" | "after", "url": "https://...", ... }`

---

## Cleaner earnings & payouts

**What it is:** Endpoints for cleaner earnings and payout history.  
**What it does:** Lets cleaners see earnings and payouts.  
**How we use it:** Use GET /cleaner/earnings and GET /cleaner/payouts (Bearer, cleaner role).

**GET /cleaner/earnings** — cleaner earnings (Bearer, cleaner role)

- Res: `{ "available_credits"?, "pending_credits"?, "items": [ ... ] }` (shape in code)

**GET /cleaner/payouts** — payout history (Bearer, cleaner)

**POST /cleaner/payouts/instant** (or admin payout run) — instant payout request (if implemented)

- Req: `{ "amount_credits": number, "idempotency_key"?: "string" }`

**POST /admin/payouts/run-weekly** (admin/cron) — run weekly payouts

- Res: `{ "ran": true, "payouts_created": number }` (or similar)

---

## Events (backend ↔ n8n)

**What it is:** Endpoints for sending events to n8n or receiving from n8n.  
**What it does:** Integrates with n8n workflows.  
**How we use it:** Backend calls n8n webhook; n8n can POST to /events or /n8n/events; see N8N_EVENT_ROUTER.

**POST /events** and **POST /n8n/events** — receive events (HMAC-verified)

- Req (our shape): `{ "eventType": "string", "jobId"?: "uuid", "actorType"?: "client"|"cleaner"|"admin"|"system", "actorId"?: "uuid", "payload"?: object }`
- Res: `204 No Content` or error JSON

Outbound: we call n8n webhooks or internal `publishEvent()`; event types align with job/tracking/payment lifecycle.

---

## Stripe webhooks

**What it is:** Endpoint that receives Stripe webhook events.  
**What it does:** Handles payment_intent.succeeded etc. with idempotency.  
**How we use it:** Configure in Stripe dashboard; verify signature; process events; see stripe_events table.

**POST /stripe/webhook** (or configured path) — Stripe sends events

- Stripe signature verified; we process `payment_intent.succeeded`, `payment_intent.payment_failed`, etc.
- Idempotency by Stripe `event.id` (stored in `stripe_events`).
- Res: `200 { "received": true }` or similar.

---

## Idempotency

**What it is:** How we ensure duplicate requests don't double-charge or double-create.  
**What it does:** Uses idempotency keys (e.g. Stripe, payments) so retries are safe.  
**How we use it:** Send idempotency key in header or body where supported; backend dedupes by key.

- **Header:** `Idempotency-Key: <string>` on money-adjacent POSTs (e.g. payments, tracking check-in/check-out).
- We store key → response; same key returns stored response (no request_hash or 409 yet).
- See **API_SPEC_COMPARISON.md** and **ERROR_RECOVERY_CIRCUIT_BREAKERS.md** for strategy details.

---

*Last updated from codebase routes and services. For full request/response schemas and status codes, use Swagger UI at `/api-docs`.*
