#!/usr/bin/env node
/**
 * Verify all migrations were successful
 * Run with: node scripts/verify-migrations.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const REQUIRED_TABLES = [
  'users', 'jobs', 'payouts', 'disputes', 'credit_ledger',
  'cleaner_profiles', 'client_profiles', 'payment_intents',
  'invoices', 'cleaner_availability', 'job_offers'
];

async function verifyMigrations() {
  try {
    console.log('🔍 Verifying database migrations...\n');
    
    const client = await pool.connect();
    
    // Check all required tables
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1)
      ORDER BY table_name;
    `, [REQUIRED_TABLES]);
    
    const foundTables = result.rows.map(r => r.table_name);
    const missingTables = REQUIRED_TABLES.filter(t => !foundTables.includes(t));
    
    console.log(`✅ Found ${foundTables.length}/${REQUIRED_TABLES.length} required tables:\n`);
    foundTables.forEach(table => {
      console.log(`   ✓ ${table}`);
    });
    
    if (missingTables.length > 0) {
      console.log(`\n❌ Missing ${missingTables.length} tables:`);
      missingTables.forEach(table => {
        console.log(`   ✗ ${table}`);
      });
      console.log('\n💡 Run the fix script: DB/migrations/001_missing_tables_fix.sql');
    } else {
      console.log('\n🎉 All required tables exist!');
    }
    
    // Count total tables
    const totalResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE';
    `);
    
    console.log(`\n📊 Total tables in database: ${totalResult.rows[0].count}`);
    
    client.release();
    await pool.end();
    
    process.exit(missingTables.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Error verifying migrations:');
    console.error(error.message);
    process.exit(1);
  }
}

verifyMigrations();

