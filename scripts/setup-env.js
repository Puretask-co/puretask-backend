#!/usr/bin/env node
/**
 * PureTask Environment Setup Script
 * 
 * Run with: node scripts/setup-env.js
 * 
 * This creates .env files from templates for development, staging, and production.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate random secrets
const generateSecret = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

const envTemplate = `# ===========================================
# PURETASK BACKEND - ENVIRONMENT VARIABLES
# ===========================================
# ⚠️ NEVER commit this file to version control!

NODE_ENV=development
PORT=4000

# ===========================================
# DATABASE (Neon PostgreSQL)
# ===========================================
# Get your connection string from: https://console.neon.tech
DATABASE_URL=postgres://YOUR_USER:YOUR_PASSWORD@ep-YOUR-PROJECT.us-east-2.aws.neon.tech/puretask?sslmode=require

# ===========================================
# AUTHENTICATION
# ===========================================
JWT_SECRET=${generateSecret(32)}
JWT_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=10

# ===========================================
# STRIPE PAYMENTS
# ===========================================
# Get keys from: https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_YOUR_WEBHOOK_SECRET

# ===========================================
# N8N INTEGRATION
# ===========================================
N8N_WEBHOOK_SECRET=${generateSecret(32)}
N8N_WEBHOOK_URL=

# ===========================================
# PAYOUT SETTINGS
# ===========================================
PAYOUTS_ENABLED=false
PAYOUT_CURRENCY=usd
CENTS_PER_CREDIT=100
PLATFORM_FEE_PERCENT=15
NON_CREDIT_SURCHARGE_PERCENT=10
CLEANER_PAYOUT_PERCENT_BRONZE=80
CLEANER_PAYOUT_PERCENT_SILVER=82
CLEANER_PAYOUT_PERCENT_GOLD=84
CLEANER_PAYOUT_PERCENT_PLATINUM=85

# ===========================================
# POLICY SETTINGS
# ===========================================
GPS_CHECKIN_RADIUS_METERS=250
MIN_PHOTOS_TOTAL=3
PHOTO_RETENTION_DAYS=90
DISPUTE_WINDOW_HOURS=48
CLEANER_NOSHOW_BONUS_CREDITS=50

# ===========================================
# APP URLS
# ===========================================
APP_URL=http://localhost:3000
STORAGE_URL=https://storage.puretask.com

# ===========================================
# NOTIFICATIONS (Optional)
# ===========================================
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=no-reply@puretask.com
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=
`;

const envDevelopment = `# ===========================================
# PURETASK - DEVELOPMENT OVERRIDES
# ===========================================
NODE_ENV=development
PORT=4000
PAYOUTS_ENABLED=false
APP_URL=http://localhost:3000
`;

const envStaging = `# ===========================================
# PURETASK - STAGING ENVIRONMENT
# ===========================================
NODE_ENV=staging
PORT=4000

# Use staging database branch
DATABASE_URL=postgres://YOUR_USER:YOUR_PASSWORD@ep-YOUR-PROJECT.us-east-2.aws.neon.tech/puretask_staging?sslmode=require

# Use Stripe TEST keys
STRIPE_SECRET_KEY=sk_test_YOUR_STAGING_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_STAGING_WEBHOOK

JWT_SECRET=${generateSecret(32)}
N8N_WEBHOOK_SECRET=${generateSecret(32)}

PAYOUTS_ENABLED=true
APP_URL=https://staging.puretask.com
`;

const envProduction = `# ===========================================
# PURETASK - PRODUCTION ENVIRONMENT
# ===========================================
# ⚠️ CRITICAL: Use LIVE Stripe keys!
# ⚠️ CRITICAL: Use unique, strong secrets!
NODE_ENV=production
PORT=4000

# Production database
DATABASE_URL=postgres://YOUR_USER:YOUR_PASSWORD@ep-YOUR-PROJECT.us-east-2.aws.neon.tech/puretask_prod?sslmode=require

# LIVE Stripe keys - REAL MONEY!
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK

JWT_SECRET=${generateSecret(64)}
N8N_WEBHOOK_SECRET=${generateSecret(32)}

BCRYPT_SALT_ROUNDS=12
PAYOUTS_ENABLED=true
APP_URL=https://app.puretask.com
`;

const files = [
  { name: '.env', content: envTemplate },
  { name: '.env.development', content: envDevelopment },
  { name: '.env.staging', content: envStaging },
  { name: '.env.production', content: envProduction },
];

console.log('🔧 PureTask Environment Setup\n');

files.forEach(({ name, content }) => {
  const filePath = path.join(process.cwd(), name);
  
  if (fs.existsSync(filePath)) {
    console.log(`⏭️  ${name} already exists - skipping`);
  } else {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Created ${name}`);
  }
});

console.log(`
🎉 Setup complete!

📝 Next steps:
1. Edit .env and add your DATABASE_URL from Neon
2. Add your Stripe keys from https://dashboard.stripe.com/test/apikeys
3. Start the server: node node_modules/ts-node/dist/bin.js --transpile-only src/index.ts

⚠️  Remember: Never commit .env files to git!
`);

