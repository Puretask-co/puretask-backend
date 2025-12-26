import express from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAuth } from "./shared/auth";
import { rateLimit } from "./shared/rateLimit";
import { redactSensitive } from "./shared/redact";
import { logRequest } from "./shared/logger";
import { tailFile } from "./shared/tailFile";

const execFileAsync = promisify(execFile);
const app = express();
const PORT = Number(process.env.MCP_OPS_PORT || 7092);
const BACKEND_BASE = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const LOG_PATH = process.env.MCP_LOG_PATH || "logs/app.log";
const N8N_TEST_URL = process.env.N8N_TEST_WEBHOOK_URL || "";
const SHELL = process.platform === "win32" ? "powershell" : "pwsh";
const AUDIT_SCRIPT = process.env.MCP_AUDIT_SCRIPT || "scripts/run-security-audit.ps1";

type ActionInput =
  | { action: "runAudit" }
  | { action: "health" }
  | { action: "statusSummary" }
  | { action: "tailLog" }
  | { action: "pingN8n" };

app.use(express.json({ limit: "64kb" }));
app.use(requireAuth);
app.use(rateLimit({ limit: 5, windowMs: 60 * 60 * 1000, scope: "ops" }));

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const text = await res.text();
  const redacted = redactSensitive(text);
  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status} ${res.statusText}`);
    (error as any).body = redacted;
    throw error;
  }
  return redacted ? JSON.parse(redacted) : {};
}

async function handleAction(input: ActionInput) {
  switch (input.action) {
    case "runAudit": {
      const { stdout, stderr } = await execFileAsync(SHELL, ["-File", AUDIT_SCRIPT], {
        cwd: process.cwd(),
        timeout: 120_000,
        windowsHide: true,
      });
      return { stdout: redactSensitive(stdout || ""), stderr: redactSensitive(stderr || "") };
    }
    case "health":
      return await fetchJson(`${BACKEND_BASE}/health`);
    case "statusSummary":
      return await fetchJson(`${BACKEND_BASE}/status/summary`);
    case "tailLog": {
      const content = redactSensitive(tailFile(LOG_PATH, 300, 50_000));
      return { path: LOG_PATH, tail: content };
    }
    case "pingN8n": {
      if (!N8N_TEST_URL) throw new Error("N8N_TEST_WEBHOOK_URL not set");
      return await fetchJson(N8N_TEST_URL, { method: "POST", body: JSON.stringify({ ping: "mcp" }) });
    }
    default:
      throw new Error("action_not_allowed");
  }
}

app.post("/run", async (req, res) => {
  const body = req.body as ActionInput;
  try {
    const result = await handleAction(body);
    logRequest("ops", { action: body?.action, status: 200 });
    res.json({ success: true, action: body?.action, result });
  } catch (err) {
    logRequest("ops", { action: body?.action, status: 500, error: (err as Error).message });
    res.status(500).json({ success: false, error: (err as Error).message, details: (err as any)?.body });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MCP Ops server listening on http://localhost:${PORT}`);
});

