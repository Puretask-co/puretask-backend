# MCP Servers for PureTask (local/dev)

This folder provides four small MCP servers with strict allowlists, auth, rate limits, and redaction. They are opt-in and do not affect the main app.

## Servers and ports (defaults)
- Docs: `MCP_DOCS_PORT=7091`
- Ops: `MCP_OPS_PORT=7092`
- Logs/Health: `MCP_LOGS_PORT=7093`
- Config metadata: `MCP_CONFIG_PORT=7094`

## Required env
- `MCP_TOKEN` (shared bearer token for all servers)

Optional:
- `BACKEND_BASE_URL` (default `http://localhost:4000` for health/status)
- `MCP_LOG_PATH` (default `logs/app.log` for tailing)
- `N8N_TEST_WEBHOOK_URL` (for the ops `pingN8n` action)
- `MCP_AUDIT_SCRIPT` (override audit script path; default `scripts/run-security-audit.ps1`)
- Per-server port envs above

## Start commands
```bash
# Docs (read-only)
npm run mcp:docs
# Ops (limited actions)
npm run mcp:ops
# Logs/health (read-only)
npm run mcp:logs
# Config metadata (non-secret)
npm run mcp:config
```

## Endpoints (high level)
- Docs: `GET /list`, `GET /docs?path=...` (only allowlisted docs/ files + SECURITY_AUDIT_REPORT.md; redacted)
- Ops: `POST /run` with `{ action: "runAudit"|"health"|"statusSummary"|"tailLog"|"pingN8n" }`
- Logs/Health: `GET /health`, `GET /status-summary`, `GET /logs/tail`
- Config: `GET /env-vars`, `GET /feature-flags`, `GET /events`, `GET /templates`

## Safety/guardrails
- Bearer auth (`MCP_TOKEN`) required.
- Simple per-IP rate limits (docs/logs/config: 10 req/hour; ops: 5 req/hour).
- Redaction for emails/phones/JWT-like tokens in responses.
- Ops server actions are explicitly allowlisted; no arbitrary shell or git commands.
- Structured request logs written to `mcp/logs/*.log`.

