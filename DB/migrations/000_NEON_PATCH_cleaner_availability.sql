-- Ensure cleaner_availability has start_time, end_time columns (for Neon DBs with older schema)
-- Run if setDayAvailability fails with "column start_time does not exist"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cleaner_availability' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE cleaner_availability ADD COLUMN start_time TIME;
    ALTER TABLE cleaner_availability ADD COLUMN end_time TIME;
    UPDATE cleaner_availability SET start_time = '08:00'::TIME, end_time = '20:00'::TIME WHERE start_time IS NULL;
    ALTER TABLE cleaner_availability ALTER COLUMN start_time SET NOT NULL;
    ALTER TABLE cleaner_availability ALTER COLUMN end_time SET NOT NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist; consolidated schema will create it
    NULL;
END
$$;
