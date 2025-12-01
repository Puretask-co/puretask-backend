# PureTask Backend - Environment Variables

Copy this to `.env` and fill in your values:

```bash
# ==============================
# Core Application
# ==============================
NODE_ENV=development
PORT=4000

# ==============================
# Database (Neon / Postgres)
# ==============================
# Format: postgres://user:password@host:port/dbname?sslmode=require
DATABASE_URL=postgres://user:password@ep-xxx.region.aws.neon.tech/puretask?sslmode=require

# ==============================
# Authentication / JWT
# ==============================
# Generate with: openssl rand -base64 64
JWT_SECRET=replace_me_with_a_strong_random_secret_at_least_64_chars
JWT_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=10

# ==============================
# Stripe (Payments + Connect)
# ==============================
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ==============================
# n8n (Automation Webhooks)
# ==============================
# Shared secret for HMAC verification of /n8n/events endpoint
N8N_WEBHOOK_SECRET=super_secret_shared_key_here
# Optional: URL to POST events TO n8n
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/puretask-events

# ==============================
# Payouts / Credits Configuration
# ==============================
# Enable/disable real Stripe payouts processing
PAYOUTS_ENABLED=true
# Currency for payouts (ISO 4217)
PAYOUT_CURRENCY=usd
# Conversion rate: 1 credit = X cents (100 = $1.00)
CENTS_PER_CREDIT=100

# Extra markup for non-credit (direct card) job payments
# Example: 5 = 5%, 10 = 10%
# Clients who pay directly by card (instead of using wallet credits) pay this % more
NON_CREDIT_SURCHARGE_PERCENT=10

# ==============================
# App URLs
# ==============================
APP_URL=http://localhost:3000
STORAGE_URL=https://storage.puretask.com

# ==============================
# Notifications (All Optional)
# If empty, that notification channel is skipped
# ==============================

# SendGrid (Email)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=no-reply@puretask.com

# Twilio (SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+1234567890

# OneSignal (Push Notifications)
ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=
```

## Quick Setup

```bash
# Copy template to .env
cp ENV_EXAMPLE.md .env
# OR create .env manually with the values above

# Edit with your actual values
nano .env
```

## Required vs Optional

### Required for basic operation:
- `DATABASE_URL` - Neon/Postgres connection string
- `JWT_SECRET` - For authentication
- `STRIPE_SECRET_KEY` - For payments
- `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- `N8N_WEBHOOK_SECRET` - For n8n integration

### Optional (features disabled if not set):
- `SENDGRID_*` - Email notifications
- `TWILIO_*` - SMS notifications  
- `ONESIGNAL_*` - Push notifications
- `N8N_WEBHOOK_URL` - Outbound n8n events
- `PAYOUTS_ENABLED` - Defaults to false if not set

## Security Notes

1. **Never commit `.env` to git** - It's in `.gitignore`
2. **Use strong secrets** - Generate with `openssl rand -base64 64`
3. **Rotate secrets regularly** - Especially JWT_SECRET
4. **Use different values per environment** - dev/staging/production
