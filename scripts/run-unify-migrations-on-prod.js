#!/usr/bin/env node
// scripts/run-unify-migrations-on-prod.js
// Run views patch + 019 + 059, 060, 061 on PRODUCTION. Requires UNIFY_PROD=1.
// Uses PROD_URL or DATABASE_URL. Loads .env from ENV_FILE or DOTENV_CONFIG_PATH if set.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envFile =
  process.env.ENV_FILE ||
  process.env.DOTENV_CONFIG_PATH ||
  path.join(process.cwd(), '.env') ||
  path.join(process.cwd(), '..', '.env');
if (fs.existsSync(envFile)) {
  require('dotenv').config({ path: envFile });
}

const MIGRATIONS = [
  'DB/migrations/000_COMPLETE_VIEWS_PATCH.sql',
  'DB/migrations/019_payout_reconciliation_flags.sql',
  'DB/migrations/059_add_invoice_status_and_invoices.sql',
  'DB/migrations/060_add_reviews_ai_worker_stripe_tables.sql',
  'DB/migrations/061_add_cleaner_id_payout_misc_tables.sql',
];

if (process.env.UNIFY_PROD !== '1') {
  console.error('❌ UNIFY_PROD=1 is required to run migrations on production.');
  process.exit(1);
}

const prodUrl = process.env.PROD_URL || process.env.DATABASE_URL;
if (!prodUrl) {
  console.error('❌ PROD_URL or DATABASE_URL is not set.');
  process.exit(1);
}

console.log('📋 Running unify migrations (views patch + 019 + 059 → 060 → 061) on PRODUCTION...');
console.log(`🔗 Target: ${prodUrl.replace(/:[^:@]+@/, ':****@')}`);
console.log('');

const env = { ...process.env, DATABASE_URL: prodUrl };
for (const migration of MIGRATIONS) {
  console.log(`▶ ${migration}`);
  try {
    execSync(`node scripts/run-migration.js "${migration}"`, {
      env,
      stdio: 'inherit',
    });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

console.log('');
console.log('✅ Unify migrations completed on production.');
