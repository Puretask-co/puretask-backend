# Environment Variables Checklist

**Quick Reference**: Which environment variables you need for each integration.

**Startup validation:** The backend validates required vars at startup in `src/config/env.ts` (`requireEnv()`). If any required variable is missing, the process exits with a clear error. See `docs/active/00-CRITICAL/PHASE_0_1_STATUS.md` for Phase 1 status.

---

## ✅ Required (Backend won't start without these)

- [ ] `DATABASE_URL` - Neon PostgreSQL connection string
- [ ] `JWT_SECRET` - Secret for JWT token signing (min 32 chars)
- [ ] `STRIPE_SECRET_KEY` - Stripe API key (sk_test_... or sk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (whsec_...)
- [ ] `N8N_WEBHOOK_SECRET` - Secret for n8n HMAC verification

---

## 🔔 Notification Integrations (Optional but Recommended)

### SendGrid (Email)
- [ ] `SENDGRID_API_KEY` - SendGrid API key (SG.xxx...)
- [ ] `SENDGRID_FROM_EMAIL` - Default: "no-reply@puretask.com"
- [ ] `SENDGRID_FROM_NAME` - Default: "PureTask"
- [ ] `SENDGRID_TEMPLATE_*` - 12 template IDs (see below)

### Twilio (SMS)
- [ ] `TWILIO_ACCOUNT_SID` - Twilio Account SID (ACxxx...)
- [ ] `TWILIO_AUTH_TOKEN` - Twilio Auth Token
- [ ] `TWILIO_FROM_NUMBER` - Twilio phone number (+1xxx...)

### OneSignal (Push Notifications)
- [ ] `ONESIGNAL_APP_ID` - OneSignal App ID
- [ ] `ONESIGNAL_API_KEY` - OneSignal API Key (Basic auth)

---

## 🔄 n8n Integration (Optional but Recommended)

- [ ] `N8N_WEBHOOK_URL` - n8n webhook URL for event forwarding
- [ ] `N8N_API_KEY` - n8n API key (for direct API calls)
- [ ] `N8N_MCP_SERVER_URL` - n8n MCP server URL
- [ ] `USE_EVENT_BASED_NOTIFICATIONS` - Set to "true" to enable

---

## 📧 SendGrid Template IDs (12 templates)

- [ ] `SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED`
- [ ] `SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED`
- [ ] `SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY`
- [ ] `SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED`
- [ ] `SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED`
- [ ] `SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED`
- [ ] `SENDGRID_TEMPLATE_USER_JOB_CANCELLED`
- [ ] `SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE`
- [ ] `SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT`
- [ ] `SENDGRID_TEMPLATE_USER_WELCOME`
- [ ] `SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION`
- [ ] `SENDGRID_TEMPLATE_USER_PASSWORD_RESET`

---

## 📱 SMS Template IDs (2 templates)

- [ ] `SMS_TEMPLATE_EMERGENCY`
- [ ] `SMS_TEMPLATE_JOB_REMINDER`

---

## 🎛️ Feature Flags (Optional)

- [ ] `NODE_ENV` - "development" or "production"
- [ ] `BOOKINGS_ENABLED` - Default: true
- [ ] `PAYOUTS_ENABLED` - Default: false (set to "true" to enable)
- [ ] `CREDITS_ENABLED` - Default: true
- [ ] `WORKERS_ENABLED` - Default: true
- [ ] `USE_EVENT_BASED_NOTIFICATIONS` - Default: true (if n8n configured)

---

## 📍 Where to Set Environment Variables

### If Running Locally:
Create a `.env` file in the project root (it's gitignored):
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-here
# ... etc
```

### If Deployed on Railway:
1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Add each variable

### If Deployed Elsewhere:
Set environment variables in your hosting platform's dashboard

---

## ✅ Quick Check

Since your backend is running, you must have at least these set:
- ✅ `DATABASE_URL`
- ✅ `JWT_SECRET`
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STRIPE_WEBHOOK_SECRET`
- ✅ `N8N_WEBHOOK_SECRET`

**To check what's actually configured**, you can:
1. Check Railway dashboard → Variables tab
2. Check your local `.env` file (if running locally)
3. Check your hosting platform's environment variables

---

**Note**: The backend will start with just the required variables. Notification integrations are optional and will gracefully degrade if not configured.
