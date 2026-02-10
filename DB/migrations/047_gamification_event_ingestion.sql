-- Migration 047: Gamification event ingestion
-- Append-only event log for metrics computation (metrics_contract_v1).
-- See docs/active/EVENT_CONTRACT.md
-- Uses TEXT for cleaner_id to match users.id; see DB/neon/ for UUID variant

-- 1) Generic immutable event log (append-only)
CREATE TABLE IF NOT EXISTS pt_event_log (
  event_id            UUID PRIMARY KEY,
  event_type          TEXT NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('mobile','web','server','admin','system')),
  idempotency_key     TEXT,
  cleaner_id          TEXT,
  client_id           TEXT,
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_pt_event_log_idempotency
  ON pt_event_log (event_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2) Engagement sessions (fast meaningful-login calculations)
CREATE TABLE IF NOT EXISTS pt_engagement_sessions (
  session_id          UUID PRIMARY KEY,
  cleaner_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  cleaner_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_at         TIMESTAMPTZ NOT NULL,
  action              TEXT NOT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_engagement_actions_cleaner_time ON pt_engagement_actions (cleaner_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_pt_engagement_actions_session_time ON pt_engagement_actions (session_id, occurred_at);

COMMENT ON TABLE pt_event_log IS 'Append-only event stream for gamification metrics';
COMMENT ON TABLE pt_engagement_sessions IS 'Cleaner app sessions for meaningful login computation';
COMMENT ON TABLE pt_engagement_actions IS 'Meaningful actions within sessions (anti-gaming)';

SELECT 'Migration 047 Completed' AS status;
