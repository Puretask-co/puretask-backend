#!/usr/bin/env node
/**
 * Dump schema-only from production and test DBs.
 * Uses PROD_URL and TEST_URL (or TARGET_DATABASE_URL/PRODUCTION_DATABASE_URL and SOURCE_DATABASE_URL/TEST_DATABASE_URL).
 *
 *   PROD_URL=... TEST_URL=... node scripts/dump-schema-only.js
 *   # or set in .env, then: npm run db:dump:schema
 *
 * Writes: prod.sql, test.sql (in repo root).
 * Requires: pg_dump in PATH.
 */

require("dotenv").config();
const { spawnSync } = require("child_process");
const path = require("path");

const PROD_URL =
  process.env.PROD_URL ||
  process.env.TARGET_DATABASE_URL ||
  process.env.PRODUCTION_DATABASE_URL ||
  process.env.DATABASE_URL;
const TEST_URL =
  process.env.TEST_URL ||
  process.env.SOURCE_DATABASE_URL ||
  process.env.TEST_DATABASE_URL;

const outDir = path.join(__dirname, "..");

if (!PROD_URL) {
  console.error("PROD_URL (or TARGET_DATABASE_URL / PRODUCTION_DATABASE_URL / DATABASE_URL) is not set.");
  process.exit(1);
}
if (!TEST_URL) {
  console.error("TEST_URL (or SOURCE_DATABASE_URL / TEST_DATABASE_URL) is not set.");
  process.exit(1);
}

const prodSql = path.join(outDir, "prod.sql");
const testSql = path.join(outDir, "test.sql");

// Older pg_dump doesn't support channel_binding; strip it so SSL still works with sslmode=require
function urlForPgDump(url) {
  return url.replace(/[?&]channel_binding=[^&]*/g, "").replace(/\?&/, "?").replace(/\?$/, "");
}
const prodUrl = urlForPgDump(PROD_URL);
const testUrl = urlForPgDump(TEST_URL);

console.log("Dumping schema-only...");
console.log("  prod.sql  <- production");
const r1 = spawnSync("pg_dump", ["--schema-only", "--no-owner", "--no-acl", "-f", prodSql, prodUrl], {
  stdio: "inherit",
  windowsHide: true,
});
if (r1.status !== 0) {
  console.error("pg_dump (prod) failed. Is pg_dump in PATH?");
  process.exit(1);
}

console.log("  test.sql  <- test");
const r2 = spawnSync("pg_dump", ["--schema-only", "--no-owner", "--no-acl", "-f", testSql, testUrl], {
  stdio: "inherit",
  windowsHide: true,
});
if (r2.status !== 0) {
  console.error("pg_dump (test) failed.");
  process.exit(1);
}

console.log("Done. prod.sql and test.sql written to repo root.");
