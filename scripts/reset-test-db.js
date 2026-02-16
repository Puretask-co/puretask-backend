#!/usr/bin/env node
/**
 * Reset test database: drop all objects in public schema, then run setup-test-db.
 * Use when the test DB has stale schema that causes migration conflicts.
 *
 * Usage: npm run db:setup:test (with RESET_TEST_DB=1)
 * Or: RESET_TEST_DB=1 node scripts/reset-test-db.js
 */

const { Pool } = require("pg");
const { execSync } = require("child_process");
const path = require("path");

require("dotenv").config();

const ROOT = path.join(__dirname, "..");

async function main() {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ TEST_DATABASE_URL or DATABASE_URL is not set");
    process.exit(1);
  }

  console.log("🔄 Resetting test database (dropping all objects)...\n");

  const pool = new Pool({
    connectionString: dbUrl,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  try {
    await client.query("DROP SCHEMA public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    console.log("✅ Schema reset complete.\n");
  } catch (err) {
    console.error("❌ Reset failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }

  console.log("📄 Running setup-test-db...\n");
  execSync("node scripts/setup-test-db.js", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
