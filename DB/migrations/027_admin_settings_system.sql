-- Migration 027: Comprehensive Admin Settings System
-- Allows admins to control absolutely everything from one central location

-- ============================================
-- SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  setting_type TEXT NOT NULL, -- 'platform', 'pricing', 'features', 'notifications', 'security', etc.
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false, -- For API keys, passwords, etc.
  requires_restart BOOLEAN DEFAULT false, -- If changing this requires server restart
  last_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_type ON admin_settings(setting_type);
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);

-- ============================================
-- SETTINGS HISTORY (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  change_reason TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_history_key ON admin_settings_history(setting_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_history_user ON admin_settings_history(changed_by, created_at DESC);

-- ============================================
-- INSERT DEFAULT SETTINGS
-- ============================================

-- PLATFORM SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('platform.name', '"PureTask"'::jsonb, 'platform', 'Platform name displayed to users'),
('platform.maintenance_mode', 'false'::jsonb, 'platform', 'Enable maintenance mode (blocks all users except admins)'),
('platform.maintenance_message', '"We are currently performing maintenance. Please check back soon."'::jsonb, 'platform', 'Message shown during maintenance'),
('platform.registration_enabled', 'true'::jsonb, 'platform', 'Allow new user registrations'),
('platform.booking_enabled', 'true'::jsonb, 'platform', 'Allow new bookings'),
('platform.max_concurrent_bookings', '10'::jsonb, 'platform', 'Maximum bookings a client can have at once'),
('platform.support_email', '"support@puretask.co"'::jsonb, 'platform', 'Support email address'),
('platform.support_phone', '"+1-555-0100"'::jsonb, 'platform', 'Support phone number')
ON CONFLICT (setting_key) DO NOTHING;

-- BOOKING RULES
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('booking.min_hours', '2'::jsonb, 'booking', 'Minimum booking duration in hours'),
('booking.max_hours', '8'::jsonb, 'booking', 'Maximum booking duration in hours'),
('booking.advance_booking_days', '60'::jsonb, 'booking', 'How far in advance bookings can be made'),
('booking.cancellation_window_hours', '24'::jsonb, 'booking', 'Hours before booking when free cancellation is allowed'),
('booking.require_approval', 'false'::jsonb, 'booking', 'Require admin approval for all bookings'),
('booking.auto_confirm_instant_book', 'true'::jsonb, 'booking', 'Auto-confirm bookings with instant book cleaners'),
('booking.buffer_time_minutes', '30'::jsonb, 'booking', 'Minimum time between bookings for same cleaner'),
('booking.allow_same_day', 'true'::jsonb, 'booking', 'Allow same-day bookings')
ON CONFLICT (setting_key) DO NOTHING;

-- PRICING SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('pricing.base_hourly_rate', '35'::jsonb, 'pricing', 'Base price per hour in dollars'),
('pricing.platform_fee_percentage', '20'::jsonb, 'pricing', 'Platform fee percentage (cleaner pays this)'),
('pricing.stripe_fee_percentage', '2.9'::jsonb, 'pricing', 'Stripe transaction fee percentage'),
('pricing.stripe_fee_fixed_cents', '30'::jsonb, 'pricing', 'Stripe fixed fee in cents'),
('pricing.tax_rate_percentage', '0'::jsonb, 'pricing', 'Tax rate percentage (if applicable)'),
('pricing.currency', '"USD"'::jsonb, 'pricing', 'Platform currency'),
('pricing.dynamic_pricing_enabled', 'false'::jsonb, 'pricing', 'Enable AI-powered dynamic pricing'),
('pricing.surge_pricing_enabled', 'false'::jsonb, 'pricing', 'Enable surge pricing during peak times'),
('pricing.surge_multiplier_max', '1.5'::jsonb, 'pricing', 'Maximum surge pricing multiplier')
ON CONFLICT (setting_key) DO NOTHING;

-- CREDIT SYSTEM
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('credits.enabled', 'true'::jsonb, 'credits', 'Enable credit system'),
('credits.cents_per_credit', '100'::jsonb, 'credits', 'How many cents equals one credit'),
('credits.welcome_bonus', '0'::jsonb, 'credits', 'Credits given to new users'),
('credits.referral_bonus_referrer', '50'::jsonb, 'credits', 'Credits given to referrer'),
('credits.referral_bonus_referee', '25'::jsonb, 'credits', 'Credits given to referred user'),
('credits.expiry_days', '365'::jsonb, 'credits', 'Days until credits expire (0 = never)'),
('credits.allow_negative_balance', 'false'::jsonb, 'credits', 'Allow users to have negative credit balance')
ON CONFLICT (setting_key) DO NOTHING;

-- PAYMENT SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description, is_sensitive) VALUES
('payment.stripe_enabled', 'true'::jsonb, 'payment', 'Enable Stripe payments', false),
('payment.stripe_public_key', '""'::jsonb, 'payment', 'Stripe publishable key', false),
('payment.stripe_secret_key', '""'::jsonb, 'payment', 'Stripe secret key', true),
('payment.stripe_webhook_secret', '""'::jsonb, 'payment', 'Stripe webhook secret', true),
('payment.auto_capture', 'true'::jsonb, 'payment', 'Automatically capture payments'),
('payment.require_payment_method', 'true'::jsonb, 'payment', 'Require payment method before booking'),
('payment.save_cards_enabled', 'true'::jsonb, 'payment', 'Allow users to save credit cards')
ON CONFLICT (setting_key) DO NOTHING;

-- PAYOUT SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('payout.frequency', '"weekly"'::jsonb, 'payout', 'Payout frequency: daily, weekly, biweekly, monthly'),
('payout.minimum_amount', '50'::jsonb, 'payout', 'Minimum payout amount in dollars'),
('payout.hold_days', '7'::jsonb, 'payout', 'Days to hold funds before payout'),
('payout.auto_process', 'true'::jsonb, 'payout', 'Automatically process payouts'),
('payout.require_approval', 'false'::jsonb, 'payout', 'Require admin approval for payouts'),
('payout.stripe_connect_enabled', 'true'::jsonb, 'payout', 'Use Stripe Connect for payouts')
ON CONFLICT (setting_key) DO NOTHING;

-- NOTIFICATION SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('notifications.email_enabled', 'true'::jsonb, 'notifications', 'Enable email notifications'),
('notifications.sms_enabled', 'true'::jsonb, 'notifications', 'Enable SMS notifications'),
('notifications.push_enabled', 'true'::jsonb, 'notifications', 'Enable push notifications'),
('notifications.in_app_enabled', 'true'::jsonb, 'notifications', 'Enable in-app notifications'),
('notifications.from_email', '"noreply@puretask.co"'::jsonb, 'notifications', 'From email address'),
('notifications.from_name', '"PureTask"'::jsonb, 'notifications', 'From name for emails'),
('notifications.reply_to_email', '"support@puretask.co"'::jsonb, 'notifications', 'Reply-to email address')
ON CONFLICT (setting_key) DO NOTHING;

-- EMAIL SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description, is_sensitive) VALUES
('email.provider', '"sendgrid"'::jsonb, 'email', 'Email provider: sendgrid, mailgun, ses, smtp', false),
('email.api_key', '""'::jsonb, 'email', 'Email provider API key', true),
('email.smtp_host', '""'::jsonb, 'email', 'SMTP host (if using SMTP)', false),
('email.smtp_port', '587'::jsonb, 'email', 'SMTP port', false),
('email.smtp_username', '""'::jsonb, 'email', 'SMTP username', true),
('email.smtp_password', '""'::jsonb, 'email', 'SMTP password', true),
('email.rate_limit_per_hour', '100'::jsonb, 'email', 'Maximum emails per hour', false)
ON CONFLICT (setting_key) DO NOTHING;

