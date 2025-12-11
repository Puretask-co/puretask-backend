#!/usr/bin/env node
/**
 * Check cleaner_profiles table structure
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

async function checkCleanerProfiles() {
  try {
    console.log('🔍 Checking cleaner_profiles table structure...\n');
    
    const client = await pool.connect();
    
    // Get columns
    const columnsResult = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'cleaner_profiles'
      ORDER BY ordinal_position;
    `);
    
    console.log(`✅ Found ${columnsResult.rows.length} columns:\n`);
    columnsResult.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    });
    
    // Check indexes
    const indexesResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'cleaner_profiles';
    `);
    
    console.log(`\n✅ Found ${indexesResult.rows.length} indexes:`);
    indexesResult.rows.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });
    
    // Check foreign keys
    const fkResult = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'cleaner_profiles';
    `);
    
    console.log(`\n✅ Found ${fkResult.rows.length} foreign keys:`);
    fkResult.rows.forEach(fk => {
      console.log(`   - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
    
    // Check row count
    const countResult = await client.query('SELECT COUNT(*) as count FROM cleaner_profiles');
    console.log(`\n📊 Total rows: ${countResult.rows[0].count}`);
    
    client.release();
    await pool.end();
    
    console.log('\n✅ Check complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkCleanerProfiles();

