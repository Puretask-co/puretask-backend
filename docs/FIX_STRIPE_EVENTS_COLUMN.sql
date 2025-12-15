-- Fix: Ensure stripe_events table has all required columns
-- Run this if you get "column does not exist" errors for stripe_events

-- Check if column exists, if not add it
DO $$
BEGIN
  -- Check if stripe_events table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'stripe_events'
  ) THEN
    -- Add stripe_event_id if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'stripe_events' 
        AND column_name = 'stripe_event_id'
    ) THEN
      ALTER TABLE stripe_events ADD COLUMN stripe_event_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_events_stripe_event_id 
        ON stripe_events (stripe_event_id) WHERE stripe_event_id IS NOT NULL;
    END IF;
    
    -- Add created_at if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'stripe_events' 
        AND column_name = 'created_at'
    ) THEN
      ALTER TABLE stripe_events ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
      -- Update existing rows to have created_at
      UPDATE stripe_events SET created_at = NOW() WHERE created_at IS NULL;
      -- Make it NOT NULL after updating
      ALTER TABLE stripe_events ALTER COLUMN created_at SET NOT NULL;
      ALTER TABLE stripe_events ALTER COLUMN created_at SET DEFAULT NOW();
    END IF;
    
    -- Add processed if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'stripe_events' 
        AND column_name = 'processed'
    ) THEN
      ALTER TABLE stripe_events ADD COLUMN processed BOOLEAN DEFAULT FALSE;
      UPDATE stripe_events SET processed = FALSE WHERE processed IS NULL;
      ALTER TABLE stripe_events ALTER COLUMN processed SET NOT NULL;
      ALTER TABLE stripe_events ALTER COLUMN processed SET DEFAULT FALSE;
    END IF;
    
    -- Add processed_at if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'stripe_events' 
        AND column_name = 'processed_at'
    ) THEN
      ALTER TABLE stripe_events ADD COLUMN processed_at TIMESTAMPTZ;
    END IF;
  ELSE
    -- Table doesn't exist - create it with all columns
    CREATE TABLE stripe_events (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stripe_event_id   TEXT NOT NULL UNIQUE,
      type              TEXT NOT NULL,
      payload           JSONB NOT NULL,
      processed         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at      TIMESTAMPTZ
    );

    CREATE INDEX idx_stripe_events_type ON stripe_events (type);
    CREATE INDEX idx_stripe_events_processed ON stripe_events (processed);
    CREATE INDEX idx_stripe_events_stripe_event_id ON stripe_events (stripe_event_id);
  END IF;
END
$$;

-- Verify all columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'stripe_events' 
  AND column_name IN ('id', 'stripe_event_id', 'type', 'payload', 'processed', 'created_at', 'processed_at')
ORDER BY column_name;
