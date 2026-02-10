-- 906_durable_jobs.sql
-- Durable job queue for Section 6: one row per logical job; idempotency by (job_type, idempotency_key).
-- Workers claim via FOR UPDATE SKIP LOCKED; crash recovery via locked_at timeout.
-- ROLLBACK: DROP TABLE IF EXISTS durable_jobs;

CREATE TABLE IF NOT EXISTS durable_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|retrying|dead
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  max_attempts   INTEGER NOT NULL DEFAULT 5,
  run_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at      TIMESTAMPTZ,
  locked_by      TEXT,
  payload_json   JSONB,
  result_json    JSONB,
  error_message  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_durable_jobs_type_key UNIQUE (job_type, idempotency_key),
  CONSTRAINT chk_durable_jobs_status CHECK (status IN ('pending','running','completed','failed','retrying','dead'))
);

CREATE INDEX IF NOT EXISTS idx_durable_jobs_pending
  ON durable_jobs (run_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_durable_jobs_type_status
  ON durable_jobs (job_type, status, run_at);

CREATE INDEX IF NOT EXISTS idx_durable_jobs_locked
  ON durable_jobs (locked_at) WHERE status = 'running';

COMMENT ON TABLE durable_jobs IS 'Section 6: durable job queue; crons enqueue here; workers process with FOR UPDATE SKIP LOCKED';
