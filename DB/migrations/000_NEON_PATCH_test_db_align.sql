-- Neon schema alignment patch (test and production).
-- Aligns existing Neon DB with app expectations: FKs, columns, enums, is_cleaner_available.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).
-- For production: use npm run db:patch:production (requires confirmation).

-- 1. job_status: add standard values if missing
DO $$
BEGIN
  ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'requested';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'accepted';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'awaiting_approval';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'disputed';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

-- 2. cleaner_availability: add start_time, end_time, is_available if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cleaner_availability' AND column_name='start_time') THEN
    ALTER TABLE cleaner_availability ADD COLUMN start_time TIME;
    ALTER TABLE cleaner_availability ADD COLUMN end_time TIME;
    UPDATE cleaner_availability SET start_time='08:00'::TIME, end_time='20:00'::TIME WHERE start_time IS NULL;
    ALTER TABLE cleaner_availability ALTER COLUMN start_time SET NOT NULL;
    ALTER TABLE cleaner_availability ALTER COLUMN end_time SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cleaner_availability' AND column_name='is_available') THEN
    ALTER TABLE cleaner_availability ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT true;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 3. jobs: add address, credit_amount, latitude, longitude, rating, estimated_hours if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='address') THEN
    ALTER TABLE jobs ADD COLUMN address TEXT;
    UPDATE jobs SET address = '123 Test St' WHERE address IS NULL;
    ALTER TABLE jobs ALTER COLUMN address SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='credit_amount') THEN
    ALTER TABLE jobs ADD COLUMN credit_amount INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='latitude') THEN
    ALTER TABLE jobs ADD COLUMN latitude NUMERIC(9,6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='longitude') THEN
    ALTER TABLE jobs ADD COLUMN longitude NUMERIC(9,6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='rating') THEN
    ALTER TABLE jobs ADD COLUMN rating INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='estimated_hours') THEN
    ALTER TABLE jobs ADD COLUMN estimated_hours NUMERIC(4,2) DEFAULT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='client_notes') THEN
    ALTER TABLE jobs ADD COLUMN client_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='cleaning_type') THEN
    ALTER TABLE jobs ADD COLUMN cleaning_type TEXT NOT NULL DEFAULT 'basic';
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 4. cleaner_availability: ensure unique constraint for ON CONFLICT (setDayAvailability)
DO $$
BEGIN
  ALTER TABLE cleaner_availability ADD CONSTRAINT unique_cleaner_day UNIQUE (cleaner_id, day_of_week);
EXCEPTION WHEN undefined_table OR duplicate_object OR duplicate_table THEN NULL;
END $$;

-- 5. jobs: allow cleaner_id NULL for requested jobs (if currently NOT NULL)
DO $$
BEGIN
  ALTER TABLE jobs ALTER COLUMN cleaner_id DROP NOT NULL;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

-- 6. jobs: set cleaning_type default for existing NOT NULL column
DO $$
BEGIN
  ALTER TABLE jobs ALTER COLUMN cleaning_type SET DEFAULT 'basic';
  UPDATE jobs SET cleaning_type = 'basic' WHERE cleaning_type IS NULL;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

-- 6b. jobs: add pricing_snapshot (V3 tier-aware pricing) if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='pricing_snapshot') THEN
    ALTER TABLE jobs ADD COLUMN pricing_snapshot JSONB;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 7. payouts: add job_id, stripe_transfer_id if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payouts' AND column_name='job_id') THEN
    ALTER TABLE payouts ADD COLUMN job_id UUID REFERENCES jobs(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payouts' AND column_name='stripe_transfer_id') THEN
    ALTER TABLE payouts ADD COLUMN stripe_transfer_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payouts' AND column_name='amount_cents') THEN
    ALTER TABLE payouts ADD COLUMN amount_cents INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payouts' AND column_name='amount_credits') THEN
    ALTER TABLE payouts ADD COLUMN amount_credits INTEGER NOT NULL DEFAULT 0;
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 8. Fix payouts.cleaner_id FK to reference users(id) (Neon test DB may reference wrong table)
DO $$
BEGIN
  ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_cleaner_id_fkey;
  ALTER TABLE payouts ADD CONSTRAINT payouts_cleaner_id_fkey
    FOREIGN KEY (cleaner_id) REFERENCES users(id) ON DELETE RESTRICT;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

-- 9. Fix cleaner_availability.cleaner_id FK to reference users(id)
DO $$
BEGIN
  ALTER TABLE cleaner_availability DROP CONSTRAINT IF EXISTS cleaner_availability_cleaner_id_fkey;
  ALTER TABLE cleaner_availability ADD CONSTRAINT cleaner_availability_cleaner_id_fkey
    FOREIGN KEY (cleaner_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

-- 10. Fix is_cleaner_available for uuid/text mismatch (Neon may have cleaner_id as UUID)
CREATE OR REPLACE FUNCTION is_cleaner_available(
  p_cleaner_id TEXT,
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

  SELECT EXISTS (
    SELECT 1 FROM cleaner_availability
    WHERE cleaner_id::text = p_cleaner_id
      AND day_of_week = v_day_of_week
      AND is_available = true
      AND v_time >= start_time
      AND v_time < end_time
  ) INTO v_has_availability;

  IF NOT v_has_availability THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM cleaner_time_off
    WHERE cleaner_id::text = p_cleaner_id
      AND p_datetime::DATE BETWEEN start_date AND end_date
      AND (all_day = true OR (
        p_datetime::TIME >= start_time AND p_datetime::TIME < end_time
      ))
  ) INTO v_has_time_off;

  RETURN NOT v_has_time_off;
END;
$$ LANGUAGE plpgsql STABLE;

-- 11. Add job.auto_assigned to job_event_type enum if it exists
DO $$
BEGIN
  ALTER TYPE job_event_type ADD VALUE 'job.auto_assigned';
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
