-- Migration 056: Marketplace Health Governor (Step 18)
-- Regional thermostat: supply/demand/quality inputs -> safe output knobs.

-- Rolling regional metrics (computed by scheduler)
CREATE TABLE IF NOT EXISTS region_marketplace_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  active_cleaners INTEGER NOT NULL DEFAULT 0,
  available_cleaners INTEGER NOT NULL DEFAULT 0,
  job_requests INTEGER NOT NULL DEFAULT 0,
  jobs_booked INTEGER NOT NULL DEFAULT 0,
  median_fill_minutes INTEGER NULL,
  cancel_rate NUMERIC NULL,
  dispute_rate NUMERIC NULL,
  avg_rating NUMERIC NULL,
  on_time_rate NUMERIC NULL,
  acceptance_rate NUMERIC NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_region_metrics_region_time
  ON region_marketplace_metrics (region_id, window_end DESC);

-- Computed governor state (what runtime uses)
CREATE TABLE IF NOT EXISTS region_governor_state (
  region_id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('undersupply','balanced','oversupply','quality_risk')),
  visibility_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  early_exposure_minutes INTEGER NOT NULL DEFAULT 0,
  acceptance_strictness_factor NUMERIC NOT NULL DEFAULT 1.0,
  quality_emphasis_factor NUMERIC NOT NULL DEFAULT 1.0,
  cash_rewards_enabled BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NULL,
  based_on_window_end TIMESTAMPTZ NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Override + audit history
CREATE TABLE IF NOT EXISTS region_governor_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('compute','override','enable','disable','config_update')),
  actor TEXT NULL,
  before_state JSONB NULL,
  after_state JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governor_audit_region_time
  ON region_governor_audit (region_id, created_at DESC);

-- Seed global state (balanced defaults)
INSERT INTO region_governor_state (region_id, state, reason)
VALUES ('__global__', 'balanced', 'no_metrics')
ON CONFLICT (region_id) DO NOTHING;

SELECT 'Migration 056 Completed' AS status;
