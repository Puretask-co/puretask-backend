# n8n in PureTask — Full Reference

**Purpose:** Single source of truth for everything n8n-related in the PureTask backend: env, outbound (event forward + API), inbound webhooks, HMAC, event types, status, and troubleshooting.

---

## 1. Overview

**What n8n does in PureTask**

- **Outbound (backend → n8n):**
  - **Event forward:** Every time we publish a job event (e.g. `job_completed`, `client_approved`), we POST that event to `N8N_WEBHOOK_URL`. n8n workflows can then send email/SMS, update sheets, or run other automations.
  - **API client:** We can trigger workflows by ID, list workflows, get executions, and check status using the n8n API (`N8N_API_KEY`, `N8N_BASE_URL`).
- **Inbound (n8n → backend):**
  - n8n workflows can call our backend at `POST /n8n/events` or `POST /events` to record an event (e.g. after an external step). Requests must include the `x-n8n-signature` header (HMAC-SHA256 of the body with `N8N_WEBHOOK_SECRET`).

**Where it lives**

- **Outbound event forward:** `src/lib/events.ts` → `forwardEventToN8nWebhook()` in `src/lib/n8nClient.ts` (uses `postJson` and `N8N_WEBHOOK_URL`).
- **API client:** `src/lib/n8nClient.ts` (trigger workflow, list workflows, get status/executions, test connection).
- **Inbound webhook:** `src/routes/events.ts` — `POST /n8n/events` and `POST /events`, protected by `verifyN8nSignature` in `src/lib/auth.ts`.
- **Re-exports:** `src/integrations/n8n.ts` re-exports all n8n client and webhook helpers.

---

## 2. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `N8N_WEBHOOK_SECRET` | **Yes** | Shared secret for verifying inbound requests from n8n (HMAC-SHA256). Must match the secret configured in n8n when calling our backend. |
| `N8N_WEBHOOK_URL` | No | URL we POST job events to (outbound). If set, every `publishEvent` forwards the event here. If not set, events are still stored in `job_events` but not sent to n8n. |
| `N8N_API_KEY` | No | n8n API key for triggering workflows and listing/checking status. Used by `n8nClient` (X-N8N-API-KEY header). |
| `N8N_BASE_URL` | No | n8n API base URL (e.g. `https://puretask.app.n8n.cloud/api/v1`). Defaults to `https://puretask.app.n8n.cloud/api/v1` if not set. |
| `N8N_MCP_SERVER_URL` | No | n8n MCP server URL (for AI/tooling). Used by `isN8nConfigured()` in some contexts; MCP ops server can “ping” n8n via `N8N_TEST_WEBHOOK_URL`. |
| `N8N_TEST_WEBHOOK_URL` | No | Used by MCP ops server only: URL to POST a test payload when you run the “pingN8n” action. |

**Summary**

- **Inbound (n8n → us):** `N8N_WEBHOOK_SECRET` is required so we can verify `x-n8n-signature`.
- **Outbound (us → n8n):** `N8N_WEBHOOK_URL` for event forward; `N8N_API_KEY` (and optionally `N8N_BASE_URL`) for API calls.

---

## 3. Outbound — Event forward (backend → n8n)

**Flow**

1. Something in the app calls `publishEvent({ jobId, actorType, actorId, eventName, payload })` (e.g. job completed, client approved).
2. We insert into `job_events` (if `jobId` is set) and then call `forwardEventToN8nWebhook()` from `n8nClient`.
3. If `N8N_WEBHOOK_URL` is set, we POST a JSON body to that URL. If not set, we log and return (no throw).
4. The POST is fire-and-forget: we catch errors and log them so the main request does not fail.

**Payload we send (outbound)**

```json
{
  "jobId": "uuid-or-null",
  "actorType": "client" | "cleaner" | "admin" | "system" | null,
  "actorId": "uuid-or-null",
  "eventName": "job_completed",
  "payload": { ... },
  "timestamp": "2026-01-31T12:00:00.000Z"
}
```

**Event types we forward**

- `job_created`, `job_accepted`, `cleaner_on_my_way`, `job_started`, `job_completed`
- `client_approved`, `client_disputed`, `dispute_resolved_refund`, `dispute_resolved_no_refund`
- `job_cancelled`, `job_auto_cancelled`, `job_overridden`, `payment_succeeded`

**Code**

