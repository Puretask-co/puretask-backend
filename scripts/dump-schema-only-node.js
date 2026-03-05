#!/usr/bin/env node
/**
 * Dump schema-only from production and test DBs using Node + pg (no pg_dump required).
 * Reads from .env: PROD_URL and TEST_URL (or TARGET_DATABASE_URL/SOURCE_DATABASE_URL, etc.).
 *
 *   npm run db:dump:schema
 *   (uses dump-schema-only-node.js when pg_dump not available)
 *
 * Writes: prod.sql, test.sql in repo root.
 */

require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
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

if (!PROD_URL || !TEST_URL) {
  console.error("Set PROD_URL and TEST_URL (or TARGET_DATABASE_URL and SOURCE_DATABASE_URL) in .env");
  process.exit(1);
}

async function getSchema(client) {
  const tables = await client.query(`
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    ORDER BY t.tablename
  `);

  const lines = ["-- Schema dump (Node)", ""];

  for (const { tablename } of tables.rows) {
    const cols = await client.query(
      `
      SELECT a.attname AS name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
             a.attnotnull AS notnull, pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default
      FROM pg_catalog.pg_attribute a
      LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
      WHERE a.attrelid = (SELECT oid FROM pg_class WHERE relname = $1 AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
      `,
      [tablename]
    );
    const colDefs = cols.rows
      .map((c) => {
        let def = `  "${c.name}" ${c.type}`;
        if (c.notnull) def += " NOT NULL";
        if (c.default) def += " DEFAULT " + c.default;
        return def;
      })
      .join(",\n");
    lines.push(`CREATE TABLE IF NOT EXISTS "${tablename}" (\n${colDefs}\n);`);
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const prodPool = new Pool({ connectionString: PROD_URL, max: 1 });
  const testPool = new Pool({ connectionString: TEST_URL, max: 1 });

  try {
    console.log("Dumping schema (Node)...");
    console.log("  prod.sql  <- production");
    const prodClient = await prodPool.connect();
    const prodSchema = await getSchema(prodClient);
    prodClient.release();
    fs.writeFileSync(path.join(outDir, "prod.sql"), prodSchema, "utf8");

    console.log("  test.sql  <- test");
    const testClient = await testPool.connect();
    const testSchema = await getSchema(testClient);
    testClient.release();
    fs.writeFileSync(path.join(outDir, "test.sql"), testSchema, "utf8");

    console.log("Done. prod.sql and test.sql written to repo root.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prodPool.end();
    await testPool.end();
  }
}

main();
