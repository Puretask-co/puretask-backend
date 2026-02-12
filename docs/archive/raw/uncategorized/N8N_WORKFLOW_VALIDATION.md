# n8n Workflow JSON Validation

**File:** `n8n-workflows/PT-Universal-Sender.json`  
**Status:** ✅ Valid JSON, Ready for Import

---

## ✅ Validation Results

### JSON Structure
- ✅ Valid JSON syntax
- ✅ All required fields present
- ✅ Node connections properly defined
- ✅ Node types are valid n8n node types

### Workflow Nodes Included

1. **Webhook Node** ✅
   - Method: POST
   - Path: puretask-communications
   - Response mode: responseNode

2. **Validate Payload** ✅
   - Type: Code node
   - Validates communication object structure
   - Validates channel (email/sms)
   - Validates required fields

3. **Route by Channel** ✅
   - Type: IF node
   - Routes email vs SMS

4. **SendGrid Send Email** ✅
   - Type: HTTP Request
   - Endpoint: SendGrid API
   - Authentication: Header Auth
   - Template support

5. **Twilio Send SMS** ✅
   - Type: HTTP Request
   - Endpoint: Twilio API
   - Authentication: Basic Auth

6. **Response Nodes** ✅
   - Success response
   - Error response
   - Slack alerts

---

## 📋 Import Instructions

### Method 1: Import via UI (Recommended)

1. **Open n8n Dashboard**
   - Navigate to your n8n instance
   - Login if required

2. **Import Workflow**
   - Click "Workflows" in sidebar
   - Click "Import from File" or "+" → "Import from File"
   - Select: `n8n-workflows/PT-Universal-Sender.json`
   - Click "Import"

3. **Configure After Import**
   - Review workflow nodes
   - Set environment variables (see below)
   - Connect nodes if needed (usually auto-connected)
   - Test webhook endpoint

### Method 2: Import via API

```bash
# Get your n8n API key from Settings → API
curl -X POST https://your-n8n.com/api/v1/workflows \
  -H "X-N8N-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d @n8n-workflows/PT-Universal-Sender.json
```

---

## 🔧 Required Configuration After Import

### Environment Variables

Set these in n8n Settings → Environment Variables:

```env
# SendGrid
SENDGRID_API_KEY=SG.xxx...
SENDGRID_FROM_EMAIL=noreply@puretask.com

# Twilio
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_FROM_NUMBER=+1234567890

# Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx...
SLACK_ALERT_CHANNEL=#puretask-alerts
```

### Node Configuration Adjustments

After import, you may need to:

1. **Update HTTP Request Nodes**
   - Verify authentication credentials
   - Test API endpoints

2. **Update Code Nodes**
   - Review validation logic
   - Adjust error messages if needed

3. **Update Slack Node**
   - Verify webhook URL (if using Slack)
   - Test alert delivery

---

## 🧪 Testing After Import

### Test 1: Webhook Endpoint

```bash
curl -X POST https://your-n8n.com/webhook/puretask-communications \
  -H "Content-Type: application/json" \
  -d '{
    "communication": {
      "templateId": "d-test",
      "to_email": "test@example.com",
      "channel": "email",
      "dynamic_data": {
        "test": "data"
      }
    }
  }'
```

### Test 2: From Backend

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

## ⚠️ Known Limitations

1. **Template IDs**: The workflow expects template IDs to be passed in the payload. Make sure backend includes them.

2. **Error Handling**: Current workflow has basic error handling. You may want to add retry logic (see implementation guide).

3. **SMS Message Construction**: SMS messages are constructed from dynamic_data. Adjust the code node if you need different formatting.

---

## 📚 Related Documents

- `docs/N8N_SETUP_COMPLETE_CHECKLIST.md` - Step-by-step setup
- `docs/N8N_WORKFLOW_IMPLEMENTATION_GUIDE.md` - Detailed implementation guide
- `docs/n8n-universal-sender-workflow-spec.md` - Full specification

---

*Validation Complete - Ready for Import*

