# n8n Setup Complete Checklist

**Purpose:** Step-by-step checklist to set up PT-Universal-Sender workflow in n8n  
**Estimated Time:** 30-45 minutes  
**Prerequisites:** n8n instance running, SendGrid and Twilio accounts configured

---

## 📋 Pre-Setup Checklist

- [ ] n8n instance is accessible
- [ ] SendGrid API key available
- [ ] Twilio Account SID and Auth Token available
- [ ] Slack webhook URL for alerts (optional but recommended)
- [ ] All SendGrid template IDs from `docs/email-registry.md`

---

## 🚀 Quick Setup (Using Import)

### Option 1: Import JSON Workflow (Fastest)

1. **Open n8n Dashboard**
   - Navigate to your n8n instance
   - Click "Workflows" in sidebar

2. **Import Workflow**
   - Click "Import from File" or "Import from URL"
   - Select: `n8n-workflows/PT-Universal-Sender.json`
   - Click "Import"

3. **Configure Environment Variables**
   - Go to Settings → Environment Variables
   - Add the following:
     ```
     SENDGRID_API_KEY=SG.xxx...
     SENDGRID_FROM_EMAIL=noreply@puretask.com
     TWILIO_ACCOUNT_SID=ACxxx...
     TWILIO_AUTH_TOKEN=xxx...
     TWILIO_FROM_NUMBER=+1234567890
     SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx... (optional)
     SLACK_ALERT_CHANNEL=#puretask-alerts (optional)
     ```

4. **Activate Workflow**
   - Toggle "Active" switch in workflow
   - Copy webhook URL (e.g., `https://your-n8n.com/webhook/puretask-communications`)

5. **Configure Backend**
   - Add to backend `.env`:
     ```
     N8N_WEBHOOK_URL=https://your-n8n.com/webhook/puretask-communications
     USE_EVENT_BASED_NOTIFICATIONS=true
     ```

6. **Test**
   - Use test payload from `docs/N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md`
   - Send test request from backend
   - Verify email/SMS received

---

## 🔧 Manual Setup (Step-by-Step)

If import doesn't work, follow these steps:

### Step 1: Create Webhook Node

1. **Create New Workflow**
   - Name: `PT-Universal-Sender`
   - Click "Add Node" → "Webhook"

2. **Configure Webhook**
   ```
   HTTP Method: POST
   Path: puretask-communications
   Response Mode: Respond When Last Node Finishes
   ```

3. **Copy Webhook URL**
   - Note the webhook URL
   - Add to backend `.env`: `N8N_WEBHOOK_URL=<webhook-url>`

### Step 2: Add Validation Node

1. **Add Code Node**
   - After Webhook node
   - Name: "Validate Payload"

2. **Add Validation Code** (see `docs/N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md` Step 2)

### Step 3: Add Channel Routing

1. **Add IF Node**
   - After Validation node
   - Name: "Route by Channel"

2. **Configure Condition**
   ```
   Condition: {{ $json.communication.channel }} equals "email"
   ```

### Step 4: Add SendGrid Node (Email Branch)

1. **Add HTTP Request Node**
   - On "True" branch of Route node
   - Name: "SendGrid Send Email"

2. **Configure HTTP Request**
   ```
   Method: POST
   URL: https://api.sendgrid.com/v3/mail/send
   Authentication: Header Auth
   Header: Authorization: Bearer {{ $env.SENDGRID_API_KEY }}
   Body: JSON
   ```

3. **Configure Body** (see guide for full JSON structure)

### Step 5: Add Twilio Node (SMS Branch)

1. **Add Code Node**
   - On "False" branch of Route node
   - Name: "Construct SMS Message"

2. **Add HTTP Request Node**
   - After Construct SMS node
   - Name: "Twilio Send SMS"

3. **Configure Twilio** (see guide for details)

### Step 6: Add Error Handling

1. **Add IF Node** (check success)
2. **Add Slack Node** (on failure)
3. **Add Respond Nodes** (success and error responses)

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Webhook URL is accessible
- [ ] Environment variables are set
- [ ] Workflow is active
- [ ] Test email sent successfully
- [ ] Test SMS sent successfully
- [ ] Error handling works (test with invalid payload)
- [ ] Slack alerts work (if configured)

---

## 🧪 Testing

### Test Payload (Email)

```json
{
  "eventName": "job.booked",
  "jobId": "test-job-123",
  "timestamp": "2025-01-15T10:00:00Z",
  "communication": {
    "templateEnvVar": "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED",
    "templateId": "d-xxxx",
    "to_email": "test@example.com",
    "channel": "email",
    "priority": "normal",
    "dynamic_data": {
      "clientName": "Test User",
      "jobAddress": "123 Test St",
      "scheduledStartTime": "Jan 16, 2025 at 10:00 AM",
      "creditAmount": 100,
      "jobId": "test-job-123"
    }
  }
}
```

### Test via cURL

```bash
curl -X POST https://your-n8n.com/webhook/puretask-communications \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Test via Backend

```typescript
import { sendNotification } from "./services/notifications";

await sendNotification({
  type: "job.booked",
  channel: "email",
  email: "test@example.com",
  data: {
    jobId: "test-123",
    clientName: "Test User",
    jobAddress: "123 Test St",
  },
});
```

---

## 📚 Related Documents

- `docs/N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md` - Detailed step-by-step guide
- `docs/n8n-universal-sender-workflow-spec.md` - Full specification
- `n8n-workflows/PT-Universal-Sender.json` - Importable workflow JSON

---

## 🚨 Troubleshooting

### Issue: Webhook not receiving requests

**Check:**
- Workflow is active
- Webhook URL is correct in backend `.env`
- Network/firewall allows requests

### Issue: SendGrid/Twilio errors

**Check:**
- API keys are correct
- Template IDs are valid
- Dynamic data matches template requirements

### Issue: Workflow import fails

**Solution:**
- Use manual setup guide
- Check n8n version compatibility
- Verify JSON format

---

*Setup Checklist - Last Updated: January 2025*

