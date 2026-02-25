#!/usr/bin/env node
/**
 * Transfer data from test DB to production DB.
 * Uses SOURCE_DATABASE_URL (test) and TARGET_DATABASE_URL (production).
 *
 * 1. Add to .env (temporarily) or set in shell:
 *    SOURCE_DATABASE_URL=postgresql://...ep-small-unit...  (test)
 *    TARGET_DATABASE_URL=postgresql://...ep-fragrant-bird... (production)
 * 2. Run: node scripts/transfer-test-to-production.js
 * 3. After success, set DATABASE_URL to production in .env and remove SOURCE/TARGET if you added them.
 *
 * Requires: pg_dump and psql in PATH (PostgreSQL client tools).
 */

require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const SOURCE = process.env.SOURCE_DATABASE_URL || process.env.TEST_DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!SOURCE) {
  console.error("SOURCE_DATABASE_URL (or TEST_DATABASE_URL) is not set.");
  console.error("Set it in .env to your TEST DB connection string (ep-small-unit-...).");
  process.exit(1);
}
if (!TARGET) {
  console.error("TARGET_DATABASE_URL (or PRODUCTION_DATABASE_URL) is not set.");
  console.error("Set it in .env to your PRODUCTION DB connection string (ep-fragrant-bird-...).");
  process.exit(1);
}

const dumpPath = path.join(__dirname, "..", "test_to_production_dump.sql");

function redact(u) {
  try {
    const url = new URL(u.replace(/^postgres:\/\//, "https://"));
    return url.hostname + (url.pathname ? url.pathname : "");
  } catch {
    return "(url)";
  }
}

console.log("Source (test):     ", redact(SOURCE));
console.log("Target (production):", redact(TARGET));
console.log("Dump file:         ", dumpPath);
console.log("");

// 1. Dump from source
console.log("Dumping from test DB...");
const dumpResult = spawnSync("pg_dump", [SOURCE, "--no-owner", "--no-acl", "-f", dumpPath], {
  stdio: "inherit",
  windowsHide: true,
});
if (dumpResult.status !== 0) {
  console.error("pg_dump failed. Is PostgreSQL client installed and in PATH?");
  process.exit(1);
}

// 2. Restore into target
console.log("Restoring into production DB...");
const restoreResult = spawnSync("psql", [TARGET, "-f", dumpPath], {
  stdio: "inherit",
  windowsHide: true,
});
if (restoreResult.status !== 0) {
  console.error("psql restore had errors (see above). You may need to run migrations on production first: npm run db:migrate");
  process.exit(1);
}

// 3. Cleanup
try {
  fs.unlinkSync(dumpPath);
} catch (_) {}

console.log("");
console.log("Done. Next steps:");
console.log("  1. In .env set DATABASE_URL to your PRODUCTION connection string (ep-fragrant-bird-...).");
console.log("  2. Optionally set TEST_DATABASE_URL to your TEST connection string so npm test uses test DB.");
console.log("  3. Restart the backend server.");
