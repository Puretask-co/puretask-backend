-- 032_federal_holidays_policy.sql
-- Federal holiday policy: source of truth, cleaner availability, and payout runs
-- NOTE: Uses TEXT for cleaner_id to match existing users.id column type

-- 1) Federal holidays source of truth
CREATE TABLE IF NOT EXISTS holidays (
  holiday_date       DATE PRIMARY KEY,
  name               TEXT NOT NULL,
  is_federal         BOOLEAN NOT NULL DEFAULT true,
  bank_holiday       BOOLEAN NOT NULL DEFAULT true,
  support_limited    BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holidays_is_federal ON holidays (is_federal);
CREATE INDEX IF NOT EXISTS idx_holidays_bank_holiday ON holidays (bank_holiday);

CREATE TRIGGER trg_holidays_updated_at
BEFORE UPDATE ON holidays
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- 2) Cleaner global holiday settings
CREATE TABLE IF NOT EXISTS cleaner_holiday_settings (
  cleaner_id                    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  available_on_federal_holidays BOOLEAN NOT NULL DEFAULT false,
  holiday_rate_enabled          BOOLEAN NOT NULL DEFAULT false,
  holiday_rate_multiplier       NUMERIC(6,3) NOT NULL DEFAULT 1.150,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_holiday_rate_multiplier
    CHECK (holiday_rate_multiplier >= 1.000 AND holiday_rate_multiplier <= 2.000)
);

CREATE TRIGGER trg_cleaner_holiday_settings_updated_at
BEFORE UPDATE ON cleaner_holiday_settings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- 3) Cleaner per-holiday overrides (per date)
CREATE TABLE IF NOT EXISTS cleaner_holiday_overrides (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  holiday_date     DATE NOT NULL REFERENCES holidays (holiday_date) ON DELETE CASCADE,
  available        BOOLEAN NOT NULL DEFAULT false,
  start_time_local TIME,
  end_time_local   TIME,
  use_holiday_rate BOOLEAN,
  min_job_hours    NUMERIC(4,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cleaner_holiday_override UNIQUE (cleaner_id, holiday_date),
  CONSTRAINT chk_time_window_valid
    CHECK (
      (start_time_local IS NULL AND end_time_local IS NULL)
      OR (start_time_local IS NOT NULL AND end_time_local IS NOT NULL AND end_time_local > start_time_local)
    ),
  CONSTRAINT chk_min_job_hours
    CHECK (min_job_hours IS NULL OR (min_job_hours >= 0.5 AND min_job_hours <= 24))
);

CREATE INDEX IF NOT EXISTS idx_cleaner_holiday_overrides_cleaner_date
  ON cleaner_holiday_overrides (cleaner_id, holiday_date);

CREATE TRIGGER trg_cleaner_holiday_overrides_updated_at
BEFORE UPDATE ON cleaner_holiday_overrides
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- 4) Payout runs (adjusts for bank holidays)
CREATE TABLE IF NOT EXISTS payout_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_for_date  DATE NOT NULL,
  initiate_on_date    DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'queued',
  initiated_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payout_runs_status
    CHECK (status IN ('queued','processing','submitted','failed','completed'))
);

CREATE INDEX IF NOT EXISTS idx_payout_runs_initiate_on_date ON payout_runs (initiate_on_date);
CREATE INDEX IF NOT EXISTS idx_payout_runs_scheduled_for_date ON payout_runs (scheduled_for_date);

CREATE TRIGGER trg_payout_runs_updated_at
BEFORE UPDATE ON payout_runs
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- 5) Business-day helpers
CREATE OR REPLACE FUNCTION is_bank_holiday(d DATE)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM holidays h
    WHERE h.holiday_date = d AND h.bank_holiday = true
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION previous_business_day(d DATE)
RETURNS DATE AS $$
DECLARE
  x DATE := d - 1;
BEGIN
  WHILE (EXTRACT(ISODOW FROM x) IN (6,7)) OR is_bank_holiday(x) LOOP
    x := x - 1;
  END LOOP;
  RETURN x;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION payout_initiate_date(scheduled DATE)
RETURNS DATE AS $$
BEGIN
  IF EXTRACT(ISODOW FROM scheduled) IN (6,7) THEN
    scheduled := previous_business_day(scheduled + 1);
  END IF;

  IF is_bank_holiday(scheduled) THEN
    RETURN previous_business_day(scheduled);
  END IF;

  RETURN scheduled;
END;
$$ LANGUAGE plpgsql STABLE;
