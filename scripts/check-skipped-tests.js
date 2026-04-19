// Fails CI if skipped tests are committed.
const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const patterns = ["it.skip(", "test.skip(", "describe.skip(", ".skip("];
const allowedFiles = new Set([
  // Temporary baseline: existing known skipped tests. Do not add new entries lightly.
  "src/routes/__tests__/cleanerOnboarding.test.ts",
  "src/tests/integration/disputeFlow.test.ts",
  "src/tests/integration/onboardingFlow.test.ts",
  "src/tests/integration/v1Hardening.test.ts",
]);

function walk(dir, out = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (!fullPath.endsWith(".ts")) continue;
    out.push(fullPath);
  }
  return out;
}

function relative(path) {
  return path.replace(ROOT + "\\", "").replaceAll("\\", "/");
}

const offenders = [];
for (const filePath of walk(SRC_DIR)) {
  const rel = relative(filePath);
  if (allowedFiles.has(rel)) continue;
  const content = readFileSync(filePath, "utf8");
  if (patterns.some((p) => content.includes(p))) {
    offenders.push(rel);
  }
}

if (offenders.length > 0) {
  console.error("Found skipped tests. Remove or unskip before merge:");
  for (const f of offenders) console.error(` - ${f}`);
  process.exit(1);
}

console.log("No skipped tests detected.");
