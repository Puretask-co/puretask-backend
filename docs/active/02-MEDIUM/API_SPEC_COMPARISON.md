# API & Data Spec Comparison — Is This Useful? Do We Have It? Use It?

**Purpose:** Compare the provided spec (exact endpoint list, DB migrations, n8n router, idempotency strategy) with what PureTask backend already has, and whether to adopt it or a version of it.

**In plain English:** Someone gave us a spec (list of endpoints, DB tables, event router, idempotency rules). This doc answers: "Do we already have that? Is it useful? Should we use it as-is or adapt it?" So we don't duplicate work and we keep one clear source of truth (our paths and our tables).

---

## New here? Key terms (plain English)

**What it is:** A glossary of backend/DevOps terms used in this doc.  
**What it does:** Lets new readers understand terms like Idempotency, Migration, CI/CD without looking elsewhere.  
**How we use it:** Refer to this table when you see an unfamiliar term in the sections below.

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

## 1) Exact Endpoint List (REST paths + request/response)

**What it is:** A spec item describing a single copy-paste-friendly list of API paths and request/response shapes.  
**What it does:** Enables frontend, SDKs, and n8n to use one reference for paths and payloads.  
**How we use it:** Compare with our actual endpoints; we keep our paths as source of truth and maintain API_EXACT_ENDPOINTS.md.

### Is it useful?
**Yes.** A single, copy-paste-friendly list of paths and request/response shapes is useful for frontend, SDKs, and n8n.

### Do we already have it or something different?
**We have something different but equivalent:**

| Spec item | We have | Notes |
|-----------|---------|--------|
| Auth | `POST /auth/register`, `POST /auth/login` | Same idea; we use **register** not **signup**. |
| Wallet / Credits | `/credits/*` not `/wallet/*` | We have: `/credits/balance`, `/credits/packages`, `/credits/checkout`, `/credits/history`, `/credits/purchases`. No `/wallet/purchase-intent` — we use **checkout session** flow. |
| Jobs (client) | `/jobs`, `/jobs/:id`, `/jobs/:id/transition`, `/cancellations/jobs/:id` | Same concepts; **cancel** is under **cancellations**. **Approve** is via `transition` with `client_approved`. |
| Jobs (cleaner) | `/tracking/:jobId` + POST body for check-in/check-out | We have check-in, check-out, approve, dispute under **tracking** and **jobs**. |
| Cleaner earnings / payouts | `GET /cleaner/earnings`, `GET /cleaner/payouts` | Same idea; path prefix is **cleaner**. |
| Events | `POST /events`, `POST /n8n/events` | We have both; body uses **eventType** (and jobId, actorType, actorId, payload), not **event_name** / **event_id** / **idempotency_key**. |
| Stripe webhooks | `POST /stripe/webhook` (or similar) | We process `payment_intent.succeeded` etc. with idempotency via `stripe_events`. |

### Should we use it or a version of it?
**Use a version.** Keep **our** paths and shapes as the source of truth. Add one doc that lists **our** exact endpoints in the same style (path + req/res) so we have a single reference. See **API_EXACT_ENDPOINTS.md** (or the section below in this repo) for that list.

---

## 2) Exact DB Schema / Migrations (missing tables)

### Is it useful?
**Yes.** The listed tables are high-leverage for audit, proof, and payouts.

### Do we already have it or something different?
**We already have equivalent tables:**

| Spec table | We have | Migration / notes |
|------------|---------|--------------------|
| `job_events` | ✅ `job_events` | We use **event_type** (not event_name). |
| `job_photos` | ✅ `job_photos` | e.g. 006_job_photos. |
| `cleaner_earnings_ledger` | ✅ `cleaner_earnings` | Same concept; we have ledger + payout_id. |
| `payouts`, `payout_items` | ✅ `payouts`, `payout_items` | 004, 014, 019, hardening 903. |
| `idempotency_keys` | ✅ `idempotency_keys` | 039; we use **idempotency_key, endpoint, method, status_code, response_body** (no scope/request_hash/expires_at in the same form). |

