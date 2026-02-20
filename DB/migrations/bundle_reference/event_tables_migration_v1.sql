-- Event ingestion tables for Gamification (v1)
-- These tables are the minimal source-of-truth event stream required for metrics_contract_v1.

BEGIN;

-- 1) Generic immutable event log (append-only)
CREATE TABLE IF NOT EXISTS pt_event_log (
  event_id            UUID PRIMARY KEY,
  event_type          TEXT NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('mobile','web','server','admin','system')),
  idempotency_key     TEXT,
  cleaner_id          UUID,
  client_id           UUID,
  job_id              UUID,
  job_request_id      UUID,
  region_id           TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_event_log_occurred_at ON pt_event_log (occurred_at);
CREATE INDEX IF NOT EXISTS idx_pt_event_log_type_time ON pt_event_log (event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_pt_event_log_cleaner_time ON pt_event_log (cleaner_id, occurred_at) WHERE cleaner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_event_log_job_time ON pt_event_log (job_id, occurred_at) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_event_log_request_time ON pt_event_log (job_request_id, occurred_at) WHERE job_request_id IS NOT NULL;

-- Optional: enforce idempotency for sources that provide keys
CREATE UNIQUE INDEX IF NOT EXISTS uq_pt_event_log_idempotency
  ON pt_event_log (event_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2) Engagement sessions table (for fast meaningful-login calculations)
CREATE TABLE IF NOT EXISTS pt_engagement_sessions (
  session_id          UUID PRIMARY KEY,
  cleaner_id          UUID NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('mobile','web')),
  timezone            TEXT,
  device_platform     TEXT,
  app_version         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_engagement_sessions_cleaner_started ON pt_engagement_sessions (cleaner_id, started_at);

-- 3) Meaningful actions (linked to sessions)
CREATE TABLE IF NOT EXISTS pt_engagement_actions (
  action_id           UUID PRIMARY KEY,
  session_id          UUID NOT NULL REFERENCES pt_engagement_sessions(session_id) ON DELETE CASCADE,
  cleaner_id          UUID NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL,
  action              TEXT NOT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_engagement_actions_cleaner_time ON pt_engagement_actions (cleaner_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_pt_engagement_actions_session_time ON pt_engagement_actions (session_id, occurred_at);

-- 4) Safety reports (optional photo; required note if no photo enforced at application layer)
CREATE TABLE IF NOT EXISTS pt_safety_reports (
  report_id           UUID PRIMARY KEY,
  cleaner_id          UUID NOT NULL,
  job_request_id      UUID,
  occurred_at         TIMESTAMPTZ NOT NULL,
  note               TEXT NOT NULL,
  photo_id            UUID,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_safety_reports_cleaner_time ON pt_safety_reports (cleaner_id, occurred_at);

COMMIT;
