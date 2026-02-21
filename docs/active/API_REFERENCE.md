# API Reference

**What it is:** Single reference for how we document the PureTask API, how it compares to external specs, and the exact endpoint list (paths + request/response).  
**What it does:** Describes Swagger/OpenAPI access, base URL and auth, spec comparison (our paths vs others), and a copy-paste-friendly endpoint list for frontend, SDKs, and n8n.  
**How we use it:** Use [BACKEND_ENDPOINTS.md](./BACKEND_ENDPOINTS.md) for a short list; use this doc for how to open docs, spec alignment, and full path/req/res details.

---

## 1. Accessing API documentation

- **Swagger UI (interactive):** `http://localhost:4000/api-docs` (dev), `https://api.puretask.com/api-docs` (prod). Try endpoints, view schemas, use auth.
- **OpenAPI JSON:** `http://localhost:4000/api-docs/json` — for Postman import, SDK generation, and other tools.

**Base URL:** Dev `http://localhost:4000`; prod `https://api.puretask.com`.  
**Auth:** `POST /auth/login` with `{ "email", "password" }` → get token; send `Authorization: Bearer <token>` on protected routes.

---

## 2. Spec comparison (our API vs external specs)

We keep **our** paths and shapes as source of truth. Summary:

| Area | We have | Notes |
|------|---------|--------|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | We use **register** not signup. |
| Credits | `/credits/*` not `/wallet/*` | `/credits/balance`, `/credits/packages`, `/credits/checkout`, `/credits/history`, `/credits/purchases`. Checkout session flow, not wallet purchase-intent. |
| Jobs (client) | `/jobs`, `/jobs/:id`, `/jobs/:id/transition`, `/cancellations/jobs/:id` | Cancel under **cancellations**; approve via transition `client_approved`. |
| Jobs (cleaner) | `/tracking/:jobId` + check-in/check-out; approve/dispute via jobs/transition | Same concepts, our path names. |
| Cleaner earnings | `GET /cleaner/earnings`, `GET /cleaner/payouts` | Path prefix **cleaner**. |
| Events | `POST /events`, `POST /n8n/events` | Body: **eventType**, jobId, actorType, actorId, payload (not event_name/event_id). |
| Stripe | `POST /stripe/webhook` | Idempotency by Stripe event id in `stripe_events`. |
| Idempotency | `idempotency_keys` table; `Idempotency-Key` header on money-adjacent POSTs | Same key returns stored response. |

**DB/n8n:** Our migrations are source of truth; use external spec only to spot missing columns. For n8n, document **our** eventType values and Switch cases; see N8N_EVENT_ROUTER if present.

---

## 3. Exact endpoint list (paths + request/response)

Short form for integration and tests. Full schemas and try-it-out: use Swagger at `/api-docs`.

### Auth

- **POST /auth/register** — Req: `{ email, password, role: "client"|"cleaner" }` → Res: `{ user, token }`
- **POST /auth/login** — Req: `{ email, password }` → Res: `{ token, user }`
- **GET /auth/me** — Current user (Bearer)

### Credits (we use `/credits` not `/wallet`)

- **GET /credits/packages** — List packages (public)
- **GET /credits/balance** — Balance (Bearer, client) → `{ balance }`
- **POST /credits/checkout** — Create Stripe Checkout Session — Req: `{ packageId, successUrl, cancelUrl }` → `{ sessionId, url }`
- **GET /credits/history**, **GET /credits/purchases** — Ledger and purchases (Bearer, client)

### Jobs (client)

- **POST /jobs** — Create job (body: cleaner_id, cleaning type, estimated_hours, start_time, address, etc.) → `{ job }`
- **GET /jobs/:jobId**, **PUT /jobs/:jobId**, **DELETE /jobs/:jobId**
- **POST /cancellations/jobs/:jobId** — Cancel — Req: `{ reason, ... }`
- **POST /jobs/:jobId/transition** — e.g. `{ eventType: "client_approved" }`
- **POST /jobs/:jobId/pay** — Pay for job

### Jobs (cleaner) — tracking

- **GET /tracking/:jobId** — Tracking state
- **POST /tracking/:jobId/check-in** — Req: `{ lat, lng, occurred_at, ... }` (Idempotency-Key supported)
- **POST /tracking/:jobId/check-out** — Req: `{ lat, lng, occurred_at, worked_minutes, ... }`
- **POST /jobs/:jobId/transition** — Approve or dispute (`eventType`: `client_approved`, `job_disputed`)
- **POST /jobs/:jobId/photos** (or under /tracking/photos) — Req: `{ type: "before"|"after", url, ... }`

### Cleaner earnings & payouts

- **GET /cleaner/earnings** — Earnings (Bearer, cleaner)
- **GET /cleaner/payouts** — Payout history
- **POST /cleaner/payouts/instant** (if implemented) — Req: `{ amount_credits, idempotency_key? }`
- **POST /admin/payouts/run-weekly** — Admin/cron weekly payouts

### Events (backend ↔ n8n)

- **POST /events**, **POST /n8n/events** — Req: `{ eventType, jobId?, actorType?, actorId?, payload? }` — Res: 204 or error

### Stripe webhooks

- **POST /stripe/webhook** — Stripe events; signature verified; idempotency by `stripe_events`; Res: `200 { received: true }`

### Health & status

- **GET /health** — Liveness
- **GET /health/ready** — Readiness (DB, etc.)
- **GET /status** — Operational status

### Idempotency

- Send **Idempotency-Key** header on money-adjacent POSTs (payments, tracking check-in/check-out). Same key returns stored response.

---

**Sources consolidated (2026-02):** Content merged from `02-MEDIUM/API_DOCUMENTATION.md`, `API_SPEC_COMPARISON.md`, and `API_EXACT_ENDPOINTS.md`. Originals archived to `docs/archive/raw/consolidated-sources/02-MEDIUM/`.
