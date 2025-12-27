-- Migration 025: Authentication Enhancements
-- Email verification, password reset, 2FA, session management, OAuth support
-- Created: 2025-12-27

-- ============================================
-- 1. EMAIL VERIFICATION
-- ============================================

-- Add email verification fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Index for quick lookup of verification tokens
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token 
  ON users(email_verification_token) 
  WHERE email_verification_token IS NOT NULL;

-- ============================================
-- 2. PASSWORD RESET
-- ============================================

-- Add password reset fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Index for quick lookup of reset tokens
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token 
  ON users(password_reset_token) 
  WHERE password_reset_token IS NOT NULL;

-- ============================================
-- 3. TWO-FACTOR AUTHENTICATION (2FA)
-- ============================================

-- Add 2FA fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_method TEXT; -- 'totp' or 'sms'
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT; -- TOTP secret
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_phone TEXT; -- Phone for SMS 2FA
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[]; -- Backup codes
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMPTZ;

-- 2FA verification codes table (for SMS 2FA)
CREATE TABLE IF NOT EXISTS two_factor_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  method TEXT NOT NULL, -- 'sms' or 'totp'
  phone TEXT, -- Phone number for SMS
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_codes_user_id ON two_factor_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_codes_code ON two_factor_codes(code) WHERE NOT used;
CREATE INDEX IF NOT EXISTS idx_two_factor_codes_expires_at ON two_factor_codes(expires_at);

-- ============================================
-- 4. SESSION MANAGEMENT
-- ============================================

-- Sessions table for token tracking and revocation
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_jti TEXT NOT NULL, -- JWT ID (jti claim)
  device_info JSONB, -- User agent, device type, etc.
  ip_address TEXT,
  country TEXT,
  city TEXT,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_jti ON user_sessions(token_jti) WHERE NOT revoked;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked ON user_sessions(revoked) WHERE NOT revoked;

-- Add last login tracking to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;

-- ============================================
-- 5. OAUTH PROVIDERS
-- ============================================

-- OAuth accounts table (Google, Facebook, etc.)
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google', 'facebook', 'apple', etc.
  provider_account_id TEXT NOT NULL, -- User ID from provider
  provider_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  profile_data JSONB, -- Store provider profile data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_accounts_provider_id 
  ON oauth_accounts(provider, provider_account_id);

-- ============================================
-- 6. SECURITY AUDIT LOG
-- ============================================

-- Security events table for audit trail
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'login', 'logout', 'password_change', 'email_verification', '2fa_enabled', etc.
  status TEXT NOT NULL, -- 'success', 'failed', 'suspicious'
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_status ON security_events(status) WHERE status IN ('failed', 'suspicious');

-- ============================================
-- 7. LOGIN ATTEMPTS TRACKING (Rate Limiting)
-- ============================================

-- Track failed login attempts for rate limiting and security
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  user_agent TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success, created_at DESC);

-- Account lockout tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;

-- ============================================
-- 8. EMAIL CHANGE VERIFICATION
-- ============================================

-- Pending email changes table (verify new email before updating)
CREATE TABLE IF NOT EXISTS email_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  verification_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_id ON email_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_email_change_requests_token 
  ON email_change_requests(verification_token) 
  WHERE NOT verified;

-- ============================================
-- 9. TRUSTED DEVICES
-- ============================================

-- Trusted devices table (skip 2FA for trusted devices)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_info JSONB,
  ip_address TEXT,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  trusted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint 
  ON trusted_devices(user_id, device_fingerprint) 
  WHERE NOT revoked;

-- ============================================
-- 10. NOTIFICATION PREFERENCES FOR AUTH
-- ============================================

-- Add auth-related notification preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_login_from_new_device BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_password_changed BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_email_changed BOOLEAN DEFAULT TRUE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS notify_2fa_disabled BOOLEAN DEFAULT TRUE;

-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_auth_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Clean up expired email verification tokens
  UPDATE users 
  SET email_verification_token = NULL,
      email_verification_token_expires_at = NULL
  WHERE email_verification_token_expires_at < NOW()
    AND email_verification_token IS NOT NULL;
  
  -- Clean up expired password reset tokens
  UPDATE users 
  SET password_reset_token = NULL,
      password_reset_token_expires_at = NULL
  WHERE password_reset_token_expires_at < NOW()
    AND password_reset_token IS NOT NULL;
  
  -- Clean up expired 2FA codes
  DELETE FROM two_factor_codes 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Clean up expired sessions
  DELETE FROM user_sessions 
  WHERE expires_at < NOW();
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke all user sessions (logout from all devices)
CREATE OR REPLACE FUNCTION revoke_all_user_sessions(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  UPDATE user_sessions 
  SET revoked = TRUE,
      revoked_at = NOW(),
      revoked_reason = 'user_logout_all'
  WHERE user_id = p_user_id
    AND NOT revoked;
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log security event
CREATE OR REPLACE FUNCTION log_security_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_status TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO security_events (
    user_id,
    event_type,
    status,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_user_id,
    p_event_type,
    p_status,
    p_ip_address,
    p_user_agent,
    p_metadata
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE user_sessions IS 'Active JWT sessions for tracking and revocation';
COMMENT ON TABLE oauth_accounts IS 'OAuth provider accounts (Google, Facebook, etc.)';
COMMENT ON TABLE two_factor_codes IS 'Temporary 2FA verification codes (SMS)';
COMMENT ON TABLE security_events IS 'Audit log for all security-related events';
COMMENT ON TABLE login_attempts IS 'Track login attempts for rate limiting and security';
COMMENT ON TABLE email_change_requests IS 'Pending email change verifications';
COMMENT ON TABLE trusted_devices IS 'Devices that can skip 2FA verification';

COMMENT ON COLUMN users.email_verified IS 'Whether user has verified their email address';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether user has enabled 2FA';
COMMENT ON COLUMN users.two_factor_method IS 'Type of 2FA: totp or sms';
COMMENT ON COLUMN users.two_factor_secret IS 'TOTP secret for authenticator apps';
COMMENT ON COLUMN users.two_factor_backup_codes IS 'Array of one-time backup codes';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp due to failed logins';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 025: Authentication enhancements completed successfully';
  RAISE NOTICE '   - Email verification support added';
  RAISE NOTICE '   - Password reset flow added';
  RAISE NOTICE '   - 2FA (TOTP + SMS) support added';
  RAISE NOTICE '   - Session management and revocation added';
  RAISE NOTICE '   - OAuth provider support added (Google, Facebook)';
  RAISE NOTICE '   - Security audit logging added';
  RAISE NOTICE '   - Login attempt tracking and account lockout added';
  RAISE NOTICE '   - Trusted devices support added';
END $$;

