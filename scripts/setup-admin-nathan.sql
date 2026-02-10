-- Setup Admin Account for nathan@puretask.co
-- Run this in your Neon Console SQL Editor

-- First, let's see if the account exists
SELECT id, email, role, created_at 
FROM users 
WHERE LOWER(email) = 'nathan@puretask.co';

-- Update the account to admin with new password
-- Password: BaileeJane7!
-- Hashed with bcrypt (10 rounds)
UPDATE users 
SET 
  password_hash = '$2b$10$rg2GyobyIg8K.o7wIbBXbuwKvZIWvf8UPK0NJw0VrKMV/uIi0cXgm',
  role = 'admin'
WHERE LOWER(email) = 'nathan@puretask.co';

-- Verify the update
SELECT id, email, role, created_at 
FROM users 
WHERE LOWER(email) = 'nathan@puretask.co';

-- You should see:
-- email: nathan@puretask.co
-- role: admin
-- 
-- ✅ YOU CAN NOW LOGIN!
-- Email: nathan@puretask.co
-- Password: BaileeJane7!

