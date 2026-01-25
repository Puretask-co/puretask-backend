/**
 * Create Admin Account for nathan@puretask.co
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('\n🔐 Creating Admin Account...\n');

    const email = 'nathan@puretask.co';
    const password = 'BaileeJane7!';
    const fullName = 'Nathan';
    const role = 'admin';

    // Check if user already exists
    const checkResult = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    );

    if (checkResult.rows.length > 0) {
      const existingUser = checkResult.rows[0];
      
      if (existingUser.role === 'admin') {
        console.log('✅ Admin account already exists!');
        console.log(`   Email: ${existingUser.email}`);
        console.log(`   User ID: ${existingUser.id}`);
        console.log('\n🎉 You can login now!');
        await pool.end();
        process.exit(0);
      }

      // Promote to admin
      console.log('⚠️  Account exists but not admin. Promoting...');
      const updateResult = await pool.query(
        'UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, role, full_name',
        ['admin', email]
      );
      
      const updated = updateResult.rows[0];
      console.log('✅ Account promoted to admin!');
      console.log(`   Email: ${updated.email}`);
      console.log(`   Name: ${updated.full_name}`);
      console.log(`   Role: ${updated.role}`);
      console.log(`   User ID: ${updated.id}`);
      console.log('\n🎉 You can login as admin now!');
      await pool.end();
      process.exit(0);
    }

    // Hash password
    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create new admin
    console.log('Creating admin user...');
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, role, full_name, created_at`,
      [email, passwordHash, role, fullName]
    );

    const admin = result.rows[0];

    console.log('\n✅ ADMIN ACCOUNT CREATED SUCCESSFULLY!\n');
    console.log('═══════════════════════════════════════');
    console.log('  Admin Details:');
    console.log('═══════════════════════════════════════');
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Name:     ${admin.full_name}`);
    console.log(`  Role:     ${admin.role}`);
    console.log(`  User ID:  ${admin.id}`);
    console.log(`  Created:  ${admin.created_at}`);
    console.log('═══════════════════════════════════════');
    console.log('\n🎉 YOU CAN NOW LOGIN AS ADMIN!\n');
    console.log('Go to: http://localhost:3001/auth/login');
    console.log(`Email: ${email}`);
    console.log('Password: BaileeJane7!');
    console.log('\nYou will be redirected to: /admin');
    console.log('\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

createAdmin();