- Publish: `src/lib/events.ts` — `publishEvent()`.
- Forward: `src/lib/n8nClient.ts` — `forwardEventToN8nWebhook(payload)` (uses `postJson(env.N8N_WEBHOOK_URL, payload)`).
- HTTP: `src/lib/httpClient.ts` — `postJson()`. Timeout 10s by default.

**n8n side**

- Create a workflow with a **Webhook** trigger.
- Set the webhook URL to the same value you put in `N8N_WEBHOOK_URL` (or the other way around: set `N8N_WEBHOOK_URL` to n8n’s webhook URL).
- The trigger receives the JSON above; you can branch on `eventName` and send email/SMS, etc.

---

## 4. Outbound — n8n API client (trigger workflow, list, status)

**When to use**

- Trigger a specific workflow by ID with custom data (e.g. from a cron or admin action).
- List workflows, get workflow status, get executions (e.g. health check, debugging).

**Functions (`src/lib/n8nClient.ts`)**

| Function | Description |
|----------|-------------|
| `triggerN8nWorkflow(workflowId, data)` | POST to `/workflows/{id}/execute`, returns `{ executionId }`. |
| `triggerN8nWorkflowWithRetry(workflowId, data, maxRetries)` | Same as above with retries (1s, 2s, 3s). |
| `listWorkflows()` | GET `/workflows`. |
| `getWorkflowStatus(workflowId)` | GET `/workflows/{id}`. |
| `getWorkflowExecutions(workflowId, { limit, status })` | GET executions for a workflow. |
| `getExecutionDetails(executionId)` | GET one execution. |
| `setWorkflowActive(workflowId, active)` | PUT to activate/deactivate. |
| `testN8nConnection()` | Returns `{ connected, workflows?, error? }` (uses API only). |

**Config**

- `N8N_API_KEY` — required for these calls (header `X-N8N-API-KEY`).
- `N8N_BASE_URL` — optional; default `https://puretask.app.n8n.cloud/api/v1`.

**Helpers**

- `isN8nWebhookConfigured()` — `true` if `N8N_WEBHOOK_URL` is set.
- `isN8nApiConfigured()` — `true` if `N8N_API_KEY` is set.
- `isN8nConfigured()` — `true` if either webhook or API is configured.

**Other**

- `sendN8nWebhook(url, body)` — generic POST to any URL (e.g. a custom n8n webhook trigger).

---

## 5. Inbound — n8n calling our backend (POST /n8n/events)

**Endpoints**

- `POST /n8n/events`
- `POST /events` (same behavior)

**Auth**

- Header **`x-n8n-signature`** (required): HMAC-SHA256 of the **raw JSON body** using `N8N_WEBHOOK_SECRET`, hex-encoded.
- If the secret is missing in production we return 500. If the header is missing or invalid we return 401.

**Body (inbound)**

```json
{
  "jobId": "uuid (optional)",
  "actorType": "client" | "cleaner" | "admin" | "system" (optional),
  "actorId": "uuid (optional)",
  "eventType": "string (required)",
  "payload": { ... } (optional)
}
```

**What we do**

- Verify signature → parse body with Zod → call `publishEvent({ jobId, actorType, actorId, eventName: eventType, payload })`.
- Response: **204** on success; **400** on validation error; **401** on missing/invalid signature; **500** on server error.

**How to compute the signature (e.g. in n8n)**

- Use the same secret as `N8N_WEBHOOK_SECRET`.
- Body = exact JSON string that will be sent in the request body.
- `signature = hex(HMAC_SHA256(secret, body))`.
- Set header: `x-n8n-signature: <signature>`.

**Code**

- Routes: `src/routes/events.ts`.
- Verification: `src/lib/auth.ts` — `verifyN8nSignature`, `computeN8nSignature` (for tests).
- Rate limit: `src/lib/security.ts` — POST to `/n8n/events` is rate-limited (e.g. 50/min).

---

## 6. Status and health

**Operational status (`GET /status/summary`)**

- `metrics.n8nWebhookConfigured` — whether `N8N_WEBHOOK_URL` is set.
- `metrics.n8nApiConfigured` — whether `N8N_API_KEY` is set.

No live call to n8n is made in the summary (to keep it fast). For a connectivity check, call `testN8nConnection()` from n8nClient (e.g. in an admin or health script).

**MCP ops server**

- Action **`pingN8n`** POSTs to `N8N_TEST_WEBHOOK_URL` (body e.g. `{ "ping": "mcp" }`). Use this to verify n8n is reachable from the MCP server.

---

## 7. Event types reference

