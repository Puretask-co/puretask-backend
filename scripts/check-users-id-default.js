#!/usr/bin/env node
/**
 * Check if users.id has a default value set
 * Run with: node scripts/check-users-id-default.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkUsersIdDefault() {
  try {
    console.log('🔍 Checking users.id default value...\n');
    
    const client = await pool.connect();
    
    // Check if default exists
    const defaultCheck = await client.query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name = 'id';
    `);
    
    if (defaultCheck.rows.length === 0) {
      console.log('❌ users.id column not found!');
      await client.release();
      await pool.end();
      return;
    }
    
    const defaultValue = defaultCheck.rows[0].column_default;
    
    if (!defaultValue) {
      console.log('❌ users.id has NO default value!\n');
      console.log('📝 To fix this, run this SQL in your Neon database:\n');
      console.log('   ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;\n');
    } else {
      console.log('✅ users.id has a default value:');
      console.log(`   ${defaultValue}\n`);
    }
    
    // Test if we can insert without providing id
    console.log('🧪 Testing insert without id...');
    try {
      const testResult = await client.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ('test-default-check@test.puretask.com', 'test', 'client')
        RETURNING id;
      `);
      
      console.log('✅ Insert succeeded! Generated id:', testResult.rows[0].id);
      
      // Clean up test user
      await client.query(`
        DELETE FROM users WHERE email = 'test-default-check@test.puretask.com';
      `);
      console.log('🧹 Test user cleaned up\n');
    } catch (testError) {
      console.log('❌ Insert FAILED:', testError.message);
      console.log('\n📝 This means the default is not working properly.\n');
    }
    
    await client.release();
    await pool.end();
    
    console.log('✅ Check complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsersIdDefault();