We use Postgres + UUID; we have the same ideas. **Do not** re-run the spec’s SQL as-is — we’d duplicate or conflict. If anything, compare column-by-column and add only **missing** columns or constraints.

### Should we use it or a version of it?
**Use as reference only.** Our migrations are the source of truth. Use the spec to spot missing columns or indexes and add them via new migrations if needed.

---

## 3) n8n Event Router (Switch by event_name)

**What it is:** A spec item describing an event_name → action map for n8n workflow design.  
**What it does:** Helps n8n workflows route events (wallet, job, payout) correctly.  
**How we use it:** We added N8N_EVENT_ROUTER.md with our eventType and Switch cases; keep it in sync with backend events.

### Is it useful?
**Yes.** A clear “event_name → action” map helps n8n workflow design and onboarding.

### Do we already have it or something different?
**We have the pipeline, not the doc.** We send events (e.g. from `publishEvent`) and have `/events` and `/n8n/events`. We do **not** have a single doc that lists “Switch on event_name → wallet / job / payout” cases.

### Should we use it or a version of it?
**Use a version.** Add a short **n8n event router** doc that:

- Describes **our** event body (e.g. `eventType`, `jobId`, `actorType`, `actorId`, `payload`).
- Lists **our** event types and recommended n8n Switch cases (wallet, job, payout).
- Optionally mentions idempotency in n8n (e.g. `n8n_event_log` by `event_id`) if we add it.

Keep our field names (`eventType` etc.); map the spec’s **event_name** cases to our **eventType** values.

---

## 4) Idempotency Strategy (purchases + approval)

### Is it useful?
**Yes.** Critical for “won’t lose money in prod.”

### Do we already have it or something different?
**We have a simpler version:**

- **Table:** `idempotency_keys` (key, endpoint, method, status_code, response_body).
- **Middleware:** `requireIdempotency` on selected routes (e.g. payments, tracking); we use **Idempotency-Key** header and return stored response on reuse.
- **Stripe:** We use `stripe_events` (by Stripe event id) so webhooks are idempotent.
- **Payouts:** We build a deterministic idempotency key (e.g. cleaner + date + payout IDs) for batch payouts.

We do **not** currently:

- Store **request_hash** or enforce “same key, same body” with 409 on mismatch.
- Use a “reserve then complete” pattern with **started** / **completed** / **failed** and **expires_at**.

### Should we use it or a version of it?
**Use a version.** Keep current behavior as-is for now. **Optionally** harden later:

- Add **request_hash** and **expires_at** to `idempotency_keys`.
- On key reuse: if **request_hash** differs → **409 Idempotency key reuse mismatch**; if **completed** → return stored response.
- Use the spec’s “reserve then complete” pattern for high-risk endpoints (e.g. approve, purchase-intent) if we want stricter guarantees.

---

## Summary

**What it is:** A table comparing each spec item (endpoint list, DB schema, n8n router, idempotency) to our current state and recommended action.  
**What it does:** Answers "useful?", "do we have it?", and "use as-is, use a version, or reference only?" in one place.  
**How we use it:** Use this table to decide next steps (e.g. add our exact endpoint list, add n8n router doc, optionally harden idempotency).

| Item | Useful? | We have? | Action |
|------|---------|----------|--------|
| 1) Exact endpoint list | Yes | Different paths/schemas | **Use a version:** add **our** exact list (see API_EXACT_ENDPOINTS.md). |
| 2) DB migrations | Yes | Same concepts, different migration history | **Reference only;** add only missing columns/constraints. |
| 3) n8n event router | Yes | No doc | **Use a version:** add n8n router doc with **our** eventType and Switch cases. |
| 4) Idempotency strategy | Yes | Simpler (no request_hash, no 409) | **Use a version:** optional hardening (request_hash, 409, reserve/complete). |

**Bottom line:** The spec is useful. We already have equivalent functionality with different paths and schema details. We should **use a version of it**: adopt the **format** (exact path + req/res), add **our** endpoint list, add an **n8n event router** doc, and optionally harden **idempotency** later.
