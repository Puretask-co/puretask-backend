-- 000_rename_scheduled_columns.sql
-- Quick fix: Rename scheduled_start/scheduled_end to scheduled_start_at/scheduled_end_at
-- Run this FIRST if you're getting "scheduled_start" column errors

-- Rename scheduled_start to scheduled_start_at (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'scheduled_start'
  ) THEN
    ALTER TABLE jobs RENAME COLUMN scheduled_start TO scheduled_start_at;
    RAISE NOTICE 'Renamed scheduled_start to scheduled_start_at';
  ELSE
    RAISE NOTICE 'scheduled_start column does not exist (may already be renamed)';
  END IF;
END $$;

-- Rename scheduled_end to scheduled_end_at (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'scheduled_end'
  ) THEN
    ALTER TABLE jobs RENAME COLUMN scheduled_end TO scheduled_end_at;
    RAISE NOTICE 'Renamed scheduled_end to scheduled_end_at';
  ELSE
    RAISE NOTICE 'scheduled_end column does not exist (may already be renamed)';
  END IF;
END $$;
