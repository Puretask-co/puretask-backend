-- 014_payout_improvements.sql
-- Payout improvements: reversals, minimum thresholds, retry logic
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- ============================================
-- PAYOUT SETTINGS (Platform-wide + per-cleaner)
-- ============================================

-- Add minimum payout threshold and other settings
ALTER TABLE cleaner_profiles 
  ADD COLUMN IF NOT EXISTS minimum_payout_cents INTEGER DEFAULT 2500,  -- $25 minimum
  ADD COLUMN IF NOT EXISTS payout_schedule TEXT DEFAULT 'weekly',  -- weekly, daily, manual
  ADD COLUMN IF NOT EXISTS instant_payout_enabled BOOLEAN DEFAULT false;

-- ============================================
-- PAYOUT REVERSALS / ADJUSTMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS payout_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id       UUID REFERENCES payouts (id) ON DELETE SET NULL,
  cleaner_id      TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL,  -- reversal, correction, dispute_hold, dispute_release
  amount_cents    INTEGER NOT NULL,  -- positive = add to cleaner, negative = deduct
  reason          TEXT NOT NULL,
  stripe_reversal_id TEXT,  -- If we reversed a Stripe transfer
  initiated_by    TEXT REFERENCES users (id) ON DELETE SET NULL,  -- admin who initiated
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, failed
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payout_adjustments_payout ON payout_adjustments (payout_id);
CREATE INDEX IF NOT EXISTS idx_payout_adjustments_cleaner ON payout_adjustments (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_payout_adjustments_status ON payout_adjustments (status);

-- ============================================
-- PAYOUT RETRY QUEUE
-- ============================================

CREATE TABLE IF NOT EXISTS payout_retry_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id       UUID NOT NULL REFERENCES payouts (id) ON DELETE CASCADE,
  cleaner_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_cents    INTEGER NOT NULL,
  stripe_account_id TEXT,
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  next_retry_at   TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, succeeded, failed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_retry_status ON payout_retry_queue (status);
CREATE INDEX IF NOT EXISTS idx_payout_retry_next ON payout_retry_queue (next_retry_at) WHERE status = 'pending';

-- ============================================
-- SUPPORT TICKETS
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs (id) ON DELETE SET NULL,
  category        TEXT NOT NULL,  -- billing, job_issue, account, payout, dispute, other
  subject         TEXT NOT NULL,
  description     TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'normal',  -- low, normal, high, urgent
  status          TEXT NOT NULL DEFAULT 'open',  -- open, in_progress, waiting_user, resolved, closed
  assigned_to     TEXT REFERENCES users (id) ON DELETE SET NULL,
  resolution      TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_job ON support_tickets (job_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets (priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets (assigned_to);

-- Support ticket messages / thread
CREATE TABLE IF NOT EXISTS support_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES support_tickets (id) ON DELETE CASCADE,
  sender_id       TEXT REFERENCES users (id) ON DELETE SET NULL,
  sender_type     TEXT NOT NULL,  -- user, admin, system
  message         TEXT NOT NULL,
  attachments     JSONB DEFAULT '[]'::jsonb,  -- array of URLs
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages (ticket_id);

-- Trigger for updated_at
CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_payout_retry_updated_at
BEFORE UPDATE ON payout_retry_queue
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- ============================================
-- BACKGROUND CHECK INTEGRATION
-- ============================================

CREATE TABLE IF NOT EXISTS background_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'checkr',  -- checkr, sterling, etc.
  provider_id     TEXT,  -- External ID from provider
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, clear, consider, suspended
  report_url      TEXT,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,  -- Background checks typically valid for 1-2 years
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_checks_cleaner ON background_checks (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_background_checks_status ON background_checks (status);

-- Track cleaner background check requirement
ALTER TABLE cleaner_profiles
  ADD COLUMN IF NOT EXISTS background_check_required BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS background_check_status TEXT DEFAULT 'not_started';  -- not_started, pending, clear, suspended

-- Trigger
CREATE TRIGGER trg_background_checks_updated_at
BEFORE UPDATE ON background_checks
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- ============================================
-- NOTIFICATION LOGS (success tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT REFERENCES users (id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,  -- email, sms, push
  type            TEXT NOT NULL,  -- template type
  recipient       TEXT NOT NULL,  -- email address, phone, device token
  subject         TEXT,
  status          TEXT NOT NULL,  -- sent, delivered, failed, bounced
  provider_id     TEXT,  -- SendGrid message ID, Twilio SID, etc.
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs (status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs (type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs (created_at DESC);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- Cleaners eligible for payout (met minimum threshold)
CREATE OR REPLACE VIEW cleaners_eligible_for_payout AS
SELECT 
  cp.user_id as cleaner_id,
  u.email,
  cp.stripe_account_id,
  cp.minimum_payout_cents,
  COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'pending'), 0) as pending_payout_cents
FROM cleaner_profiles cp
JOIN users u ON u.id = cp.user_id
LEFT JOIN payouts p ON p.cleaner_id = cp.user_id
WHERE cp.stripe_account_id IS NOT NULL
GROUP BY cp.user_id, u.email, cp.stripe_account_id, cp.minimum_payout_cents
HAVING COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'pending'), 0) >= cp.minimum_payout_cents;

-- Comments
COMMENT ON TABLE payout_adjustments IS 'Track payout reversals, corrections, and dispute holds';
COMMENT ON TABLE payout_retry_queue IS 'Queue for retrying failed payout transfers';
COMMENT ON TABLE support_tickets IS 'Customer support ticket system';
COMMENT ON TABLE background_checks IS 'Track background check status for cleaners';
COMMENT ON TABLE notification_logs IS 'Log all sent notifications for tracking and debugging';
