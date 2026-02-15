#!/usr/bin/env node
/**
 * Run the Neon schema alignment patch against PRODUCTION database.
 * Requires explicit confirmation unless --yes is passed.
 *
 * Usage:
 *   PRODUCTION_DATABASE_URL=... node scripts/run-production-schema-patch.js
 *   PRODUCTION_DATABASE_URL=... node scripts/run-production-schema-patch.js --yes
 *
 * Or with DATABASE_URL (will prompt unless --yes):
 *   DATABASE_URL=... node scripts/run-production-schema-patch.js
 */

require("dotenv").config();
const { execSync } = require("child_process");
const readline = require("readline");

const PATCH_FILE = "DB/migrations/000_NEON_PATCH_test_db_align.sql";

function main() {
  const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error("❌ PRODUCTION_DATABASE_URL or DATABASE_URL is required.");
    console.error("   Set it in .env or as an env var before running.");
    process.exit(1);
  }

  const isYes = process.argv.includes("--yes");

  if (!isYes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const redacted = dbUrl.replace(/:[^:@]+@/, ":****@").substring(0, 60) + "...";
    console.log("\n⚠️  PRODUCTION SCHEMA PATCH");
    console.log("   Database:", redacted);
    console.log("   File:", PATCH_FILE);
    console.log("   This will alter production schema. Ensure you have a backup.");
    rl.question("\n   Type 'yes' to continue: ", (answer) => {
      rl.close();
      if (answer?.toLowerCase() !== "yes") {
        console.log("   Aborted.");
        process.exit(1);
      }
      runPatch(dbUrl);
    });
  } else {
    runPatch(dbUrl);
  }
}

function runPatch(dbUrl) {
  console.log("\n📄 Running schema alignment patch...");
  try {
    execSync(`node scripts/run-migration.js "${PATCH_FILE}"`, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    console.log("\n✅ Production schema patch completed.");
  } catch (e) {
    process.exit(e.status || 1);
  }
}

main();
