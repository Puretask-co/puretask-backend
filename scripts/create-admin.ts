/**
 * Create Admin User Script
 * 
 * Usage:
 * ts-node scripts/create-admin.ts <email> <password> <full_name>
 * 
 * Example:
 * ts-node scripts/create-admin.ts admin@puretask.com SecurePass123! "Admin User"
 */

import { query } from '../src/db/client';
import * as bcrypt from 'bcryptjs';

async function createAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('❌ Usage: ts-node scripts/create-admin.ts <email> <password> <full_name>');
    console.error('Example: ts-node scripts/create-admin.ts admin@puretask.com SecurePass123! "Admin User"');
    process.exit(1);
  }

  const [email, password, fullName] = args;

  console.log('\n🔐 Creating Admin User...\n');
  console.log(`Email: ${email}`);
  console.log(`Name: ${fullName}`);
  console.log(`Role: admin\n`);

  try {
    // Check if user already exists
    const existing = await query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      
      if (existingUser.role === 'admin') {
        console.log('✅ User already exists and is an admin!');
        console.log(`User ID: ${existingUser.id}`);
        process.exit(0);
      }

      // Update existing user to admin
      console.log('⚠️  User exists but is not an admin. Promoting to admin...');
      await query(
        'UPDATE users SET role = $1 WHERE email = $2 RETURNING id',
        ['admin', email]
      );
      console.log('✅ User promoted to admin successfully!');
      console.log(`User ID: ${existingUser.id}`);
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create new admin user
    const result = await query(
      `INSERT INTO users (email, password_hash, role, full_name, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, role, full_name, created_at`,
      [email, passwordHash, 'admin', fullName]
    );

    const newAdmin = result.rows[0];

    console.log('✅ Admin user created successfully!\n');
    console.log('Admin Details:');
    console.log(`  ID: ${newAdmin.id}`);
    console.log(`  Email: ${newAdmin.email}`);
    console.log(`  Name: ${newAdmin.full_name}`);
    console.log(`  Role: ${newAdmin.role}`);
    console.log(`  Created: ${newAdmin.created_at}`);
    console.log('\n🎉 You can now login with these credentials!');

  } catch (error: any) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
createAdmin();

