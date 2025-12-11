-- 000_fix_password_hash.sql
-- Fix: Add password_hash column if missing from users table
-- This is a safety migration for databases that don't have password_hash yet

-- Add password_hash column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
    
    -- If there are existing users without passwords, you may want to handle them
    -- For now, we set a default empty string (users will need to reset passwords)
    RAISE NOTICE 'Added password_hash column to users table';
  ELSE
    RAISE NOTICE 'password_hash column already exists';
  END IF;
END $$;

-- Remove the default after adding (so new users must provide password)
ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;

