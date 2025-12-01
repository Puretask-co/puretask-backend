-- 008_client_stripe_customer.sql
-- Add stripe_customer_id to client_profiles for Stripe payment integration

-- Add stripe_customer_id column
ALTER TABLE client_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_client_profiles_stripe_customer_id
  ON client_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Add phone column to users for SMS notifications
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add push_token to client_profiles for push notifications
ALTER TABLE client_profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Add push_token to cleaner_profiles for push notifications  
ALTER TABLE cleaner_profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Comments
COMMENT ON COLUMN client_profiles.stripe_customer_id IS 'Stripe customer ID for this client';
COMMENT ON COLUMN users.phone IS 'Phone number for SMS notifications';
COMMENT ON COLUMN client_profiles.push_token IS 'OneSignal/FCM push notification token';
COMMENT ON COLUMN cleaner_profiles.push_token IS 'OneSignal/FCM push notification token';

