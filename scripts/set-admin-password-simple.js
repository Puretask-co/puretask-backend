/**
 * Simple Admin Password Update
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
    console.log('\n🔐 Setting Admin Password...\n');

    const email = 'nathan@puretask.co';
    const newPassword = 'BaileeJane7!';

    // Hash password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Simple update - just password and role
    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, 
           role = CASE WHEN role != 'admin' THEN 'admin' ELSE role END
       WHERE LOWER(email) = LOWER($2)
       RETURNING id, email, role, full_name, created_at`,
      [passwordHash, email]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found!');
      console.log(`\nSearched for: ${email}`);
      console.log('\nLet me check what users exist...');
      
      const allUsers = await pool.query('SELECT id, email, role FROM users LIMIT 10');
      console.log('\nExisting users:');
      allUsers.rows.forEach(u => {
        console.log(`  - ${u.email} (${u.role})`);
      });
      
      await pool.end();
      process.exit(1);
    }

    const admin = result.rows[0];

    console.log('✅ SUCCESS!\n');
    console.log('═══════════════════════════════════════');
    console.log('  🔐 ADMIN ACCOUNT READY');
    console.log('═══════════════════════════════════════');
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Name:     ${admin.full_name || 'Nathan'}`);
    console.log(`  Role:     ${admin.role.toUpperCase()}`);
    console.log(`  User ID:  ${admin.id}`);
    console.log('═══════════════════════════════════════\n');
    console.log('🎉 YOU CAN NOW LOGIN AS ADMIN!\n');
    console.log('📍 URL:      http://localhost:3001/auth/login');
    console.log(`📧 Email:    ${email}`);
    console.log('🔑 Password: BaileeJane7!');
    console.log('\n✨ After login → redirects to /admin\n');

    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await pool.end();
    process.exit(1);
  }
}

updatePassword();