Events we publish (and forward to n8n when `N8N_WEBHOOK_URL` is set):

| eventName | Typical trigger |
|-----------|------------------|
| `job_created` | New job booked. |
| `job_accepted` | Cleaner accepted the job. |
| `cleaner_on_my_way` | Cleaner checked in “on my way”. |
| `job_started` | Cleaner started the job. |
| `job_completed` | Cleaner marked job completed. |
| `client_approved` | Client approved the job. |
| `client_disputed` | Client opened a dispute. |
| `dispute_resolved_refund` | Dispute resolved with refund. |
| `dispute_resolved_no_refund` | Dispute resolved without refund. |
| `job_cancelled` | Job cancelled (user or admin). |
| `job_auto_cancelled` | Job auto-cancelled (e.g. no-show). |
| `job_overridden` | Admin override. |
| `payment_succeeded` | Payment captured, credits granted. |

---

## 8. Troubleshooting

**Events not reaching n8n**

- Confirm `N8N_WEBHOOK_URL` is set and matches the webhook URL in n8n.
- Check logs for `n8n_forward_failed` or `n8n_webhook_not_configured`.
- Ensure n8n workflow is active and the webhook trigger is listening.

**Inbound 401 (invalid signature)**

- Use the same secret as `N8N_WEBHOOK_SECRET`.
- Sign the **exact** JSON body (same encoding, no extra spaces). In n8n, use the same body that will be sent.
- Use HMAC-SHA256 and hex encoding.

**API calls failing (trigger workflow, list workflows)**

- Ensure `N8N_API_KEY` is set and valid for your n8n instance.
- If you use a different n8n URL, set `N8N_BASE_URL`.
- Check logs for `n8n_api_key_missing`, `n8n_api_request_failed`, `n8n_trigger_failed`.

**Webhook retries**

- Failed outbound webhooks can be retried via `webhookRetryService` and the `webhook_failures` table (source `n8n`). See FOUNDER_WEBHOOKS.md.

---

## 9. Workflows and notifications (what to build in n8n)

**See `docs/active/N8N_WORKFLOWS_AND_EVENTS.md`** for:

- **Complete list of events** the backend sends to n8n (by category: job lifecycle, tracking, payouts, reschedule, cancellation, workers, referrals).
- **Exactly what each event is for** and which file publishes it.
- **What n8n should do per event:** notifications (email, SMS, push), alerts (Slack/email), automations.
- **SendGrid template env vars** to use in n8n for consistent copy.
- **Checklist of workflows to create** in n8n (must-have, should-have, nice-to-have, time-based reminders).

---

## 10. File and doc index

| Item | Path |
|------|------|
| n8n API + webhook forward | `src/lib/n8nClient.ts` |
| Event publish + forward call | `src/lib/events.ts` |
| HTTP POST helper | `src/lib/httpClient.ts` |
| Inbound routes + HMAC | `src/routes/events.ts`, `src/lib/auth.ts` |
| Re-exports | `src/integrations/n8n.ts` |
| Env | `src/config/env.ts` (N8N_*) |
| Status summary n8n flags | `src/routes/status.ts` |
| n8n client unit tests | `src/lib/__tests__/n8nClient.test.ts` |
| Events / n8n smoke tests | `src/tests/smoke/events.test.ts` (POST /events, POST /n8n/events) |
| Founder doc (n8n client) | `docs/active/founder/FOUNDER_N8N_CLIENT.md` |
| Founder doc (events) | `docs/active/founder/FOUNDER_EVENTS.md` |
| Founder doc (webhooks) | `docs/active/founder/FOUNDER_WEBHOOKS.md` |
| Founder doc (job events flow) | `docs/active/founder/FOUNDER_JOB_EVENTS_FLOW.md` |

---

## 12. Quick checklist

- [ ] `N8N_WEBHOOK_SECRET` set and shared with n8n for inbound calls.
- [ ] `N8N_WEBHOOK_URL` set to n8n’s webhook URL if you want event forward.
- [ ] `N8N_API_KEY` set if you use trigger/list/status from the backend.
- [ ] n8n workflow with Webhook trigger URL = `N8N_WEBHOOK_URL`.
- [ ] Inbound calls from n8n include `x-n8n-signature` (HMAC-SHA256 of body with `N8N_WEBHOOK_SECRET`).
- [ ] CORS / `allowedHeaders` includes `x-n8n-signature` (see `src/index.ts`).

**Last updated:** 2026-01-31
