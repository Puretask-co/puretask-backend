#!/usr/bin/env node
// scripts/analyze-migrations-vs-master.js
// For each migration file, extracts object names (CREATE TABLE/VIEW/TYPE etc.) and checks
// presence in 000_MASTER_MIGRATION.sql. Reports: IN_MASTER | COVERED | HAS_POTENTIAL_NEW | NO_OBJECTS.

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'DB', 'migrations');
const MASTER_FILE = '000_MASTER_MIGRATION.sql';

function extractObjects(content) {
  const objects = { tables: [], views: [], types: [] };
  const reTable = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w.]+\s*\.\s*)?([\w]+)/gi;
  const reView = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w.]+\s*\.\s*)?([\w]+)/gi;
  const reType = /CREATE\s+TYPE\s+(?:[\w.]+\s*\.\s*)?([\w]+)/gi;
  let m;
  while ((m = reTable.exec(content)) !== null) objects.tables.push(m[1]);
  while ((m = reView.exec(content)) !== null) objects.views.push(m[1]);
  while ((m = reType.exec(content)) !== null) objects.types.push(m[1]);
  return objects;
}

function main() {
  const masterPath = path.join(MIGRATIONS_DIR, MASTER_FILE);
  if (!fs.existsSync(masterPath)) {
    console.error('Missing', MASTER_FILE);
    process.exit(1);
  }
  const masterContent = fs.readFileSync(masterPath, 'utf8');
  const masterLower = masterContent.toLowerCase();

  const canonical = [
    '000_FIX_credit_ledger_delta_credits.sql',
    '000_COMPLETE_CONSOLIDATED_SCHEMA.sql',
    '000_COMPLETE_VIEWS_PATCH.sql',
    '019_payout_reconciliation_flags.sql',
    '057_pt_safety_reports.sql',
    '058_gamification_frontend_spec_tables.sql',
    '059_add_invoice_status_and_invoices.sql',
    '060_add_reviews_ai_worker_stripe_tables.sql',
    '061_add_cleaner_id_payout_misc_tables.sql',
  ];

  const results = { IN_MASTER: [], COVERED: [], HAS_POTENTIAL_NEW: [], NO_OBJECTS: [] };
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && f !== MASTER_FILE);
  for (const file of files.sort()) {
    const fullPath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const objs = extractObjects(content);
    const all = [...objs.tables, ...objs.views, ...objs.types];
    if (all.length === 0) {
      results.NO_OBJECTS.push(file);
      continue;
    }
    if (canonical.includes(file)) {
      results.IN_MASTER.push(file);
      continue;
    }
    const missing = all.filter((name) => !masterLower.includes(name.toLowerCase()));
    if (missing.length === 0) results.COVERED.push(file);
    else results.HAS_POTENTIAL_NEW.push({ file, missing });
  }
  console.log('IN_MASTER (canonical source files):', results.IN_MASTER.length);
  results.IN_MASTER.forEach((f) => console.log('  ', f));
  console.log('\nCOVERED (objects found in master):', results.COVERED.length);
  results.COVERED.slice(0, 15).forEach((f) => console.log('  ', f));
  if (results.COVERED.length > 15) console.log('  ... and', results.COVERED.length - 15, 'more');
  console.log('\nHAS_POTENTIAL_NEW (objects not in master):', results.HAS_POTENTIAL_NEW.length);
  results.HAS_POTENTIAL_NEW.forEach(({ file, missing }) => console.log('  ', file, '->', missing.join(', ')));
  console.log('\nNO_OBJECTS:', results.NO_OBJECTS.length);
  results.NO_OBJECTS.slice(0, 10).forEach((f) => console.log('  ', f));
  if (results.NO_OBJECTS.length > 10) console.log('  ... and', results.NO_OBJECTS.length - 10, 'more');
}

main();
