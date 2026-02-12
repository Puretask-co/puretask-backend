#!/usr/bin/env node
/**
 * Migration runner: run DB/migrations/*.sql in order and track applied migrations.
 * Uses schema_migrations table. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   node scripts/migrate-runner.js status   - list applied and pending
 *   node scripts/migrate-runner.js up       - run pending migrations
 *   node scripts/migrate-runner.js create-schema - create schema_migrations table only
 *
 * Requires: DATABASE_URL in env.
 */

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const MIGRATIONS_DIR = path.join(process.cwd(), "DB", "migrations");
const TABLE_NAME = "schema_migrations";

function getMigrationFiles() {
  const files = [];
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return files;
  }
  // Top-level .sql (excluding 000_* consolidated/seed - often run separately)
  const top = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  top.sort();
  top.forEach((f) => files.push({ name: f, fullPath: path.join(MIGRATIONS_DIR, f) }));

  const hardeningDir = path.join(MIGRATIONS_DIR, "hardening");
  if (fs.existsSync(hardeningDir)) {
    const hard = fs.readdirSync(hardeningDir).filter((f) => f.endsWith(".sql"));
    hard.sort();
    hard.forEach((f) =>
      files.push({ name: "hardening/" + f, fullPath: path.join(hardeningDir, f) })
    );
  }
  return files;
}

async function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }
  return new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
    query_timeout: 60000,
  });
}

async function ensureSchemaMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied(client) {
  const res = await client.query(
    `SELECT name FROM ${TABLE_NAME} ORDER BY applied_at`
  );
  return new Set(res.rows.map((r) => r.name));
}

async function runUp(pool) {
  const client = await pool.connect();
  try {
    await ensureSchemaMigrationsTable(client);
    const applied = await getApplied(client);
    const all = getMigrationFiles();
    const pending = all.filter((m) => !applied.has(m.name));

    if (pending.length === 0) {
      console.log("✅ No pending migrations. Database is up to date.");
      return;
    }

    console.log(`📄 Running ${pending.length} pending migration(s)...\n`);
    for (const m of pending) {
      const sql = fs.readFileSync(m.fullPath, "utf8");
      if (!sql || !sql.trim()) {
        console.log(`⏭️  Skipping empty file: ${m.name}`);
        await client.query(
          `INSERT INTO ${TABLE_NAME} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [m.name]
        );
        continue;
      }
      console.log(`   Running: ${m.name}`);
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${TABLE_NAME} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [m.name]
        );
        console.log(`   ✅ ${m.name}`);
      } catch (err) {
        console.error(`   ❌ ${m.name} failed:`, err.message);
        throw err;
      }
    }
    console.log("\n✅ Migrations complete.");
  } finally {
    client.release();
  }
}

async function runStatus(pool) {
  const client = await pool.connect();
  try {
    await ensureSchemaMigrationsTable(client);
    const applied = await getApplied(client);
    const all = getMigrationFiles();
    const pending = all.filter((m) => !applied.has(m.name));

    console.log("📋 Migration status\n");
    console.log(`   Applied: ${applied.size}`);
    console.log(`   Pending: ${pending.length}`);
    if (pending.length > 0) {
      console.log("\n   Pending migrations:");
      pending.forEach((m) => console.log(`   - ${m.name}`));
    }
  } finally {
    client.release();
  }
}

async function main() {
  const cmd = process.argv[2] || "status";
  const pool = await getPool();

  try {
    if (cmd === "up") {
      await runUp(pool);
    } else if (cmd === "status") {
      await runStatus(pool);
    } else if (cmd === "create-schema") {
      const client = await pool.connect();
      try {
        await ensureSchemaMigrationsTable(client);
        console.log("✅ schema_migrations table ready.");
      } finally {
        client.release();
      }
    } else {
      console.log("Usage: node scripts/migrate-runner.js [ status | up | create-schema ]");
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