-- SMS SETTINGS (Twilio)
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description, is_sensitive) VALUES
('sms.provider', '"twilio"'::jsonb, 'sms', 'SMS provider: twilio', false),
('sms.twilio_account_sid', '""'::jsonb, 'sms', 'Twilio Account SID', true),
('sms.twilio_auth_token', '""'::jsonb, 'sms', 'Twilio Auth Token', true),
('sms.twilio_phone_number', '""'::jsonb, 'sms', 'Twilio phone number', false),
('sms.rate_limit_per_hour', '50'::jsonb, 'sms', 'Maximum SMS per hour', false)
ON CONFLICT (setting_key) DO NOTHING;

-- FEATURE FLAGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('features.ai_assistant_enabled', 'true'::jsonb, 'features', 'Enable AI Assistant features'),
('features.instant_booking_enabled', 'true'::jsonb, 'features', 'Enable instant booking'),
('features.reviews_enabled', 'true'::jsonb, 'features', 'Enable review system'),
('features.tips_enabled', 'true'::jsonb, 'features', 'Allow tips for cleaners'),
('features.favorites_enabled', 'true'::jsonb, 'features', 'Allow clients to favorite cleaners'),
('features.chat_enabled', 'true'::jsonb, 'features', 'Enable in-app chat'),
('features.video_chat_enabled', 'false'::jsonb, 'features', 'Enable video chat'),
('features.referral_program_enabled', 'true'::jsonb, 'features', 'Enable referral program'),
('features.bundle_offers_enabled', 'true'::jsonb, 'features', 'Enable bundle booking offers'),
('features.subscription_plans_enabled', 'false'::jsonb, 'features', 'Enable subscription plans'),
('features.cleaner_teams_enabled', 'false'::jsonb, 'features', 'Enable cleaner teams'),
('features.property_management_enabled', 'false'::jsonb, 'features', 'Enable property management features')
ON CONFLICT (setting_key) DO NOTHING;

