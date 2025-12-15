-- 904_worker_runs_table.sql
-- Track worker execution for observability + concurrency guard patterns.

CREATE TABLE IF NOT EXISTS worker_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running', -- running|success|failed
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  processed     INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB,
  error_message TEXT
);

-- Query helper
CREATE INDEX IF NOT EXISTS idx_worker_runs_name_started
  ON worker_runs (worker_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_runs_status
  ON worker_runs (status, started_at DESC);

