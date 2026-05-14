#!/usr/bin/env node
/**
 * `pretest` hook: run setup-test-db.js iff TEST_DATABASE_URL is set.
 *
 * - When TEST_DATABASE_URL is set, sets DATABASE_URL to it and runs
 *   setup-test-db.js so integration tests find a seeded schema.
 * - When TEST_DATABASE_URL is unset, exits 0 silently so the
 *   deterministic CI slice (which doesn't need DB) still works.
 *
 * See docs/active/AUDIT_REANALYSIS_2026-05-13.md § A.5.
 */

const { spawnSync } = require("child_process");
const path = require("path");

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl || testDbUrl.trim() === "") {
  // No test DB configured; skip seeding. Integration tests that need a
  // seeded DB will surface their own clear errors when they hit the pool.
  process.exit(0);
}

console.log("[pretest] TEST_DATABASE_URL set; running setup-test-db.js...");

const setupScript = path.join(__dirname, "setup-test-db.js");
const result = spawnSync(process.execPath, [setupScript], {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: testDbUrl,
    STRICT_MIGRATION_PATH: process.env.STRICT_MIGRATION_PATH || "1",
  },
});

if (result.status !== 0) {
  console.error("[pretest] setup-test-db.js failed; aborting test run.");
  process.exit(result.status || 1);
}

console.log("[pretest] test DB ready.");
