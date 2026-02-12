# Railway Environment Variables Verification Guide

**For**: PureTask Backend on Railway  
**Purpose**: Verify all integrations (n8n, SendGrid, Twilio, OneSignal) are configured

---

## 🔍 How to Check Your Railway Variables

### Step 1: Open Railway Dashboard
1. Go to https://railway.app
2. Click on your **PureTask project**
3. Click on your **backend service** (usually named `puretask-backend`)
4. Click the **"Variables"** tab

### Step 2: Verify Required Variables
These are **required** - your backend won't start without them:

- [ ] `DATABASE_URL` - Should be auto-created by Railway if you added a PostgreSQL database
- [ ] `JWT_SECRET` - Should be a long random string (32+ characters)
- [ ] `STRIPE_SECRET_KEY` - Should start with `sk_test_` or `sk_live_`
- [ ] `STRIPE_WEBHOOK_SECRET` - Should start with `whsec_`
- [ ] `N8N_WEBHOOK_SECRET` - Should be a secret string for n8n HMAC verification

**✅ If all 5 are set, your backend is running!**

---

## 🔔 Integration Variables (Check These)

### n8n Integration
Check if these are set for event-based notifications:

- [ ] `N8N_WEBHOOK_URL` - Should be your n8n webhook URL (e.g., `https://puretask.app.n8n.cloud/webhook/universal-sender`)
- [ ] `N8N_API_KEY` - Your n8n API key (optional, for direct API calls)
- [ ] `N8N_MCP_SERVER_URL` - Your n8n MCP server URL (optional)
- [ ] `USE_EVENT_BASED_NOTIFICATIONS` - Should be `true` if you want to use n8n for notifications

**Status**: 
- ✅ If `N8N_WEBHOOK_URL` is set → Events will forward to n8n
- ❌ If not set → Events won't forward (but backend still works)

---

### SendGrid (Email)
Check if these are set for email notifications:

- [ ] `SENDGRID_API_KEY` - Should start with `SG.`
- [ ] `SENDGRID_FROM_EMAIL` - Your sender email (e.g., `no-reply@puretask.com`)
- [ ] `SENDGRID_FROM_NAME` - Your sender name (e.g., `PureTask`)

**Template IDs** (12 templates - these are optional but recommended):
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

**Status**:
- ✅ If `SENDGRID_API_KEY` is set → Email notifications will work
- ❌ If not set → Email notifications will fail gracefully (logged but won't break the app)

---

### Twilio (SMS)
Check if these are set for SMS notifications:

- [ ] `TWILIO_ACCOUNT_SID` - Should start with `AC`
- [ ] `TWILIO_AUTH_TOKEN` - Your Twilio auth token
- [ ] `TWILIO_FROM_NUMBER` - Your Twilio phone number (e.g., `+15551234567`)

**Template IDs** (optional):
- [ ] `SMS_TEMPLATE_EMERGENCY`
- [ ] `SMS_TEMPLATE_JOB_REMINDER`

**Status**:
- ✅ If all 3 are set → SMS notifications will work
- ❌ If not set → SMS notifications will fail gracefully

---

### OneSignal (Push Notifications)
Check if these are set for push notifications:

- [ ] `ONESIGNAL_APP_ID` - Your OneSignal App ID
- [ ] `ONESIGNAL_API_KEY` - Your OneSignal API Key (for Basic auth)

**Status**:
- ✅ If both are set → Push notifications will work
- ❌ If not set → Push notifications will fail gracefully

---

## 📊 Quick Status Check

After checking Railway, fill this out:

### Required (Backend won't start without these)
- [ ] `DATABASE_URL` - ✅/❌
- [ ] `JWT_SECRET` - ✅/❌
- [ ] `STRIPE_SECRET_KEY` - ✅/❌
- [ ] `STRIPE_WEBHOOK_SECRET` - ✅/❌
- [ ] `N8N_WEBHOOK_SECRET` - ✅/❌

### Integrations (Optional but Recommended)
- [ ] **n8n**: `N8N_WEBHOOK_URL` - ✅/❌
- [ ] **SendGrid**: `SENDGRID_API_KEY` - ✅/❌
- [ ] **Twilio**: `TWILIO_ACCOUNT_SID` - ✅/❌
- [ ] **OneSignal**: `ONESIGNAL_APP_ID` - ✅/❌

---

## 🎯 What This Means

### If All Required Variables Are Set:
✅ **Your backend is running!** The integrations will work if their variables are set.

### If Integration Variables Are Missing:
⚠️ **That's okay!** The backend will still work, but those specific features won't:
- Missing `SENDGRID_API_KEY` → No email notifications
- Missing `TWILIO_*` → No SMS notifications
- Missing `ONESIGNAL_*` → No push notifications
- Missing `N8N_WEBHOOK_URL` → Events won't forward to n8n (but direct provider calls still work)

---

## 🔧 How to Add Missing Variables

### In Railway Dashboard:
1. Go to your service → **Variables** tab
2. Click **"+ New Variable"**
3. Enter the variable name (e.g., `SENDGRID_API_KEY`)
4. Enter the value
5. Click **"Add"**
6. Railway will automatically redeploy

### Using Railway CLI:
```bash
# Set a variable
railway variables set SENDGRID_API_KEY=SG.your-key-here

# View all variables
railway variables

# View a specific variable
railway variables get SENDGRID_API_KEY
```

---

## ✅ Verification Checklist

After checking Railway, you should know:

1. ✅ **Backend is running** (if all 5 required vars are set)
2. ✅ **Which integrations are configured** (check the integration variables)
3. ✅ **What needs to be added** (any missing integration variables)

---

## 🚀 Next Steps

Once you've verified what's set in Railway:

1. **If integration variables are missing**: Add them in Railway → Variables tab
2. **If everything is set**: Your integrations are ready! Test them:
   - Send a test email
   - Send a test SMS
   - Send a test push notification
   - Trigger an event to test n8n forwarding

---

## 📝 Quick Reference

**Railway Dashboard Path**:
```
Railway.app → Your Project → Backend Service → Variables Tab
```

**Required Variables**: 5 (DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, N8N_WEBHOOK_SECRET)

**Integration Variables**: 
- n8n: 1-4 variables
- SendGrid: 1-3 + 12 template IDs
- Twilio: 3 + 2 template IDs
- OneSignal: 2

---

**Last Updated**: 2025-01-27  
**Status**: Ready for verification
