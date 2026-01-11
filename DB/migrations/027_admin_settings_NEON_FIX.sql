-- Migration 027: Comprehensive Admin Settings System (NEON COMPATIBLE)
-- Allows admins to control absolutely everything from one central location
-- FIXED: Removed foreign key constraints

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
  last_updated_by TEXT,
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
  changed_by TEXT,
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
('platform.support_email', '"support@puretask.com"'::jsonb, 'platform', 'Support email address'),
('platform.support_phone', '"+1 (555) 123-4567"'::jsonb, 'platform', 'Support phone number'),
('pricing.commission_rate', '0.15'::jsonb, 'pricing', 'Platform commission rate (0.15 = 15%)'),
('pricing.minimum_booking_amount', '50.00'::jsonb, 'pricing', 'Minimum booking amount in dollars'),
('features.ai_assistant_enabled', 'true'::jsonb, 'features', 'Enable AI Assistant for cleaners'),
('features.gamification_enabled', 'true'::jsonb, 'features', 'Enable gamification system'),
('security.max_login_attempts', '5'::jsonb, 'security', 'Maximum failed login attempts before lockout')
ON CONFLICT (setting_key) DO NOTHING;

COMMENT ON TABLE admin_settings IS 'Centralized admin settings for platform configuration';
COMMENT ON TABLE admin_settings_history IS 'Audit trail for all settings changes';

SELECT 'Admin Settings System Migration Completed Successfully!' AS status;