-- AI ASSISTANT SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description, is_sensitive) VALUES
('ai.openai_api_key', '""'::jsonb, 'ai', 'OpenAI API key', true),
('ai.model', '"gpt-4"'::jsonb, 'ai', 'OpenAI model to use', false),
('ai.max_tokens', '500'::jsonb, 'ai', 'Maximum tokens per request', false),
('ai.temperature', '0.7'::jsonb, 'ai', 'AI temperature (0-1, higher = more creative)', false),
('ai.scheduling_enabled', 'true'::jsonb, 'ai', 'Enable AI scheduling suggestions', false),
('ai.communication_enabled', 'true'::jsonb, 'ai', 'Enable AI communication automation', false),
('ai.rate_limit_per_day', '1000'::jsonb, 'ai', 'Maximum AI requests per day', false)
ON CONFLICT (setting_key) DO NOTHING;

-- SECURITY SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('security.password_min_length', '8'::jsonb, 'security', 'Minimum password length'),
('security.password_require_uppercase', 'true'::jsonb, 'security', 'Require uppercase in passwords'),
('security.password_require_numbers', 'true'::jsonb, 'security', 'Require numbers in passwords'),
('security.password_require_special', 'false'::jsonb, 'security', 'Require special characters in passwords'),
('security.max_login_attempts', '5'::jsonb, 'security', 'Maximum failed login attempts before lockout'),
('security.lockout_duration_minutes', '30'::jsonb, 'security', 'Account lockout duration'),
('security.session_timeout_hours', '24'::jsonb, 'security', 'Session timeout in hours'),
('security.require_email_verification', 'true'::jsonb, 'security', 'Require email verification for new accounts'),
('security.two_factor_required_for_admin', 'false'::jsonb, 'security', 'Require 2FA for admin accounts'),
('security.ip_whitelist_enabled', 'false'::jsonb, 'security', 'Enable IP whitelist for admin'),
('security.allowed_admin_ips', '[]'::jsonb, 'security', 'Allowed IP addresses for admin access')
ON CONFLICT (setting_key) DO NOTHING;

