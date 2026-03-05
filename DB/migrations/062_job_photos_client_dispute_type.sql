-- 062_job_photos_client_dispute_type.sql
-- Allow job_photos.type = 'client_dispute' for client dispute evidence uploads.

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'job_photos' AND c.contype = 'c' AND c.conname LIKE '%type%'
  LIMIT 1;
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE job_photos DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE job_photos ADD CONSTRAINT job_photos_type_check
  CHECK (type IN ('before', 'after', 'client_dispute'));

COMMENT ON COLUMN job_photos.type IS 'Photo type: before, after, or client_dispute (dispute evidence)';
