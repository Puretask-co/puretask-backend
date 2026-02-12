-- Migration 030: Interactive Onboarding & Gamification System (NEON COMPATIBLE)
-- Includes: onboarding progress, achievements, certifications, template library
-- FIXED: Removed foreign key constraints that Neon doesn't support well

-- ============================================
-- ONBOARDING PROGRESS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL UNIQUE,
  
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
  cleaner_id TEXT NOT NULL,
  achievement_id UUID NOT NULL,
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
  level INTEGER NOT NULL, -- 1-4 for different tiers
  icon TEXT,
  badge_color TEXT DEFAULT '#3B82F6',
  requirements JSONB NOT NULL, -- Criteria to earn
  benefits JSONB, -- What user gets
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certifications_level ON certifications(level);

-- ============================================
-- USER CERTIFICATIONS (EARNED)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL,
  certification_id UUID NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  certificate_url TEXT,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(cleaner_id, certification_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_certifications_cleaner ON cleaner_certifications(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_certifications_active ON cleaner_certifications(cleaner_id, is_active) WHERE is_active = true;

-- ============================================
-- TEMPLATE LIBRARY (MARKETPLACE)
-- ============================================

CREATE TABLE IF NOT EXISTS template_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type TEXT NOT NULL, -- 'booking_confirmation', 'job_complete', etc.
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT NOT NULL, -- 'residential', 'commercial', 'general'
  subcategory TEXT,
  description TEXT,
  author_id TEXT, -- cleaner who created it
  rating_average DECIMAL(3,2) DEFAULT 0.0,
  rating_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_library_category ON template_library(category);
CREATE INDEX IF NOT EXISTS idx_template_library_type ON template_library(template_type);
CREATE INDEX IF NOT EXISTS idx_template_library_rating ON template_library(rating_average DESC);
CREATE INDEX IF NOT EXISTS idx_template_library_featured ON template_library(is_featured) WHERE is_featured = true;

-- ============================================
-- SAVED LIBRARY TEMPLATES (USER'S COLLECTION)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_saved_library_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL,
  library_template_id UUID NOT NULL,
  customized_content TEXT,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cleaner_id, library_template_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_templates_cleaner ON cleaner_saved_library_templates(cleaner_id);

-- ============================================
-- TEMPLATE RATINGS (USER REVIEWS)
-- ============================================

CREATE TABLE IF NOT EXISTS template_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  cleaner_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_template_ratings_template ON template_ratings(template_id);

-- ============================================
-- ONBOARDING TOOLTIPS
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_tooltips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tooltip_key TEXT NOT NULL UNIQUE,
  page_url TEXT NOT NULL,
  element_selector TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  position TEXT DEFAULT 'bottom', -- 'top', 'bottom', 'left', 'right'
  sequence_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_conditions JSONB, -- When to show
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tooltips_page ON onboarding_tooltips(page_url);
CREATE INDEX IF NOT EXISTS idx_tooltips_active ON onboarding_tooltips(is_active) WHERE is_active = true;

-- ============================================
-- PRE-LOAD ACHIEVEMENTS
-- ============================================

INSERT INTO achievements (achievement_key, name, description, category, tier, icon, points, criteria, display_order) VALUES
('first_login', 'Welcome Aboard! 👋', 'Completed your first login', 'onboarding', 'bronze', '👋', 10, '{"action": "login", "count": 1}', 1),
('profile_complete', 'Profile Pro ⭐', 'Completed your profile 100%', 'onboarding', 'silver', '⭐', 25, '{"profile_completion": 100}', 2),
('setup_wizard', 'Quick Starter 🚀', 'Completed the setup wizard', 'onboarding', 'bronze', '🚀', 15, '{"setup_wizard_completed": true}', 3),
('first_template', 'Template Explorer 📝', 'Used your first message template', 'activity', 'bronze', '📝', 10, '{"first_template_used": true}', 4),
('template_creator', 'Content Creator ✨', 'Created your first custom template', 'activity', 'silver', '✨', 20, '{"created_custom_template": true}', 5),
('quick_response_master', 'Quick Responder ⚡', 'Added 5+ quick responses', 'activity', 'silver', '⚡', 20, '{"quick_responses_added": 5}', 6),
('template_customizer', 'Customization Expert 🎨', 'Customized 10+ templates', 'activity', 'gold', '🎨', 30, '{"templates_customized": 10}', 7),
('week_warrior', '7-Day Streak 🔥', 'Active for 7 consecutive days', 'engagement', 'silver', '🔥', 25, '{"days_since_signup": 7}', 8),
('month_master', '30-Day Champion 🏆', 'Active for 30 days', 'engagement', 'gold', '🏆', 50, '{"days_since_signup": 30}', 9),
('insights_explorer', 'Data Detective 🔍', 'Viewed the insights dashboard', 'discovery', 'bronze', '🔍', 10, '{"viewed_insights_dashboard": true}', 10),
('settings_exporter', 'Backup Pro 💾', 'Exported your AI settings', 'discovery', 'bronze', '💾', 10, '{"exported_settings": true}', 11),
('favorite_picker', 'Favorites Fan 💖', 'Marked a quick response as favorite', 'discovery', 'bronze', '💖', 10, '{"marked_favorite_response": true}', 12),
('ai_personality', 'AI Personality Set 🤖', 'Configured your AI personality', 'onboarding', 'silver', '🤖', 20, '{"ai_personality_set": true}', 13),
('power_user', 'Power User 💪', 'Completed all onboarding steps', 'milestone', 'platinum', '💪', 100, '{"profile_completion": 100, "setup_wizard_completed": true, "templates_customized": 5}', 14)
ON CONFLICT (achievement_key) DO NOTHING;

-- ============================================
-- PRE-LOAD CERTIFICATIONS
-- ============================================

INSERT INTO certifications (certification_key, name, description, level, icon, badge_color, requirements, benefits, display_order) VALUES
('ai_assistant_basic', 'AI Assistant Basics', 'Master the fundamentals of the AI Assistant', 1, '🎓', '#3B82F6', 
  '{"profile_completion": 50, "templates_customized": 3, "quick_responses_added": 5}', 
  '["Access to basic templates", "Community forum access"]', 1),
  
('ai_assistant_intermediate', 'AI Assistant Intermediate', 'Advanced AI configuration skills', 2, '📚', '#8B5CF6', 
  '{"profile_completion": 75, "templates_customized": 10, "quick_responses_added": 15, "created_custom_template": true}', 
  '["Priority support", "Advanced template library", "Analytics dashboard"]', 2),
  
('ai_assistant_advanced', 'AI Assistant Advanced', 'Expert-level AI customization', 3, '🏅', '#F59E0B', 
  '{"profile_completion": 90, "templates_customized": 20, "quick_responses_added": 25, "viewed_insights_dashboard": true, "exported_settings": true}', 
  '["1-on-1 coaching session", "Featured in marketplace", "Beta features access"]', 3),
  
('ai_assistant_master', 'AI Assistant Master', 'Absolute mastery of all AI features', 4, '👑', '#EF4444', 
  '{"profile_completion": 100, "templates_customized": 50, "quick_responses_added": 50, "days_since_signup": 30}', 
  '["Lifetime priority support", "Exclusive webinars", "Revenue sharing on templates", "Master badge on profile"]', 4)
ON CONFLICT (certification_key) DO NOTHING;

-- ============================================
-- PRE-LOAD TEMPLATE LIBRARY ITEMS
-- ============================================

INSERT INTO template_library (template_type, template_name, template_content, variables, category, description, is_featured, is_verified, tags) VALUES
('booking_confirmation', 'Professional Booking Confirmation', 
  'Hi {client_name}! 🎉 Your {service_type} is confirmed for {date} at {time}. I'll arrive at {property_address} with all professional supplies. Looking forward to making your space sparkle! - {cleaner_name}',
  '["client_name", "service_type", "date", "time", "property_address", "cleaner_name"]',
  'general', 'Professional and friendly booking confirmation', true, true, ARRAY['professional', 'friendly', 'detailed']),
  
('running_late', 'Apologetic Running Late', 
  'Hi {client_name}, I sincerely apologize but I''m running about {delay_minutes} minutes late due to {reason}. I''ll be there as soon as possible. Thank you so much for your patience and understanding!',
  '["client_name", "delay_minutes", "reason"]',
  'general', 'Polite delay notification with apology', true, true, ARRAY['apologetic', 'professional', 'delay']),
  
('job_complete', 'Detailed Job Complete', 
  'Hi {client_name}! ✨ Your cleaning is complete! Today I cleaned: {services_performed}. Total time: {duration}. Your {property_type} looks amazing! Please let me know if you need anything adjusted. Thank you!',
  '["client_name", "services_performed", "duration", "property_type"]',
  'general', 'Detailed completion message with summary', true, true, ARRAY['professional', 'detailed', 'friendly']),
  
('review_request', 'Warm Review Request', 
  'Hi {client_name}! ❤️ I hope you''re loving your freshly cleaned space! If you were happy with my service, would you mind leaving a quick review? It really helps my small business grow. Thank you so much! 🙏',
  '["client_name"]',
  'general', 'Friendly review request that converts', true, true, ARRAY['review', 'friendly', 'growth'])
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE cleaner_onboarding_progress IS 'Tracks cleaner onboarding progress and profile completion';
COMMENT ON TABLE achievements IS 'Available achievements that cleaners can earn';
COMMENT ON TABLE cleaner_achievements IS 'Achievements earned by cleaners';
COMMENT ON TABLE certifications IS 'Certification tiers available';
COMMENT ON TABLE cleaner_certifications IS 'Certifications earned by cleaners';
COMMENT ON TABLE template_library IS 'Public template marketplace';
COMMENT ON TABLE cleaner_saved_library_templates IS 'Templates saved by cleaners from the library';
COMMENT ON TABLE template_ratings IS 'Ratings and reviews for templates';
COMMENT ON TABLE onboarding_tooltips IS 'In-app contextual help tooltips';

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

SELECT 'Onboarding & Gamification System Migration Completed Successfully!' AS status;

