-- 019_comprehensive_schema_additions.sql
-- Comprehensive schema additions based on full audit
-- Adds missing tables, columns, and indexes for complete PureTask platform
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- ============================================
-- 1. USER NAME COLUMNS
-- ============================================

-- Add name columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;

COMMENT ON COLUMN users.first_name IS 'User first name';
COMMENT ON COLUMN users.last_name IS 'User last name';

-- ============================================
-- 2. CLIENT PROFILE ENHANCEMENTS
-- ============================================

ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

COMMENT ON COLUMN client_profiles.first_name IS 'Client first name (can differ from user account)';
COMMENT ON COLUMN client_profiles.last_name IS 'Client last name (can differ from user account)';

-- ============================================
-- 3. CLEANER PROFILE ENHANCEMENTS
-- ============================================

ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2);
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS jobs_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS low_flexibility_badge BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS base_rate_cph NUMERIC(10,2);
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS deep_addon_cph NUMERIC(10,2);
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS moveout_addon_cph NUMERIC(10,2);

COMMENT ON COLUMN cleaner_profiles.first_name IS 'Cleaner first name (display name)';
COMMENT ON COLUMN cleaner_profiles.last_name IS 'Cleaner last name (display name)';
COMMENT ON COLUMN cleaner_profiles.bio IS 'Cleaner bio/description for profile';
COMMENT ON COLUMN cleaner_profiles.avg_rating IS 'Average rating from completed jobs (1.00-5.00)';
COMMENT ON COLUMN cleaner_profiles.jobs_completed IS 'Total number of completed jobs';
COMMENT ON COLUMN cleaner_profiles.low_flexibility_badge IS 'Low flexibility badge for matching penalty';
COMMENT ON COLUMN cleaner_profiles.base_rate_cph IS 'Base rate in credits per hour';
COMMENT ON COLUMN cleaner_profiles.deep_addon_cph IS 'Additional rate for deep cleaning';
COMMENT ON COLUMN cleaner_profiles.moveout_addon_cph IS 'Additional rate for move-out cleaning';

-- ============================================
-- 4. ADDRESSES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT,                          -- "Home", "Work", "Rental #1"
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    country TEXT NOT NULL DEFAULT 'US',
    lat NUMERIC(9,6),                    -- Latitude for geo-matching
    lng NUMERIC(9,6),                    -- Longitude for geo-matching
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_geo ON addresses(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

COMMENT ON TABLE addresses IS 'User addresses for job locations';

-- ============================================
-- 5. STRIPE CUSTOMERS TABLE (dedicated)
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    default_payment_method_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

COMMENT ON TABLE stripe_customers IS 'Stripe customer records for payment processing';

-- ============================================
-- 6. STRIPE CONNECT ACCOUNTS TABLE (dedicated)
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    stripe_account_id TEXT NOT NULL UNIQUE,
    charges_enabled BOOLEAN NOT NULL DEFAULT false,
    payouts_enabled BOOLEAN NOT NULL DEFAULT false,
    details_submitted BOOLEAN NOT NULL DEFAULT false,
    onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_connect_stripe_id ON stripe_connect_accounts(stripe_account_id);

COMMENT ON TABLE stripe_connect_accounts IS 'Stripe Connect accounts for cleaner payouts';

-- ============================================
-- 7. JOB STATUS HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS job_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by_user_id TEXT REFERENCES users(id),
    changed_by_type TEXT CHECK (changed_by_type IN ('client', 'cleaner', 'admin', 'system')),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_history_created ON job_status_history(created_at);

COMMENT ON TABLE job_status_history IS 'Complete history of job status transitions';

-- ============================================
-- 8. JOB CHECKINS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS job_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('check_in', 'check_out')),
    lat NUMERIC(9,6),
    lng NUMERIC(9,6),
    distance_from_job_meters NUMERIC(10,2),
    is_within_radius BOOLEAN,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_checkins_job_id ON job_checkins(job_id);
