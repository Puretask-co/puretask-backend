#!/usr/bin/env node
/**
 * Setup test database: consolidated schema + gamification migrations (041–056).
 * Used by CI before running tests. Idempotent (uses IF NOT EXISTS).
 *
 * Uses 000_COMPLETE_CONSOLIDATED_SCHEMA.sql (001–025 + hardening) for full production-like schema.
 * Set USE_LEGACY_SCHEMA=1 to use 000_CONSOLIDATED_SCHEMA.sql (001–019 only).
 *
 * Usage: DATABASE_URL=... node scripts/setup-test-db.js
 */

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

require("dotenv").config();

const ROOT = path.join(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "DB", "migrations");

const USE_LEGACY = process.env.USE_LEGACY_SCHEMA === "1";
const CONSOLIDATED = USE_LEGACY
  ? "DB/migrations/000_CONSOLIDATED_SCHEMA.sql"
  : "DB/migrations/000_COMPLETE_CONSOLIDATED_SCHEMA.sql";
const GAMIFICATION_MIGRATIONS = [
  "041_n8n_event_log.sql",
  "042_webhook_events.sql",
  "043_cleaner_level_system.sql",
  "044_meaningful_login_and_attribution.sql",
  "045_gamification_expansion.sql",
  "046_safety_reports.sql",
  "047_gamification_event_ingestion.sql",
  "048_gamification_reward_grants_and_choices.sql",
  "049_gamification_sql_helpers.sql",
  "050_gamification_reward_idempotency_and_effects.sql",
  "051_gamification_admin_control_plane.sql",
  "052_gamification_cash_budget_enforcement.sql",
  "053_gamification_badges.sql",
  "054_gamification_seasonal_challenges.sql",
  "055_gamification_ops_views.sql",
  "056_marketplace_health_governor.sql",
];
const UNIFY_MIGRATIONS = [
  "059_add_invoice_status_and_invoices.sql",
  "060_add_reviews_ai_worker_stripe_tables.sql",
  "061_add_cleaner_id_payout_misc_tables.sql",
];

function runMigration(file) {
  const relPath = file.startsWith("DB/") ? file : `DB/migrations/${file}`;
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Skip (not found): ${file}`);
    return;
  }
  console.log(`   Running: ${path.basename(file)}`);
  try {
    const out = execSync(`node scripts/run-migration.js "${relPath}"`, {
      cwd: ROOT,
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      encoding: "utf8",
    });
    if (out) process.stdout.write(out);
  } catch (error) {
    const stdout =
      typeof error?.stdout === "string"
        ? error.stdout
        : Buffer.isBuffer(error?.stdout)
          ? error.stdout.toString("utf8")
          : "";
    const stderr =
      typeof error?.stderr === "string"
        ? error.stderr
        : Buffer.isBuffer(error?.stderr)
          ? error.stderr.toString("utf8")
          : "";
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    const enriched = new Error(`${error?.message || "Migration command failed"}\n${stdout}\n${stderr}`);
    enriched.original = error;
    throw enriched;
  }
}

function migrationSupportsCurrentSchema(errorMessage = "") {
  const normalized = errorMessage.toLowerCase();
  return !(
    normalized.includes("cannot be implemented") ||
    normalized.includes("42804") ||
    normalized.includes("foreign key constraint")
  );
}

function normalizeExecError(error) {
  if (!error) return "";
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.stderr === "string" && error.stderr.trim()) return error.stderr;
  if (Buffer.isBuffer(error.stderr)) return error.stderr.toString("utf8");
  if (Array.isArray(error.output)) {
    return error.output
      .filter(Boolean)
      .map((v) => (Buffer.isBuffer(v) ? v.toString("utf8") : String(v)))
      .join("\n");
  }
  return String(error);
}

function runConsolidatedWithFallback() {
  try {
    runMigration(CONSOLIDATED);
  } catch (error) {
    const message = normalizeExecError(error).toLowerCase();
    const canFallback =
      !USE_LEGACY &&
      (message.includes("invalid input value for enum credit_reason") ||
        message.includes("wallet_topup"));

    if (!canFallback) {
      throw error;
    }

    console.warn(
      "⚠️  Consolidated schema failed on current DB; retrying with legacy consolidated schema for compatibility."
    );
    runMigration("DB/migrations/000_CONSOLIDATED_SCHEMA.sql");
  }
}

function main() {
  const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ TEST_DATABASE_URL or DATABASE_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = dbUrl;

  console.log("📄 Setting up test database...\n");

  console.log(`1. Applying consolidated schema (${path.basename(CONSOLIDATED)})`);
  runConsolidatedWithFallback();

  console.log("\n2. Applying gamification migrations (041–056)");
  for (const m of GAMIFICATION_MIGRATIONS) {
    runMigration(m);
  }

  console.log("\n3. Applying NEON patches (cleaner_profiles, is_cleaner_available, job_status, etc.)");
  runMigration("DB/migrations/000_NEON_PATCH_existing_db.sql");
  runMigration("DB/migrations/000_NEON_PATCH_job_status_disputed.sql");
  runMigration("DB/migrations/000_NEON_PATCH_cleaner_availability.sql");
  runMigration("DB/migrations/000_NEON_PATCH_test_db_align.sql");

  console.log("\n4. Applying unify migrations (059–061) when schema supports UUID invoice references");
  const shouldRunUnifyMigrations = !USE_LEGACY;
  if (!shouldRunUnifyMigrations) {
    console.log("⚠️  Skipping unify migrations because USE_LEGACY_SCHEMA=1 (legacy TEXT-id schema mode).");
  } else {
    for (const m of UNIFY_MIGRATIONS) {
      try {
        runMigration(m);
      } catch (error) {
        const message = normalizeExecError(error);
        // Older local/test schemas can still use TEXT ids; keep setup usable and rely on trust fallback.
        if (!migrationSupportsCurrentSchema(message)) {
          console.warn(`⚠️  Skipping ${m}: schema type mismatch for FK references (${message})`);
          continue;
        }
        throw error;
      }
    }
  }

  console.log("\n✅ Test database ready.");
}

main();
