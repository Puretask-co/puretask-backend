-- Migration 018: Core Systems V2 Tables
-- Implements tables for:
-- - Reliability Score Engine (cleaner metrics, events, streaks)
-- - Client Risk Score Engine (events, scores)
-- - Rescheduling System (events, reason codes)
-- - Cancellation System (events)
-- - Matching System (recommendations)
-- - Inconvenience Score System (logs)
-- - Flexibility System (cleaner/client profiles)
-- - Availability System (blocks, blackouts)
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- ============================================
-- CLEANER RELIABILITY SYSTEM
-- ============================================

-- Pre-aggregated cleaner metrics (rolling window)
CREATE TABLE IF NOT EXISTS cleaner_metrics (
    cleaner_id TEXT PRIMARY KEY REFERENCES users(id),
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

-- Cleaner events (penalties/bonuses)
DO $$ BEGIN
    CREATE TYPE cleaner_event_type AS ENUM (
        'late_reschedule',
        'cancel_24_48',
        'cancel_lt24',
        'no_show',
        'dispute_cleaner_at_fault',
        'inconvenience_high',
        'inconvenience_pattern',
        'streak_bonus',
        'photo_compliance_bonus'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS cleaner_events (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id TEXT NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    event_type cleaner_event_type NOT NULL,
    weight INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_cleaner_events_cleaner_id ON cleaner_events(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_events_created_at ON cleaner_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cleaner_events_type ON cleaner_events(event_type);

-- Weekly streak tracking
CREATE TABLE IF NOT EXISTS cleaner_weekly_streaks (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id TEXT NOT NULL REFERENCES users(id),
    week_start DATE NOT NULL,
    is_streak BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cleaner_id, week_start)
);

-- Add reliability fields to cleaner_profiles if not exists
DO $$ BEGIN
    ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS reliability_last_computed TIMESTAMPTZ;
EXCEPTION
    WHEN others THEN null;
END $$;

-- ============================================
-- CLIENT RISK SCORE SYSTEM
-- ============================================

-- Client risk bands
DO $$ BEGIN
    CREATE TYPE client_risk_band AS ENUM ('normal', 'mild', 'elevated', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Client risk scores
CREATE TABLE IF NOT EXISTS client_risk_scores (
    client_id TEXT PRIMARY KEY REFERENCES users(id),
    risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    risk_band client_risk_band NOT NULL DEFAULT 'normal',
    last_recomputed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client risk events
DO $$ BEGIN
    CREATE TYPE client_risk_event_type AS ENUM (
        'late_reschedule_lt24',
        'late_reschedule_pattern',
        'cancel_24_48',
        'cancel_24_48_grace',
        'cancel_lt24',
        'cancel_lt24_grace',
        'cancel_after_decline',
        'no_show',
        'dispute_client_at_fault',
        'card_decline',
        'chargeback',
        'inconvenience_pattern_3',
        'inconvenience_pattern_5',
        'abuse_flag'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS client_risk_events (
    id BIGSERIAL PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    event_type client_risk_event_type NOT NULL,
    weight INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_client_risk_events_client_id ON client_risk_events(client_id);
CREATE INDEX IF NOT EXISTS idx_client_risk_events_created_at ON client_risk_events(created_at);

-- ============================================
-- RESCHEDULING SYSTEM
-- ============================================

-- Reschedule reason codes
CREATE TABLE IF NOT EXISTS reschedule_reason_codes (
    id SERIAL PRIMARY KEY,
    requester_type VARCHAR(10) NOT NULL CHECK (requester_type IN ('client', 'cleaner')),
    code VARCHAR(50) NOT NULL UNIQUE,
    reason_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default reason codes
INSERT INTO reschedule_reason_codes (requester_type, code, reason_text) VALUES
    ('client', 'schedule_conflict', 'Schedule conflict'),
    ('client', 'emergency', 'Emergency situation'),
    ('client', 'plans_changed', 'Plans changed'),
    ('client', 'forgot_appointment', 'Forgot about the appointment'),
    ('client', 'need_different_time', 'Need a different time'),
    ('cleaner', 'schedule_conflict', 'Schedule conflict'),
    ('cleaner', 'emergency', 'Emergency situation'),
    ('cleaner', 'transportation_issue', 'Transportation issue'),
    ('cleaner', 'sick', 'Feeling unwell'),
    ('cleaner', 'prior_job_overrun', 'Previous job running late')
ON CONFLICT (code) DO NOTHING;

-- Reschedule events
DO $$ BEGIN
    CREATE TYPE reschedule_status AS ENUM ('pending', 'accepted', 'declined', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reschedule_bucket AS ENUM ('lt24', '24_48', 'gt48');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS reschedule_events (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    client_id TEXT NOT NULL REFERENCES users(id),
    cleaner_id TEXT NOT NULL REFERENCES users(id),
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
CREATE INDEX IF NOT EXISTS idx_reschedule_events_client_id ON reschedule_events(client_id);
CREATE INDEX IF NOT EXISTS idx_reschedule_events_status ON reschedule_events(status);

-- ============================================
-- CANCELLATION SYSTEM
-- ============================================

-- Cancellation events
CREATE TABLE IF NOT EXISTS cancellation_events (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    client_id TEXT REFERENCES users(id),
    cleaner_id TEXT REFERENCES users(id),
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
CREATE INDEX IF NOT EXISTS idx_cancellation_events_client_id ON cancellation_events(client_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_events_cleaner_id ON cancellation_events(cleaner_id);

-- Grace cancellations tracking
-- Note: This table is also defined in 017_policy_compliance.sql with TEXT types
-- Using IF NOT EXISTS to avoid conflict
CREATE TABLE IF NOT EXISTS grace_cancellations (
    id BIGSERIAL PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grace_cancellations_client_id ON grace_cancellations(client_id);

-- Add grace fields to client_profiles if not exists
DO $$ BEGIN
    ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS grace_cancellations_total INTEGER DEFAULT 2;
    ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS grace_cancellations_used INTEGER DEFAULT 0;
EXCEPTION
    WHEN others THEN null;
END $$;

-- ============================================
-- MATCHING SYSTEM
-- ============================================

-- Match recommendations (for analytics)
CREATE TABLE IF NOT EXISTS match_recommendations (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    client_id TEXT NOT NULL REFERENCES users(id),
    cleaner_id TEXT NOT NULL REFERENCES users(id),
    match_score NUMERIC(6,4) NOT NULL,
    rank INTEGER NOT NULL,
    breakdown JSONB,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_recommendations_job_id ON match_recommendations(job_id);
CREATE INDEX IF NOT EXISTS idx_match_recommendations_cleaner_id ON match_recommendations(cleaner_id);

-- ============================================
-- INCONVENIENCE SCORE SYSTEM
-- ============================================

-- Inconvenience logs
CREATE TABLE IF NOT EXISTS inconvenience_logs (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES jobs(id),
    client_id TEXT NOT NULL REFERENCES users(id),
    cleaner_id TEXT NOT NULL REFERENCES users(id),
    caused_by VARCHAR(10) NOT NULL CHECK (caused_by IN ('client', 'cleaner')),
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 4),
    reason_link VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_inconvenience_logs_client_id ON inconvenience_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_inconvenience_logs_cleaner_id ON inconvenience_logs(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_inconvenience_logs_caused_by ON inconvenience_logs(caused_by);

-- ============================================
-- FLEXIBILITY SYSTEM
-- ============================================

-- Cleaner flexibility profiles
CREATE TABLE IF NOT EXISTS cleaner_flex_profiles (
    cleaner_id TEXT PRIMARY KEY REFERENCES users(id),
    reasonable_declines_14d INTEGER NOT NULL DEFAULT 0,
    reasonable_declines_30d INTEGER NOT NULL DEFAULT 0,
    low_flexibility_active BOOLEAN NOT NULL DEFAULT false,
    badge_assigned_at TIMESTAMPTZ,
    badge_removed_at TIMESTAMPTZ,
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Flexibility decline events (for low flex badge calculation)
CREATE TABLE IF NOT EXISTS flexibility_decline_events (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id TEXT NOT NULL REFERENCES users(id),
    reschedule_event_id BIGINT REFERENCES reschedule_events(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flexibility_decline_cleaner_id ON flexibility_decline_events(cleaner_id);

-- Client flexibility profiles
CREATE TABLE IF NOT EXISTS client_flex_profiles (
    client_id TEXT PRIMARY KEY REFERENCES users(id),
    flex_score NUMERIC(3,2) NOT NULL DEFAULT 0.5, -- 0.0 to 1.0
    reschedules_30d INTEGER NOT NULL DEFAULT 0,
    late_reschedules_30d INTEGER NOT NULL DEFAULT 0,
    cancellations_30d INTEGER NOT NULL DEFAULT 0,
    last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- ============================================
-- AVAILABILITY SYSTEM
-- ============================================

-- Weekly availability blocks
CREATE TABLE IF NOT EXISTS availability_blocks (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id TEXT NOT NULL REFERENCES users(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_availability_blocks_cleaner_id ON availability_blocks(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_day ON availability_blocks(day_of_week);

-- Blackout periods (time off, etc.)
CREATE TABLE IF NOT EXISTS blackout_periods (
    id BIGSERIAL PRIMARY KEY,
    cleaner_id TEXT NOT NULL REFERENCES users(id),
    start_ts TIMESTAMPTZ NOT NULL,
    end_ts TIMESTAMPTZ NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_blackout_range CHECK (start_ts < end_ts)
);

CREATE INDEX IF NOT EXISTS idx_blackout_periods_cleaner_id ON blackout_periods(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_blackout_periods_dates ON blackout_periods(start_ts, end_ts);

-- Add fields to cleaner_profiles if not exists
DO $$ BEGIN
    ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS travel_radius_km NUMERIC(5,2) DEFAULT 50;
    ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS max_jobs_per_day INTEGER DEFAULT 5;
    ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS accepts_high_risk BOOLEAN DEFAULT false;
    ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6);
    ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);
    ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
EXCEPTION
    WHEN others THEN null;
END $$;

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View for active cleaners with all relevant fields
CREATE OR REPLACE VIEW v_active_cleaners AS
SELECT 
    u.id,
    cp.reliability_score,
    cp.tier,
    cp.latitude,
    cp.longitude,
    cp.travel_radius_km,
    cp.max_jobs_per_day,
    cp.accepts_high_risk,
    cp.is_available,
    COALESCE(cfp.low_flexibility_active, false) as low_flexibility_badge
FROM users u
JOIN cleaner_profiles cp ON cp.user_id = u.id
LEFT JOIN cleaner_flex_profiles cfp ON cfp.cleaner_id = u.id
WHERE u.role = 'cleaner' AND cp.is_available = true;

-- View for client risk summary
CREATE OR REPLACE VIEW v_client_risk_summary AS
SELECT 
    u.id as client_id,
    COALESCE(crs.risk_score, 0) as risk_score,
    COALESCE(crs.risk_band, 'normal') as risk_band,
    COALESCE(cfp.flex_score, 0.5) as flex_score,
    COALESCE(clp.grace_cancellations_total, 2) - COALESCE(clp.grace_cancellations_used, 0) as grace_remaining
FROM users u
LEFT JOIN client_risk_scores crs ON crs.client_id = u.id
LEFT JOIN client_flex_profiles cfp ON cfp.client_id = u.id
LEFT JOIN client_profiles clp ON clp.user_id = u.id
WHERE u.role = 'client';

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Jobs table indexes for matching queries
CREATE INDEX IF NOT EXISTS idx_jobs_cleaner_date ON jobs(cleaner_id, scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_start ON jobs(status, scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_jobs_client_cleaner ON jobs(client_id, cleaner_id);

COMMENT ON TABLE cleaner_metrics IS 'Pre-aggregated rolling window metrics for cleaner reliability scoring';
COMMENT ON TABLE cleaner_events IS 'Reliability score events (penalties/bonuses) for cleaners';
COMMENT ON TABLE client_risk_scores IS 'Current client risk score and band';
COMMENT ON TABLE client_risk_events IS 'Risk score events for clients';
COMMENT ON TABLE reschedule_events IS 'Full history of reschedule requests and outcomes';
COMMENT ON TABLE cancellation_events IS 'Full history of cancellations with fee breakdown';
COMMENT ON TABLE inconvenience_logs IS 'Post-reschedule inconvenience ratings from users';
COMMENT ON TABLE match_recommendations IS 'Analytics log of cleaner-job match recommendations';
COMMENT ON TABLE cleaner_flex_profiles IS 'Cleaner flexibility tracking for Low Flexibility badge';
COMMENT ON TABLE client_flex_profiles IS 'Client flexibility scores for matching optimization';
COMMENT ON TABLE availability_blocks IS 'Weekly availability schedule for cleaners';
COMMENT ON TABLE blackout_periods IS 'Time-off periods where cleaners are unavailable';
