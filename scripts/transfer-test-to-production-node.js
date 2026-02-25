#!/usr/bin/env node
/**
 * Transfer data from test DB to production DB using Node.js and pg only (no pg_dump/psql).
 * Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL (or TEST_ and PRODUCTION_DATABASE_URL), then run.
 */

require("dotenv").config();
const { Pool } = require("pg");

const SOURCE = process.env.SOURCE_DATABASE_URL || process.env.TEST_DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!SOURCE || !TARGET) {
  console.error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL (or TEST_ and PRODUCTION_DATABASE_URL) in env.");
  process.exit(1);
}

const sourcePool = new Pool({ connectionString: SOURCE, max: 1 });
const targetPool = new Pool({ connectionString: TARGET, max: 1 });

async function getTables(pool) {
  const r = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT LIKE 'pg_%'
    ORDER BY tablename
  `);
  return r.rows.map((x) => x.tablename);
}

async function main() {
  let sourceClient, targetClient;
  try {
    sourceClient = await sourcePool.connect();
    targetClient = await targetPool.connect();

    const tables = await getTables(sourcePool);
    console.log("Tables to copy:", tables.length);

    // Truncate all target tables (CASCADE to handle FKs)
    const truncateList = tables.map((t) => `"${t.replace(/"/g, '""')}"`).join(", ");
    await targetClient.query(`TRUNCATE ${truncateList} CASCADE`);

    for (const table of tables) {
      try {
        const rows = await sourceClient.query(`SELECT * FROM "${table.replace(/"/g, '""')}"`);
        if (rows.rows.length === 0) {
          console.log("  OK", table, "(0 rows)");
          continue;
        }
        const cols = Object.keys(rows.rows[0]);
        const colList = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const insertSql = `INSERT INTO "${table.replace(/"/g, '""')}" (${colList}) VALUES (${placeholders})`;
        for (const row of rows.rows) {
          const values = cols.map((c) => row[c]);
          await targetClient.query(insertSql, values);
        }
        console.log("  OK", table, "(" + rows.rows.length + " rows)");
      } catch (e) {
        console.error("  FAIL", table, e.message);
      }
    }

    console.log("\nDone. Set DATABASE_URL in .env to production and restart the app.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    sourceClient?.release();
    targetClient?.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

main();
