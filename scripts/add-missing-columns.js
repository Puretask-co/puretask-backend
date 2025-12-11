#!/usr/bin/env node
/**
 * Add missing columns to cleaner_profiles table
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
});

async function addMissingColumns() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🔧 Adding missing columns to cleaner_profiles...\n');
    
    // Check and add tier
    const tierCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cleaner_profiles' AND column_name = 'tier'
    `);
    
    if (tierCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE cleaner_profiles 
        ADD COLUMN tier TEXT NOT NULL DEFAULT 'bronze'
      `);
      console.log('✅ Added column: tier');
    } else {
      console.log('✓ Column already exists: tier');
    }
    
    // Check and add reliability_score
    const scoreCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cleaner_profiles' AND column_name = 'reliability_score'
    `);
    
    if (scoreCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE cleaner_profiles 
        ADD COLUMN reliability_score NUMERIC(5,2) NOT NULL DEFAULT 100.0
      `);
      console.log('✅ Added column: reliability_score');
    } else {
      console.log('✓ Column already exists: reliability_score');
    }
    
    // Check and add hourly_rate_credits
    const rateCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cleaner_profiles' AND column_name = 'hourly_rate_credits'
    `);
    
    if (rateCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE cleaner_profiles 
        ADD COLUMN hourly_rate_credits INTEGER NOT NULL DEFAULT 0
      `);
      console.log('✅ Added column: hourly_rate_credits');
    } else {
      console.log('✓ Column already exists: hourly_rate_credits');
    }
    
    // Add indexes if they don't exist
    const indexChecks = [
      { name: 'idx_cleaner_profiles_reliability', sql: 'CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_reliability ON cleaner_profiles (reliability_score DESC)' },
      { name: 'idx_cleaner_profiles_tier', sql: 'CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_tier ON cleaner_profiles (tier)' },
      { name: 'idx_cleaner_profiles_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_user_id ON cleaner_profiles (user_id)' }
    ];
    
    for (const idx of indexChecks) {
      const idxCheck = await client.query(`
        SELECT indexname FROM pg_indexes WHERE indexname = $1
      `, [idx.name]);
      
      if (idxCheck.rows.length === 0) {
        await client.query(idx.sql);
        console.log(`✅ Created index: ${idx.name}`);
      } else {
        console.log(`✓ Index already exists: ${idx.name}`);
      }
    }
    
    await client.query('COMMIT');
    console.log('\n🎉 All columns and indexes added successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingColumns().catch(() => process.exit(1));

