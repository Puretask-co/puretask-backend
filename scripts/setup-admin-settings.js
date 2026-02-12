// scripts/setup-admin-settings.js
// Script to set up the comprehensive admin settings system

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function setupAdminSettings() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in .env file');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  const migrationFilePath = path.resolve(__dirname, '../DB/migrations/027_admin_settings_system.sql');
  
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    console.log('📄 Reading migration file...');
    const migrationSQL = fs.readFileSync(migrationFilePath, 'utf8');
    console.log(`✅ Migration file loaded (${migrationSQL.length} characters)\n`);

    console.log('🚀 Executing Admin Settings migration...');
    console.log('   This will create:');
    console.log('   • admin_settings table');
    console.log('   • admin_settings_history table');
    console.log('   • 100+ default settings across 20+ categories');
    console.log('   • Helper functions for settings management\n');

    await client.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying installation...');
    
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'admin_settings'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      throw new Error('admin_settings table was not created');
    }
    console.log('  ✅ admin_settings table created');

    const historyCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'admin_settings_history'
      )
    `);

    if (!historyCheck.rows[0].exists) {
      throw new Error('admin_settings_history table was not created');
    }
    console.log('  ✅ admin_settings_history table created');

    // Count settings
    const settingsCount = await client.query(`
      SELECT COUNT(*) as count FROM admin_settings
    `);
    console.log(`  ✅ ${settingsCount.rows[0].count} default settings configured`);

    // List setting categories
    const categories = await client.query(`
      SELECT setting_type, COUNT(*) as count
      FROM admin_settings
      GROUP BY setting_type
      ORDER BY setting_type
    `);

    console.log('\n📋 Settings Categories:');
    categories.rows.forEach(cat => {
      console.log(`   • ${cat.setting_type}: ${cat.count} settings`);
    });

    console.log('\n============================================');
    console.log('🎉 ADMIN SETTINGS SYSTEM SETUP COMPLETE!');
    console.log('============================================');
    console.log('\n📊 Summary:');
    console.log(`   • Total Settings: ${settingsCount.rows[0].count}`);
    console.log(`   • Categories: ${categories.rows.length}`);
    console.log('   • History Tracking: Enabled');
    console.log('   • Audit Logging: Enabled');
    
    console.log('\n🔗 API Endpoints Available:');
    console.log('   GET    /admin/settings');
    console.log('   GET    /admin/settings/categories');
    console.log('   GET    /admin/settings/:key');
    console.log('   PUT    /admin/settings/:key');
    console.log('   POST   /admin/settings/bulk-update');
    console.log('   GET    /admin/settings/:key/history');
    console.log('   GET    /admin/settings/export');
    console.log('   POST   /admin/settings/import');

    console.log('\n📝 Next Steps:');
    console.log('   1. Start your server: npm run dev');
    console.log('   2. Test endpoint: curl http://localhost:4000/admin/settings \\');
    console.log('      -H "Authorization: Bearer YOUR_TOKEN"');
    console.log('   3. Access settings UI at: /admin/settings');
    console.log('\n============================================\n');

  } catch (error) {
    console.error('\n❌ Error setting up admin settings:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run the script
setupAdminSettings().catch(console.error);