CREATE INDEX IF NOT EXISTS idx_job_checkins_cleaner_id ON job_checkins(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_job_checkins_type ON job_checkins(type);

COMMENT ON TABLE job_checkins IS 'GPS check-in/check-out records for jobs';

-- ============================================
-- 9. DISPUTE ACTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS dispute_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    actor_user_id TEXT REFERENCES users(id),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('client', 'cleaner', 'admin', 'system')),
    action TEXT NOT NULL,                -- 'opened', 'responded', 'evidence_added', 'resolved', 'escalated'
    details JSONB DEFAULT '{}'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_actions_dispute_id ON dispute_actions(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_actions_actor ON dispute_actions(actor_user_id);

COMMENT ON TABLE dispute_actions IS 'Actions taken during dispute resolution';

-- ============================================
-- 10. PAYOUT REQUESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_credits INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    decided_by TEXT REFERENCES users(id),
    rejection_reason TEXT,
    payout_id UUID REFERENCES payouts(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_cleaner ON payout_requests(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

COMMENT ON TABLE payout_requests IS 'Cleaner requests for payouts (instant/manual)';

-- ============================================
-- 11. RELIABILITY SNAPSHOTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reliability_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    tier TEXT,
    inputs JSONB NOT NULL,               -- All inputs used in calculation
    breakdown JSONB,                     -- Score component breakdown
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reliability_snapshots_cleaner ON reliability_snapshots(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_reliability_snapshots_computed ON reliability_snapshots(computed_at);

COMMENT ON TABLE reliability_snapshots IS 'Historical reliability score snapshots for audit';

-- ============================================
-- 12. CLEANER TIER HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_tier_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_tier TEXT,
    to_tier TEXT NOT NULL,
    reason TEXT,                         -- 'score_increase', 'score_decrease', 'manual_adjustment', 'new_cleaner'
    triggered_by TEXT CHECK (triggered_by IN ('system', 'admin')),
    triggered_by_user_id TEXT REFERENCES users(id),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_history_cleaner ON cleaner_tier_history(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_tier_history_effective ON cleaner_tier_history(effective_from);

COMMENT ON TABLE cleaner_tier_history IS 'History of cleaner tier changes';

-- ============================================
-- 13. NOTIFICATION TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,            -- 'job.accepted', 'job.reminder', 'payout.completed'
    name TEXT NOT NULL,
    description TEXT,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
    subject TEXT,                        -- For email
    title TEXT,                          -- For push/in_app
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb, -- List of available template variables
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_key ON notification_templates(key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(channel);

COMMENT ON TABLE notification_templates IS 'Templates for all notification types';

-- Seed default notification templates
INSERT INTO notification_templates (key, name, channel, subject, title, body, variables) VALUES
    ('job.created', 'Job Created', 'push', NULL, 'New Job Request', 'You have a new cleaning request for {{date}}', '["date", "address", "cleaning_type"]'),
    ('job.accepted', 'Job Accepted', 'push', NULL, 'Job Accepted!', '{{cleaner_name}} has accepted your cleaning request', '["cleaner_name", "date"]'),
    ('job.reminder', 'Job Reminder', 'push', NULL, 'Cleaning Tomorrow', 'Reminder: Your cleaning is scheduled for tomorrow at {{time}}', '["time", "address"]'),
    ('job.started', 'Job Started', 'push', NULL, 'Cleaning Started', '{{cleaner_name}} has arrived and started cleaning', '["cleaner_name"]'),
    ('job.completed', 'Job Completed', 'push', NULL, 'Cleaning Complete', 'Your cleaning has been completed. Please review and approve.', '["cleaner_name"]'),
    ('payout.completed', 'Payout Completed', 'email', 'Your payout has been sent!', NULL, 'Your payout of ${{amount}} has been sent to your bank account.', '["amount"]'),
    ('dispute.opened', 'Dispute Opened', 'email', 'Dispute Filed for Job #{{job_id}}', NULL, 'A dispute has been opened. Our team will review it within 24-48 hours.', '["job_id"]'),
    ('reschedule.requested', 'Reschedule Requested', 'push', NULL, 'Reschedule Request', '{{requester_name}} has requested to reschedule your cleaning', '["requester_name", "new_date"]'),
    ('cancellation.confirmed', 'Cancellation Confirmed', 'push', NULL, 'Cancellation Confirmed', 'Your cleaning has been cancelled. {{refund_message}}', '["refund_message"]')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 14. ADMIN AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,                -- 'user.suspended', 'dispute.resolved', 'payout.approved'
    entity_type TEXT,                    -- 'user', 'job', 'dispute', 'payout', 'cleaner'
    entity_id UUID,
    old_values JSONB,                    -- Previous state
    new_values JSONB,                    -- New state
    reason TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);

COMMENT ON TABLE admin_audit_log IS 'Audit trail for all admin actions';

-- ============================================
-- 15. CREDIT ACCOUNTS TABLE (Dedicated Balance)
-- ============================================

CREATE TABLE IF NOT EXISTS credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_balance INTEGER NOT NULL DEFAULT 0,
    held_balance INTEGER NOT NULL DEFAULT 0,     -- Credits in escrow
    lifetime_purchased INTEGER NOT NULL DEFAULT 0,
    lifetime_spent INTEGER NOT NULL DEFAULT 0,
    lifetime_refunded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_user ON credit_accounts(user_id);

COMMENT ON TABLE credit_accounts IS 'User credit balances (source of truth for available credits)';

-- ============================================
-- 16. CREDIT TRANSACTIONS TABLE (Enhanced)
-- ============================================

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,             -- Positive = credit, Negative = debit
    balance_after INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (
        type IN ('purchase', 'hold', 'release', 'refund', 'adjustment', 'payout', 'bonus', 'expiry')
    ),
    reference_type TEXT,                 -- 'job', 'dispute', 'payout', 'promo'
    reference_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_account ON credit_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_ref ON credit_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at);

COMMENT ON TABLE credit_transactions IS 'Complete ledger of all credit movements';

-- ============================================
-- 17. JOBS TABLE ENHANCEMENTS
-- ============================================

-- Add missing columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES addresses(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cleaning_type TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(4,2);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS price_credits INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS held_credits INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes_client TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes_cleaner TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cleaner_payout_amount_cents INTEGER;

-- Add check constraint for cleaning_type if column exists
DO $$ BEGIN
    ALTER TABLE jobs ADD CONSTRAINT jobs_cleaning_type_check 
        CHECK (cleaning_type IN ('standard', 'basic', 'deep', 'move_out'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN jobs.address_id IS 'Reference to addresses table for job location';
COMMENT ON COLUMN jobs.cleaning_type IS 'Type of cleaning: standard, basic, deep, move_out';
COMMENT ON COLUMN jobs.duration_hours IS 'Estimated duration in hours';
COMMENT ON COLUMN jobs.price_credits IS 'Total price in credits';
COMMENT ON COLUMN jobs.held_credits IS 'Credits currently held in escrow';
COMMENT ON COLUMN jobs.notes_client IS 'Special instructions from client';
COMMENT ON COLUMN jobs.notes_cleaner IS 'Notes from cleaner about the job';
COMMENT ON COLUMN jobs.cleaner_payout_amount_cents IS 'Amount to pay cleaner in cents (after platform fee)';

-- ============================================
-- 18. DISPUTES TABLE ENHANCEMENTS
-- ============================================

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS opened_by_user_id TEXT REFERENCES users(id);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS reason_code TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution_type TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS refund_amount_credits INTEGER;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolved_by_user_id TEXT REFERENCES users(id);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN disputes.opened_by_user_id IS 'User who opened the dispute';
COMMENT ON COLUMN disputes.reason_code IS 'Standardized reason code for dispute';
COMMENT ON COLUMN disputes.resolution_type IS 'How dispute was resolved: full_refund, partial_refund, no_refund, cancelled';
COMMENT ON COLUMN disputes.resolution_notes IS 'Admin notes on resolution';

-- ============================================
-- 19. PAYOUTS TABLE ENHANCEMENTS
-- ============================================

ALTER TABLE payouts ADD COLUMN IF NOT EXISTS total_usd NUMERIC(10,2);
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS stripe_payout_id TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

COMMENT ON COLUMN payouts.total_usd IS 'Total payout amount in USD';
COMMENT ON COLUMN payouts.stripe_payout_id IS 'Stripe payout/transfer ID';
COMMENT ON COLUMN payouts.failure_reason IS 'Reason for failed payout';
COMMENT ON COLUMN payouts.processed_at IS 'When payout was processed';

-- ============================================
-- 20. USER PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

COMMENT ON TABLE user_preferences IS 'User notification and display preferences';

-- ============================================
-- 21. MESSAGES TABLE (In-App Messaging)
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id),
    sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'cleaner', 'admin', 'system')),
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_job ON messages(job_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(job_id, is_read) WHERE is_read = false;

COMMENT ON TABLE messages IS 'In-app messages between clients and cleaners';

-- ============================================
-- 22. CLEANER EARNINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_cleaner_earnings_cleaner ON cleaner_earnings(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_earnings_job ON cleaner_earnings(job_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_earnings_status ON cleaner_earnings(status);

COMMENT ON TABLE cleaner_earnings IS 'Individual earnings records for cleaners';

-- ============================================
-- 23. REVIEWS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
    reviewer_id TEXT NOT NULL REFERENCES users(id),
    reviewee_id TEXT NOT NULL REFERENCES users(id),
    reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('client', 'cleaner')),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    response TEXT,                       -- Reviewee can respond
    response_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_job ON reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);

COMMENT ON TABLE reviews IS 'Job reviews and ratings';

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamps
CREATE TRIGGER trg_addresses_updated_at
BEFORE UPDATE ON addresses
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_stripe_customers_updated_at
BEFORE UPDATE ON stripe_customers
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_stripe_connect_accounts_updated_at
BEFORE UPDATE ON stripe_connect_accounts
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_payout_requests_updated_at
BEFORE UPDATE ON payout_requests
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_credit_accounts_updated_at
BEFORE UPDATE ON credit_accounts
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_cleaner_earnings_updated_at
BEFORE UPDATE ON cleaner_earnings
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View for cleaner dashboard stats
CREATE OR REPLACE VIEW v_cleaner_dashboard AS
SELECT 
    u.id as cleaner_id,
    u.email,
    COALESCE(cp.first_name, '') || ' ' || COALESCE(cp.last_name, '') as full_name,
    cp.tier,
    cp.reliability_score,
    cp.avg_rating,
    cp.jobs_completed,
    cp.low_flexibility_badge,
    cp.payout_percent,
    COALESCE(ce.pending_earnings, 0) as pending_earnings_cents,
    COALESCE(ce.available_earnings, 0) as available_earnings_cents
FROM users u
JOIN cleaner_profiles cp ON cp.user_id = u.id
LEFT JOIN (
    SELECT cleaner_id, 
           SUM(CASE WHEN status = 'pending' THEN net_amount_cents ELSE 0 END) as pending_earnings,
           SUM(CASE WHEN status = 'available' THEN net_amount_cents ELSE 0 END) as available_earnings
    FROM cleaner_earnings
    GROUP BY cleaner_id
) ce ON ce.cleaner_id = u.id
WHERE u.role = 'cleaner';

-- View for client dashboard stats
CREATE OR REPLACE VIEW v_client_dashboard AS
SELECT 
    u.id as client_id,
    u.email,
    COALESCE(clp.first_name, '') || ' ' || COALESCE(clp.last_name, '') as full_name,
    COALESCE(ca.current_balance, 0) as credit_balance,
    COALESCE(ca.held_balance, 0) as held_credits,
    COALESCE(crs.risk_score, 0) as risk_score,
    COALESCE(crs.risk_band, 'normal') as risk_band,
    COALESCE(clp.grace_cancellations_total, 2) - COALESCE(clp.grace_cancellations_used, 0) as grace_cancellations_remaining
FROM users u
LEFT JOIN client_profiles clp ON clp.user_id = u.id
LEFT JOIN credit_accounts ca ON ca.user_id = u.id
LEFT JOIN client_risk_scores crs ON crs.client_id = u.id
WHERE u.role = 'client';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE addresses IS 'User addresses for job locations with geocoding';
COMMENT ON TABLE stripe_customers IS 'Stripe customer records for payment processing';
COMMENT ON TABLE stripe_connect_accounts IS 'Stripe Connect accounts for cleaner payouts';
COMMENT ON TABLE job_status_history IS 'Complete audit trail of job status changes';
COMMENT ON TABLE job_checkins IS 'GPS check-in/check-out records with distance validation';
COMMENT ON TABLE dispute_actions IS 'All actions taken during dispute resolution';
COMMENT ON TABLE payout_requests IS 'Cleaner-initiated payout requests';
COMMENT ON TABLE reliability_snapshots IS 'Historical reliability score calculations';
COMMENT ON TABLE cleaner_tier_history IS 'History of cleaner tier promotions/demotions';
COMMENT ON TABLE notification_templates IS 'Templates for email, SMS, and push notifications';
COMMENT ON TABLE admin_audit_log IS 'Comprehensive audit log for admin actions';
COMMENT ON TABLE credit_accounts IS 'User credit balances and lifetime stats';
COMMENT ON TABLE credit_transactions IS 'Complete ledger of credit movements';
COMMENT ON TABLE user_preferences IS 'User notification and display preferences';
COMMENT ON TABLE messages IS 'In-app messaging between users';
COMMENT ON TABLE cleaner_earnings IS 'Individual job earnings for cleaners';
COMMENT ON TABLE reviews IS 'Job reviews and ratings from clients and cleaners';
