-- Migration 028: Comprehensive Cleaner AI Assistant Settings Suite
-- Gives cleaners complete control over their AI Assistant

-- ============================================
-- CLEANER AI SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setting_category TEXT NOT NULL, -- 'communication', 'scheduling', 'matching', 'preferences', etc.
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cleaner_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_ai_settings_cleaner ON cleaner_ai_settings(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_ai_settings_category ON cleaner_ai_settings(cleaner_id, setting_category);
CREATE INDEX IF NOT EXISTS idx_cleaner_ai_settings_enabled ON cleaner_ai_settings(cleaner_id, is_enabled);

-- ============================================
-- AI AUTOMATION TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_ai_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL, -- 'booking_confirmation', 'reminder', 'on_my_way', etc.
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb, -- Available variables like {client_name}, {date}, etc.
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_ai_templates_cleaner ON cleaner_ai_templates(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_ai_templates_type ON cleaner_ai_templates(cleaner_id, template_type);
CREATE INDEX IF NOT EXISTS idx_cleaner_ai_templates_active ON cleaner_ai_templates(cleaner_id, is_active);

-- ============================================
-- QUICK RESPONSES LIBRARY
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_quick_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_category TEXT NOT NULL, -- 'pricing', 'availability', 'services', 'policies'
  trigger_keywords TEXT[], -- Keywords that suggest this response
  response_text TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_quick_responses_cleaner ON cleaner_quick_responses(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_quick_responses_category ON cleaner_quick_responses(cleaner_id, response_category);
CREATE INDEX IF NOT EXISTS idx_cleaner_quick_responses_keywords ON cleaner_quick_responses USING gin(trigger_keywords);

-- ============================================
-- AI PERFORMANCE PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Communication Style
  communication_tone TEXT DEFAULT 'professional_friendly', -- 'professional', 'friendly', 'professional_friendly', 'casual'
  formality_level INTEGER DEFAULT 3, -- 1-5 scale
  emoji_usage TEXT DEFAULT 'moderate', -- 'none', 'minimal', 'moderate', 'frequent'
  
  -- Response Timing
  response_speed TEXT DEFAULT 'balanced', -- 'immediate', 'balanced', 'thoughtful'
  business_hours_only BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  -- Automation Level
  full_automation_enabled BOOLEAN DEFAULT false,
  require_approval_for_bookings BOOLEAN DEFAULT true,
  auto_accept_instant_book BOOLEAN DEFAULT true,
  auto_decline_outside_hours BOOLEAN DEFAULT false,
  
  -- Smart Features
  learn_from_responses BOOLEAN DEFAULT true,
  suggest_better_responses BOOLEAN DEFAULT true,
  auto_improve_templates BOOLEAN DEFAULT false,
  
  -- Privacy & Data
  share_anonymized_data BOOLEAN DEFAULT true,
  allow_ai_training BOOLEAN DEFAULT true,
  
  -- Goals & Priorities
  priority_goal TEXT DEFAULT 'balanced', -- 'maximize_bookings', 'quality_clients', 'balanced', 'work_life_balance'
  target_weekly_hours INTEGER,
  preferred_booking_size TEXT DEFAULT 'any', -- 'small', 'medium', 'large', 'any'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INSERT DEFAULT AI SETTINGS FOR EXISTING CLEANERS
-- ============================================

-- This will create default settings for all existing cleaners
INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'communication',
  'booking_confirmation.enabled',
  'true'::jsonb,
  'Send automatic booking confirmations'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'communication',
  'booking_confirmation.channels',
  '["email", "in_app"]'::jsonb,
  'Channels for booking confirmations'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'communication',
  'pre_cleaning_reminder.enabled',
  'true'::jsonb,
  'Send reminders before cleaning'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'communication',
  'pre_cleaning_reminder.hours_before',
  '24'::jsonb,
  'Hours before cleaning to send reminder'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'scheduling',
  'ai_scheduling.enabled',
  'false'::jsonb,
  'Enable AI-powered schedule optimization'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'scheduling',
  'gap_filling.enabled',
  'true'::jsonb,
  'Prioritize filling gaps in schedule'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'scheduling',
  'suggestion_window_days',
  '14'::jsonb,
  'Days in advance to suggest bookings'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'matching',
  'auto_match.enabled',
  'true'::jsonb,
  'Enable AI client matching'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'matching',
  'preferred_client_types',
  '[]'::jsonb,
  'Preferred client types for matching'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'notifications',
  'new_booking_alert',
  'true'::jsonb,
  'Alert on new booking opportunities'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'notifications',
  'daily_summary.enabled',
  'true'::jsonb,
  'Receive daily AI summary'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

INSERT INTO cleaner_ai_settings (cleaner_id, setting_category, setting_key, setting_value, description)
SELECT 
  user_id,
  'notifications',
  'performance_insights.enabled',
  'true'::jsonb,
  'Receive AI performance insights'
FROM cleaner_profiles
ON CONFLICT (cleaner_id, setting_key) DO NOTHING;

-- ============================================
-- DEFAULT TEMPLATES FOR ALL CLEANERS
-- ============================================

-- Booking Confirmation Template
INSERT INTO cleaner_ai_templates (cleaner_id, template_type, template_name, template_content, variables, is_default, is_active)
SELECT 
  user_id,
  'booking_confirmation',
  'Default Confirmation',
  'Hi {client_name}! 👋 Your cleaning is confirmed for {date} at {time}. I''ll bring all necessary supplies and can''t wait to make your space sparkle! See you then! - {cleaner_name}',
  '["client_name", "date", "time", "cleaner_name", "address"]'::jsonb,
  true,
  true
FROM cleaner_profiles
ON CONFLICT DO NOTHING;

-- Pre-Cleaning Reminder Template
INSERT INTO cleaner_ai_templates (cleaner_id, template_type, template_name, template_content, variables, is_default, is_active)
SELECT 
  user_id,
  'pre_cleaning_reminder',
  'Default Reminder',
  'Hi {client_name}! Just a friendly reminder that I''ll be cleaning your place tomorrow at {time}. Please ensure I can access the property. Thanks! 🧹 - {cleaner_name}',
  '["client_name", "time", "cleaner_name", "address"]'::jsonb,
  true,
  true
FROM cleaner_profiles
ON CONFLICT DO NOTHING;

-- On My Way Template
INSERT INTO cleaner_ai_templates (cleaner_id, template_type, template_name, template_content, variables, is_default, is_active)
SELECT 
  user_id,
  'on_my_way',
  'Default On My Way',
  'Hi {client_name}! I''m on my way to your place. ETA: {eta} minutes. See you soon! 🚗 - {cleaner_name}',
  '["client_name", "eta", "cleaner_name"]'::jsonb,
  true,
  true
FROM cleaner_profiles
ON CONFLICT DO NOTHING;

-- ============================================
-- DEFAULT QUICK RESPONSES
-- ============================================

-- Pricing Responses
INSERT INTO cleaner_quick_responses (cleaner_id, response_category, trigger_keywords, response_text)
SELECT 
  user_id,
  'pricing',
  ARRAY['price', 'cost', 'rate', 'how much'],
  'My rates depend on the size of your space and type of cleaning needed. For a detailed quote, could you share your home size (sq ft or bedrooms/bathrooms) and the type of cleaning you''re looking for? I offer basic, deep, and move-out cleaning options.'
FROM cleaner_profiles
ON CONFLICT DO NOTHING;

-- Availability Responses
INSERT INTO cleaner_quick_responses (cleaner_id, response_category, trigger_keywords, response_text)
SELECT 
  user_id,
  'availability',
  ARRAY['available', 'schedule', 'when', 'appointment'],
  'I''d be happy to help! What date and time works best for you? I typically have openings throughout the week and can accommodate most schedules.'
FROM cleaner_profiles
ON CONFLICT DO NOTHING;

-- Services Responses
INSERT INTO cleaner_quick_responses (cleaner_id, response_category, trigger_keywords, response_text)
SELECT 
  user_id,
  'services',
  ARRAY['services', 'what do you clean', 'include', 'provide'],
  'I provide comprehensive cleaning services including: general housekeeping, deep cleaning, move-in/out cleaning, and specialized services like window cleaning and appliance cleaning. All supplies included! What specific service are you interested in?'
FROM cleaner_profiles
ON CONFLICT DO NOTHING;

-- ============================================
-- DEFAULT AI PREFERENCES FOR EXISTING CLEANERS
-- ============================================

INSERT INTO cleaner_ai_preferences (cleaner_id)
SELECT user_id FROM cleaner_profiles
ON CONFLICT (cleaner_id) DO NOTHING;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get all settings for a cleaner
CREATE OR REPLACE FUNCTION get_cleaner_ai_settings(p_cleaner_id TEXT)
RETURNS TABLE (
  category TEXT,
  key TEXT,
  value JSONB,
  description TEXT,
  is_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    setting_category,
    setting_key,
    setting_value,
    description,
    is_enabled
  FROM cleaner_ai_settings
  WHERE cleaner_id = p_cleaner_id
  ORDER BY setting_category, setting_key;
END;
$$ LANGUAGE plpgsql;

-- Update cleaner AI setting
CREATE OR REPLACE FUNCTION update_cleaner_ai_setting(
  p_cleaner_id TEXT,
  p_key TEXT,
  p_value JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE cleaner_ai_settings
  SET setting_value = p_value,
      last_updated_at = NOW()
  WHERE cleaner_id = p_cleaner_id
    AND setting_key = p_key;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get cleaner's active templates
CREATE OR REPLACE FUNCTION get_active_templates(p_cleaner_id TEXT)
RETURNS TABLE (
  template_type TEXT,
  template_name TEXT,
  template_content TEXT,
  variables JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.template_type,
    t.template_name,
    t.template_content,
    t.variables
  FROM cleaner_ai_templates t
  WHERE t.cleaner_id = p_cleaner_id
    AND t.is_active = true
  ORDER BY t.template_type, t.is_default DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE cleaner_ai_settings IS 'Individual AI Assistant settings for each cleaner';
COMMENT ON TABLE cleaner_ai_templates IS 'Customizable message templates for AI automation';
COMMENT ON TABLE cleaner_quick_responses IS 'Quick response library for common client questions';
COMMENT ON TABLE cleaner_ai_preferences IS 'Overall AI behavior preferences for each cleaner';

SELECT 'Cleaner AI Settings Suite Migration Completed Successfully!' AS status;

