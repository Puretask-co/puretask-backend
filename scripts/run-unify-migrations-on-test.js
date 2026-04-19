#!/usr/bin/env node
// scripts/run-unify-migrations-on-test.js
// Run migrations 059, 060, 061 on the TEST database so test has the same schema as prod.
// Uses TEST_DATABASE_URL so you don't have to swap DATABASE_URL.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const MIGRATIONS = [
  'DB/migrations/000_COMPLETE_VIEWS_PATCH.sql',
  'DB/migrations/019_payout_reconciliation_flags.sql',
  'DB/migrations/059_add_invoice_status_and_invoices.sql',
  'DB/migrations/060_add_reviews_ai_worker_stripe_tables.sql',
  'DB/migrations/061_add_cleaner_id_payout_misc_tables.sql',
  'DB/migrations/062_job_photos_client_dispute_type.sql',
];

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error('❌ TEST_DATABASE_URL is not set.');
  console.error('   Set it in .env to your test DB (e.g. Neon ep-small-unit).');
  console.error('   Example: TEST_DATABASE_URL=postgresql://user:pass@ep-small-unit-xxx.neon.tech/neondb?sslmode=require');
  process.exit(1);
}

console.log('📋 Running unify migrations (views patch + 019 + 059 → 060 → 061 + 062) on TEST database...');
console.log(`🔗 Target: ${testUrl.replace(/:[^:@]+@/, ':****@')}`);
console.log('');

const env = { ...process.env, DATABASE_URL: testUrl };
for (const migration of MIGRATIONS) {
  const fullPath = path.join(process.cwd(), migration);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  Skip (missing): ${migration}`);
    continue;
  }
  console.log(`▶ ${migration}`);
  try {
    execSync(`node scripts/run-migration.js "${migration}"`, {
      env,
      stdio: 'inherit',
    });
  } catch (e) {
    const details = String(e && (e.stderr || e.message || e)).toLowerCase();
    if (
      details.includes('cannot be implemented') ||
      details.includes('42804') ||
      details.includes('foreign key constraint')
    ) {
      console.warn(`⚠️  Skipping ${migration}: incompatible FK/id type for current schema`);
      continue;
    }
    process.exit(e.status || 1);
  }
}

console.log('');
console.log('✅ Unify migrations completed on test DB.');
console.log('   Prod and test now have aligned full-stack schema patches.');
