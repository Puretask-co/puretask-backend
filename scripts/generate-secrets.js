#!/usr/bin/env node
// scripts/generate-secrets.js
// Generate secure random secrets for Railway environment variables

const crypto = require('crypto');

console.log('\n🔐 Generating Secure Secrets for Railway\n');
console.log('=' .repeat(60));

// JWT_SECRET (64 characters)
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('\n1. JWT_SECRET (64 characters):');
console.log('   ' + jwtSecret);
console.log('   → Copy this to Railway: JWT_SECRET');

// N8N_WEBHOOK_SECRET (32 characters)
const n8nSecret = crypto.randomBytes(16).toString('hex');
console.log('\n2. N8N_WEBHOOK_SECRET (32 characters):');
console.log('   ' + n8nSecret);
console.log('   → Copy this to Railway: N8N_WEBHOOK_SECRET');

// Temporary STRIPE_WEBHOOK_SECRET (for testing)
const stripeWebhookSecret = 'whsec_test_' + crypto.randomBytes(20).toString('hex');
console.log('\n3. STRIPE_WEBHOOK_SECRET (temporary, for testing):');
console.log('   ' + stripeWebhookSecret);
console.log('   → Copy this to Railway: STRIPE_WEBHOOK_SECRET');
console.log('   ⚠️  Replace with real secret after setting up Stripe webhook');

console.log('\n' + '='.repeat(60));
console.log('\n✅ Secrets generated!');
console.log('\n📋 Next Steps:');
console.log('   1. Copy each secret above');
console.log('   2. Go to Railway → puretask-backend → Variables');
console.log('   3. Update each variable with the values above');
console.log('   4. Get STRIPE_SECRET_KEY from: https://dashboard.stripe.com/test/apikeys');
console.log('   5. Redeploy your service\n');

