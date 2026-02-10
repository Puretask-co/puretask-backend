# Founder Reference: MCP Servers

**Candidate:** MCP servers (System #9)  
**Where it lives:** `mcp/` (configServer, docsServer, logsServer, opsServer), `mcp/shared/` (auth, rateLimit, redact, tailFile, paths, logger)  
**Why document:** What MCP is, what each server does, and how Cursor/other tools use them.

---

For each question below, every answer has two parts: **Technical** and **Simple (like for a 10-year-old)**. Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** MCP (Model Context Protocol) servers are four small, standalone HTTP servers in the `mcp/` folder that expose read-only or limited actions (docs, config metadata, logs, health, ops) for AI assistants or dev tools like Cursor. They are **opt-in** and do not run with the main PureTask app. Each server: **Docs** (port 7091) serves allowlisted `docs/` files and SECURITY_AUDIT_REPORT.md with redaction; **Ops** (7092) runs allowlisted actions (runAudit, health, statusSummary, tailLog, pingN8n); **Logs** (7093) proxies backend health/status and tails app log file; **Config** (7094) returns env var metadata, feature flags, event types, and template keys (no secret values). All use shared Bearer auth (`MCP_TOKEN`), per-server rate limits, and redaction of sensitive content.

**Simple (like for a 10-year-old):** MCP servers are like four small helper apps that only run when you start them. They let a coding assistant (like Cursor) safely read our docs, see our config list, check if the main app is healthy, and read the end of our log file—or run a security check or ping n8n. They don’t run with the main website; you turn them on separately and protect them with a secret token.

### 2. Where it is used

**Technical:** Implemented in `mcp/docsServer.ts`, `mcp/opsServer.ts`, `mcp/logsServer.ts`, `mcp/configServer.ts`; shared code in `mcp/shared/auth.ts` (requireAuth, MCP_TOKEN), `mcp/shared/rateLimit.ts`, `mcp/shared/redact.ts`, `mcp/shared/tailFile.ts`, `mcp/shared/paths.ts` (isAllowedPath, resolveWithinRepo), `mcp/shared/logger.ts`. Started via npm scripts: `npm run mcp:docs`, `mcp:ops`, `mcp:logs`, `mcp:config`. Cursor or other MCP clients point at these URLs and send `Authorization: Bearer <MCP_TOKEN>`.

**Simple (like for a 10-year-old):** The code lives in the `mcp` folder; each server is its own file, and they share the same login and safety rules. You start them with npm commands. Cursor (or another tool) talks to them by visiting their URLs and sending the secret token.

### 3. When we use it

**Technical:** Used when a developer or AI tool needs to read docs, inspect config metadata, check backend health/status, tail logs, run the security audit script, or ping n8n—without giving direct DB or app access. Triggered by MCP client requests (e.g. Cursor asking for a doc or for “run health check”). There is no schedule; usage is on-demand per request.

**Simple (like for a 10-year-old):** We use them whenever someone (or Cursor) wants to look at our docs, see what config we have, check if the app is healthy, read the latest logs, run a security check, or ping n8n. It’s only when they ask—no automatic timers.

### 4. How it is used

**Technical:** Docs: `GET /list` (allowlists), `GET /docs?path=...` (file content; path must be under `docs/` with `.md`/`.json` or in ALLOWED_FILES; content redacted). Ops: `POST /run` with body `{ action: "runAudit"|"health"|"statusSummary"|"tailLog"|"pingN8n" }`; runAudit runs `MCP_AUDIT_SCRIPT` (default PowerShell script); health/statusSummary proxy to backend; tailLog reads last 300 lines of MCP_LOG_PATH; pingN8n POSTs to N8N_TEST_WEBHOOK_URL. Logs: `GET /health`, `GET /status-summary` (proxy), `GET /logs/tail`. Config: `GET /env-vars`, `GET /feature-flags`, `GET /events`, `GET /templates` (metadata only; secrets redacted). All responses go through redactSensitive; auth is Bearer token; rate limits: docs/logs/config 10 req/hour, ops 5 req/hour.

**Simple (like for a 10-year-old):** You ask for a doc by path, or you ask for “run health” or “tail log” or “run audit.” The servers only do a fixed list of things; they won’t run random commands. They hide secrets in what they send back and limit how many requests you can make per hour.

### 5. How we use it (practical)

**Technical:** Set `MCP_TOKEN` in env (required). Optionally set `MCP_DOCS_PORT`, `MCP_OPS_PORT`, `MCP_LOGS_PORT`, `MCP_CONFIG_PORT`, `MCP_LOG_PATH`, `BACKEND_BASE_URL`, `N8N_TEST_WEBHOOK_URL`, `MCP_AUDIT_SCRIPT`. Configure Cursor (or other MCP client) with server URLs and the same token. Logs go to `mcp/logs/*.log`. No UI in the main app; these are dev/tooling endpoints.

**Simple (like for a 10-year-old):** In practice you set the secret token and optional ports/paths, then tell Cursor (or your tool) where the servers are and give it the token. The servers write their own request logs in the mcp folder. The main app doesn’t show these—they’re for developers and tools.

### 6. Why we use it vs other methods

**Technical:** MCP gives AI assistants and tools a bounded, auditable way to read docs and run a few safe actions without SSH or full DB access. Separate processes and strict allowlists reduce risk: only listed paths and actions are allowed; redaction and rate limits limit data exposure and abuse. Alternatives (direct DB, full app admin, or no tool access) would be either too powerful or not useful for assisted development.

**Simple (like for a 10-year-old):** We use these small servers so Cursor (or similar) can help us without needing the keys to the whole castle. They can only do a short list of safe things, and we hide secrets and limit how often they can ask. That’s safer than giving full database or server access.

### 7. Best practices

**Technical:** We use a single shared token and require it on every server; allowlists for paths and actions; redaction before returning any content; per-IP rate limits; no arbitrary shell or git from MCP; structured request logging. Gaps: token is single shared (no per-server or per-tool tokens); no audit of who (which tool) did what beyond logs; allowlist must be kept in sync with safe paths.

**Simple (like for a 10-year-old):** We always require the secret, only allow certain files and actions, hide secrets in answers, and limit requests. We don’t let these servers run any random command. We could improve by having different tokens per tool and a clearer record of who did what.

### 8. Other relevant info

**Technical:** MCP servers are independent of the main app: they don’t share its DB pool or routes. If the main app is down, health/statusSummary will fail (502). Docs server reads from repo filesystem; ops runAudit runs a local script—ensure paths and scripts exist. Config server only returns metadata; actual secrets stay in env. Cursor MCP config typically lives in user globalStorage (e.g. mcp-settings.json).

**Simple (like for a 10-year-old):** These servers are separate from the main website. If the website is down, “health” from MCP will say so. They read from our project files and run a script we chose; they don’t store secrets, only describe what we have. Cursor stores its MCP settings in its own config.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Provide a safe, scoped way for AI-assisted dev tools (e.g. Cursor) to read documentation, inspect config and feature metadata, check backend health and status, tail logs, run a security audit, and ping n8n—without granting full app or database access.

**Simple (like for a 10-year-old):** Let Cursor (or a similar tool) help us by reading docs, seeing what’s configured, checking if the app is up, reading the latest logs, running a security check, or pinging n8n—all in a safe, limited way.

### 10. What does "done" or "success" look like for it?

**Technical:** Success for a request: client sends valid Bearer token; request is within rate limit; action/path is allowlisted; server returns 200 with (redacted) content or proxy result; request is logged. Failure: 401/403 (auth), 403 (path/action not allowed), 429 (rate limit), 404/500 (file not found, script/backend error).

**Simple (like for a 10-year-old):** Success means the tool sent the right token, didn’t ask too often, asked for something allowed, and got back an answer (with secrets hidden). If the token is wrong, or the request isn’t allowed, or something breaks, the server returns an error and logs it.

### 11. What would happen if we didn't have it?

**Technical:** AI tools and scripts would have no standard, bounded way to read PureTask docs or run these ops; developers would use ad-hoc scripts, SSH, or direct DB access, increasing risk and inconsistency. Cursor wouldn’t have a documented, safe way to “read our docs” or “check health.”

**Simple (like for a 10-year-old):** Without these servers, Cursor wouldn’t have a safe, agreed way to read our docs or run those checks. People would use their own scripts or log into the server, which is riskier and messier.

### 12. What is it not responsible for?

**Technical:** Not responsible for: running the main PureTask API, serving production traffic, storing business data, sending notifications, or executing arbitrary user or admin actions. It does not replace the admin dashboard, backups, or monitoring—only exposes a narrow, tool-friendly slice of docs, config metadata, logs, and a few ops.

**Simple (like for a 10-year-old):** They don’t run the real website, don’t store customer data, and don’t do whatever an admin can do. They only serve docs, config list, log tail, health check, audit script, and n8n ping.

---

## Inputs, outputs, and flow

### 13. Main inputs

**Technical:** Per request: HTTP method and path (or POST body for ops); `Authorization: Bearer <token>`; optional query (e.g. `path=` for docs). Env: `MCP_TOKEN`, optional ports, `MCP_LOG_PATH`, `BACKEND_BASE_URL`, `N8N_TEST_WEBHOOK_URL`, `MCP_AUDIT_SCRIPT`.

**Simple (like for a 10-year-old):** Each request needs the secret token and what you want (e.g. which doc, or which action). The servers also need the right env vars for log path, main app URL, and n8n test URL if you use ping.

### 14. What it produces or changes

**Technical:** Produces: HTTP JSON responses (file content, proxy health/status, tail text, env/flag/event/template metadata, or action result). Ops runAudit can change local state (script output); pingN8n sends a POST to n8n. Writes request logs to `mcp/logs/*.log`. Does not change main app DB or config.

**Simple (like for a 10-year-old):** They send back the doc, the health result, the log tail, or the result of the action (e.g. audit output). The “run audit” action runs a script on the machine, and “ping n8n” sends a message to n8n. They write their own request logs. They don’t change the main app’s database.

### 15. Who or what consumes its output?

**Technical:** The MCP client (e.g. Cursor) or any HTTP client configured with the server URLs and token. Output is used to show docs, display config/feature metadata, show health/status, show log tail, or confirm audit/ping result.

**Simple (like for a 10-year-old):** Mainly Cursor (or another tool you’ve pointed at these servers). It uses the answers to show you docs, config, health, logs, or the result of the security check or n8n ping.

### 16. Main steps or flow

**Technical:** Request hits Express app → requireAuth checks Bearer token → rateLimit checks per-IP count → handler: Docs resolves path, checks allowlist, reads file, redacts, returns JSON; Ops parses action, runs allowlisted handler (audit script, fetch health/status, tailFile, or ping n8n), redacts, returns result; Logs proxies or tails and redacts; Config reads metadata arrays, redacts, returns. logRequest records path/action and status.

**Simple (like for a 10-year-old):** Request comes in → we check the token and rate limit → we do only the allowed thing (read a doc, run one action, proxy health, or tail log) → we hide secrets in the answer and send it back, and we log the request.

### 17. Rules or policies

**Technical:** Only allowlisted paths (docs under `docs/` with allowed extensions or ALLOWED_FILES) and allowlisted ops (runAudit, health, statusSummary, tailLog, pingN8n). Bearer token must match MCP_TOKEN. Rate limits enforced per scope (docs/logs/config 10/hr, ops 5/hr). All response content passed through redactSensitive. No arbitrary command execution.

**Simple (like for a 10-year-old):** Only certain files and a short list of actions are allowed. You must send the right token and stay under the request limit. We strip secrets from everything we send back and we don’t run random commands.

---

## Triggers, dependencies, and lifecycle

### 18. What triggers it

**Technical:** MCP client HTTP requests (e.g. Cursor requesting a doc, health, or an ops action). No cron or internal scheduler.

**Simple (like for a 10-year-old):** When you (or Cursor) call the server and ask for something. Nothing runs on a timer.

### 19. What could go wrong

**Technical:** MCP_TOKEN unset or wrong → 401/403. Path/action not allowlisted → 403. Rate limit exceeded → 429. File missing or not file → 404/400. Audit script missing/fails or backend down → ops returns 500. Backend unreachable → health/statusSummary 502. Log file missing or unreadable → tail may fail or return empty.

**Simple (like for a 10-year-old):** Wrong or missing token, asking for something not allowed, or too many requests will get an error. If the audit script or main app is broken, or the log file is missing, the server will report that.

### 20. How we know it's doing its job

**Technical:** Request logs in `mcp/logs/*.log`; client gets 200 + expected JSON or 4xx/5xx with error. No built-in metrics dashboard; monitor logs and client behavior.

**Simple (like for a 10-year-old):** We look at the MCP logs and whether the client gets a successful response or an error. There’s no fancy dashboard—just logs and what the tool sees.

### 21. What it depends on

**Technical:** Node, Express, filesystem (docs, log file), backend HTTP for health/status (and optionally n8n for ping). Env: MCP_TOKEN; optional ports, MCP_LOG_PATH, BACKEND_BASE_URL, N8N_TEST_WEBHOOK_URL, MCP_AUDIT_SCRIPT. Ops runAudit depends on the audit script existing and being runnable (e.g. PowerShell).

**Simple (like for a 10-year-old):** It needs Node, the project files, the log file, and (for health/ping) the main app and maybe n8n. It needs the token and optional settings in env. The audit action needs the script to exist and run on your machine.

### 22. Main config or env vars

**Technical:** `MCP_TOKEN` (required). Optional: `MCP_DOCS_PORT` (7091), `MCP_OPS_PORT` (7092), `MCP_LOGS_PORT` (7093), `MCP_CONFIG_PORT` (7094), `MCP_LOG_PATH` (default `logs/app.log`), `BACKEND_BASE_URL` (default `http://localhost:4000`), `N8N_TEST_WEBHOOK_URL`, `MCP_AUDIT_SCRIPT` (default `scripts/run-security-audit.ps1`).

**Simple (like for a 10-year-old):** You must set the secret token. You can optionally set the four ports, where the log file is, where the main app is, the n8n test URL, and which script to run for “run audit.”

### 25. Main stakeholders

**Technical:** Developers and AI-assisted tools (e.g. Cursor) that need safe, scoped access to docs, config metadata, health, logs, and a few ops. Ops/platform may care that audit and health are available without full server access.

**Simple (like for a 10-year-old):** Developers and tools like Cursor who want to read docs and run those checks without having full access to the server.

### 26. Security or privacy considerations

**Technical:** All responses redacted for emails, phones, JWT-like tokens, and known secret env names. Token is single shared secret—compromise gives access to all four servers. Rate limits reduce brute-force and abuse. Allowlists prevent path traversal and arbitrary execution. No PII stored by MCP; logs may contain paths/actions and status, not request bodies with user data.

**Simple (like for a 10-year-old):** We hide secrets and personal details in what we send back. The one token opens all four servers, so we keep it safe. Rate limits and strict allowlists make it harder to misuse. We don’t store user data; we might log what was asked (e.g. which doc) but not people’s details.

### 27. Limits or scaling

**Technical:** Low request volume per hour by design (10 or 5 per IP). Single process per server; no clustering. For high-frequency tool use, rate limits may be hit; increase limits or scope if needed. Doc and tail size bounded by file size and tail line count (e.g. 300 lines, 50KB).

**Simple (like for a 10-year-old):** We deliberately keep the number of requests per hour low. If you need more, we can raise the limits. Each server is one process; we don’t run many copies. The doc and log tail we return aren’t huge.

### 33. How it interacts with other systems

**Technical:** Ops server calls main backend `/health` and `/status/summary` and optionally n8n webhook; runs local audit script. Config server only reads in-memory metadata (env list, flags, events, templates). Docs and Logs read from repo filesystem and log file. No direct DB or queue access; no events published to PureTask.

**Simple (like for a 10-year-old):** The ops server can call the main app’s health and status and ping n8n, and run a script on the machine. The config server just returns lists we defined in code. Docs and logs read from files. They don’t talk to the database or the rest of the app’s events.

---

**See also:** `mcp/README.md`, FOUNDER_AUTH.md (main app auth), FOUNDER_RATE_LIMITING.md (main app limits).
