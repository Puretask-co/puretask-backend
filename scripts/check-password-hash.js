#!/usr/bin/env node
/**
 * Check if password_hash column exists in users table
 * Run with: node scripts/check-password-hash.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkPasswordHash() {
  try {
    console.log('🔍 Checking users table schema...\n');
    
    const client = await pool.connect();
    
    // Check if password_hash column exists
    const columnCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name = 'password_hash';
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('❌ password_hash column is MISSING from users table!\n');
      console.log('📝 To fix this, run this SQL in your Neon database:\n');
      console.log('   ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT \'\';\n');
      console.log('   ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;\n');
      console.log('   Or paste the contents of DB/migrations/000_fix_password_hash.sql into Neon SQL Editor\n');
    } else {
      const col = columnCheck.rows[0];
      console.log('✅ password_hash column EXISTS!');
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}\n`);
    }
    
    // Check all columns in users table
    const allColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 All columns in users table:');
    allColumns.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`   - ${col.column_name} (${col.data_type}) ${nullable}`);
    });
    
    client.release();
    await pool.end();
    
    process.exit(columnCheck.rows.length === 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Error checking schema:');
    console.error(error.message);
    process.exit(1);
  }
}

checkPasswordHash();

