#!/usr/bin/env node
// scripts/verify-master-completeness.js
// Checks that tables/views from 001-056 (+ hardening) and 019 appear in COMPLETE or in the master.
// Fails only when the MASTER is missing something (not when COMPLETE is missing, since we patch the master).

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'DB', 'migrations');

// Tables/views that are only in 057-061 or 019 (not in COMPLETE) — expected; master adds them via inlined files
const AFTER_COMPLETE = new Set([
  'abuse_signals',
  'ai_assistant_conversations',
  'ai_assistant_messages',
  'cleaner_agreements',
  'cleaner_client_notes',
  'cleaner_tooltip_interactions', // in VIEWS_PATCH
  'gamification_choice_groups',
  'gamification_goals',
  'gamification_rewards',
  'cleaner_reward_pause',
  'id_verifications',
  'invoices',
  'invoice_line_items',
  'invoice_status_history',
  'message_delivery_log',
  'payout_items',
  'payout_reconciliation_flags',
  'phone_verifications',
  'pt_safety_reports',
  'reviews',
  'stripe_events_processed',
  'stripe_object_processed',
  'worker_runs',
]);

// Objects renamed or replaced in COMPLETE (e.g. different view name)
const RENAMED_IN_COMPLETE = new Set([]);

function extractTableAndViewNames(content) {
  const names = new Set();
  const reTable = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w.]+\s*\.\s*)?([\w]+)/gi;
  const reView = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w.]+\s*\.\s*)?([\w]+)/gi;
  let m;
  while ((m = reTable.exec(content)) !== null) names.add(m[1]);
  while ((m = reView.exec(content)) !== null) names.add(m[1]);
  return names;
}

function main() {
  const completePath = path.join(MIGRATIONS_DIR, '000_COMPLETE_CONSOLIDATED_SCHEMA.sql');
  const masterPath = path.join(MIGRATIONS_DIR, '000_MASTER_MIGRATION.sql');
  if (!fs.existsSync(completePath) || !fs.existsSync(masterPath)) {
    console.error('Missing 000_COMPLETE_CONSOLIDATED_SCHEMA.sql or 000_MASTER_MIGRATION.sql');
    process.exit(1);
  }
  const completeRaw = fs.readFileSync(completePath, 'utf8');
  const masterRaw = fs.readFileSync(masterPath, 'utf8');

  const sourceFiles = [
    { name: '001-056 + hardening', path: path.join(MIGRATIONS_DIR, '000_COMPLETE_CONSOLIDATED_SCHEMA.sql') },
    { name: '019_payout_reconciliation_flags.sql', path: path.join(MIGRATIONS_DIR, '019_payout_reconciliation_flags.sql') },
  ];
  const hardeningDir = path.join(MIGRATIONS_DIR, 'hardening');
  if (fs.existsSync(hardeningDir)) {
    fs.readdirSync(hardeningDir)
      .filter((f) => f.endsWith('.sql'))
      .forEach((f) => sourceFiles.push({ name: 'hardening/' + f, path: path.join(hardeningDir, f) }));
  }

  const missingInComplete = [];
  const missingInMaster = [];
  for (const { name, path: filePath } of sourceFiles) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const tables = [...extractTableAndViewNames(content)];
    for (const t of tables) {
      if (AFTER_COMPLETE.has(t) || RENAMED_IN_COMPLETE.has(t)) continue;
      if (!completeRaw.includes(t)) missingInComplete.push({ file: name, table: t });
      if (!masterRaw.includes(t)) missingInMaster.push({ file: name, table: t });
    }
  }

  if (missingInComplete.length > 0) {
    console.log('Objects not in COMPLETE (expected if in views patch or 019/057-061):');
    missingInComplete.forEach(({ file, table }) => console.log('   ', file, '->', table));
  }
  if (missingInMaster.length > 0) {
    console.log('\n*** Master is missing objects above. Add them to 000_COMPLETE_VIEWS_PATCH or the generator and regenerate. ***');
    missingInMaster.forEach(({ file, table }) => console.log('   ', file, '->', table));
    process.exit(1);
  }
  console.log('All source files present.');
  console.log('OK: Master includes all tables/views from the canonical migrations.');
}

main();
