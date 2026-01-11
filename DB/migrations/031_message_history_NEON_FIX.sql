-- Message History & Conversation Logging System (NEON COMPATIBLE)
-- Saves all messages sent by cleaners for reference and analytics
-- FIXED: Removed foreign key constraints

-- Message history table
CREATE TABLE IF NOT EXISTS cleaner_message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL,
  
  -- Message details
  message_content TEXT NOT NULL,
  recipient_type VARCHAR(50), -- 'client', 'support', 'other'
  recipient_id TEXT,
  recipient_name VARCHAR(255),
  
  -- Template info (if used)
  template_id UUID,
  template_name VARCHAR(255),
  variables_used JSONB, -- The variables that were filled in
  
  -- Context
  booking_id UUID,
  message_type VARCHAR(100), -- 'booking_confirmation', 'running_late', etc.
  channel VARCHAR(50), -- 'sms', 'email', 'in_app', 'manual'
  
  -- Metadata
  character_count INTEGER,
  word_count INTEGER,
  sent_at TIMESTAMP DEFAULT NOW(),
  was_ai_generated BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Saved templates (user's personal drafts/favorites)
CREATE TABLE IF NOT EXISTS cleaner_saved_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL,
  
  -- Message details
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags TEXT[],
  
  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  is_favorite BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_history_cleaner ON cleaner_message_history(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_message_history_sent_at ON cleaner_message_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_message_history_booking ON cleaner_message_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_saved_messages_cleaner ON cleaner_saved_messages(cleaner_id);

COMMENT ON TABLE cleaner_message_history IS 'Stores all messages sent by cleaners for history and analytics';
COMMENT ON TABLE cleaner_saved_messages IS 'User-saved message drafts and frequently used replies';

SELECT 'Message History System Migration Completed Successfully!' AS status;

