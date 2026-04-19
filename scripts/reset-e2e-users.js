#!/usr/bin/env node
/**
 * Delete deterministic E2E users used by frontend Playwright tests.
 * Safe to run multiple times.
 */

const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL or TEST_DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 10000 });

const E2E_EMAILS = ["client@test.com", "cleaner@test.com", "admin@test.com"];

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("DELETE FROM users WHERE email = ANY($1::text[]) RETURNING email", [
      E2E_EMAILS,
    ]);
    await client.query("COMMIT");
    console.log(`✅ Deleted ${result.rowCount} deterministic E2E users`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to delete E2E users:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error.message);
  process.exit(1);
});
