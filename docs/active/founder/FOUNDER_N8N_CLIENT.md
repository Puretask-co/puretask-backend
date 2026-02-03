# Founder Reference: n8n Client

**Candidate:** n8n client (Module #25)  
**Where it lives:** `src/lib/n8nClient.ts` (API: triggerN8nWorkflow, getWorkflowExecutions, getWorkflowStatus, listWorkflows, setWorkflowActive, getExecutionDetails, triggerN8nWorkflowWithRetry; webhook outbound: forwardEventToN8nWebhook, sendN8nWebhook; config: isN8nConfigured, isN8nWebhookConfigured, isN8nApiConfigured, testN8nConnection; types: N8nEventPayload, N8nActorType, N8nEventType); `src/integrations/n8n.ts` re-exports. Event forward is used by `src/lib/events.ts` (publishEvent → forwardEventToN8nWebhook).  
**Why document:** How the backend triggers n8n workflows, forwards events to n8n, and checks status; when we use it (e.g. after events).  
**See also:** `docs/active/N8N_FULL_REFERENCE.md` for env, inbound webhooks, HMAC, and troubleshooting.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The n8n client in PureTask is the code that (1) forwards job events to n8n (outbound webhook) and (2) talks to the n8n API to run workflows and check status. **Event forward:** forwardEventToN8nWebhook(payload) POSTs to N8N_WEBHOOK_URL with jobId, actorType, actorId, eventName, payload, timestamp; used by publishEvent in events.ts. sendN8nWebhook(url, body) is a generic POST to any webhook URL. **API:** Base URL from N8N_BASE_URL or default https://puretask.app.n8n.cloud/api/v1; all requests use N8N_API_KEY in X-N8N-API-KEY header. **Functions:** triggerN8nWorkflow(workflowId, data), triggerN8nWorkflowWithRetry(workflowId, data, maxRetries), getWorkflowExecutions, getWorkflowStatus(workflowId), listWorkflows(), setWorkflowActive(workflowId, active), getExecutionDetails(executionId), testN8nConnection(). **Config:** isN8nWebhookConfigured() (N8N_WEBHOOK_URL), isN8nApiConfigured() (N8N_API_KEY), isN8nConfigured() (either set). Types: N8nEventPayload, N8nActorType, N8nEventType.

**Simple (like for a 10-year-old):** The n8n client is how our backend talks to n8n (a tool that runs workflows, like "when X happens do Y"). We use it to start a workflow (e.g. "send an email when a job is completed") and to check workflow status and executions. We have: trigger workflow, get executions, get workflow status, list workflows, turn workflow on/off, get execution details, and a "trigger with retry" that tries a few times. We also have "is n8n configured?" and "test connection." We call the n8n API with a secret key in the header.

### 2. Where it is used

**Technical:** `src/lib/n8nClient.ts` defines all functions. `src/integrations/n8n.ts` re-exports everything (triggerN8nWorkflow, forwardEventToN8nWebhook, sendN8nWebhook, isN8nWebhookConfigured, isN8nApiConfigured, types, etc.). Callers: events.ts uses forwardEventToN8nWebhook from n8nClient after publishEvent; any code that needs to trigger a workflow or check status imports from n8nClient or integrations/n8n. Status/summary (src/routes/status.ts) uses isN8nWebhookConfigured and isN8nApiConfigured. Env: N8N_WEBHOOK_URL (event forward), N8N_API_KEY (API), N8N_BASE_URL (optional API base). See docs/active/N8N_FULL_REFERENCE.md for full n8n reference.

**Simple (like for a 10-year-old):** The code lives in n8nClient.ts; integrations/n8n re-exports some of it. Any part of the app that wants to run an n8n workflow or check its status imports from here. The event or notification system might call "trigger workflow" after something happens (e.g. job completed). We need N8N_API_KEY and optionally N8N_MCP_SERVER_URL in the environment.

### 3. When we use it

**Technical:** We use it when we want to run an n8n workflow (e.g. after a job event—job completed, dispute opened—so n8n can send an email, update a sheet, or do something else). We use triggerN8nWorkflow or triggerN8nWorkflowWithRetry when we need to fire a workflow with payload data. We use getWorkflowStatus or listWorkflows when we need to check if a workflow exists or is active. We use getWorkflowExecutions or getExecutionDetails when we need to inspect past runs. We use testN8nConnection for health checks or admin. Triggers: request or background job that decides "trigger workflow X with data Y"; or admin/ops checking status. The event system (publishEvent) may forward to n8n via this client—see FOUNDER_EVENTS for the exact flow.

**Simple (like for a 10-year-old):** We use it when we want n8n to do something (e.g. send an email or update a spreadsheet when a job is completed). We call "trigger workflow" with the workflow id and the data. We call "get status" or "list workflows" when we need to see if a workflow is there or on. We call "test connection" to see if n8n is reachable. Something in our app (e.g. after an event) decides to trigger a workflow and uses this client.

### 4. How it is used

**Technical:** n8nApiRequest(endpoint, { method, body }): if !env.N8N_API_KEY throw; fetch(N8N_BASE_URL + endpoint, { method, headers: { "X-N8N-API-KEY": env.N8N_API_KEY, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); if !response.ok throw with status and body; return response.json(). triggerN8nWorkflow: n8nApiRequest(`/workflows/${workflowId}/execute`, { method: "POST", body: data }), return { executionId: result.data?.executionId || result.executionId }. triggerN8nWorkflowWithRetry: loop maxRetries, try triggerN8nWorkflow; on failure wait 1s/2s/3s and retry; after last attempt throw. Other functions build endpoint and params and call n8nApiRequest. No circuit breaker in n8nClient itself (circuitBreakers.n8n exists in circuitBreaker.ts—callers could wrap n8n calls in it for extra resilience).

**Simple (like for a 10-year-old):** Every call builds a URL and sends a request with the API key in the header. "Trigger workflow" POSTs to the execute endpoint with the workflow id and data and returns the execution id. "Trigger with retry" tries up to 3 times with 1s, 2s, 3s waits. The rest are GET or PUT to different endpoints. We don't use the circuit breaker inside this file—something that calls n8n could wrap the call in the n8n circuit breaker if we want to stop calling n8n after many failures.

### 5. How we use it (practical)

**Technical:** Set N8N_API_KEY (and N8N_MCP_SERVER_URL if using isN8nConfigured) in env. To trigger after an event: get workflow id (config or constant), build payload (e.g. jobId, eventName), call triggerN8nWorkflow(workflowId, payload) or triggerN8nWorkflowWithRetry. To check health: testN8nConnection(). Logs: n8n_workflow_triggered, n8n_trigger_failed, n8n_api_key_missing, n8n_api_request_failed, n8n_trigger_retry, etc. Base URL is hardcoded (N8N_BASE_URL); for different n8n instances we'd need config. integrations/n8n.ts re-exports sendN8nWebhook, sendN8nEvent—if those exist in n8nClient they're for webhook-style triggers; the file we read has triggerN8nWorkflow (API execute). Document workflow ids and payload shape where we trigger (e.g. in FOUNDER_EVENTS).

**Simple (like for a 10-year-old):** We set the n8n API key in the environment. When we want to run a workflow we call triggerN8nWorkflow with the workflow id and the data. We can use triggerN8nWorkflowWithRetry if we want automatic retries. We log when we trigger and when we fail. The n8n server URL is in the code; if we had multiple n8n servers we'd need config. We should write down which workflow ids we use and what data we send (e.g. in the events doc).

### 6. Why we use it vs other methods

**Technical:** We use n8n for workflows (email, integrations, automation) so we need a way to start those workflows from the backend. Alternatives: call n8n webhook URLs (HTTP POST to a webhook trigger)—different from the API execute endpoint; run everything in our app (no n8n). We use the n8n API (execute) so we can trigger by workflow id and pass structured data; we get an execution id back so we can check status. The client centralizes auth (API key), base URL, and error handling so we don't repeat that in every caller.

**Simple (like for a 10-year-old):** We use n8n for automations (e.g. send email when job completes), so we need to tell n8n "run this workflow with this data." We could do that by calling a webhook URL or by using the n8n API; we use the API so we can pass workflow id and data and get back an execution id. We put all the "how we talk to n8n" in one client so we don't repeat the key and error handling everywhere.

### 7. Best practices

**Technical:** Always check isN8nConfigured() or N8N_API_KEY before calling so we don't throw "not configured" in production if n8n is optional. Use triggerN8nWorkflowWithRetry for critical triggers so transient failures retry. Don't put secrets in the workflow payload (n8n may log it). Log workflowId and executionId on success and on failure for debugging. Consider wrapping trigger calls in circuitBreakers.n8n.execute() so we don't hammer n8n when it's down (see FOUNDER_CIRCUIT_BREAKER_RETRY). Base URL is hardcoded—move to env (e.g. N8N_BASE_URL) if we have multiple environments. Gaps: integrations/n8n re-exports sendN8nWebhook, sendN8nEvent which may be in another file or deprecated; the main client uses API execute.

**Simple (like for a 10-year-old):** We should check "is n8n configured?" before calling so we don't crash if n8n isn't set up. For important workflows we use "trigger with retry." We don't put passwords or tokens in the data we send. We log workflow id and execution id so we can debug. We could use the n8n circuit breaker so we stop calling n8n when it's down. The n8n server URL is in code—we might want it in env for different environments. The integration file mentions "send webhook" and "send event" which might be a different way to trigger; our main client uses "execute workflow."

### 8. Other relevant info

**Technical:** n8n receives our request and runs the workflow asynchronously; we get executionId back but the workflow may still be running. To wait for completion we'd poll getExecutionDetails(executionId). We don't use the circuit breaker inside n8nClient; callers can wrap with circuitBreakers.n8n.execute(). Incoming n8n webhooks (n8n calling us) are a different route (e.g. /n8n/events); see webhook docs. Document workflow ids and payload contracts in FOUNDER_EVENTS or a dedicated n8n doc. See FOUNDER_EVENTS for event → n8n flow.

**Simple (like for a 10-year-old):** When we trigger a workflow n8n starts it and gives us an execution id; the workflow might still be running. If we need to know when it's done we'd poll "get execution details." We don't use the circuit breaker inside this file—the code that calls n8n can wrap the call if we want. When n8n calls us (webhooks) that's a different URL and doc. We should write down which workflow ids we use and what we send. See the events doc for how events lead to triggering n8n.

---

## Purpose and outcome (condensed)

### 9–12. Purpose, success, without it, not responsible for

**Technical:** Purpose: trigger n8n workflows from the backend and query workflow/execution status so we can run automations (email, integrations) in response to app events. Success: trigger returns executionId; status/list/execution calls return data; testN8nConnection returns connected. Without it we couldn't start n8n workflows from the app. Not responsible for: defining workflows (done in n8n UI); incoming n8n webhooks; retry/circuit (caller or wrapper can add).

**Simple (like for a 10-year-old):** It's there to start n8n workflows and check their status. Success is we get an execution id when we trigger and we get data when we ask for status. Without it we couldn't run n8n from our app. It doesn't create the workflows (that's in n8n) or handle n8n calling us—only we calling n8n.

---

## Inputs, outputs, flow, rules (condensed)

### 13–17. Inputs, outputs, flow, rules

**Technical:** Inputs: workflowId, data (for trigger); executionId (for getExecutionDetails); limit, status (for getWorkflowExecutions); active (for setWorkflowActive). Env: N8N_API_KEY, N8N_MCP_SERVER_URL (isN8nConfigured). Outputs: executionId, workflow list/status, execution list/details, or throw. Flow: n8nApiRequest → fetch → parse JSON or throw. No business rules in client; only HTTP and auth.

**Simple (like for a 10-year-old):** We pass workflow id and data to trigger; execution id to get details; optional limit and status for executions. We need the API key (and optionally MCP URL) in env. We get back execution id or workflow/execution data, or we throw. We just do HTTP and auth; we don't enforce business rules.

---

## Triggers through ownership (condensed)

### 18–37. Triggers, failure modes, dependencies, config, testing, recovery, stakeholders, lifecycle, state, assumptions, interaction, failure, correctness, owner, evolution

**Technical:** Triggered by callers (event handler, admin, health check). Failure: N8N_API_KEY missing, n8n down, non-2xx response—we throw and log. Depends on env, fetch, logger. Config: N8N_API_KEY, N8N_MCP_SERVER_URL; N8N_BASE_URL hardcoded. Test: mock fetch or integration test. Recovery: caller retries (triggerN8nWorkflowWithRetry) or circuit breaker. Stakeholders: product (automations), ops (n8n health). No state in client. Assumptions: n8n API v1 shape; workflow id exists. When not to use: for incoming webhooks use webhook route. Interacts with logger, env; event system may call it. Owner: platform or integrations. Evolution: env for base URL; circuit breaker wrapper; document workflow ids and payloads.

**Simple (like for a 10-year-old):** Something in the app (event handler, admin, health check) calls it. If the key is missing or n8n is down we throw and log. We need the API key and optionally MCP URL in env; the base URL is in code. We test by mocking the network. Callers can use "trigger with retry" or the circuit breaker. We don't keep state. The platform or integrations team owns it. Later we might make the base URL configurable and add the circuit breaker here.

---

*End of Founder Reference: n8n Client*
