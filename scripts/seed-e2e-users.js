#!/usr/bin/env node
/**
 * Seed deterministic E2E users for frontend/backed full-stack tests.
 *
 * This script is intentionally standalone (pg + bcryptjs) so CI can run it
 * without requiring backend TypeScript build artifacts.
 */

const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

const USERS = [
  {
    email: (process.env.E2E_CLIENT_EMAIL || "client@test.com").toLowerCase().trim(),
    password: process.env.E2E_CLIENT_PASSWORD || process.env.E2E_TEST_PASSWORD || "TestPass123!",
    role: "client",
  },
  {
    email: (process.env.E2E_CLEANER_EMAIL || "cleaner@test.com").toLowerCase().trim(),
    password: process.env.E2E_CLEANER_PASSWORD || process.env.E2E_TEST_PASSWORD || "TestPass123!",
    role: "cleaner",
  },
  {
    email: (process.env.E2E_ADMIN_EMAIL || "admin@test.com").toLowerCase().trim(),
    password: process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_PASSWORD || "TestPass123!",
    role: "admin",
  },
];

if (!DATABASE_URL) {
  console.error("❌ Missing DATABASE_URL or TEST_DATABASE_URL");
  process.exit(1);
}

async function ensureUser(client, user) {
  const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
  const upsert = await client.query(
    `
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, $3::user_role)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, email, role
    `,
    [user.email, passwordHash, user.role]
  );

  const dbUser = upsert.rows[0];
  if (!dbUser) {
    throw new Error(`Failed to upsert user ${user.email}`);
  }

  if (user.role === "client") {
    await client.query(`INSERT INTO client_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [
      dbUser.id,
    ]);
  }

  if (user.role === "cleaner") {
    try {
      await client.query(
        `
          INSERT INTO cleaner_profiles (user_id, tier, reliability_score, hourly_rate_credits)
          VALUES ($1, 'bronze', 100.0, 0)
          ON CONFLICT (user_id) DO NOTHING
        `,
        [dbUser.id]
      );
    } catch {
      // Backward-compatible fallback for older schemas without these columns.
      await client.query(
        `INSERT INTO cleaner_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
        [dbUser.id]
      );
    }

    try {
      await client.query(
        `
          UPDATE cleaner_profiles
          SET
            first_name = COALESCE(first_name, 'Test'),
            last_name = COALESCE(last_name, 'Cleaner')
          WHERE user_id = $1
        `,
        [dbUser.id]
      );
    } catch {
      // Some schemas may not have first_name/last_name columns; ignore for deterministic auth users.
    }
  }

  return dbUser;
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("🌱 Seeding deterministic E2E users...");
    for (const user of USERS) {
      const ensured = await ensureUser(client, user);
      console.log(`✅ ensured ${ensured.role}: ${ensured.email}`);
    }
    await client.query("COMMIT");
    console.log("✅ E2E user seeding complete.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to seed E2E users:", error.message || error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error.message || error);
  process.exit(1);
});
