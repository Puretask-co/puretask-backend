-- FIX_JOB_EVENTS_COLUMNS.sql
-- Fix: Add missing columns to job_events table (actor_type, actor_id, event_type)
-- Run this in Neon SQL Editor

-- Add actor_type column if missing
DO $$
BEGIN
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
END $$;

-- Add actor_id column if missing
DO $$
BEGIN
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
END $$;

-- Handle type/event_name vs event_type column name mismatch
DO $$
BEGIN
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

