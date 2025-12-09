-- ============================================================
-- PURETASK CONSOLIDATED SCHEMA - COMPLETE DATABASE
-- Run this on a FRESH database to set up everything correctly
-- ============================================================
-- Generated: 2024
-- Combines all migrations (001-019) in proper dependency order
-- ============================================================

-- ============================================
-- STEP 0: EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================
-- STEP 1: ENUM TYPES
-- ============================================

-- Core enums
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('client', 'cleaner', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE job_status AS ENUM (
  'requested', 'accepted', 'on_my_way', 'in_progress', 
  'awaiting_approval', 'completed', 'disputed', 'cancelled'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE payout_status AS ENUM ('pending', 'paid', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE dispute_status AS ENUM ('open', 'resolved_refund', 'resolved_no_refund'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE credit_reason AS ENUM (
  'purchase', 'job_escrow', 'job_release', 'refund', 'adjustment'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Reliability system enums
DO $$ BEGIN CREATE TYPE cleaner_event_type AS ENUM (
    'late_reschedule', 'cancel_24_48', 'cancel_lt24', 'no_show',
    'dispute_cleaner_at_fault', 'inconvenience_high', 'inconvenience_pattern',
    'streak_bonus', 'photo_compliance_bonus'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Client risk enums
DO $$ BEGIN CREATE TYPE client_risk_band AS ENUM ('normal', 'mild', 'elevated', 'high', 'critical'); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE client_risk_event_type AS ENUM (
    'late_reschedule_lt24', 'late_reschedule_pattern', 'cancel_24_48',
    'cancel_24_48_grace', 'cancel_lt24', 'cancel_lt24_grace',
    'cancel_after_decline', 'no_show', 'dispute_client_at_fault',
    'card_decline', 'chargeback', 'inconvenience_pattern_3',
    'inconvenience_pattern_5', 'abuse_flag'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Reschedule enums
DO $$ BEGIN CREATE TYPE reschedule_status AS ENUM ('pending', 'accepted', 'declined', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE reschedule_bucket AS ENUM ('lt24', '24_48', 'gt48'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================
-- STEP 2: BASE TABLES (No Foreign Keys to Other Tables)
-- ============================================

-- USERS table (base of everything)
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           CITEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'client',
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  referral_code   TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- CLIENT PROFILES
CREATE TABLE IF NOT EXISTS client_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  first_name              TEXT,
  last_name               TEXT,
  default_address         TEXT,
  stripe_customer_id      TEXT UNIQUE,
  push_token              TEXT,
  grace_cancellations_total INTEGER DEFAULT 2,
  grace_cancellations_used INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CLEANER PROFILES
CREATE TABLE IF NOT EXISTS cleaner_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  first_name               TEXT,
  last_name                TEXT,
  bio                      TEXT,
  tier                     TEXT NOT NULL DEFAULT 'bronze',
  reliability_score        NUMERIC(5,2) NOT NULL DEFAULT 100.0,
  reliability_last_computed TIMESTAMPTZ,
  hourly_rate_credits      INTEGER NOT NULL DEFAULT 0,
  base_rate_cph            NUMERIC(10,2),
  deep_addon_cph           NUMERIC(10,2),
  moveout_addon_cph        NUMERIC(10,2),
  avg_rating               NUMERIC(3,2),
  jobs_completed           INTEGER NOT NULL DEFAULT 0,
  low_flexibility_badge    BOOLEAN NOT NULL DEFAULT false,
  payout_percent           NUMERIC(5,2) DEFAULT 80,
  -- Stripe Connect
  stripe_connect_id        TEXT,
  stripe_account_id        TEXT,
  -- Availability settings
  latitude                 NUMERIC(9,6),
  longitude                NUMERIC(9,6),
  is_available             BOOLEAN DEFAULT true,
  travel_radius_km         NUMERIC(5,2) DEFAULT 50,
  max_jobs_per_day         INTEGER DEFAULT 5,
  accepts_high_risk        BOOLEAN DEFAULT false,
  -- Payout settings
  minimum_payout_cents     INTEGER DEFAULT 2500,
  payout_schedule          TEXT DEFAULT 'weekly',
  instant_payout_enabled   BOOLEAN DEFAULT false,
  -- Background check
  background_check_required BOOLEAN DEFAULT true,
  background_check_status   TEXT DEFAULT 'not_started',
  -- Tokens
  push_token               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_reliability ON cleaner_profiles (reliability_score DESC);
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_tier ON cleaner_profiles (tier);
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_user_id ON cleaner_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_stripe_account_id ON cleaner_profiles (stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- ============================================
-- STEP 3: CITIES & SERVICE AREAS (before properties)
-- ============================================

CREATE TABLE IF NOT EXISTS cities (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  country_code    TEXT NOT NULL DEFAULT 'US',
  state_region    TEXT,
  timezone        TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_service_areas (
  id              SERIAL PRIMARY KEY,
  city_id         INT NOT NULL REFERENCES cities(id),
  name            TEXT NOT NULL,
  zip_codes       TEXT[] NOT NULL,
  base_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 4: PROPERTIES (before jobs)
-- ============================================

CREATE TABLE IF NOT EXISTS properties (
  id              SERIAL PRIMARY KEY,
  client_id       UUID NOT NULL REFERENCES users(id),
  service_area_id INT REFERENCES platform_service_areas(id),
  label           TEXT NOT NULL,
  address_line1   TEXT NOT NULL,
  address_line2   TEXT,
  city            TEXT NOT NULL,
  state_region    TEXT,
  postal_code     TEXT,
  country_code    TEXT NOT NULL DEFAULT 'US',
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  notes           TEXT,
  bedrooms        INT,
  bathrooms       NUMERIC(3,1),
  square_feet     INT,
  has_pets        BOOLEAN DEFAULT FALSE,
  has_kids        BOOLEAN DEFAULT FALSE,
  cleaning_score  NUMERIC(5,2) NOT NULL DEFAULT 100,
  last_basic_at   TIMESTAMPTZ,
  last_deep_at    TIMESTAMPTZ,
  last_moveout_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_client ON properties (client_id);

-- ADDRESSES table (user addresses)
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    country TEXT NOT NULL DEFAULT 'US',
    lat NUMERIC(9,6),
    lng NUMERIC(9,6),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- ============================================
-- STEP 5: TEAMS (before jobs)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_teams (
  id              SERIAL PRIMARY KEY,
  owner_cleaner_id UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  description     TEXT,
  max_members     INT NOT NULL DEFAULT 5,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id          SERIAL PRIMARY KEY,
  team_id     INT NOT NULL REFERENCES cleaner_teams(id) ON DELETE CASCADE,
  cleaner_id  UUID NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL DEFAULT 'member',
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, cleaner_id)
);

-- ============================================
-- STEP 6: JOBS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS jobs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  cleaner_id              UUID REFERENCES users (id) ON DELETE SET NULL,
  property_id             INT REFERENCES properties(id),
  address_id              UUID REFERENCES addresses(id),
  team_id                 INT REFERENCES cleaner_teams(id),
  status                  job_status NOT NULL DEFAULT 'requested',
  scheduled_start_at      TIMESTAMPTZ NOT NULL,
  scheduled_end_at        TIMESTAMPTZ NOT NULL,
  actual_start_at         TIMESTAMPTZ,
  actual_end_at           TIMESTAMPTZ,
  address                 TEXT NOT NULL,
  latitude                NUMERIC(9,6),
  longitude               NUMERIC(9,6),
  credit_amount           INTEGER NOT NULL,
  cleaning_type           TEXT,
  duration_hours          NUMERIC(4,2),
  price_credits           INTEGER,
  held_credits            INTEGER DEFAULT 0,
  rating                  INTEGER CHECK (rating BETWEEN 1 AND 5),
  client_notes            TEXT,
  notes_client            TEXT,
  notes_cleaner           TEXT,
  cleaner_payout_amount_cents INTEGER,
  is_rush                 BOOLEAN DEFAULT false,
  rush_fee_credits        INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs (client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_cleaner_id ON jobs (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs (scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_cleaner_date ON jobs(cleaner_id, scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_start ON jobs(status, scheduled_start_at);

-- ============================================
-- STEP 7: CREDIT SYSTEM
-- ============================================

-- Credit ledger (source of truth)
CREATE TABLE IF NOT EXISTS credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs (id) ON DELETE SET NULL,
  delta_credits   INTEGER NOT NULL,
  reason          credit_reason NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_job_id ON credit_ledger (job_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_balance ON credit_ledger (user_id, created_at);

-- Credit accounts (balance cache)
CREATE TABLE IF NOT EXISTS credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_balance INTEGER NOT NULL DEFAULT 0,
    held_balance INTEGER NOT NULL DEFAULT 0,
    lifetime_purchased INTEGER NOT NULL DEFAULT 0,
    lifetime_spent INTEGER NOT NULL DEFAULT 0,
    lifetime_refunded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'hold', 'release', 'refund', 'adjustment', 'payout', 'bonus', 'expiry')),
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit purchases
CREATE TABLE IF NOT EXISTS credit_purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  package_id      TEXT NOT NULL,
  credits_amount  INTEGER NOT NULL,
  price_usd       NUMERIC(10,2) NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Credit bonuses
CREATE TABLE IF NOT EXISTS credit_bonuses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bonus_type      TEXT NOT NULL,
  amount          INTEGER NOT NULL,
  week_of_year    INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  source          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 8: PAYMENTS & PAYOUTS
-- ============================================

-- Payment intents
CREATE TABLE IF NOT EXISTS payment_intents (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                      UUID REFERENCES jobs (id) ON DELETE SET NULL,
  client_id                   UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_payment_intent_id    TEXT NOT NULL UNIQUE,
  status                      TEXT NOT NULL,
  amount_cents                INTEGER NOT NULL,
  currency                    TEXT NOT NULL DEFAULT 'usd',
  purpose                     TEXT NOT NULL DEFAULT 'wallet_topup',
  credits_amount              INTEGER,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payouts
CREATE TABLE IF NOT EXISTS payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id          UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  job_id              UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  stripe_transfer_id  TEXT UNIQUE,
  stripe_payout_id    TEXT,
  amount_credits      INTEGER NOT NULL,
  amount_cents        INTEGER NOT NULL,
  total_usd           NUMERIC(10,2),
  status              payout_status NOT NULL DEFAULT 'pending',
  failure_reason      TEXT,
  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_cleaner_id ON payouts (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts (status);

-- Payout adjustments
CREATE TABLE IF NOT EXISTS payout_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id       UUID REFERENCES payouts (id) ON DELETE SET NULL,
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  stripe_reversal_id TEXT,
  initiated_by    UUID REFERENCES users (id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Payout retry queue
CREATE TABLE IF NOT EXISTS payout_retry_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id       UUID NOT NULL REFERENCES payouts (id) ON DELETE CASCADE,
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_cents    INTEGER NOT NULL,
  stripe_account_id TEXT,
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  next_retry_at   TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payout requests
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_credits INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    decided_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    payout_id UUID REFERENCES payouts(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cleaner earnings
CREATE TABLE IF NOT EXISTS cleaner_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    amount_credits INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    platform_fee_cents INTEGER NOT NULL,
    net_amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid', 'held')),
    available_at TIMESTAMPTZ,
    payout_id UUID REFERENCES payouts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 9: STRIPE
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id   TEXT NOT NULL UNIQUE,
  type              TEXT NOT NULL,
  payload           JSONB NOT NULL,
  processed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    default_payment_method_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    stripe_account_id TEXT NOT NULL UNIQUE,
    charges_enabled BOOLEAN NOT NULL DEFAULT false,
    payouts_enabled BOOLEAN NOT NULL DEFAULT false,
    details_submitted BOOLEAN NOT NULL DEFAULT false,
    onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 10: JOB EVENTS & HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS job_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  actor_type      TEXT NOT NULL,
  actor_id        UUID,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events (job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_event_type ON job_events (event_type);

CREATE TABLE IF NOT EXISTS job_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by_user_id UUID REFERENCES users(id),
    changed_by_type TEXT CHECK (changed_by_type IN ('client', 'cleaner', 'admin', 'system')),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    cleaner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('check_in', 'check_out')),
    lat NUMERIC(9,6),
    lng NUMERIC(9,6),
    distance_from_job_meters NUMERIC(10,2),
    is_within_radius BOOLEAN,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 11: DISPUTES
-- ============================================

CREATE TABLE IF NOT EXISTS disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  opened_by_user_id UUID REFERENCES users(id),
  status          dispute_status NOT NULL DEFAULT 'open',
  client_notes    TEXT NOT NULL,
  admin_notes     TEXT,
  reason_code     TEXT,
  description     TEXT,
  resolution_type TEXT,
  resolution_notes TEXT,
  refund_amount_credits INTEGER,
  resolved_by_user_id UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  job_completed_at TIMESTAMPTZ,
  within_window   BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes (status);

CREATE TABLE IF NOT EXISTS dispute_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('client', 'cleaner', 'admin', 'system')),
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 12: PHOTOS
-- ============================================

CREATE TABLE IF NOT EXISTS job_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  uploaded_by  UUID NOT NULL REFERENCES users (id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('before', 'after')),
  url          TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size    INTEGER,
  mime_type    TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON job_photos (job_id);

CREATE TABLE IF NOT EXISTS photo_compliance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
  cleaner_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  total_photos     INTEGER NOT NULL DEFAULT 0,
  before_photos    INTEGER NOT NULL DEFAULT 0,
  after_photos     INTEGER NOT NULL DEFAULT 0,
  meets_minimum    BOOLEAN NOT NULL DEFAULT false,
  bonus_applied    BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 13: NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  email_enabled   BOOLEAN NOT NULL DEFAULT true,
  sms_enabled     BOOLEAN NOT NULL DEFAULT false,
  push_enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users (id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,
  type            TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notification_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users (id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,
  type            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
    subject TEXT,
    title TEXT,
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users (id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,
  type            TEXT NOT NULL,
  recipient       TEXT NOT NULL,
  subject         TEXT,
  status          TEXT NOT NULL,
  provider_id     TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token           TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_token UNIQUE (user_id, token)
);

-- ============================================
-- STEP 14: AVAILABILITY
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_available    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_cleaner_day UNIQUE (cleaner_id, day_of_week),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS cleaner_time_off (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  all_day         BOOLEAN NOT NULL DEFAULT true,
  start_time      TIME,
  end_time        TIME,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS cleaner_service_areas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  zip_code        TEXT,
  city            TEXT,
  state           TEXT,
  radius_miles    INTEGER,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cleaner_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id          UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  max_jobs_per_day    INTEGER NOT NULL DEFAULT 5,
  min_job_duration_h  NUMERIC(3,1) NOT NULL DEFAULT 1.0,
  max_job_duration_h  NUMERIC(3,1) NOT NULL DEFAULT 8.0,
  accepts_pets        BOOLEAN NOT NULL DEFAULT true,
  accepts_deep_clean  BOOLEAN NOT NULL DEFAULT true,
  accepts_move_out    BOOLEAN NOT NULL DEFAULT true,
  has_own_supplies    BOOLEAN NOT NULL DEFAULT false,
  has_vehicle         BOOLEAN NOT NULL DEFAULT true,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability_blocks (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id UUID NOT NULL REFERENCES users(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_block_time_range CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS blackout_periods (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id UUID NOT NULL REFERENCES users(id),
    start_ts TIMESTAMPTZ NOT NULL,
    end_ts TIMESTAMPTZ NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_blackout_range CHECK (start_ts < end_ts)
);

-- ============================================
-- STEP 15: JOB OFFERS
-- ============================================

CREATE TABLE IF NOT EXISTS job_offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMPTZ NOT NULL,
  decline_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_job_cleaner_offer UNIQUE (job_id, cleaner_id)
);

-- ============================================
-- STEP 16: RELIABILITY SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_metrics (
    cleaner_id UUID PRIMARY KEY REFERENCES users(id),
    total_jobs_window INTEGER NOT NULL DEFAULT 0,
    attended_jobs INTEGER NOT NULL DEFAULT 0,
    no_show_jobs INTEGER NOT NULL DEFAULT 0,
    on_time_checkins INTEGER NOT NULL DEFAULT 0,
    photo_compliant_jobs INTEGER NOT NULL DEFAULT 0,
    communication_ok_jobs INTEGER NOT NULL DEFAULT 0,
    completion_ok_jobs INTEGER NOT NULL DEFAULT 0,
    ratings_sum NUMERIC(10,2) NOT NULL DEFAULT 0,
    ratings_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cleaner_events (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id UUID NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    event_type cleaner_event_type NOT NULL,
    weight INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_cleaner_events_cleaner_id ON cleaner_events(cleaner_id);

CREATE TABLE IF NOT EXISTS cleaner_weekly_streaks (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id UUID NOT NULL REFERENCES users(id),
    week_start DATE NOT NULL,
    is_streak BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cleaner_id, week_start)
);

CREATE TABLE IF NOT EXISTS reliability_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    tier TEXT,
    inputs JSONB NOT NULL,
    breakdown JSONB,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reliability_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  old_score       NUMERIC(5,2) NOT NULL,
  new_score       NUMERIC(5,2) NOT NULL,
  old_tier        TEXT NOT NULL,
  new_tier        TEXT NOT NULL,
  reason          TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cleaner_tier_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_tier TEXT,
    to_tier TEXT NOT NULL,
    reason TEXT,
    triggered_by TEXT CHECK (triggered_by IN ('system', 'admin')),
    triggered_by_user_id UUID REFERENCES users(id),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tier_locks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tier            TEXT NOT NULL,
  locked_until    TIMESTAMPTZ NOT NULL,
  reason          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_active_tier_lock UNIQUE (cleaner_id)
);

-- ============================================
-- STEP 17: CLIENT RISK SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS client_risk_scores (
    client_id UUID PRIMARY KEY REFERENCES users(id),
    risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    risk_band client_risk_band NOT NULL DEFAULT 'normal',
    last_recomputed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_risk_events (
    id BIGSERIAL PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    event_type client_risk_event_type NOT NULL,
    weight INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_client_risk_events_client_id ON client_risk_events(client_id);

-- ============================================
-- STEP 18: RESCHEDULE SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS reschedule_reason_codes (
    id SERIAL PRIMARY KEY,
    requester_type VARCHAR(10) NOT NULL CHECK (requester_type IN ('client', 'cleaner')),
    code VARCHAR(50) NOT NULL UNIQUE,
    reason_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reschedule_events (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    client_id UUID NOT NULL REFERENCES users(id),
    cleaner_id UUID NOT NULL REFERENCES users(id),
    requested_by VARCHAR(10) NOT NULL CHECK (requested_by IN ('client', 'cleaner')),
    requested_to VARCHAR(10) NOT NULL CHECK (requested_to IN ('client', 'cleaner')),
    t_request TIMESTAMPTZ NOT NULL,
    t_start_original TIMESTAMPTZ NOT NULL,
    t_start_new TIMESTAMPTZ NOT NULL,
    hours_before_original NUMERIC(10,2) NOT NULL,
    bucket reschedule_bucket NOT NULL,
    reason_code VARCHAR(50),
    status reschedule_status NOT NULL DEFAULT 'pending',
    declined_by VARCHAR(10) CHECK (declined_by IN ('client', 'cleaner')),
    decline_reason_code VARCHAR(50),
    is_reasonable BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reschedule_events_job_id ON reschedule_events(job_id);

-- ============================================
-- STEP 19: CANCELLATION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS cancellation_events (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    client_id UUID REFERENCES users(id),
    cleaner_id UUID REFERENCES users(id),
    cancelled_by VARCHAR(10) NOT NULL CHECK (cancelled_by IN ('client', 'cleaner', 'system', 'admin')),
    type VARCHAR(50),
    t_cancel TIMESTAMPTZ NOT NULL,
    hours_before_start NUMERIC(10,2),
    bucket VARCHAR(20),
    reason_code VARCHAR(100),
    after_reschedule_declined BOOLEAN NOT NULL DEFAULT false,
    fee_pct INTEGER NOT NULL DEFAULT 0,
    fee_credits INTEGER NOT NULL DEFAULT 0,
    refund_credits INTEGER NOT NULL DEFAULT 0,
    cleaner_comp_credits INTEGER NOT NULL DEFAULT 0,
    platform_comp_credits INTEGER NOT NULL DEFAULT 0,
    grace_used BOOLEAN NOT NULL DEFAULT false,
    bonus_credits_to_client INTEGER NOT NULL DEFAULT 0,
    is_emergency BOOLEAN NOT NULL DEFAULT false,
    job_status_at_cancellation VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_events_job_id ON cancellation_events(job_id);

CREATE TABLE IF NOT EXISTS grace_cancellations (
    id BIGSERIAL PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grace_cancellations_client_id ON grace_cancellations(client_id);

CREATE TABLE IF NOT EXISTS cancellation_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  cancelled_by    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  cancelled_by_role TEXT NOT NULL,
  cancellation_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_start   TIMESTAMPTZ NOT NULL,
  hours_before      NUMERIC(6,2) NOT NULL,
  penalty_applied   BOOLEAN NOT NULL DEFAULT false,
  penalty_credits   INTEGER,
  is_grace_period   BOOLEAN NOT NULL DEFAULT false,
  fee_percent       NUMERIC(5,2) DEFAULT 0,
  refund_credits    INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cleaner_no_shows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  cleaner_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bonus_credits    INTEGER NOT NULL DEFAULT 50,
  processed        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 20: MATCHING & INCONVENIENCE SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS match_recommendations (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    client_id UUID NOT NULL REFERENCES users(id),
    cleaner_id UUID NOT NULL REFERENCES users(id),
    match_score NUMERIC(6,4) NOT NULL,
    rank INTEGER NOT NULL,
    breakdown JSONB,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_recommendations_job_id ON match_recommendations(job_id);

CREATE TABLE IF NOT EXISTS inconvenience_logs (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    client_id UUID NOT NULL REFERENCES users(id),
    cleaner_id UUID NOT NULL REFERENCES users(id),
    caused_by VARCHAR(10) NOT NULL CHECK (caused_by IN ('client', 'cleaner')),
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 4),
    reason_link VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_inconvenience_logs_client_id ON inconvenience_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_inconvenience_logs_cleaner_id ON inconvenience_logs(cleaner_id);

-- ============================================
-- STEP 21: FLEXIBILITY SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_flex_profiles (
    cleaner_id UUID PRIMARY KEY REFERENCES users(id),
    reasonable_declines_14d INTEGER NOT NULL DEFAULT 0,
    reasonable_declines_30d INTEGER NOT NULL DEFAULT 0,
    low_flexibility_active BOOLEAN NOT NULL DEFAULT false,
    badge_assigned_at TIMESTAMPTZ,
    badge_removed_at TIMESTAMPTZ,
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flexibility_decline_events (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id UUID NOT NULL REFERENCES users(id),
    reschedule_event_id BIGINT REFERENCES reschedule_events(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_flex_profiles (
    client_id UUID PRIMARY KEY REFERENCES users(id),
    flex_score NUMERIC(3,2) NOT NULL DEFAULT 0.5,
    reschedules_30d INTEGER NOT NULL DEFAULT 0,
    late_reschedules_30d INTEGER NOT NULL DEFAULT 0,
    cancellations_30d INTEGER NOT NULL DEFAULT 0,
    last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- ============================================
-- STEP 22: REFERRALS & BOOSTS
-- ============================================

CREATE TABLE IF NOT EXISTS referral_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code            TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL DEFAULT 'standard',
  reward_credits  INTEGER NOT NULL DEFAULT 20,
  referee_credits INTEGER NOT NULL DEFAULT 10,
  max_uses        INTEGER,
  uses_count      INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  referee_id      UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
  referral_code   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  referee_role    TEXT NOT NULL,
  jobs_required   INTEGER NOT NULL DEFAULT 3,
  jobs_completed  INTEGER NOT NULL DEFAULT 0,
  referrer_reward INTEGER NOT NULL DEFAULT 20,
  referee_reward  INTEGER NOT NULL DEFAULT 10,
  rewarded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cleaner_boosts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  boost_type      TEXT NOT NULL DEFAULT 'standard',
  credits_spent   INTEGER NOT NULL,
  multiplier      NUMERIC(3,2) NOT NULL DEFAULT 1.5,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  jobs_during     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_boosts_active ON cleaner_boosts (status, ends_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS rush_job_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_hours_ahead INTEGER NOT NULL DEFAULT 2,
  rush_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.25,
  max_rush_fee    INTEGER NOT NULL DEFAULT 50,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 23: SUBSCRIPTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaning_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  cleaner_id      UUID REFERENCES users (id) ON DELETE SET NULL,
  property_id     INT REFERENCES properties(id),
  frequency       TEXT NOT NULL,
  day_of_week     SMALLINT,
  preferred_time  TIME,
  address         TEXT NOT NULL,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  credit_amount   INTEGER NOT NULL,
  base_hours      NUMERIC(5,2) DEFAULT 3.0,
  cleaning_type   TEXT DEFAULT 'basic',
  timezone        TEXT DEFAULT 'America/Los_Angeles',
  status          TEXT NOT NULL DEFAULT 'active',
  paused_reason   TEXT,
  cancelled_at    TIMESTAMPTZ,
  next_job_date   DATE,
  jobs_created    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorite_cleaners (
  id          SERIAL PRIMARY KEY,
  client_id   UUID NOT NULL REFERENCES users(id),
  cleaner_id  UUID NOT NULL REFERENCES users(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, cleaner_id)
);

-- ============================================
-- STEP 24: CLEANER GOALS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_goals (
  id           SERIAL PRIMARY KEY,
  cleaner_id   UUID NOT NULL REFERENCES users(id),
  goal_type    TEXT NOT NULL DEFAULT 'jobs',
  month        DATE NOT NULL,
  target_value INT NOT NULL,
  current_value INT NOT NULL DEFAULT 0,
  reward_credits INT NOT NULL,
  is_awarded   BOOLEAN NOT NULL DEFAULT FALSE,
  awarded_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cleaner_id, goal_type, month)
);

-- ============================================
-- STEP 25: CALENDAR
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_connections (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id),
  provider      TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  email         TEXT,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  sync_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id              SERIAL PRIMARY KEY,
  connection_id   INT NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  external_event_id TEXT NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'job',
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, external_event_id)
);

-- ============================================
-- STEP 26: KPIs & METRICS
-- ============================================

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE NOT NULL UNIQUE,
  total_jobs          INTEGER NOT NULL DEFAULT 0,
  completed_jobs      INTEGER NOT NULL DEFAULT 0,
  disputed_jobs       INTEGER NOT NULL DEFAULT 0,
  cancelled_jobs      INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 27: SUPPORT SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs (id) ON DELETE SET NULL,
  category        TEXT NOT NULL,
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'normal',
  status          TEXT NOT NULL DEFAULT 'open',
  assigned_to     UUID REFERENCES users (id) ON DELETE SET NULL,
  resolution      TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS support_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES users (id) ON DELETE SET NULL,
  sender_type     TEXT NOT NULL,
  message         TEXT NOT NULL,
  attachments     JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 28: BACKGROUND CHECKS
-- ============================================

CREATE TABLE IF NOT EXISTS background_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'checkr',
  provider_id     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  report_url      TEXT,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 29: WEBHOOKS & QUEUES
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_failures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,
  event_id        TEXT,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 5,
  next_retry_at   TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_queue (
  id              SERIAL PRIMARY KEY,
  queue_name      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  priority        INT NOT NULL DEFAULT 0,
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 3,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  data         JSONB NOT NULL
);

-- ============================================
-- STEP 30: AUDIT & FRAUD
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_type      TEXT NOT NULL,
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     UUID,
  old_value       JSONB,
  new_value       JSONB,
  metadata        JSONB DEFAULT '{}'::jsonb,
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users (id) ON DELETE SET NULL,
  alert_type      TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'medium',
  description     TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'open',
  resolved_by     UUID REFERENCES users (id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 31: FEATURE FLAGS
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  target_type TEXT,
  target_ids  TEXT[],
  percentage  INT DEFAULT 100,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 32: USER PREFERENCES & MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    sms_notifications BOOLEAN NOT NULL DEFAULT true,
    push_notifications BOOLEAN NOT NULL DEFAULT true,
    marketing_emails BOOLEAN NOT NULL DEFAULT false,
    language TEXT NOT NULL DEFAULT 'en',
    timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'cleaner', 'admin', 'system')),
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_job ON messages(job_id);

-- ============================================
-- STEP 33: REVIEWS
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id),
    reviewee_id UUID NOT NULL REFERENCES users(id),
    reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('client', 'cleaner')),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    response TEXT,
    response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);

-- ============================================
-- STEP 34: FUNCTIONS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Credit balance function
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(delta_credits), 0)
  INTO v_balance
  FROM credit_ledger
  WHERE user_id = p_user_id;
  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- User has credits function
CREATE OR REPLACE FUNCTION user_has_credits(p_user_id UUID, p_required INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_credit_balance(p_user_id) >= p_required;
END;
$$ LANGUAGE plpgsql STABLE;

-- Cleaner availability check
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

-- Grace cancellations remaining
CREATE OR REPLACE FUNCTION get_client_grace_cancellations_remaining(p_client_id UUID)
RETURNS INTEGER AS $$
DECLARE
  used_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO used_count
  FROM grace_cancellations
  WHERE client_id = p_client_id;
  RETURN GREATEST(0, 2 - used_count);
END;
$$ LANGUAGE plpgsql;

-- Dispute window check
CREATE OR REPLACE FUNCTION is_dispute_within_window(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  completed_at TIMESTAMPTZ;
BEGIN
  SELECT actual_end_at INTO completed_at
  FROM jobs WHERE id = p_job_id;
  
  IF completed_at IS NULL THEN RETURN true; END IF;
  RETURN (NOW() - completed_at) <= INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;

-- Cancellation fee calculator
CREATE OR REPLACE FUNCTION calculate_cancellation_fee_percent(hours_before NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  IF hours_before > 48 THEN RETURN 0;
  ELSIF hours_before > 24 THEN RETURN 50;
  ELSE RETURN 100;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Tier lock check
CREATE OR REPLACE FUNCTION is_tier_locked(p_cleaner_id UUID) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tier_locks
    WHERE cleaner_id = p_cleaner_id AND locked_until > NOW()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Expire old job offers
CREATE OR REPLACE FUNCTION expire_old_job_offers() RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE job_offers SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Payout percent on tier change
CREATE OR REPLACE FUNCTION update_payout_percent_on_tier_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier != OLD.tier THEN
    NEW.payout_percent = CASE NEW.tier
      WHEN 'platinum' THEN 85
      WHEN 'gold' THEN 84
      WHEN 'silver' THEN 82
      ELSE 80
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 35: TRIGGERS
-- ============================================

-- Drop existing triggers if they exist (safe recreation)
DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
DROP TRIGGER IF EXISTS trg_jobs_set_updated_at ON jobs;
DROP TRIGGER IF EXISTS trg_payouts_set_updated_at ON payouts;
DROP TRIGGER IF EXISTS trg_disputes_set_updated_at ON disputes;
DROP TRIGGER IF EXISTS trg_client_profiles_set_updated_at ON client_profiles;
DROP TRIGGER IF EXISTS trg_cleaner_profiles_set_updated_at ON cleaner_profiles;
DROP TRIGGER IF EXISTS trg_update_payout_percent ON cleaner_profiles;

CREATE TRIGGER trg_users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();
CREATE TRIGGER trg_jobs_set_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();
CREATE TRIGGER trg_payouts_set_updated_at BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();
CREATE TRIGGER trg_disputes_set_updated_at BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();
CREATE TRIGGER trg_client_profiles_set_updated_at BEFORE UPDATE ON client_profiles FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();
CREATE TRIGGER trg_cleaner_profiles_set_updated_at BEFORE UPDATE ON cleaner_profiles FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();
CREATE TRIGGER trg_update_payout_percent BEFORE UPDATE ON cleaner_profiles FOR EACH ROW EXECUTE FUNCTION update_payout_percent_on_tier_change();

-- ============================================
-- STEP 36: VIEWS
-- ============================================

-- User credit balances
CREATE OR REPLACE VIEW user_credit_balances AS
SELECT user_id, COALESCE(SUM(delta_credits), 0)::INTEGER AS balance_credits
FROM credit_ledger GROUP BY user_id;

-- Credit ledger with running balance
CREATE OR REPLACE VIEW credit_ledger_with_balance AS
SELECT cl.*, SUM(cl.delta_credits) OVER (PARTITION BY cl.user_id ORDER BY cl.created_at ROWS UNBOUNDED PRECEDING)::INTEGER AS running_balance
FROM credit_ledger cl;

-- Cleaner job earnings
CREATE OR REPLACE VIEW cleaner_job_earnings AS
SELECT j.id AS job_id, j.cleaner_id, j.credit_amount, j.status, j.actual_end_at as completed_at,
       p.id AS payout_id, p.status AS payout_status, p.stripe_transfer_id
FROM jobs j
LEFT JOIN payouts p ON p.job_id = j.id
WHERE j.status = 'completed' AND j.cleaner_id IS NOT NULL;

-- Payouts with details
CREATE OR REPLACE VIEW payouts_with_details AS
SELECT p.*, u.email as cleaner_email, cp.stripe_account_id, cp.tier as cleaner_tier, j.address as job_address, j.scheduled_start_at as job_date
FROM payouts p
JOIN users u ON p.cleaner_id = u.id
LEFT JOIN cleaner_profiles cp ON cp.user_id = p.cleaner_id
JOIN jobs j ON p.job_id = j.id;

-- Cleaner payout summary
CREATE OR REPLACE VIEW cleaner_payout_summary AS
SELECT p.cleaner_id, u.email, cp.stripe_account_id,
       COUNT(*) FILTER (WHERE p.status = 'pending') as pending_count,
       COUNT(*) FILTER (WHERE p.status = 'paid') as paid_count,
       COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'pending'), 0)::INTEGER as pending_cents,
       COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0)::INTEGER as paid_cents
FROM payouts p
JOIN users u ON p.cleaner_id = u.id
LEFT JOIN cleaner_profiles cp ON cp.user_id = p.cleaner_id
GROUP BY p.cleaner_id, u.email, cp.stripe_account_id;

-- Cleaner Stripe info
CREATE OR REPLACE VIEW cleaner_stripe_info AS
SELECT cp.user_id, cp.tier, cp.reliability_score, cp.hourly_rate_credits,
       COALESCE(cp.stripe_account_id, cp.stripe_connect_id) as stripe_account_id, u.email as cleaner_email
FROM cleaner_profiles cp JOIN users u ON u.id = cp.user_id;

-- Active cleaners
CREATE OR REPLACE VIEW v_active_cleaners AS
SELECT u.id, cp.reliability_score, cp.tier, cp.latitude, cp.longitude, cp.travel_radius_km,
       cp.max_jobs_per_day, cp.accepts_high_risk, cp.is_available,
       COALESCE(cfp.low_flexibility_active, false) as low_flexibility_badge
FROM users u
JOIN cleaner_profiles cp ON cp.user_id = u.id
LEFT JOIN cleaner_flex_profiles cfp ON cfp.cleaner_id = u.id
WHERE u.role = 'cleaner' AND cp.is_available = true;

-- Client risk summary
CREATE OR REPLACE VIEW v_client_risk_summary AS
SELECT u.id as client_id, COALESCE(crs.risk_score, 0) as risk_score,
       COALESCE(crs.risk_band, 'normal') as risk_band, COALESCE(cfp.flex_score, 0.5) as flex_score,
       COALESCE(clp.grace_cancellations_total, 2) - COALESCE(clp.grace_cancellations_used, 0) as grace_remaining
FROM users u
LEFT JOIN client_risk_scores crs ON crs.client_id = u.id
LEFT JOIN client_flex_profiles cfp ON cfp.client_id = u.id
LEFT JOIN client_profiles clp ON clp.user_id = u.id
WHERE u.role = 'client';

-- Active boosts
CREATE OR REPLACE VIEW active_cleaner_boosts AS
SELECT cleaner_id, boost_type, multiplier, ends_at, EXTRACT(EPOCH FROM (ends_at - NOW())) / 3600 as hours_remaining
FROM cleaner_boosts WHERE status = 'active' AND ends_at > NOW();

-- ============================================
-- STEP 37: SEED DATA
-- ============================================

-- Insert default reschedule reason codes
INSERT INTO reschedule_reason_codes (requester_type, code, reason_text) VALUES
    ('client', 'schedule_conflict', 'Schedule conflict'),
    ('client', 'emergency', 'Emergency situation'),
    ('client', 'plans_changed', 'Plans changed'),
    ('cleaner', 'schedule_conflict', 'Schedule conflict'),
    ('cleaner', 'emergency', 'Emergency situation'),
    ('cleaner', 'transportation_issue', 'Transportation issue'),
    ('cleaner', 'sick', 'Feeling unwell')
ON CONFLICT (code) DO NOTHING;

-- Insert Sacramento as first city
INSERT INTO cities (name, country_code, state_region, timezone)
VALUES ('Sacramento', 'US', 'CA', 'America/Los_Angeles')
ON CONFLICT DO NOTHING;

-- Insert feature flags
INSERT INTO feature_flags (key, description, is_enabled) VALUES
  ('subscriptions.enabled', 'Enable subscription cleanings', true),
  ('calendar_sync.enabled', 'Enable calendar sync feature', true),
  ('ai_features.enabled', 'Enable AI-powered features', true),
  ('teams.enabled', 'Enable cleaner teams', true),
  ('goals.enabled', 'Enable cleaner goals', true)
ON CONFLICT (key) DO NOTHING;

-- Insert rush job settings
INSERT INTO rush_job_settings (min_hours_ahead, rush_multiplier, max_rush_fee)
VALUES (2, 1.25, 50) ON CONFLICT DO NOTHING;

-- Insert notification templates
INSERT INTO notification_templates (key, name, channel, subject, title, body, variables) VALUES
    ('job.created', 'Job Created', 'push', NULL, 'New Job Request', 'You have a new cleaning request for {{date}}', '["date", "address"]'),
    ('job.accepted', 'Job Accepted', 'push', NULL, 'Job Accepted!', '{{cleaner_name}} has accepted your cleaning request', '["cleaner_name", "date"]'),
    ('job.completed', 'Job Completed', 'push', NULL, 'Cleaning Complete', 'Your cleaning has been completed. Please review.', '["cleaner_name"]'),
    ('payout.completed', 'Payout Completed', 'email', 'Your payout has been sent!', NULL, 'Your payout of ${{amount}} has been sent.', '["amount"]')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- DONE!
-- ============================================
SELECT 'PURETASK SCHEMA CREATED SUCCESSFULLY' AS status;

