-- DROP_EVENT_NAME_COLUMN.sql
-- Drop the old event_name column from job_events table
-- The code uses event_type, not event_name

-- First, check if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'job_events'
    AND column_name = 'event_name'
  ) THEN
    ALTER TABLE job_events DROP COLUMN event_name;
    RAISE NOTICE 'Dropped event_name column from job_events table';
  ELSE
    RAISE NOTICE 'event_name column does not exist (already dropped)';
  END IF;
END $$;

