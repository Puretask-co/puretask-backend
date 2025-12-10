-- 006_job_photos.sql
-- Job photos table for before/after images
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- Job photos table
CREATE TABLE IF NOT EXISTS job_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  uploaded_by  TEXT NOT NULL REFERENCES users (id) ON DELETE SET NULL,
  type         TEXT NOT NULL CHECK (type IN ('before', 'after')),
  url          TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size    INTEGER,
  mime_type    TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON job_photos (job_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_type ON job_photos (type);
CREATE INDEX IF NOT EXISTS idx_job_photos_uploaded_by ON job_photos (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_job_photos_created_at ON job_photos (created_at DESC);

-- Comments
COMMENT ON TABLE job_photos IS 'Before/after photos uploaded by cleaners for jobs';
COMMENT ON COLUMN job_photos.type IS 'Photo type: before (pre-cleaning) or after (post-cleaning)';
COMMENT ON COLUMN job_photos.url IS 'Full URL to the photo in cloud storage (S3/R2/etc)';
COMMENT ON COLUMN job_photos.thumbnail_url IS 'Optional thumbnail URL for faster loading';
COMMENT ON COLUMN job_photos.metadata IS 'Additional metadata: dimensions, exif, etc';
