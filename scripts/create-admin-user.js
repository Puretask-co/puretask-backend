// scripts/create-admin-user.js
// Script to create an admin user for PureTask

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function createAdminUser() {
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

  const adminEmail = 'nathan@puretask.co';
  const adminPassword = 'BaileeJane7!';
  const adminName = 'Nathan (Admin)';

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Check if user already exists
    console.log('\n🔍 Checking if admin user already exists...');
    const existingUser = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [adminEmail]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      console.log('⚠️  User already exists with email:', adminEmail);
      console.log('   User ID:', user.id);
      console.log('   Current role:', user.role);

      // Update to admin role if not already
      if (user.role !== 'admin') {
        console.log('\n🔄 Updating user role to admin...');
        await client.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['admin', user.id]
        );
        console.log('✅ User role updated to admin');
      } else {
        console.log('✅ User already has admin role');
      }

      // Update password
      console.log('\n🔄 Updating password...');
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await client.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hashedPassword, user.id]
      );
      console.log('✅ Password updated');

      console.log('\n============================================');
      console.log('✅ ADMIN USER READY!');
      console.log('============================================');
      console.log('Email:', adminEmail);
      console.log('Password:', adminPassword);
      console.log('Role: admin');
      console.log('User ID:', user.id);
      console.log('============================================');
      
      return;
    }

    // Create new admin user
    console.log('\n👤 Creating new admin user...');
    
    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    console.log('✅ Password hashed');

    // Create user
    console.log('📝 Inserting user into database...');
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, email, role, created_at`,
      [adminEmail, hashedPassword, 'admin']
    );

    const newUser = userResult.rows[0];
    console.log('✅ User created successfully');
    console.log('   User ID:', newUser.id);
    console.log('   Email:', newUser.email);
    console.log('   Role:', newUser.role);

    // Create admin profile (if there's a profile table)
    try {
      console.log('\n📋 Creating admin profile...');
      await client.query(
        `INSERT INTO cleaner_profiles (user_id, user_email, full_name, phone, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_email) DO NOTHING`,
        [newUser.id, adminEmail, adminName, null]
      );
      console.log('✅ Admin profile created');
    } catch (profileError) {
      console.log('ℹ️  Profile creation skipped (table may not exist or already exists)');
    }

    console.log('\n============================================');
    console.log('🎉 ADMIN USER CREATED SUCCESSFULLY!');
    console.log('============================================');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Role: admin');
    console.log('User ID:', newUser.id);
    console.log('Created:', newUser.created_at);
    console.log('============================================');
    console.log('\n📝 Next steps:');
    console.log('1. Start your server: npm run dev');
    console.log('2. Login at: http://localhost:4000/admin/login');
    console.log('3. Access admin dashboard: http://localhost:4000/admin');
    console.log('============================================');

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
createAdminUser().catch(console.error);

