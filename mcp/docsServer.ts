import express from "express";
import fs from "fs";
import path from "path";
import { requireAuth } from "./shared/auth";
import { rateLimit } from "./shared/rateLimit";
import { redactSensitive } from "./shared/redact";
import { isAllowedPath, resolveWithinRepo } from "./shared/paths";
import { logRequest } from "./shared/logger";

const app = express();
const PORT = Number(process.env.MCP_DOCS_PORT || 7091);

const ALLOWED_PREFIXES = ["docs/"];
const ALLOWED_EXTENSIONS = [".md", ".json"];
const ALLOWED_FILES = ["SECURITY_AUDIT_REPORT.md"];

app.use(express.json({ limit: "256kb" }));
app.use(requireAuth);
app.use(rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, scope: "docs" }));

app.get("/list", (_req, res) => {
  logRequest("docs", { path: "/list" });
  res.json({
    allowedPrefixes: ALLOWED_PREFIXES,
    allowedFiles: ALLOWED_FILES,
    allowedExtensions: ALLOWED_EXTENSIONS,
  });
});

app.get("/docs", async (req, res) => {
  const relPath = String(req.query.path || "");
  const normalized = relPath.replace(/^\/+/, "");
  const isAllowed =
    isAllowedPath(normalized, ALLOWED_PREFIXES, ALLOWED_EXTENSIONS) || ALLOWED_FILES.includes(normalized);

  if (!isAllowed) {
    logRequest("docs", { path: normalized, status: 403 });
    return res.status(403).json({ error: "path_not_allowed" });
  }

  const fullPath = resolveWithinRepo(normalized);
  try {
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      logRequest("docs", { path: normalized, status: 400 });
      return res.status(400).json({ error: "not_a_file" });
    }
    const content = fs.readFileSync(fullPath, "utf8");
    logRequest("docs", { path: normalized, status: 200, bytes: content.length });
    res.json({ path: normalized, content: redactSensitive(content) });
  } catch (err) {
    logRequest("docs", { path: normalized, status: 404, error: (err as Error).message });
    res.status(404).json({ error: "file_not_found" });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MCP Docs server listening on http://localhost:${PORT}`);
});

