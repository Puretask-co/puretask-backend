# Environment Variables Template

Copy the content below to your `.env` file and fill in your values.

```env
# ===========================================
# PURETASK BACKEND - ENVIRONMENT VARIABLES
# ===========================================
# NEVER commit .env to version control!

# ===========================================
# CORE SETTINGS (REQUIRED)
# ===========================================

# Environment: development, staging, production
NODE_ENV=development

# Server port
PORT=4000

# PostgreSQL connection string (Neon)
# Format: postgres://user:password@host/database?sslmode=require
DATABASE_URL=postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/puretask?sslmode=require

# ===========================================
# AUTHENTICATION (REQUIRED)
# ===========================================

# JWT secret - use a strong random string (min 32 chars)
# Generate with: openssl rand -hex 32
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# JWT expiration (default: 30d)
JWT_EXPIRES_IN=30d

# Bcrypt salt rounds for password hashing (default: 10)
BCRYPT_SALT_ROUNDS=10

# ===========================================
# STRIPE (REQUIRED)
# ===========================================

# Stripe API keys from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

# ===========================================
# N8N INTEGRATION (REQUIRED)
# ===========================================

# Webhook secret for n8n authentication
# Generate with: openssl rand -hex 32
N8N_WEBHOOK_SECRET=your-n8n-webhook-secret-key

# n8n webhook URL (optional - for event forwarding)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/puretask

# ===========================================
# PAYOUT SETTINGS (OPTIONAL - defaults shown)
# ===========================================

# Enable/disable payouts (set to 'true' to enable)
PAYOUTS_ENABLED=false

# Payout currency
PAYOUT_CURRENCY=usd

# Credits to cents ratio (10 credits = $1 USD)
CENTS_PER_CREDIT=10

# Platform fee percentage (default: 15%)
PLATFORM_FEE_PERCENT=15

# Cleaner payout percentages by tier
CLEANER_PAYOUT_PERCENT_BRONZE=80
CLEANER_PAYOUT_PERCENT_SILVER=82
CLEANER_PAYOUT_PERCENT_GOLD=84
CLEANER_PAYOUT_PERCENT_PLATINUM=85

# Surcharge for direct card payments (non-credit)
NON_CREDIT_SURCHARGE_PERCENT=10

# ===========================================
# POLICY SETTINGS (OPTIONAL - defaults shown)
# ===========================================

# GPS check-in radius in meters
GPS_CHECKIN_RADIUS_METERS=250

# Minimum photos required for job completion
MIN_PHOTOS_TOTAL=3

# Photo retention period in days
PHOTO_RETENTION_DAYS=90

# Dispute window in hours after job completion
DISPUTE_WINDOW_HOURS=48

# Bonus credits for client when cleaner no-shows
CLEANER_NOSHOW_BONUS_CREDITS=50

# ===========================================
# APP URLS (OPTIONAL)
# ===========================================

# Frontend app URL
APP_URL=http://localhost:3000

# Storage/CDN URL for photos
STORAGE_URL=https://storage.puretask.com

# ===========================================
# EMAIL - SENDGRID (OPTIONAL)
# ===========================================

# SendGrid API key from https://app.sendgrid.com/settings/api_keys
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx

# From email address for outgoing emails
SENDGRID_FROM_EMAIL=no-reply@puretask.com

# ===========================================
# SMS - TWILIO (OPTIONAL)
# ===========================================

# Twilio credentials from https://console.twilio.com
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1234567890

# ===========================================
# PUSH NOTIFICATIONS - ONESIGNAL (OPTIONAL)
# ===========================================

# OneSignal credentials from https://onesignal.com
ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONESIGNAL_API_KEY=xxxxxxxxxxxxxxxxxxxxx
```

