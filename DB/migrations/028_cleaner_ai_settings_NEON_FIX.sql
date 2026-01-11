-- Migration 028: Comprehensive Cleaner AI Assistant Settings Suite (NEON COMPATIBLE)
-- Gives cleaners complete control over their AI Assistant
-- FIXED: Removed foreign key constraints

-- ============================================
-- CLEANER AI SETTINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL,
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
  cleaner_id TEXT NOT NULL,
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
  cleaner_id TEXT NOT NULL,
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
  cleaner_id TEXT NOT NULL UNIQUE,
  
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
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_ai_preferences_cleaner ON cleaner_ai_preferences(cleaner_id);

-- ============================================
-- INSERT DEFAULT TEMPLATES
-- ============================================

INSERT INTO cleaner_ai_templates (cleaner_id, template_type, template_name, template_content, variables, is_default, is_active) VALUES
('DEFAULT', 'booking_confirmation', 'Standard Booking Confirmation', 
 'Hi {client_name}! Thank you for booking with me. Your {service_type} is confirmed for {date} at {time}. I''ll see you at {property_address}!',
 '["client_name", "service_type", "date", "time", "property_address"]'::jsonb, true, true),
 
('DEFAULT', 'on_my_way', 'On My Way Message',
 'Hi {client_name}! I''m on my way and should arrive in about {eta_minutes} minutes. See you soon!',
 '["client_name", "eta_minutes"]'::jsonb, true, true),
 
('DEFAULT', 'running_late', 'Running Late Notification',
 'Hi {client_name}, I''m running a bit late due to {reason}. I should be there in about {eta_minutes} minutes. Sorry for the inconvenience!',
 '["client_name", "reason", "eta_minutes"]'::jsonb, true, true),
 
('DEFAULT', 'job_complete', 'Job Completion Message',
 'Hi {client_name}! All done! Your {property_type} is sparkling clean. Please let me know if you need anything else!',
 '["client_name", "property_type"]'::jsonb, true, true),
 
('DEFAULT', 'review_request', 'Review Request',
 'Hi {client_name}! I hope you''re happy with the cleaning! If you have a moment, I''d really appreciate a review. Thank you!',
 '["client_name"]'::jsonb, true, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- INSERT DEFAULT QUICK RESPONSES
-- ============================================

INSERT INTO cleaner_quick_responses (cleaner_id, response_category, trigger_keywords, response_text, is_favorite) VALUES
('DEFAULT', 'pricing', ARRAY['how much', 'price', 'cost', 'rate'], 'My standard cleaning rate is $X per hour. Deep cleaning starts at $Y. Would you like a custom quote for your space?', true),
('DEFAULT', 'availability', ARRAY['available', 'when', 'schedule'], 'I typically have availability on weekdays and some weekends. What day works best for you?', true),
('DEFAULT', 'services', ARRAY['what do you clean', 'services', 'include'], 'I offer standard cleaning, deep cleaning, and move-in/move-out services. Each includes all rooms, surfaces, and floors!', true),
('DEFAULT', 'supplies', ARRAY['supplies', 'products', 'bring'], 'I bring all my own professional-grade supplies and equipment. If you prefer specific products, just let me know!', false),
('DEFAULT', 'pets', ARRAY['pet', 'dog', 'cat'], 'I love pets! I''m comfortable cleaning around friendly animals. Just let me know about any special considerations!', false)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE cleaner_ai_settings IS 'AI Assistant settings for each cleaner';
COMMENT ON TABLE cleaner_ai_templates IS 'Message templates for automated communication';
COMMENT ON TABLE cleaner_quick_responses IS 'Quick response library for common questions';
COMMENT ON TABLE cleaner_ai_preferences IS 'AI behavior and personality preferences';

SELECT 'Cleaner AI Settings Suite Migration Completed Successfully!' AS status;

