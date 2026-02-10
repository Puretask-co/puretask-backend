-- Migration 030: Interactive Onboarding & Gamification System
-- Includes: onboarding progress, achievements, certifications, template library

-- ============================================
-- ONBOARDING PROGRESS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Setup Progress
  setup_wizard_completed BOOLEAN DEFAULT false,
  setup_wizard_step INTEGER DEFAULT 0,
  setup_wizard_completed_at TIMESTAMPTZ,
  
  -- Profile Completion
  profile_completion_percentage INTEGER DEFAULT 0,
  profile_photo_uploaded BOOLEAN DEFAULT false,
  bio_completed BOOLEAN DEFAULT false,
  services_defined BOOLEAN DEFAULT false,
  availability_set BOOLEAN DEFAULT false,
  pricing_configured BOOLEAN DEFAULT false,
  
  -- AI Configuration
  ai_personality_set BOOLEAN DEFAULT false,
  templates_customized INTEGER DEFAULT 0,
  quick_responses_added INTEGER DEFAULT 0,
  first_template_used BOOLEAN DEFAULT false,
  
  -- Feature Discovery
  viewed_insights_dashboard BOOLEAN DEFAULT false,
  exported_settings BOOLEAN DEFAULT false,
  created_custom_template BOOLEAN DEFAULT false,
  marked_favorite_response BOOLEAN DEFAULT false,
  
  -- Tutorial Progress
  tooltip_dismissed_count INTEGER DEFAULT 0,
  tutorial_videos_watched JSONB DEFAULT '[]'::jsonb,
  help_articles_read JSONB DEFAULT '[]'::jsonb,
  
  -- Engagement Metrics
  days_since_signup INTEGER DEFAULT 0,
  total_logins INTEGER DEFAULT 1,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  onboarding_abandoned BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_cleaner ON cleaner_onboarding_progress(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_completion ON cleaner_onboarding_progress(profile_completion_percentage);
CREATE INDEX IF NOT EXISTS idx_onboarding_wizard ON cleaner_onboarding_progress(setup_wizard_completed);

-- ============================================
-- ACHIEVEMENTS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'onboarding', 'activity', 'quality', 'milestone'
  tier TEXT NOT NULL DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
  icon TEXT, -- emoji or icon name
  points INTEGER NOT NULL DEFAULT 10,
  criteria JSONB NOT NULL, -- What needs to be achieved
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_active ON achievements(is_active);

-- ============================================
-- USER ACHIEVEMENTS (EARNED BADGES)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen BOOLEAN DEFAULT false,
  progress_percentage INTEGER DEFAULT 100,
  UNIQUE(cleaner_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_achievements_cleaner ON cleaner_achievements(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_achievements_unseen ON cleaner_achievements(cleaner_id, seen) WHERE seen = false;

-- ============================================
-- CERTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  level INTEGER NOT NULL, -- 1=Beginner, 2=Pro, 3=Expert, 4=Master
  icon TEXT,
  badge_color TEXT DEFAULT '#3B82F6',
  requirements JSONB NOT NULL, -- What's needed to earn
  benefits TEXT[], -- What you get with this cert
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certifications_level ON certifications(level);
CREATE INDEX IF NOT EXISTS idx_certifications_active ON certifications(is_active);

-- ============================================
-- USER CERTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  certificate_url TEXT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(cleaner_id, certification_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_certifications_cleaner ON cleaner_certifications(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_certifications_active ON cleaner_certifications(cleaner_id, is_active);

-- ============================================
-- TEMPLATE LIBRARY (SHARED TEMPLATES)
-- ============================================

CREATE TABLE IF NOT EXISTS template_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT NOT NULL, -- 'residential', 'commercial', 'luxury', 'general'
  subcategory TEXT,
  description TEXT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  
  -- Ratings & Usage
  rating_average DECIMAL(3,2) DEFAULT 0.00,
  rating_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  
  -- Moderation
  is_featured BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Tags for searchability
  tags TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_library_type ON template_library(template_type);
CREATE INDEX IF NOT EXISTS idx_template_library_category ON template_library(category);
CREATE INDEX IF NOT EXISTS idx_template_library_featured ON template_library(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_template_library_rating ON template_library(rating_average DESC);
CREATE INDEX IF NOT EXISTS idx_template_library_tags ON template_library USING gin(tags);

-- ============================================
-- TEMPLATE LIBRARY RATINGS
-- ============================================

CREATE TABLE IF NOT EXISTS template_library_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES template_library(id) ON DELETE CASCADE,
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_template_ratings_template ON template_library_ratings(template_id);

-- ============================================
-- USER SAVED TEMPLATES (FROM LIBRARY)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_saved_library_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  library_template_id UUID NOT NULL REFERENCES template_library(id) ON DELETE CASCADE,
  customized_content TEXT,
  is_active BOOLEAN DEFAULT true,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cleaner_id, library_template_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_templates_cleaner ON cleaner_saved_library_templates(cleaner_id);

-- ============================================
-- TOOLTIPS & IN-APP TUTORIALS
-- ============================================

CREATE TABLE IF NOT EXISTS app_tooltips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tooltip_key TEXT NOT NULL UNIQUE,
  target_element TEXT NOT NULL, -- CSS selector or identifier
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  position TEXT DEFAULT 'bottom', -- 'top', 'bottom', 'left', 'right'
  trigger_condition TEXT, -- When to show
  display_order INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tooltips_active ON app_tooltips(is_active);

-- ============================================
-- USER TOOLTIP INTERACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_tooltip_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tooltip_id UUID NOT NULL REFERENCES app_tooltips(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  marked_helpful BOOLEAN,
  UNIQUE(cleaner_id, tooltip_id)
);

CREATE INDEX IF NOT EXISTS idx_tooltip_interactions_cleaner ON cleaner_tooltip_interactions(cleaner_id);

-- ============================================
-- INSERT DEFAULT ACHIEVEMENTS
-- ============================================

INSERT INTO achievements (achievement_key, name, description, category, tier, icon, points, criteria) VALUES
('first_login', 'Welcome Aboard! 🎉', 'Logged in to PureTask for the first time', 'onboarding', 'bronze', '👋', 5, '{"action": "login", "count": 1}'::jsonb),
('profile_complete', 'Profile Pro 📋', 'Completed your profile 100%', 'onboarding', 'silver', '✅', 20, '{"profile_completion": 100}'::jsonb),
('wizard_complete', 'AI Wizard 🧙', 'Completed the AI setup wizard', 'onboarding', 'silver', '🎓', 15, '{"setup_wizard_completed": true}'::jsonb),
('first_template', 'Template Tester 📝', 'Used your first AI template', 'activity', 'bronze', '📝', 10, '{"first_template_used": true}'::jsonb),
('template_creator', 'Template Creator ✨', 'Created your own custom template', 'activity', 'silver', '✨', 15, '{"created_custom_template": true}'::jsonb),
('customizer', 'Personalization Pro 🎨', 'Customized 5 templates to match your style', 'activity', 'gold', '🎨', 25, '{"templates_customized": 5}'::jsonb),
('quick_responder', 'Quick Responder 💬', 'Added 5 quick responses', 'activity', 'bronze', '💬', 10, '{"quick_responses_added": 5}'::jsonb),
('first_week', 'Week One Warrior 🗓️', 'Active for 7 days', 'milestone', 'silver', '🗓️', 20, '{"days_since_signup": 7}'::jsonb),
('first_month', 'Monthly Master 📅', 'Active for 30 days', 'milestone', 'gold', '📅', 50, '{"days_since_signup": 30}'::jsonb),
('early_adopter', 'Early Adopter 🚀', 'Joined during launch period', 'special', 'platinum', '🚀', 100, '{"signup_before": "2025-03-01"}'::jsonb),
('five_star', 'Five Star Cleaner ⭐', 'Achieved 5-star rating', 'quality', 'gold', '⭐', 50, '{"rating": 5.0}'::jsonb),
('super_saver', 'Time Saver ⏰', 'Saved 100+ hours with AI', 'milestone', 'platinum', '⏰', 100, '{"hours_saved": 100}'::jsonb),
('power_user', 'Power User 💪', 'Used AI for 50+ bookings', 'activity', 'gold', '💪', 50, '{"bookings_with_ai": 50}'::jsonb),
('explorer', 'Feature Explorer 🔍', 'Tried all AI features', 'activity', 'gold', '🔍', 40, '{"features_used": ["settings", "templates", "responses", "insights"]}'::jsonb);

-- ============================================
-- INSERT DEFAULT CERTIFICATIONS
-- ============================================

INSERT INTO certifications (certification_key, name, description, level, icon, badge_color, requirements, benefits) VALUES
(
  'ai_beginner',
  'AI Assistant Beginner',
  'Master the basics of AI Assistant',
  1,
  '🎓',
  '#10B981',
  '{"setup_wizard_completed": true, "templates_customized": 3, "days_active": 7}'::jsonb,
  ARRAY['Digital certificate', 'Beginner badge on profile', 'Access to basic templates']
),
(
  'ai_pro',
  'AI Assistant Pro',
  'Advanced AI optimization skills',
  2,
  '⚡',
  '#3B82F6',
  '{"days_active": 30, "templates_customized": 10, "quick_responses_added": 10, "bookings_with_ai": 25}'::jsonb,
  ARRAY['Pro certificate', 'Pro badge on profile', 'Access to advanced features', 'Priority support']
),
(
  'ai_expert',
  'AI Assistant Expert',
  'Expert-level AI mastery',
  3,
  '🏆',
  '#8B5CF6',
  '{"days_active": 90, "rating_average": 4.7, "bookings_with_ai": 100, "templates_created": 15}'::jsonb,
  ARRAY['Expert certificate', 'Expert badge on profile', 'Featured in directory', 'Template library access', 'Community mentor status']
),
(
  'ai_master',
  'AI Assistant Master',
  'Elite AI optimization master',
  4,
  '👑',
  '#EF4444',
  '{"days_active": 180, "rating_average": 4.9, "bookings_with_ai": 500, "referrals": 5}'::jsonb,
  ARRAY['Master certificate', 'Master badge on profile', 'VIP support', 'Revenue share on templates', 'Speaking opportunities', 'Beta feature access']
);

-- ============================================
-- INSERT DEFAULT TEMPLATE LIBRARY ITEMS
-- ============================================

INSERT INTO template_library (template_type, template_name, template_content, variables, category, description, is_featured, is_verified, tags) VALUES
(
  'booking_confirmation',
  'Warm Welcome Confirmation',
  'Hi {client_name}! 🎉 I''m thrilled to confirm your cleaning appointment for {date} at {time}! I''ll arrive with all professional-grade supplies and am committed to making your {property_type} absolutely sparkle! If you have any special requests, just let me know. Can''t wait to meet you! - {cleaner_name}',
  '["client_name", "date", "time", "property_type", "cleaner_name"]'::jsonb,
  'residential',
  'Enthusiastic and warm booking confirmation perfect for residential clients',
  true,
  true,
  ARRAY['residential', 'friendly', 'popular', 'warm']
),
(
  'booking_confirmation',
  'Professional Business Confirmation',
  'Dear {client_name}, Thank you for choosing our cleaning services. Your appointment is confirmed for {date} at {time}. Our team will arrive promptly with all necessary equipment and supplies. We look forward to serving your {property_type}. Best regards, {cleaner_name}',
  '["client_name", "date", "time", "property_type", "cleaner_name"]'::jsonb,
  'commercial',
  'Formal and professional confirmation ideal for commercial clients',
  true,
  true,
  ARRAY['commercial', 'professional', 'formal']
),
(
  'review_request',
  'Heartfelt Review Request',
  'Hi {client_name}! ❤️ I hope you''re loving your freshly cleaned space! Your feedback means everything to me as a small business owner. If you were happy with the service, would you mind taking 30 seconds to leave a quick review? It truly makes a huge difference! Thank you so much for your support! 🙏 - {cleaner_name}',
  '["client_name", "cleaner_name"]'::jsonb,
  'general',
  'Emotional and compelling review request with high conversion rate',
  true,
  true,
  ARRAY['reviews', 'emotional', 'high-converting']
),
(
  'job_complete',
  'Detailed Completion Report',
  'Hi {client_name}! ✨ Your cleaning is complete! Here''s what I did today: {services_performed}. Total time: {duration}. Your {property_type} looks amazing! Please inspect and let me know if anything needs attention. It was a pleasure serving you today! - {cleaner_name}',
  '["client_name", "services_performed", "duration", "property_type", "cleaner_name"]'::jsonb,
  'general',
  'Detailed completion message with service summary',
  false,
  true,
  ARRAY['detailed', 'professional', 'completion']
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Update profile completion percentage
CREATE OR REPLACE FUNCTION update_profile_completion_percentage()
RETURNS TRIGGER AS $$
DECLARE
  total_fields INTEGER := 5;
  completed_fields INTEGER := 0;
BEGIN
  IF NEW.profile_photo_uploaded THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.bio_completed THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.services_defined THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.availability_set THEN completed_fields := completed_fields + 1; END IF;
  IF NEW.pricing_configured THEN completed_fields := completed_fields + 1; END IF;
  
  NEW.profile_completion_percentage := (completed_fields * 100) / total_fields;
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_completion
  BEFORE UPDATE ON cleaner_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_completion_percentage();

-- Update template library ratings
CREATE OR REPLACE FUNCTION update_template_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE template_library
  SET 
    rating_average = (
      SELECT COALESCE(AVG(rating), 0)
      FROM template_library_ratings
      WHERE template_id = NEW.template_id
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM template_library_ratings
      WHERE template_id = NEW.template_id
    ),
    updated_at = NOW()
  WHERE id = NEW.template_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_rating
  AFTER INSERT OR UPDATE ON template_library_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_template_rating();

-- Initialize onboarding for new cleaners
CREATE OR REPLACE FUNCTION initialize_cleaner_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'cleaner' THEN
    INSERT INTO cleaner_onboarding_progress (cleaner_id)
    VALUES (NEW.id)
    ON CONFLICT (cleaner_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_initialize_onboarding
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_cleaner_onboarding();

COMMENT ON TABLE cleaner_onboarding_progress IS 'Tracks cleaner onboarding progress and profile completion';
COMMENT ON TABLE achievements IS 'Available achievements that cleaners can earn';
COMMENT ON TABLE cleaner_achievements IS 'Achievements earned by cleaners';
COMMENT ON TABLE certifications IS 'Available AI Assistant certifications';
COMMENT ON TABLE cleaner_certifications IS 'Certifications earned by cleaners';
COMMENT ON TABLE template_library IS 'Shared template library for all cleaners';
COMMENT ON TABLE app_tooltips IS 'In-app tooltip definitions';

SELECT 'Onboarding & Gamification System Migration Completed Successfully!' AS status;

