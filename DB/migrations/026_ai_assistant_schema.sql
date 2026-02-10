-- Migration 026: AI Assistant System Schema
-- Adds all necessary fields and tables for AI assistant functionality

-- ============================================
-- STEP 1: Extend cleaner_profiles for AI settings
-- ============================================

ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS communication_settings JSONB DEFAULT '{
  "ai_scheduling_enabled": false,
  "suggest_days_in_advance": 14,
  "prioritize_gap_filling": true,
  "notify_client_not_interested": true,
  
  "booking_confirmation": {
    "enabled": true,
    "channels": ["email", "in_app"],
    "custom_template": "Hi {client_name}! Your cleaning is confirmed for {date} at {time}. Looking forward to making your space sparkle! - {cleaner_name}"
  },
  
  "pre_cleaning_reminder": {
    "enabled": true,
    "days_before": 1,
    "channels": ["sms", "email"],
    "custom_template": "Hi {client_name}! Just a reminder that I''ll be cleaning your place tomorrow at {time}. Please ensure access is available. Thanks! - {cleaner_name}"
  },
  
  "on_my_way": {
    "enabled": true,
    "channels": ["sms", "in_app"],
    "include_eta": true,
    "custom_template": "Hi {client_name}! I''m on my way to your place. ETA: {eta} minutes. See you soon! - {cleaner_name}"
  },
  
  "post_cleaning_summary": {
    "enabled": true,
    "channels": ["email", "in_app"],
    "custom_template": "Hi {client_name}! Your cleaning is complete. Thanks for having me! - {cleaner_name}"
  },
  
  "review_request": {
    "enabled": true,
    "hours_after_completion": 24,
    "channels": ["email", "in_app"],
    "custom_template": "Hi {client_name}! I hope you love your clean space! If you have a moment, I''d really appreciate a review. {review_link}"
  },
  
  "reengagement": {
    "enabled": false,
    "inactive_after_weeks": 8,
    "target_booking_count": 3,
    "discount_percentage": 15,
    "channels": ["email"],
    "custom_template": "Hi {client_name}! It''s been a while! I''d love to help make your home sparkle again. {discount_text} - {cleaner_name}"
  }
}'::jsonb;

ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS ai_onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS ai_features_active_count INTEGER DEFAULT 0;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS last_ai_interaction_at TIMESTAMPTZ;

-- Add specialty tags and services if not exists
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS offers_additional_services TEXT[] DEFAULT '{}';

-- ============================================
-- STEP 2: Message Delivery Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS message_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type TEXT NOT NULL,
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  channels TEXT[] NOT NULL,
  delivery_results JSONB NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_message_delivery_cleaner ON message_delivery_log(cleaner_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_delivery_client ON message_delivery_log(client_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_delivery_type ON message_delivery_log(message_type, sent_at DESC);

-- ============================================
-- STEP 3: AI Suggestions Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL, -- 'booking_slot', 'message_response', 'schedule_optimization'
  suggestion_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  feedback_rating INTEGER, -- 1-5 stars
  feedback_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_cleaner ON ai_suggestions(cleaner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(suggestion_type);

-- ============================================
-- STEP 4: AI Activity Log
-- ============================================

CREATE TABLE IF NOT EXISTS ai_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'message_sent', 'suggestion_made', 'booking_matched', etc.
  activity_description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_activity_actor ON ai_activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_activity_type ON ai_activity_log(activity_type, created_at DESC);

-- ============================================
-- STEP 5: Booking Request Extensions
-- ============================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_suggested_slots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_match_score INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ai_match_reasoning TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS request_expires_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS provisional_slot_expires_at TIMESTAMPTZ;

-- ============================================
-- STEP 6: Client Preferences for AI Matching
-- ============================================

ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS communication_preferences JSONB DEFAULT '{
  "preferred_channels": ["email", "in_app"],
  "quiet_hours_start": "21:00",
  "quiet_hours_end": "08:00",
  "language": "en"
}'::jsonb;

ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS preferred_cleaner_attributes JSONB DEFAULT '{
  "specialties": [],
  "must_have_services": [],
  "preferred_gender": null,
  "eco_friendly_required": false,
  "pet_experience_required": false
}'::jsonb;

-- ============================================
-- STEP 7: Analytics Tables
-- ============================================

CREATE TABLE IF NOT EXISTS ai_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  metric_type TEXT NOT NULL,
  cleaner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_date, metric_type, cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_metrics_date ON ai_performance_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_cleaner ON ai_performance_metrics(cleaner_id, metric_date DESC);

-- ============================================
-- STEP 8: Template Variables Documentation
-- ============================================

COMMENT ON COLUMN cleaner_profiles.communication_settings IS 'AI-powered communication automation settings. Available template variables: {client_name}, {cleaner_name}, {date}, {time}, {address}, {eta}, {hours}, {review_link}, {discount_text}';

-- ============================================
-- STEP 9: Helper Functions
-- ============================================

-- Function to get cleaner's active AI features count
CREATE OR REPLACE FUNCTION count_active_ai_features(p_cleaner_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  settings JSONB;
  feature_count INTEGER := 0;
BEGIN
  SELECT communication_settings INTO settings
  FROM cleaner_profiles
  WHERE user_id = p_cleaner_id;
  
  IF settings IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Count enabled features
  IF (settings->'booking_confirmation'->>'enabled')::boolean THEN feature_count := feature_count + 1; END IF;
  IF (settings->'pre_cleaning_reminder'->>'enabled')::boolean THEN feature_count := feature_count + 1; END IF;
  IF (settings->'on_my_way'->>'enabled')::boolean THEN feature_count := feature_count + 1; END IF;
  IF (settings->'post_cleaning_summary'->>'enabled')::boolean THEN feature_count := feature_count + 1; END IF;
  IF (settings->'review_request'->>'enabled')::boolean THEN feature_count := feature_count + 1; END IF;
  IF (settings->'reengagement'->>'enabled')::boolean THEN feature_count := feature_count + 1; END IF;
  IF (settings->>'ai_scheduling_enabled')::boolean THEN feature_count := feature_count + 1; END IF;
  
  RETURN feature_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update active feature count
CREATE OR REPLACE FUNCTION update_ai_features_count()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ai_features_active_count := count_active_ai_features(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_ai_features_count
BEFORE UPDATE OF communication_settings ON cleaner_profiles
FOR EACH ROW
EXECUTE FUNCTION update_ai_features_count();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

SELECT 'AI Assistant Schema Migration Completed Successfully!' AS status;

