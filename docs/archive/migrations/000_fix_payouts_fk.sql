-- 000_fix_payouts_fk.sql
-- Fix: Ensure payouts.cleaner_id foreign key references users.id (not cleaner_profiles.user_id)
-- Run this in Neon SQL Editor if the foreign key constraint is failing

-- Step 1: Check current foreign key constraint
-- Run this first to see what it currently references:
/*
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
*/

-- Step 2: Drop the existing foreign key if it references the wrong table
-- (Only run if the query above shows it references cleaner_profiles or a different table)
DO $$
BEGIN
  -- Check if the constraint exists and references the wrong table
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'payouts'
      AND kcu.column_name = 'cleaner_id'
      AND (ccu.table_name != 'users' OR ccu.column_name != 'id')
  ) THEN
    ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_cleaner_id_fkey;
    RAISE NOTICE 'Dropped incorrect foreign key constraint';
  ELSE
    RAISE NOTICE 'Foreign key constraint is correct or does not exist';
  END IF;
END $$;

-- Step 3: Add the correct foreign key constraint (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'payouts_cleaner_id_fkey'
      AND table_name = 'payouts'
  ) THEN
    ALTER TABLE payouts
    ADD CONSTRAINT payouts_cleaner_id_fkey
    FOREIGN KEY (cleaner_id)
    REFERENCES users(id)
    ON DELETE RESTRICT;
    RAISE NOTICE 'Added correct foreign key constraint: payouts.cleaner_id -> users.id';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Step 4: Ensure cleaner_profiles table exists (for tier-based payouts)
-- This is required for tier-based payout calculations and reliability scoring
-- Best Practice: Use IF NOT EXISTS to make migration idempotent
-- Best Practice: Match the exact schema from 001_init.sql
CREATE TABLE IF NOT EXISTS cleaner_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  tier                    TEXT NOT NULL DEFAULT 'bronze', -- bronze/silver/gold/platinum
  reliability_score       NUMERIC(5,2) NOT NULL DEFAULT 100.0, -- 0–100
  hourly_rate_credits     INTEGER NOT NULL DEFAULT 0,
  stripe_connect_id       TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Best Practice: Create indexes with IF NOT EXISTS for idempotency
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_reliability ON cleaner_profiles (reliability_score DESC);
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_tier ON cleaner_profiles (tier);
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_user_id ON cleaner_profiles (user_id);

-- Best Practice: Add missing columns if table exists but is missing columns
-- This handles the case where the table was created without all columns
DO $$
BEGIN
  -- Add reliability_score if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaner_profiles' AND column_name = 'reliability_score'
  ) THEN
    ALTER TABLE cleaner_profiles 
    ADD COLUMN reliability_score NUMERIC(5,2) NOT NULL DEFAULT 100.0;
    RAISE NOTICE 'Added missing column: reliability_score';
  END IF;

  -- Add hourly_rate_credits if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaner_profiles' AND column_name = 'hourly_rate_credits'
  ) THEN
    ALTER TABLE cleaner_profiles 
    ADD COLUMN hourly_rate_credits INTEGER NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added missing column: hourly_rate_credits';
  END IF;

  -- Add stripe_connect_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaner_profiles' AND column_name = 'stripe_connect_id'
  ) THEN
    ALTER TABLE cleaner_profiles 
    ADD COLUMN stripe_connect_id TEXT;
    RAISE NOTICE 'Added missing column: stripe_connect_id';
  END IF;

  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaner_profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cleaner_profiles 
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added missing column: updated_at';
  END IF;
END $$;

-- Step 5: If the foreign key actually references cleaner_profiles.user_id (not users.id),
-- we need to ensure cleaner_profiles records exist for all cleaners who have payouts
-- This is a safety measure - the code will create profiles as needed
-- But if the FK references cleaner_profiles, we need to ensure existing cleaners have profiles
DO $$
BEGIN
  -- Check if the FK references cleaner_profiles
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'payouts'
      AND kcu.column_name = 'cleaner_id'
      AND ccu.table_name = 'cleaner_profiles'
      AND ccu.column_name = 'user_id'
  ) THEN
    -- FK references cleaner_profiles, so create profiles for all cleaners who don't have one
    INSERT INTO cleaner_profiles (user_id, tier, reliability_score, hourly_rate_credits)
    SELECT DISTINCT u.id, 'bronze', 100.0, 0
    FROM users u
    WHERE u.role = 'cleaner'
      AND NOT EXISTS (
        SELECT 1 FROM cleaner_profiles cp WHERE cp.user_id = u.id
      )
    ON CONFLICT (user_id) DO NOTHING;
    RAISE NOTICE 'Created cleaner_profiles for existing cleaners (FK references cleaner_profiles)';
  ELSE
    RAISE NOTICE 'Foreign key references users.id (not cleaner_profiles) - no action needed';
  END IF;
END $$;

