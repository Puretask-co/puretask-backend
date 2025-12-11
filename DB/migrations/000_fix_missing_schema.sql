-- 000_fix_missing_schema.sql
-- Fix: Add missing columns and tables for tests to pass
-- Run this in Neon SQL Editor if you're missing these schema elements

-- ============================================
-- 1. Fix users table - add password_hash if missing
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ALTER COLUMN password_hash DROP DEFAULT;
    RAISE NOTICE 'Added password_hash column to users table';
  ELSE
    RAISE NOTICE 'password_hash column already exists';
  END IF;
END $$;

-- ============================================
-- 2. Fix jobs table - add rating and actual_end_at columns if missing
-- ============================================
DO $$ 
BEGIN
  -- Add rating column
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'rating'
  ) THEN
    ALTER TABLE jobs ADD COLUMN rating INTEGER CHECK (rating BETWEEN 1 AND 5);
    RAISE NOTICE 'Added rating column to jobs table';
  ELSE
    RAISE NOTICE 'rating column already exists';
  END IF;
  
  -- Add actual_start_at column
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'actual_start_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN actual_start_at TIMESTAMPTZ;
    RAISE NOTICE 'Added actual_start_at column to jobs table';
  ELSE
    RAISE NOTICE 'actual_start_at column already exists';
  END IF;
  
  -- Add actual_end_at column
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'actual_end_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN actual_end_at TIMESTAMPTZ;
    RAISE NOTICE 'Added actual_end_at column to jobs table';
  ELSE
    RAISE NOTICE 'actual_end_at column already exists';
  END IF;
  
  -- Handle scheduled_start/scheduled_start_at column name mismatch
  -- Check if scheduled_start exists (old name) and rename it, or create scheduled_start_at
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'scheduled_start'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'scheduled_start_at'
  ) THEN
    -- Rename old column to new name
    ALTER TABLE jobs RENAME COLUMN scheduled_start TO scheduled_start_at;
    RAISE NOTICE 'Renamed scheduled_start to scheduled_start_at';
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'scheduled_start_at'
  ) THEN
    -- Create new column if neither exists
    ALTER TABLE jobs ADD COLUMN scheduled_start_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added scheduled_start_at column to jobs table';
  ELSE
    RAISE NOTICE 'scheduled_start_at column already exists';
  END IF;
  
  -- Handle scheduled_end/scheduled_end_at column name mismatch
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'scheduled_end'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'scheduled_end_at'
  ) THEN
    -- Rename old column to new name
    ALTER TABLE jobs RENAME COLUMN scheduled_end TO scheduled_end_at;
    RAISE NOTICE 'Renamed scheduled_end to scheduled_end_at';
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'scheduled_end_at'
  ) THEN
    -- Create new column if neither exists
    ALTER TABLE jobs ADD COLUMN scheduled_end_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 hours';
    RAISE NOTICE 'Added scheduled_end_at column to jobs table';
  ELSE
    RAISE NOTICE 'scheduled_end_at column already exists';
  END IF;
  
  -- Add address column if missing (required for job creation)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'address'
  ) THEN
    ALTER TABLE jobs ADD COLUMN address TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added address column to jobs table';
  ELSE
    RAISE NOTICE 'address column already exists';
  END IF;
  
  -- Add latitude column if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'latitude'
  ) THEN
    ALTER TABLE jobs ADD COLUMN latitude NUMERIC(9,6);
    RAISE NOTICE 'Added latitude column to jobs table';
  ELSE
    RAISE NOTICE 'latitude column already exists';
  END IF;
  
  -- Add longitude column if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'longitude'
  ) THEN
    ALTER TABLE jobs ADD COLUMN longitude NUMERIC(9,6);
    RAISE NOTICE 'Added longitude column to jobs table';
  ELSE
    RAISE NOTICE 'longitude column already exists';
  END IF;
  
  -- Add credit_amount column if missing (required for job creation)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'credit_amount'
  ) THEN
    ALTER TABLE jobs ADD COLUMN credit_amount INTEGER NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added credit_amount column to jobs table';
  ELSE
    RAISE NOTICE 'credit_amount column already exists';
  END IF;
  
  -- Add client_notes column if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'client_notes'
  ) THEN
    ALTER TABLE jobs ADD COLUMN client_notes TEXT;
    RAISE NOTICE 'Added client_notes column to jobs table';
  ELSE
    RAISE NOTICE 'client_notes column already exists';
  END IF;
END $$;

-- ============================================
-- 3. Create messages table if missing
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users (id),
  sender_type     TEXT NOT NULL CHECK (sender_type IN ('client', 'cleaner', 'admin', 'system')),
  content         TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  attachments     JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for messages table
CREATE INDEX IF NOT EXISTS idx_messages_job ON messages (job_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages (job_id, is_read) WHERE is_read = false;

-- ============================================
-- 4. Fix job_events table - add actor_type and actor_id columns if missing
-- ============================================
DO $$ 
BEGIN
  -- Add actor_type column if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'job_events' 
    AND column_name = 'actor_type'
  ) THEN
    ALTER TABLE job_events ADD COLUMN actor_type TEXT NOT NULL DEFAULT 'system';
    ALTER TABLE job_events ALTER COLUMN actor_type DROP DEFAULT;
    RAISE NOTICE 'Added actor_type column to job_events table';
  ELSE
    RAISE NOTICE 'actor_type column already exists';
  END IF;

  -- Add actor_id column if missing
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'job_events' 
    AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE job_events ADD COLUMN actor_id TEXT;
    RAISE NOTICE 'Added actor_id column to job_events table';
  ELSE
    RAISE NOTICE 'actor_id column already exists';
  END IF;

  -- Handle type/event_name vs event_type column name mismatch
  -- If type exists but event_type doesn't, rename it
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'job_events' 
    AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'job_events' 
    AND column_name = 'event_type'
  ) THEN
    ALTER TABLE job_events RENAME COLUMN type TO event_type;
    RAISE NOTICE 'Renamed type to event_type in job_events table';
  -- If event_name exists but event_type doesn't, rename it
  ELSIF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'job_events' 
    AND column_name = 'event_name'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'job_events' 
    AND column_name = 'event_type'
  ) THEN
    ALTER TABLE job_events RENAME COLUMN event_name TO event_type;
    RAISE NOTICE 'Renamed event_name to event_type in job_events table';
  -- If event_type doesn't exist and neither type nor event_name exist, add it
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'job_events' 
    AND column_name = 'event_type'
  ) THEN
    ALTER TABLE job_events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'unknown';
    ALTER TABLE job_events ALTER COLUMN event_type DROP DEFAULT;
    RAISE NOTICE 'Added event_type column to job_events table';
  ELSE
    RAISE NOTICE 'event_type column already exists';
  END IF;
END $$;

-- ============================================
-- 5. Ensure users.id has proper default
-- ============================================
-- The default should already be set, but let's make sure
DO $$ 
BEGIN
  -- Check if default exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'id'
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
    RAISE NOTICE 'Set default for users.id';
  ELSE
    RAISE NOTICE 'users.id default already set';
  END IF;
END $$;

