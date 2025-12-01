-- 011_cleaner_availability.sql
-- Cleaner availability and schedule management

-- Weekly availability (recurring schedule)
CREATE TABLE IF NOT EXISTS cleaner_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One entry per day per cleaner
  CONSTRAINT unique_cleaner_day UNIQUE (cleaner_id, day_of_week),
  -- End time must be after start time
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_availability_cleaner_id ON cleaner_availability (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_availability_day ON cleaner_availability (day_of_week);

-- Time off / blocked dates (one-time overrides)
CREATE TABLE IF NOT EXISTS cleaner_time_off (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  all_day         BOOLEAN NOT NULL DEFAULT true,
  start_time      TIME,  -- If not all_day
  end_time        TIME,  -- If not all_day
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- End date must be >= start date
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_time_off_cleaner ON cleaner_time_off (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_time_off_dates ON cleaner_time_off (start_date, end_date);

-- Service areas / coverage zones
CREATE TABLE IF NOT EXISTS cleaner_service_areas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  zip_code        TEXT,
  city            TEXT,
  state           TEXT,
  radius_miles    INTEGER,  -- Max travel distance from home base
  latitude        NUMERIC(9,6),  -- Home base latitude
  longitude       NUMERIC(9,6),  -- Home base longitude
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_cleaner ON cleaner_service_areas (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_zip ON cleaner_service_areas (zip_code);

-- Cleaner preferences (job types, special skills)
CREATE TABLE IF NOT EXISTS cleaner_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id          UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  max_jobs_per_day    INTEGER NOT NULL DEFAULT 5,
  min_job_duration_h  NUMERIC(3,1) NOT NULL DEFAULT 1.0,  -- Minimum job length in hours
  max_job_duration_h  NUMERIC(3,1) NOT NULL DEFAULT 8.0,  -- Maximum job length in hours
  accepts_pets        BOOLEAN NOT NULL DEFAULT true,
  accepts_deep_clean  BOOLEAN NOT NULL DEFAULT true,
  accepts_move_out    BOOLEAN NOT NULL DEFAULT true,
  has_own_supplies    BOOLEAN NOT NULL DEFAULT false,
  has_vehicle         BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_preferences_cleaner ON cleaner_preferences (cleaner_id);

-- Add trigger for updated_at
CREATE TRIGGER trg_cleaner_availability_updated_at
BEFORE UPDATE ON cleaner_availability
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_cleaner_preferences_updated_at
BEFORE UPDATE ON cleaner_preferences
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- Helper function: Check if cleaner is available at a specific datetime
CREATE OR REPLACE FUNCTION is_cleaner_available(
  p_cleaner_id UUID,
  p_datetime TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week INTEGER;
  v_time TIME;
  v_has_availability BOOLEAN;
  v_has_time_off BOOLEAN;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_datetime);
  v_time := p_datetime::TIME;
  
  -- Check recurring availability
  SELECT EXISTS (
    SELECT 1 FROM cleaner_availability
    WHERE cleaner_id = p_cleaner_id
      AND day_of_week = v_day_of_week
      AND is_available = true
      AND v_time >= start_time
      AND v_time < end_time
  ) INTO v_has_availability;
  
  IF NOT v_has_availability THEN
    RETURN FALSE;
  END IF;
  
  -- Check time off
  SELECT EXISTS (
    SELECT 1 FROM cleaner_time_off
    WHERE cleaner_id = p_cleaner_id
      AND p_datetime::DATE BETWEEN start_date AND end_date
      AND (all_day = true OR (
        p_datetime::TIME >= start_time AND p_datetime::TIME < end_time
      ))
  ) INTO v_has_time_off;
  
  RETURN NOT v_has_time_off;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON TABLE cleaner_availability IS 'Weekly recurring availability schedule for cleaners';
COMMENT ON TABLE cleaner_time_off IS 'One-time time off / blocked dates for cleaners';
COMMENT ON TABLE cleaner_service_areas IS 'Geographic areas a cleaner is willing to work in';
COMMENT ON TABLE cleaner_preferences IS 'Job preferences and capabilities for cleaners';
COMMENT ON FUNCTION is_cleaner_available IS 'Check if a cleaner is available at a specific datetime';

