-- 001_core_schema.sql
-- PureTask core database schema (v1)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================
-- ENUM TYPES
-- ============================

CREATE TYPE user_role AS ENUM ('client', 'cleaner', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');

CREATE TYPE job_status AS ENUM (
  'created',
  'request',
  'accepted',
  'en_route',
  'in_progress',
  'awaiting_client',
  'approved',
  'disputed',
  'cancelled'
);

CREATE TYPE cleaning_type AS ENUM ('basic', 'deep', 'moveout');

CREATE TYPE dispute_status AS ENUM ('open', 'resolved_client', 'resolved_cleaner', 'resolved_split');
CREATE TYPE earning_status AS ENUM ('pending', 'paid', 'failed');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');

CREATE TYPE credit_tx_type AS ENUM (
  'purchase',
  'hold',
  'release',
  'charge',
  'refund',
  'adjustment'
);

CREATE TYPE photo_type AS ENUM ('before', 'after');

CREATE TYPE actor_type AS ENUM ('client', 'cleaner', 'system', 'admin');

-- ============================
-- USERS
-- ============================

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role              user_role NOT NULL,
  status            user_status NOT NULL DEFAULT 'active',

  full_name         TEXT NOT NULL,
  email             CITEXT UNIQUE,
  phone_e164        TEXT UNIQUE,

  password_hash     TEXT,
  auth_provider     TEXT,
  auth_provider_id  TEXT,

  wallet_credits_balance NUMERIC(12,2) NOT NULL DEFAULT 0,

  tier                TEXT,
  base_rate_cph       NUMERIC(8,2),
  deep_addon_cph      NUMERIC(8,2),
  moveout_addon_cph   NUMERIC(8,2),

  reliability_score   NUMERIC(5,2),
  payout_percentage   NUMERIC(5,4),
  stripe_connect_id   TEXT,
  avg_rating          NUMERIC(3,2),
  jobs_completed      INTEGER NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================
-- JOBS
-- ============================

CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id       UUID NOT NULL REFERENCES users(id),
  cleaner_id      UUID REFERENCES users(id),

  status          job_status NOT NULL DEFAULT 'created',
  cleaning_type   cleaning_type NOT NULL,

  scheduled_start_at TIMESTAMPTZ,
  scheduled_end_at   TIMESTAMPTZ,

  estimated_hours      NUMERIC(5,2),

  snapshot_base_rate_cph     NUMERIC(8,2),
  snapshot_addon_rate_cph    NUMERIC(8,2),
  snapshot_total_rate_cph    NUMERIC(8,2),

  payout_percentage_at_accept NUMERIC(5,4),

  escrow_credits_reserved NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_charge_credits    NUMERIC(12,2),
  refund_credits          NUMERIC(12,2),

  check_in_at       TIMESTAMPTZ,
  check_out_at      TIMESTAMPTZ,
  actual_hours      NUMERIC(5,2),
  check_in_lat      NUMERIC(9,6),
  check_in_lng      NUMERIC(9,6),
  check_out_lat     NUMERIC(9,6),
  check_out_lng     NUMERIC(9,6),

  cleaner_notes         TEXT,
  tasks_completed_json  JSONB,
  client_review_stars   INTEGER,
  client_review_text    TEXT,

  dispute_status    dispute_status,
  dispute_reason    TEXT,
  dispute_details   TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_client ON jobs(client_id);
CREATE INDEX idx_jobs_cleaner ON jobs(cleaner_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled_start ON jobs(scheduled_start_at);

-- ============================
-- CREDIT TRANSACTIONS (LEDGER)
-- ============================

CREATE TABLE credit_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users(id),
  job_id          UUID REFERENCES jobs(id),
  type            credit_tx_type NOT NULL,
  amount_credits  NUMERIC(12,2) NOT NULL,
  balance_after   NUMERIC(12,2),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_tx_client ON credit_transactions(client_id);
CREATE INDEX idx_credit_tx_job ON credit_transactions(job_id);
CREATE INDEX idx_credit_tx_created_at ON credit_transactions(created_at);

-- ============================
-- JOB PHOTOS
-- ============================

CREATE TABLE job_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  cleaner_id      UUID NOT NULL REFERENCES users(id),
  photo_url       TEXT NOT NULL,
  type            photo_type NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_photos_job_type ON job_photos(job_id, type);

-- ============================
-- MESSAGES (CHAT)
-- ============================

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sender_role     actor_type NOT NULL,
  sender_id       UUID NOT NULL REFERENCES users(id),
  receiver_id     UUID REFERENCES users(id),
  body            TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ
);

CREATE INDEX idx_messages_job ON messages(job_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);

-- ============================
-- CLEANER EARNINGS
-- ============================

CREATE TABLE cleaner_earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users(id),
  job_id          UUID NOT NULL REFERENCES jobs(id),
  credits_earned  NUMERIC(12,2) NOT NULL,
  payout_percentage NUMERIC(5,4) NOT NULL,
  usd_due         NUMERIC(12,2) NOT NULL,
  status          earning_status NOT NULL DEFAULT 'pending',
  payout_id       UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cleaner_earnings_cleaner_status
  ON cleaner_earnings(cleaner_id, status);
CREATE INDEX idx_cleaner_earnings_job ON cleaner_earnings(job_id);

-- ============================
-- PAYOUTS
-- ============================

CREATE TABLE payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users(id),
  total_usd       NUMERIC(12,2) NOT NULL,
  payout_method   TEXT,
  stripe_transfer_id TEXT,
  status          payout_status NOT NULL DEFAULT 'pending',
  scheduled_for   DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payouts_cleaner_status
  ON payouts(cleaner_id, status);

ALTER TABLE cleaner_earnings
  ADD CONSTRAINT cleaner_earnings_payout_id_fkey
    FOREIGN KEY (payout_id) REFERENCES payouts(id);

-- ============================
-- APP EVENTS (LOGGING)
-- ============================

CREATE TABLE app_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID REFERENCES jobs(id),
  actor_type      actor_type,
  actor_id        UUID REFERENCES users(id),
  event_name      TEXT NOT NULL,
  payload_json    JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_events_job ON app_events(job_id);
CREATE INDEX idx_app_events_event_name ON app_events(event_name);
CREATE INDEX idx_app_events_occurred_at ON app_events(occurred_at);
