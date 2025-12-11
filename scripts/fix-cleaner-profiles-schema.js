#!/usr/bin/env node
/**
 * Add missing columns to cleaner_profiles table
 * This fixes the schema mismatch between code and database
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
});

async function fixSchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing cleaner_profiles schema...\n');
    
    // Check current columns
    const currentCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cleaner_profiles'
    `);
    const existingCols = currentCols.rows.map(r => r.column_name);
    console.log(`Current columns: ${existingCols.length}`);
    
    // Add tier if missing
    if (!existingCols.includes('tier')) {
      console.log('Adding column: tier...');
      await client.query(`
        ALTER TABLE cleaner_profiles 
        ADD COLUMN tier TEXT NOT NULL DEFAULT 'bronze'
      `);
      console.log('✅ Added: tier');
    } else {
      console.log('✓ tier already exists');
    }
    
    // Add reliability_score if missing
    if (!existingCols.includes('reliability_score')) {
      console.log('Adding column: reliability_score...');
      await client.query(`
        ALTER TABLE cleaner_profiles 
        ADD COLUMN reliability_score NUMERIC(5,2) NOT NULL DEFAULT 100.0
      `);
      console.log('✅ Added: reliability_score');
    } else {
      console.log('✓ reliability_score already exists');
    }
    
    // Add hourly_rate_credits if missing
    if (!existingCols.includes('hourly_rate_credits')) {
      console.log('Adding column: hourly_rate_credits...');
      await client.query(`
        ALTER TABLE cleaner_profiles 
        ADD COLUMN hourly_rate_credits INTEGER NOT NULL DEFAULT 0
      `);
      console.log('✅ Added: hourly_rate_credits');
    } else {
      console.log('✓ hourly_rate_credits already exists');
    }
    
    // Create indexes
    console.log('\n📊 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_reliability ON cleaner_profiles (reliability_score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_tier ON cleaner_profiles (tier)',
      'CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_user_id ON cleaner_profiles (user_id)'
    ];
    
    for (const idxSql of indexes) {
      await client.query(idxSql);
    }
    console.log('✅ Indexes created');
    
    // Verify
    const verifyCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cleaner_profiles' 
        AND column_name IN ('tier', 'reliability_score', 'hourly_rate_credits')
    `);
    
    console.log('\n✅ Verification:');
    verifyCols.rows.forEach(col => {
      console.log(`   ✓ ${col.column_name}`);
    });
    
    if (verifyCols.rows.length === 3) {
      console.log('\n🎉 Schema fix complete! All required columns exist.');
    } else {
      console.log(`\n⚠️  Only ${verifyCols.rows.length}/3 columns found`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixSchema()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

