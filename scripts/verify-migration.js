#!/usr/bin/env node
// scripts/verify-migration.js
// Verify that the payouts foreign key constraint is correct
// Best Practice: Always verify migrations after running them

const { Pool } = require('pg');
require('dotenv').config();

async function verifyMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  console.log('🔍 Verifying migration: 000_fix_payouts_fk.sql');
  console.log('');

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();

  try {
    console.log('✅ Connected to database');
    console.log('');

    // Check 1: Verify foreign key constraint
    console.log('1️⃣ Checking foreign key constraint...');
    const fkResult = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'payouts'
        AND kcu.column_name = 'cleaner_id';
    `);

    if (fkResult.rows.length === 0) {
      console.log('   ⚠️  No foreign key constraint found');
      console.log('   💡 Run the migration to add the constraint');
    } else {
      const fk = fkResult.rows[0];
      console.log(`   ✅ Foreign key found: ${fk.constraint_name}`);
      console.log(`   📍 References: ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      
      if (fk.foreign_table_name === 'users' && fk.foreign_column_name === 'id') {
        console.log('   ✅ Foreign key is CORRECT (references users.id)');
      } else {
        console.log(`   ❌ Foreign key is INCORRECT (references ${fk.foreign_table_name}.${fk.foreign_column_name})`);
        console.log('   💡 Expected: users.id');
        console.log('   💡 Run the migration to fix it');
      }
    }
    console.log('');

    // Check 2: Verify cleaner_profiles table exists
    console.log('2️⃣ Checking cleaner_profiles table...');
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'cleaner_profiles'
      ) AS exists;
    `);

    if (tableResult.rows[0].exists) {
      console.log('   ✅ cleaner_profiles table exists');
      
      // Check for required columns
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'cleaner_profiles'
        ORDER BY ordinal_position;
      `);

      const requiredColumns = [
        'id', 'user_id', 'tier', 'reliability_score', 
        'hourly_rate_credits', 'stripe_connect_id', 
        'created_at', 'updated_at'
      ];

      const existingColumns = columnsResult.rows.map(r => r.column_name);
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

      if (missingColumns.length === 0) {
        console.log('   ✅ All required columns exist');
        console.log(`   📋 Columns: ${existingColumns.join(', ')}`);
      } else {
        console.log(`   ⚠️  Missing columns: ${missingColumns.join(', ')}`);
        console.log('   💡 Run the migration to add missing columns');
      }
    } else {
      console.log('   ❌ cleaner_profiles table does not exist');
      console.log('   💡 Run the migration to create it');
    }
    console.log('');

    // Check 3: Verify indexes
    console.log('3️⃣ Checking indexes...');
    const indexesResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'cleaner_profiles';
    `);

    const requiredIndexes = [
      'idx_cleaner_profiles_reliability',
      'idx_cleaner_profiles_tier',
      'idx_cleaner_profiles_user_id'
    ];

    const existingIndexes = indexesResult.rows.map(r => r.indexname);
    const missingIndexes = requiredIndexes.filter(idx => !existingIndexes.includes(idx));

    if (missingIndexes.length === 0) {
      console.log('   ✅ All required indexes exist');
    } else {
      console.log(`   ⚠️  Missing indexes: ${missingIndexes.join(', ')}`);
      console.log('   💡 Run the migration to create them');
    }
    console.log('');

    console.log('✅ Verification complete!');
    console.log('');
    console.log('💡 If any issues were found, run:');
    console.log('   npm run migrate:fix-payouts-fk');

  } catch (error) {
    console.error('❌ Verification failed:');
    console.error(`   ${error.message}`);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyMigration().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