-- RATE LIMITING
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('rate_limit.enabled', 'true'::jsonb, 'rate_limit', 'Enable rate limiting'),
('rate_limit.general_requests_per_minute', '60'::jsonb, 'rate_limit', 'General API requests per minute'),
('rate_limit.auth_requests_per_minute', '10'::jsonb, 'rate_limit', 'Authentication requests per minute'),
('rate_limit.booking_requests_per_hour', '20'::jsonb, 'rate_limit', 'Booking requests per hour'),
('rate_limit.strict_mode', 'false'::jsonb, 'rate_limit', 'Strict mode: ban on violation vs just throttle')
ON CONFLICT (setting_key) DO NOTHING;

-- CLEANER TIER SYSTEM
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('tiers.enabled', 'true'::jsonb, 'tiers', 'Enable tier system'),
('tiers.rookie.min_score', '0'::jsonb, 'tiers', 'Minimum score for Rookie tier'),
('tiers.semi_pro.min_score', '70'::jsonb, 'tiers', 'Minimum score for Semi Pro tier'),
('tiers.pro.min_score', '80'::jsonb, 'tiers', 'Minimum score for Pro tier'),
('tiers.gold.min_score', '90'::jsonb, 'tiers', 'Minimum score for Gold tier'),
('tiers.platinum.min_score', '95'::jsonb, 'tiers', 'Minimum score for Platinum tier'),
('tiers.auto_upgrade', 'true'::jsonb, 'tiers', 'Automatically upgrade cleaners based on score'),
('tiers.require_verification_for_upgrade', 'false'::jsonb, 'tiers', 'Require admin verification for tier upgrades')
ON CONFLICT (setting_key) DO NOTHING;

-- REVIEW SYSTEM
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('reviews.enabled', 'true'::jsonb, 'reviews', 'Enable review system'),
('reviews.min_rating', '1'::jsonb, 'reviews', 'Minimum rating value'),
('reviews.max_rating', '5'::jsonb, 'reviews', 'Maximum rating value'),
('reviews.require_booking', 'true'::jsonb, 'reviews', 'Require completed booking to leave review'),
('reviews.editable_hours', '24'::jsonb, 'reviews', 'Hours after posting when review can be edited'),
('reviews.require_moderation', 'false'::jsonb, 'reviews', 'Require admin approval before review is visible'),
('reviews.allow_cleaner_response', 'true'::jsonb, 'reviews', 'Allow cleaners to respond to reviews')
ON CONFLICT (setting_key) DO NOTHING;

-- DISPUTE SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('disputes.enabled', 'true'::jsonb, 'disputes', 'Enable dispute system'),
('disputes.window_days', '7'::jsonb, 'disputes', 'Days after booking when dispute can be filed'),
('disputes.auto_refund_threshold', '0'::jsonb, 'disputes', 'Auto-refund if dispute amount under this (0 = disabled)'),
('disputes.require_evidence', 'true'::jsonb, 'disputes', 'Require photos/evidence for disputes'),
('disputes.max_per_user_per_month', '3'::jsonb, 'disputes', 'Maximum disputes per user per month')
ON CONFLICT (setting_key) DO NOTHING;

-- REFERRAL PROGRAM
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('referral.enabled', 'true'::jsonb, 'referral', 'Enable referral program'),
('referral.referrer_reward_type', '"credits"'::jsonb, 'referral', 'Reward type: credits, percentage_discount, fixed_amount'),
('referral.referrer_reward_amount', '50'::jsonb, 'referral', 'Reward amount for referrer'),
('referral.referee_reward_amount', '25'::jsonb, 'referral', 'Reward amount for referee'),
('referral.minimum_booking_for_reward', '1'::jsonb, 'referral', 'Referee must complete X bookings before reward given'),
('referral.max_referrals_per_user', '0'::jsonb, 'referral', 'Maximum referrals per user (0 = unlimited)')
ON CONFLICT (setting_key) DO NOTHING;

