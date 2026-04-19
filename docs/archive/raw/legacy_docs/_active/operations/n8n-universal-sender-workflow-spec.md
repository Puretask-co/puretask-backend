# n8n Universal Email/SMS Sender Workflow Specification

**Purpose:** Specification for n8n workflows that handle all PureTask email/SMS communications  
**Status:** 📋 Specification (to be implemented in n8n)  
**Workflow Name:** `PT-Universal-Sender`

---

## 🎯 Architecture Overview

```
Backend Event → n8n Webhook → Universal Sender Workflow → SendGrid/Twilio → Retry/Alert
```

**Golden Rule:**
- Backend emits events only (never decides email content)
- n8n chooses template + sends email + handles retries
- Frontend UI only

---

## 📥 Webhook Input Specification

### Endpoint

**URL:** `https://n8n.puretask.com/webhook/puretask-communications`  
**Method:** `POST`  
**Authentication:** HMAC signature (header: `x-n8n-signature`)

### Request Payload Structure

```json
{
  "eventName": "job.booked",
  "jobId": "job-123",
  "timestamp": "2025-01-15T10:00:00Z",
  "communication": {
    "templateEnvVar": "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED",
    "templateId": "d-xxxx",
    "to_email": "client@example.com",
    "to_phone": "+1234567890",  // Optional, for SMS
    "channel": "email",  // "email" | "sms"
    "priority": "normal",  // "high" | "normal"
    "dynamic_data": {
      "clientName": "John Doe",
      "jobAddress": "123 Main St",
      "scheduledStartTime": "Jan 16, 2025 at 10:00 AM",
      "creditAmount": 100,
      "jobId": "job-123"
    }
  }
}
```

### Payload Validation Rules

1. ✅ `communication.templateId` must exist
2. ✅ `communication.channel` must be "email" or "sms"
3. ✅ For email: `communication.to_email` required
4. ✅ For SMS: `communication.to_phone` required
5. ✅ `communication.dynamic_data` must be object
6. ✅ Template ID must match env var mapping

---

## 🔄 Workflow Logic Flow

### Step 1: Webhook Trigger

**Node Type:** Webhook  
**Authentication:** HMAC signature verification  
**Output:** Full request payload

### Step 2: Validate Payload

**Node Type:** Function/Code  
**Action:** Validate payload structure and required fields

```javascript
// Validation logic
const { communication } = $json;

if (!communication.templateId) {
  throw new Error("Missing templateId");
}

if (!communication.channel) {
  throw new Error("Missing channel");
}

if (communication.channel === "email" && !communication.to_email) {
  throw new Error("Missing to_email for email channel");
}

if (communication.channel === "sms" && !communication.to_phone) {
  throw new Error("Missing to_phone for SMS channel");
}

return $json;
```

### Step 3: Route by Channel

**Node Type:** IF Node  
**Condition:** `communication.channel === "email"`

- **True:** → Email Branch
- **False:** → SMS Branch

---

## 📧 Email Branch (SendGrid)

### Step 4: SendGrid Send Email

**Node Type:** SendGrid  
**Action:** Send dynamic template email

**Configuration:**
- API Key: `{{$env.SENDGRID_API_KEY}}`
- From Email: `{{$env.SENDGRID_FROM_EMAIL}}`
- From Name: `PureTask`

**Template Configuration:**
- Template ID: `{{$json.communication.templateId}}`
- To Email: `{{$json.communication.to_email}}`
- Dynamic Data: `{{$json.communication.dynamic_data}}`

**Example SendGrid Request:**
```json
{
  "from": {
    "email": "noreply@puretask.com",
    "name": "PureTask"
  },
  "personalizations": [
    {
      "to": [
        {
          "email": "client@example.com"
        }
      ],
      "dynamic_template_data": {
        "clientName": "John Doe",
        "jobAddress": "123 Main St",
        "scheduledStartTime": "Jan 16, 2025 at 10:00 AM",
        "creditAmount": 100,
        "jobId": "job-123"
      }
    }
  ],
  "template_id": "d-xxxx"
}
```

### Step 5: Handle SendGrid Response

**Node Type:** Function  
**Action:** Check response and prepare for retry if needed

```javascript
const response = $json;

if (response.statusCode === 202) {
  // Success
  return {
    success: true,
    messageId: response.headers['x-message-id'],
    channel: 'email',
    timestamp: new Date().toISOString()
  };
} else {
  // Failure - trigger retry
  throw new Error(`SendGrid error: ${response.statusCode}`);
}
```

### Step 6: Retry Logic (On Failure)

**Node Type:** Error Trigger  
**Action:** Retry failed email sends

