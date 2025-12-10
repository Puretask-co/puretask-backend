#!/usr/bin/env node
/**
 * Quick script to test database connection and verify migrations
 * Run with: node scripts/test-db-connection.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...\n');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful!\n');
    
    // Check core tables
    console.log('📊 Checking core tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`\n✅ Found ${tablesResult.rows.length} tables:`);
    tablesResult.rows.slice(0, 20).forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    if (tablesResult.rows.length > 20) {
      console.log(`   ... and ${tablesResult.rows.length - 20} more`);
    }
    
    // Check views
    const viewsResult = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log(`\n✅ Found ${viewsResult.rows.length} views:`);
    viewsResult.rows.slice(0, 10).forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    if (viewsResult.rows.length > 10) {
      console.log(`   ... and ${viewsResult.rows.length - 10} more`);
    }
    
    // Check functions
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name;
    `);
    
    console.log(`\n✅ Found ${functionsResult.rows.length} functions:`);
    functionsResult.rows.slice(0, 10).forEach(row => {
      console.log(`   - ${row.routine_name}`);
    });
    if (functionsResult.rows.length > 10) {
      console.log(`   ... and ${functionsResult.rows.length - 10} more`);
    }
    
    // Test a simple query
    console.log('\n🧪 Testing a simple query...');
    const testResult = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`✅ Query successful!`);
    console.log(`   Current time: ${testResult.rows[0].current_time}`);
    console.log(`   PostgreSQL: ${testResult.rows[0].pg_version.split(' ')[0]} ${testResult.rows[0].pg_version.split(' ')[1]}`);
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 All tests passed! Database is ready to use.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error(error.message);
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Tip: Check your DATABASE_URL - the hostname cannot be resolved.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Check if your Neon database is active (not paused).');
    }
    process.exit(1);
  }
}

testConnection();