-- ANALYTICS & TRACKING
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description, is_sensitive) VALUES
('analytics.google_analytics_id', '""'::jsonb, 'analytics', 'Google Analytics tracking ID', false),
('analytics.facebook_pixel_id', '""'::jsonb, 'analytics', 'Facebook Pixel ID', false),
('analytics.hotjar_id', '""'::jsonb, 'analytics', 'Hotjar site ID', false),
('analytics.mixpanel_token', '""'::jsonb, 'analytics', 'Mixpanel project token', true),
('analytics.track_user_behavior', 'true'::jsonb, 'analytics', 'Track user behavior for analytics', false)
ON CONFLICT (setting_key) DO NOTHING;

-- API SETTINGS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('api.version', '"v1"'::jsonb, 'api', 'Current API version'),
('api.base_url', '"https://api.puretask.co"'::jsonb, 'api', 'API base URL'),
('api.require_api_key', 'false'::jsonb, 'api', 'Require API key for external integrations'),
('api.cors_enabled', 'true'::jsonb, 'api', 'Enable CORS'),
('api.allowed_origins', '["https://app.puretask.com", "https://admin.puretask.com"]'::jsonb, 'api', 'Allowed CORS origins'),
('api.max_request_size_mb', '10'::jsonb, 'api', 'Maximum request body size in MB')
ON CONFLICT (setting_key) DO NOTHING;

-- WEBHOOKS
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('webhooks.enabled', 'false'::jsonb, 'webhooks', 'Enable webhook system'),
('webhooks.events', '["booking.created", "booking.completed", "payment.succeeded"]'::jsonb, 'webhooks', 'Available webhook events'),
('webhooks.retry_attempts', '3'::jsonb, 'webhooks', 'Number of retry attempts for failed webhooks'),
('webhooks.timeout_seconds', '30'::jsonb, 'webhooks', 'Webhook request timeout')
ON CONFLICT (setting_key) DO NOTHING;

-- BACKUP & MAINTENANCE
INSERT INTO admin_settings (setting_key, setting_value, setting_type, description) VALUES
('backup.enabled', 'true'::jsonb, 'backup', 'Enable automatic backups'),
('backup.frequency', '"daily"'::jsonb, 'backup', 'Backup frequency: hourly, daily, weekly'),
('backup.retention_days', '30'::jsonb, 'backup', 'Days to keep backups'),
('backup.include_files', 'true'::jsonb, 'backup', 'Include uploaded files in backups'),
('maintenance.scheduled', 'false'::jsonb, 'maintenance', 'Scheduled maintenance enabled'),
('maintenance.window_day', '"Sunday"'::jsonb, 'maintenance', 'Scheduled maintenance day'),
('maintenance.window_time', '"02:00"'::jsonb, 'maintenance', 'Scheduled maintenance time (24h format)')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- TRIGGER FOR SETTINGS HISTORY
-- ============================================

CREATE OR REPLACE FUNCTION log_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO admin_settings_history (
    setting_key,
    old_value,
    new_value,
    changed_by,
    ip_address
  ) VALUES (
    OLD.setting_key,
    OLD.setting_value,
    NEW.setting_value,
    NEW.last_updated_by,
    current_setting('request.ip_address', true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_settings_change ON admin_settings;
CREATE TRIGGER trg_log_settings_change
AFTER UPDATE ON admin_settings
FOR EACH ROW
WHEN (OLD.setting_value IS DISTINCT FROM NEW.setting_value)
EXECUTE FUNCTION log_settings_change();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get a setting value
CREATE OR REPLACE FUNCTION get_setting(p_key TEXT, p_default JSONB DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT setting_value INTO v_value
  FROM admin_settings
  WHERE setting_key = p_key;
  
  IF v_value IS NULL THEN
    RETURN p_default;
  END IF;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- Function to update a setting
CREATE OR REPLACE FUNCTION update_setting(
  p_key TEXT,
  p_value JSONB,
  p_updated_by TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE admin_settings
  SET setting_value = p_value,
      last_updated_by = p_updated_by,
      updated_at = NOW()
  WHERE setting_key = p_key;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE admin_settings IS 'Comprehensive system settings controlled by admins';
COMMENT ON TABLE admin_settings_history IS 'Complete audit trail of all settings changes';

SELECT 'Admin Settings System Migration Completed Successfully!' AS status;

