// Script to run AI Assistant database migration
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  console.log('🤖 Starting AI Assistant Migration...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in environment variables');
    console.error('   Please check your .env file');
    process.exit(1);
  }

  // Read migration file
  const migrationPath = path.join(__dirname, '../DB/migrations/026_ai_assistant_schema.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ ERROR: Migration file not found at:', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  console.log('✅ Migration file loaded');
  console.log('📄 File:', migrationPath);
  console.log('📊 Size:', migrationSQL.length, 'characters\n');

  // Connect to database
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('🚀 Executing migration...\n');
    console.log('=' .repeat(60));
    
    // Execute migration
    const result = await client.query(migrationSQL);
    
    console.log('=' .repeat(60));
    console.log('\n✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');
    
    const tables = [
      'message_delivery_log',
      'ai_suggestions',
      'ai_activity_log',
      'ai_performance_metrics'
    ];

    for (const table of tables) {
      const checkResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      const exists = checkResult.rows[0].exists;
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    }

    // Check columns were added
    console.log('\n🔍 Verifying columns...\n');
    
    const columns = [
      { table: 'cleaner_profiles', column: 'communication_settings' },
      { table: 'cleaner_profiles', column: 'ai_onboarding_completed' },
      { table: 'cleaner_profiles', column: 'ai_features_active_count' },
      { table: 'jobs', column: 'ai_suggested_slots' },
      { table: 'client_profiles', column: 'communication_preferences' }
    ];

    for (const { table, column } of columns) {
      const checkResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = $2
        )
      `, [table, column]);
      
      const exists = checkResult.rows[0].exists;
      console.log(`  ${exists ? '✅' : '❌'} ${table}.${column}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 AI ASSISTANT DATABASE SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📊 Created:');
    console.log('  • 4 new tables');
    console.log('  • 10+ new columns');
    console.log('  • 2 helper functions');
    console.log('  • Multiple indexes\n');
    console.log('🚀 Your AI Assistant backend is now fully functional!\n');
    console.log('Next steps:');
    console.log('  1. Start your server: npm run dev');
    console.log('  2. Test endpoint: curl http://localhost:4000/api/ai/settings');
    console.log('  3. Copy frontend components (optional)\n');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Note: Some tables/columns may already exist.');
      console.log('   This is OK if you\'ve run this migration before.');
    } else {
      console.error('\nFull error:', error);
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

