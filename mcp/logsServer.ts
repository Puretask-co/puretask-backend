import express from "express";
import { requireAuth } from "./shared/auth";
import { rateLimit } from "./shared/rateLimit";
import { redactSensitive } from "./shared/redact";
import { tailFile } from "./shared/tailFile";
import { logRequest } from "./shared/logger";

const app = express();
const PORT = Number(process.env.MCP_LOGS_PORT || 7093);
const BACKEND_BASE = process.env.BACKEND_BASE_URL || "http://localhost:4000";
const LOG_PATH = process.env.MCP_LOG_PATH || "logs/app.log";

app.use(express.json({ limit: "32kb" }));
app.use(requireAuth);
app.use(rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, scope: "logs" }));

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
  const text = await res.text();
  const redacted = redactSensitive(text);
  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status} ${res.statusText}`);
    (error as any).body = redacted;
    throw error;
  }
  return redacted ? JSON.parse(redacted) : {};
}

app.get("/health", async (_req, res) => {
  try {
    const data = await fetchJson(`${BACKEND_BASE}/health`);
    logRequest("logs", { path: "/health", status: 200 });
    res.json(data);
  } catch (err) {
    logRequest("logs", { path: "/health", status: 502, error: (err as Error).message });
    res.status(502).json({ error: (err as Error).message, details: (err as any)?.body });
  }
});

app.get("/status-summary", async (_req, res) => {
  try {
    const data = await fetchJson(`${BACKEND_BASE}/status/summary`);
    logRequest("logs", { path: "/status-summary", status: 200 });
    res.json(data);
  } catch (err) {
    logRequest("logs", { path: "/status-summary", status: 502, error: (err as Error).message });
    res.status(502).json({ error: (err as Error).message, details: (err as any)?.body });
  }
});

app.get("/logs/tail", (_req, res) => {
  const content = redactSensitive(tailFile(LOG_PATH, 300, 50_000));
  logRequest("logs", { path: "/logs/tail", status: 200, bytes: content.length });
  res.json({ path: LOG_PATH, tail: content });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MCP Logs server listening on http://localhost:${PORT}`);
});