**Retry Strategy:**
- Initial retry: 1 minute
- Second retry: 5 minutes
- Third retry: 15 minutes
- Max retries: 3

**After Max Retries:**
- Send to Slack alert channel
- Log to error tracking
- Optionally fallback to SMS (if `communication.to_phone` exists)

---

## 📱 SMS Branch (Twilio)

### Step 7: Twilio Send SMS

**Node Type:** Twilio  
**Action:** Send SMS message

**Configuration:**
- Account SID: `{{$env.TWILIO_ACCOUNT_SID}}`
- Auth Token: `{{$env.TWILIO_AUTH_TOKEN}}`
- From Number: `{{$env.TWILIO_FROM_NUMBER}}`

**Message Configuration:**
- To: `{{$json.communication.to_phone}}`
- Body: Construct message from template + dynamic_data

**Message Template Construction:**
```javascript
// Construct SMS message from dynamic_data
const data = $json.communication.dynamic_data;
const message = `PureTask: ${data.message || 'Job update'}. ${data.jobAddress || ''}`;

return {
  to: $json.communication.to_phone,
  body: message
};
```

### Step 8: Handle Twilio Response

**Node Type:** Function  
**Action:** Check response

```javascript
const response = $json;

if (response.status === 'queued' || response.status === 'sent') {
  return {
    success: true,
    messageId: response.sid,
    channel: 'sms',
    timestamp: new Date().toISOString()
  };
} else {
  throw new Error(`Twilio error: ${response.status}`);
}
```

---

## 🔔 Error Handling & Alerts

### Slack Alert on Failure

**Node Type:** Slack  
**Trigger:** After max retries exceeded or critical error

**Alert Format:**
```json
{
  "text": "🚨 Email Send Failed",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Email Send Failed*\n*Template:* job.booked\n*To:* client@example.com\n*Error:* SendGrid API error 500\n*Job ID:* job-123"
      }
    }
  ]
}
```

**Slack Channel:** `#puretask-alerts` (configurable via env var)

### Error Logging

**Node Type:** Function  
**Action:** Log errors to error tracking service (optional: Sentry, DataDog)

---

## 🔄 Retry Workflow (Separate Workflow)

**Workflow Name:** `PT-Universal-Sender-Retry`

**Purpose:** Retry failed communications from dead letter queue

**Trigger:** Scheduled (every 15 minutes) OR Manual trigger

**Logic:**
1. Check for failed communications in queue
2. Attempt resend
3. Update retry count
4. Archive after max retries
5. Alert on permanent failures

---

## 📋 Environment Variables (n8n)

```env
# SendGrid
SENDGRID_API_KEY=SG.xxx...
SENDGRID_FROM_EMAIL=noreply@puretask.com
SENDGRID_FROM_NAME=PureTask

# Twilio
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_FROM_NUMBER=+1234567890

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx...

# Template IDs (from email-registry.md)
SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED=d-xxxx
SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED=d-yyyy
# ... etc
```

---

## ✅ Workflow Implementation Checklist

### Phase 1: Basic Email Sending

- [ ] Create webhook endpoint in n8n
- [ ] Add HMAC signature verification
- [ ] Create payload validation node
- [ ] Add SendGrid node configuration
- [ ] Test with sample payload

### Phase 2: Error Handling

- [ ] Add error handling nodes
- [ ] Implement retry logic
- [ ] Add Slack alert integration
- [ ] Test failure scenarios

### Phase 3: SMS Support

- [ ] Add SMS branch routing
- [ ] Configure Twilio node
- [ ] Add SMS fallback on email failure
- [ ] Test SMS delivery

### Phase 4: Advanced Features

- [ ] Create retry workflow
- [ ] Add dead letter queue
- [ ] Implement rate limiting
- [ ] Add analytics/monitoring

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

### Test Payload (SMS)

```json
{
  "eventName": "communication.sms",
  "timestamp": "2025-01-15T10:00:00Z",
  "communication": {
    "templateEnvVar": "SMS_TEMPLATE_EMERGENCY",
    "to_phone": "+1234567890",
    "channel": "sms",
    "priority": "high",
    "dynamic_data": {
      "userName": "Test User",
      "message": "Your cleaner is running 15 minutes late",
      "jobAddress": "123 Test St",
      "jobId": "test-job-123"
    }
  }
}
```

---

## 📚 Related Documents

- `docs/email-registry.md` - Template registry
- `docs/architecture-what-lives-where.md` - Architecture boundaries
- `docs/EVENT_SYSTEM_SPEC.md` - Event specifications

---

**This specification defines how n8n workflows should handle all PureTask communications.**

---

*Last Updated: January 2025*
