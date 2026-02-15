#!/usr/bin/env node
/**
 * Verify production database schema has key tables and columns.
 * Use after running db:patch:production to confirm alignment.
 *
 * Usage:
 *   PRODUCTION_DATABASE_URL=... node scripts/verify-production-schema.js
 *   npm run db:verify:production
 */

require("dotenv").config();
const { Pool } = require("pg");

const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

const CHECKS = [
  {
    name: "users table",
    sql: `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'`,
    expect: 1,
  },
  {
    name: "jobs.credit_amount",
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='credit_amount'`,
    expect: 1,
  },
  {
    name: "jobs.cleaning_type",
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='cleaning_type'`,
    expect: 1,
  },
  {
    name: "jobs.pricing_snapshot",
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='pricing_snapshot'`,
    expect: 1,
  },
  {
    name: "credit_ledger.delta_credits",
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='credit_ledger' AND column_name='delta_credits'`,
    expect: 1,
  },
  {
    name: "messages table (job chat)",
    sql: `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages'`,
    expect: 1,
  },
  {
    name: "cleaner_availability.start_time",
    sql: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cleaner_availability' AND column_name='start_time'`,
    expect: 1,
  },
];

async function main() {
  if (!dbUrl) {
    console.error("❌ PRODUCTION_DATABASE_URL or DATABASE_URL is required.");
    process.exit(1);
  }

  const redacted = dbUrl.replace(/:[^:@]+@/, ":****@").substring(0, 60) + "...";
  console.log("\n🔍 Production schema verification");
  console.log("   Database:", redacted);

  const pool = new Pool({ connectionString: dbUrl });
  let failed = 0;

  for (const check of CHECKS) {
    try {
      const res = await pool.query(check.sql);
      const ok = res.rows.length >= check.expect;
      console.log(ok ? "   ✓" : "   ✗", check.name);
      if (!ok) failed++;
    } catch (e) {
      console.log("   ✗", check.name, "-", e.message);
      failed++;
    }
  }

  await pool.end();

  if (failed > 0) {
    console.log("\n❌", failed, "check(s) failed. Run db:patch:production if needed.");
    process.exit(1);
  }
  console.log("\n✅ All schema checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
