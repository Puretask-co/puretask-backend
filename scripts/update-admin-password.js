/**
 * Update Admin Password for nathan@puretask.co
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function updatePassword() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('\n🔐 Updating Admin Password...\n');

    const email = 'nathan@puretask.co';
    const newPassword = 'BaileeJane7!';

    // Hash new password
    console.log('Hashing new password...');
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and ensure role is admin
    console.log('Updating database...');
    
    // Disable trigger temporarily
    await pool.query('ALTER TABLE users DISABLE TRIGGER set_users_updated_at');
    
    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, role = 'admin'
       WHERE email = $2
       RETURNING id, email, role, full_name`,
      [passwordHash, email]
    );
    
    // Re-enable trigger
    await pool.query('ALTER TABLE users ENABLE TRIGGER set_users_updated_at');

    if (result.rows.length === 0) {
      console.log('❌ User not found with that email!');
      await pool.end();
      process.exit(1);
    }

    const admin = result.rows[0];

    console.log('\n✅ ADMIN ACCOUNT UPDATED!\n');
    console.log('═══════════════════════════════════════');
    console.log('  Admin Details:');
    console.log('═══════════════════════════════════════');
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Name:     ${admin.full_name || 'Nathan'}`);
    console.log(`  Role:     ${admin.role}`);
    console.log(`  User ID:  ${admin.id}`);
    console.log('═══════════════════════════════════════');
    console.log('\n🎉 PASSWORD UPDATED! YOU CAN NOW LOGIN!\n');
    console.log('Login at: http://localhost:3001/auth/login');
    console.log(`Email:    ${email}`);
    console.log('Password: BaileeJane7!');
    console.log('\nAfter login, you will be redirected to: /admin');
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

updatePassword();

