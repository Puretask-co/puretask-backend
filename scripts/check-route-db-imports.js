// Guardrail: block new route-level direct DB imports.
const { readdirSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");

const ROOT = process.cwd();
const ROUTES_DIR = join(ROOT, "src", "routes");
const importPattern = /from\s+["'][^"']*db\/client["']/;

const baselineAllowed = new Set([
  "src/routes/gamification.ts",
  "src/routes/trustAdapter.ts",
  "src/routes/jobs.ts",
  "src/routes/dashboardStubs.ts",
  "src/routes/admin/settings.ts",
  "src/routes/admin/gamificationControl.ts",
  "src/routes/admin.ts",
  "src/routes/__tests__/cleanerOnboarding.test.ts",
  "src/routes/__tests__/adminIdVerifications.test.ts",
  "src/routes/payments.ts",
  "src/routes/users.ts",
  "src/routes/cleanerEnhanced.ts",
  "src/routes/admin/risk.ts",
  "src/routes/message-history.ts",
  "src/routes/stripe.ts",
  "src/routes/admin/finance.ts",
  "src/routes/admin/clients.ts",
  "src/routes/admin/cleaners.ts",
  "src/routes/clientEnhanced.ts",
  "src/routes/scoring.ts",
  "src/routes/reschedule.ts",
  "src/routes/client.ts",
  "src/routes/cleanerOnboarding.ts",
  "src/routes/cleaner-ai-settings.ts",
  "src/routes/cleaner-ai-advanced.ts",
  "src/routes/cancellation.ts",
  "src/routes/ai.ts",
  "src/routes/adminIdVerifications.ts",
  "src/routes/adminEnhanced.ts",
  "src/routes/admin/webhooks.ts",
  "src/routes/admin/system.ts",
  "src/routes/admin/messages.ts",
  "src/routes/admin/levelTuning.ts",
  "src/routes/admin/bookings.ts",
  "src/routes/admin/analytics.ts",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

function rel(path) {
  return path.replace(ROOT + "\\", "").replaceAll("\\", "/");
}

const offenders = [];
for (const file of walk(ROUTES_DIR)) {
  const content = readFileSync(file, "utf8");
  if (!importPattern.test(content)) continue;
  const relativePath = rel(file);
  if (!baselineAllowed.has(relativePath)) offenders.push(relativePath);
}

if (offenders.length > 0) {
  console.error("New route-level db/client imports detected:");
  for (const file of offenders) console.error(` - ${file}`);
  process.exit(1);
}

console.log("No new route-level db/client imports detected.");
