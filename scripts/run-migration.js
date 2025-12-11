#!/usr/bin/env node
// scripts/run-migration.js
// Run a SQL migration file against the database
// Best Practice: Migrations should be idempotent and safe to run multiple times

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Run a SQL migration file against the database
 * Best Practices:
 * - Migrations are idempotent (safe to run multiple times)
 * - Uses transactions for atomicity
 * - Provides clear error messages
 * - Validates environment before running
 */
async function runMigration(migrationFile) {
  const migrationPath = path.resolve(process.cwd(), migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    console.error(`   Current working directory: ${process.cwd()}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  if (!sql || sql.trim().length === 0) {
    console.error(`❌ Migration file is empty: ${migrationFile}`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    console.error('   Please set it in your .env file or environment');
    console.error('   Example: DATABASE_URL=postgresql://user:pass@host:port/db');
    process.exit(1);
  }

  // Validate connection string format
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    console.error('❌ Invalid DATABASE_URL format');
    console.error('   Expected format: postgresql://user:password@host:port/database');
    process.exit(1);
  }

  console.log(`📄 Running migration: ${migrationFile}`);
  console.log(`🔗 Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password
  console.log('');

  const pool = new Pool({
    connectionString: databaseUrl,
    // Best Practice: Set connection timeout
    connectionTimeoutMillis: 10000,
    // Best Practice: Set query timeout
    query_timeout: 30000,
  });

  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to database');
    console.log('🔄 Executing migration...');
    console.log('');

    // Best Practice: Execute migration
    // Note: PostgreSQL allows most DDL in transactions, but this migration uses
    // DO blocks which handle their own transaction logic. The migration is designed
    // to be idempotent and safe to run multiple times.
    const result = await client.query(sql);
    
    // Check if we got any NOTICE messages (from RAISE NOTICE statements)
    // PostgreSQL sends notices as separate messages, not in the result object
    // They will appear in the console output automatically
    
    console.log('✅ Migration completed successfully');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Verify the migration: npm run migrate:verify');
    console.log('   2. Run tests: npm run test:smoke');
    console.log('   3. Check application logs for any errors');
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:');
    console.error(`   Error: ${error.message}`);
    if (error.code) {
      console.error(`   PostgreSQL Error Code: ${error.code}`);
    }
    if (error.position) {
      console.error(`   Position in SQL: ${error.position}`);
    }
    if (error.hint) {
      console.error(`   Hint: ${error.hint}`);
    }
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   - Check that the database exists and is accessible');
    console.error('   - Verify DATABASE_URL is correct');
    console.error('   - Ensure you have ALTER TABLE permissions');
    console.error('   - Check that required tables exist (run 001_init.sql first if needed)');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Usage: node scripts/run-migration.js <migration-file>');
  console.error('   Example: node scripts/run-migration.js DB/migrations/000_fix_payouts_fk.sql');
  process.exit(1);
}

runMigration(migrationFile).catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

