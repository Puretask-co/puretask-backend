# n8n Workflow Import Instructions

**File to Import:** `n8n-workflows/PT-Universal-Sender.json`  
**Status:** ✅ Validated and Ready

---

## 🚀 Quick Import (5 minutes)

### Step 1: Open n8n Dashboard

1. Navigate to your n8n instance (e.g., `https://n8n.your-domain.com`)
2. Login if required

### Step 2: Import Workflow

1. **Click "Workflows"** in the left sidebar
2. **Click the "+" button** or **"Import from File"**
3. **Select file:** `n8n-workflows/PT-Universal-Sender.json`
4. **Click "Import"**

### Step 3: Configure Environment Variables

Go to **Settings → Environment Variables** and add:

```env
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxx...
SENDGRID_FROM_EMAIL=noreply@puretask.com

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_FROM_NUMBER=+1234567890

# Slack Configuration (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx...
SLACK_ALERT_CHANNEL=#puretask-alerts
```

### Step 4: Activate Workflow

1. **Open the imported workflow** (should be named "PT-Universal-Sender")
2. **Review the workflow** - verify all nodes are connected
3. **Toggle "Active" switch** in the top right
4. **Copy the Webhook URL** (shown in the Webhook node)

The webhook URL will look like:
```
https://your-n8n-instance.com/webhook/puretask-communications
```

### Step 5: Configure Backend

Add to your backend `.env` file:

```env
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/puretask-communications
USE_EVENT_BASED_NOTIFICATIONS=true
```

### Step 6: Test

Test the workflow with a sample request:

```bash
curl -X POST https://your-n8n-instance.com/webhook/puretask-communications \
  -H "Content-Type: application/json" \
  -d '{
    "communication": {
      "templateId": "d-test",
      "to_email": "test@example.com",
      "channel": "email",
      "dynamic_data": {
        "clientName": "Test User",
        "jobAddress": "123 Test St"
      }
    }
  }'
```

Or test from backend:

```typescript
import { sendNotification } from "./services/notifications";

await sendNotification({
  type: "job.booked",
  channel: "email",
  email: "test@example.com",
  data: {
    jobId: "test-123",
    clientName: "Test User",
  },
});
```

---

## ✅ Verification Checklist

After import, verify:

- [ ] Workflow imported successfully
- [ ] All nodes are visible and connected
- [ ] Environment variables are set
- [ ] Workflow is active
- [ ] Webhook URL is accessible
- [ ] Test request succeeds
- [ ] Email/SMS received (if testing with real credentials)

---

## 🔧 Troubleshooting

### Issue: Import fails

**Check:**
- n8n version compatibility (should work with n8n 0.200+)
- JSON file is not corrupted
- File path is correct

**Solution:**
- Try copying JSON content and pasting into "Import from JSON" option
- Or follow manual setup guide: `docs/N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md`

### Issue: Nodes not connected

**Solution:**
- Manually connect nodes if needed
- Connections should be:
  - Webhook → Validate Payload
  - Validate Payload → Route by Channel
  - Route by Channel → [SendGrid OR Construct SMS]
  - [SendGrid/Check SendGrid] → Check Success
  - [Construct SMS/Twilio/Check Twilio] → Check Success
  - Check Success → [Respond Success OR Slack Alert]

### Issue: Environment variables not working

**Solution:**
- Ensure variables are set in Settings → Environment Variables (not in workflow)
- Use syntax: `{{ $env.VARIABLE_NAME }}` in nodes
- Restart n8n if variables were just added

---

## 📚 Related Documents

- `docs/N8N_SETUP_COMPLETE_CHECKLIST.md` - Detailed checklist
- `docs/N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md` - Step-by-step manual setup
- `docs/N8N_WORKFLOW_VALIDATION.md` - Validation details

---

**Ready to Import!** The JSON file is validated and ready to use.

---

*Import Instructions - Last Updated: January 2025*

