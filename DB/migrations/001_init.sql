-- Enable extensions (if allowed on your Neon project)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-------------------------
-- ENUM TYPES
-------------------------

CREATE TYPE user_role AS ENUM ('client', 'cleaner', 'admin');

CREATE TYPE job_status AS ENUM (
  'requested',
  'accepted',
  'on_my_way',
  'in_progress',
  'awaiting_approval',
  'completed',
  'disputed',
  'cancelled'
);

CREATE TYPE payout_status AS ENUM ('pending', 'paid', 'failed');

CREATE TYPE dispute_status AS ENUM ('open', 'resolved_refund', 'resolved_no_refund');

CREATE TYPE credit_reason AS ENUM (
  'purchase',
  'job_escrow',
  'job_release',
  'refund',
  'adjustment'
);

-------------------------
-- USERS & PROFILES
-------------------------

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'client',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users (role);

CREATE TABLE client_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  default_address TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cleaner_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  tier                    TEXT NOT NULL DEFAULT 'bronze', -- bronze/silver/gold/platinum
  reliability_score       NUMERIC(5,2) NOT NULL DEFAULT 100.0, -- 0–100
  hourly_rate_credits     INTEGER NOT NULL DEFAULT 0,
  stripe_connect_id       TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cleaner_profiles_reliability ON cleaner_profiles (reliability_score DESC);
CREATE INDEX idx_cleaner_profiles_tier ON cleaner_profiles (tier);

-------------------------
-- JOBS & EVENTS
-------------------------

CREATE TABLE jobs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  cleaner_id              UUID REFERENCES users (id) ON DELETE SET NULL,
  status                  job_status NOT NULL DEFAULT 'requested',

  scheduled_start_at      TIMESTAMPTZ NOT NULL,
  scheduled_end_at        TIMESTAMPTZ NOT NULL,
  actual_start_at         TIMESTAMPTZ,
  actual_end_at           TIMESTAMPTZ,

  address                 TEXT NOT NULL,
  latitude                NUMERIC(9,6),
  longitude               NUMERIC(9,6),

  credit_amount           INTEGER NOT NULL, -- credits escrowed for this job

  -- Optional: store rating/notes directly on job for quick querying
  rating                  INTEGER CHECK (rating BETWEEN 1 AND 5),
  client_notes            TEXT,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_client_id ON jobs (client_id);
CREATE INDEX idx_jobs_cleaner_id ON jobs (cleaner_id);
CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_scheduled_start ON jobs (scheduled_start_at);
CREATE INDEX idx_jobs_created_at ON jobs (created_at);

-- Job events: full audit log of lifecycle & actions

CREATE TABLE job_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  actor_type      TEXT NOT NULL, -- client/cleaner/admin/system
  actor_id        UUID,          -- nullable for 'system'
  event_type      TEXT NOT NULL, -- e.g. job.created, job.accepted, job.approved, ...
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_events_job_id ON job_events (job_id);
CREATE INDEX idx_job_events_event_type ON job_events (event_type);
CREATE INDEX idx_job_events_created_at ON job_events (created_at);

-------------------------
-- CREDITS & PAYMENTS
-------------------------

-- Credit ledger is source of truth for credit balances
-- balance = SUM(delta_credits) per user_id

CREATE TABLE credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs (id) ON DELETE SET NULL,
  delta_credits   INTEGER NOT NULL, -- + added, - deducted
  reason          credit_reason NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_user_id ON credit_ledger (user_id);
CREATE INDEX idx_credit_ledger_job_id ON credit_ledger (job_id);
CREATE INDEX idx_credit_ledger_created_at ON credit_ledger (created_at);

-- Stripe payment intents used for buying credits / paying for jobs

CREATE TABLE payment_intents (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                      UUID REFERENCES jobs (id) ON DELETE SET NULL,
  stripe_payment_intent_id    TEXT NOT NULL UNIQUE,
  status                      TEXT NOT NULL,
  amount_cents                INTEGER NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'usd',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_intents_job_id ON payment_intents (job_id);
CREATE INDEX idx_payment_intents_status ON payment_intents (status);

-------------------------
-- STRIPE EVENTS
-------------------------

CREATE TABLE stripe_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id   TEXT NOT NULL UNIQUE,
  type              TEXT NOT NULL,
  payload           JSONB NOT NULL,
  processed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ
);

CREATE INDEX idx_stripe_events_type ON stripe_events (type);
CREATE INDEX idx_stripe_events_processed ON stripe_events (processed);

-------------------------
-- PAYOUTS
-------------------------

CREATE TABLE payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id          UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  job_id              UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,

  stripe_transfer_id  TEXT UNIQUE,
  amount_credits      INTEGER NOT NULL,
  amount_cents        INTEGER NOT NULL,
  status              payout_status NOT NULL DEFAULT 'pending',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payouts_cleaner_id ON payouts (cleaner_id);
CREATE INDEX idx_payouts_job_id ON payouts (job_id);
CREATE INDEX idx_payouts_status ON payouts (status);

-------------------------
-- DISPUTES
-------------------------

CREATE TABLE disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

  status          dispute_status NOT NULL DEFAULT 'open',
  client_notes    TEXT NOT NULL,
  admin_notes     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_status ON disputes (status);
CREATE INDEX idx_disputes_client_id ON disputes (client_id);
CREATE INDEX idx_disputes_created_at ON disputes (created_at);

-------------------------
-- KPIs / METRICS
-------------------------

CREATE TABLE kpi_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE NOT NULL UNIQUE,

  total_jobs          INTEGER NOT NULL DEFAULT 0,
  completed_jobs      INTEGER NOT NULL DEFAULT 0,
  disputed_jobs       INTEGER NOT NULL DEFAULT 0,
  cancelled_jobs      INTEGER NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-------------------------
-- OPTIONAL: FAILED NOTIFICATIONS (for retries)
-------------------------

CREATE TABLE notification_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users (id) ON DELETE SET NULL,
  channel         TEXT NOT NULL, -- sms/email/push
  type            TEXT NOT NULL, -- e.g. job.reminder, job.assigned
  payload         JSONB NOT NULL,
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_failures_retry ON notification_failures (retry_count);
CREATE INDEX idx_notification_failures_created_at ON notification_failures (created_at);

-------------------------
-- BASIC TRIGGERS (OPTIONAL QUALITY-OF-LIFE)
-------------------------

-- Auto-update updated_at on tables
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_jobs_set_updated_at
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_payouts_set_updated_at
BEFORE UPDATE ON payouts
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_disputes_set_updated_at
BEFORE UPDATE ON disputes
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_client_profiles_set_updated_at
BEFORE UPDATE ON client_profiles
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_cleaner_profiles_set_updated_at
BEFORE UPDATE ON cleaner_profiles
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at_timestamp();

