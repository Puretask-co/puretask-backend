# n8n Workflow Implementation Guide

**Purpose:** Step-by-step guide to implement PureTask communication workflows in n8n  
**Status:** 📋 Ready for Implementation  
**Prerequisites:** n8n instance running, SendGrid and Twilio accounts configured

---

## 🎯 Overview

This guide walks through implementing the **PT-Universal-Sender** workflow that handles all PureTask email and SMS communications via event-driven architecture.

**Architecture:**
```
Backend → publishEvent() → n8n Webhook → PT-Universal-Sender → SendGrid/Twilio → Retry/Alert
```

---

## 📋 Prerequisites

### 1. n8n Setup

- ✅ n8n instance running (cloud or self-hosted)
- ✅ Access to n8n UI
- ✅ Webhook URLs configured
- ✅ Environment variables set in n8n

### 2. Required API Keys

- ✅ SendGrid API Key
- ✅ Twilio Account SID and Auth Token
- ✅ Slack Webhook URL (for alerts)
- ✅ n8n Webhook Secret (for HMAC verification)

### 3. SendGrid Templates

- ✅ All templates created in SendGrid (see `docs/email-registry.md`)
- ✅ Template IDs recorded
- ✅ Dynamic data fields documented

---

## 🚀 Step-by-Step Implementation

### Step 1: Create Webhook Node

**Purpose:** Receive events from PureTask backend

1. **Create New Workflow:**
   - Click "New Workflow" in n8n
   - Name it: `PT-Universal-Sender`

2. **Add Webhook Node:**
   - Drag "Webhook" node onto canvas
   - Click to configure

3. **Webhook Settings:**
   ```
   Settings:
   - HTTP Method: POST
   - Path: puretask-communications
   - Authentication: Header Auth (or HMAC - see Step 2)
   - Response Mode: Respond When Last Node Finishes
   ```

4. **Copy Webhook URL:**
   - Copy the webhook URL (e.g., `https://n8n.puretask.com/webhook/puretask-communications`)
   - Add to backend `.env`: `N8N_WEBHOOK_URL=<webhook-url>`

### Step 2: Add HMAC Verification (Optional but Recommended)

**Purpose:** Verify requests are from PureTask backend

1. **Add Function Node** (after Webhook):
   - Add "Function" node
   - Connect from Webhook

2. **HMAC Verification Code:**
   ```javascript
   // Get signature from header
   const signature = $input.item.json.headers['x-n8n-signature'];
   const body = JSON.stringify($input.item.json.body);
   const secret = $env.N8N_WEBHOOK_SECRET;
   
   // Calculate HMAC
   const crypto = require('crypto');
   const expectedSignature = crypto
     .createHmac('sha256', secret)
     .update(body)
     .digest('hex');
   
   // Verify
   if (signature !== expectedSignature) {
     throw new Error('Invalid signature');
   }
   
   // Return payload for processing
   return { json: $input.item.json.body };
   ```

### Step 3: Add Validation Node

**Purpose:** Validate payload structure

1. **Add IF Node:**
   - Add "IF" node
   - Connect from Function/Webhook

2. **Validation Rules:**
   ```
   Condition 1: Check if communication object exists
   - Expression: {{ $json.communication }}
   - Operation: Exists
   
   Condition 2: Check if channel is email or sms
   - Expression: {{ $json.communication.channel }}
   - Operation: Contains
   - Value: email|sms
   ```

3. **On False:** Connect to Error Handler (see Step 8)

### Step 4: Route by Channel

**Purpose:** Separate email and SMS processing

1. **Add IF Node:**
   - Add "IF" node
   - Connect from Validation

2. **Condition:**
   ```
   Expression: {{ $json.communication.channel }}
   Operation: Equals
   Value: email
   ```

3. **True Branch:** → Email Processing (Step 5)
4. **False Branch:** → SMS Processing (Step 6)

---

### Step 5: Email Branch (SendGrid)

**Purpose:** Send emails via SendGrid dynamic templates

#### 5.1: Add SendGrid Node

1. **Add HTTP Request Node:**
   - Name: "SendGrid Send Email"
   - Method: POST
   - URL: `https://api.sendgrid.com/v3/mail/send`

2. **Headers:**
   ```
   Authorization: Bearer {{ $env.SENDGRID_API_KEY }}
   Content-Type: application/json
   ```

3. **Body (JSON):**
   ```json
   {
     "from": {
       "email": "{{ $env.SENDGRID_FROM_EMAIL }}",
       "name": "PureTask"
     },
     "personalizations": [
       {
         "to": [
           {
             "email": "{{ $json.communication.to_email }}"
           }
         ],
         "dynamic_template_data": {{ $json.communication.dynamic_data }}
       }
     ],
     "template_id": "{{ $json.communication.templateId }}"
   }
   ```

#### 5.2: Handle SendGrid Response

1. **Add Function Node** (after SendGrid):
   - Name: "Check SendGrid Response"

2. **Response Check Code:**
   ```javascript
   const statusCode = $input.item.json.statusCode || $input.item.json.response?.statusCode;
   
   if (statusCode === 202) {
     // Success
     return {
       json: {
         success: true,
         channel: 'email',
         messageId: $input.item.json.headers?.['x-message-id'],
         timestamp: new Date().toISOString(),
         originalEvent: $('Webhook').item.json
       }
     };
   } else {
     // Failure - throw to trigger error handler
     throw new Error(`SendGrid error: ${statusCode} - ${JSON.stringify($input.item.json)}`);
   }
   ```

---

### Step 6: SMS Branch (Twilio)

**Purpose:** Send SMS via Twilio

#### 6.1: Construct SMS Message

1. **Add Function Node:**
   - Name: "Construct SMS Message"

2. **Message Construction Code:**
   ```javascript
   const data = $json.communication.dynamic_data;
   const templateKey = $json.communication.templateEnvVar;
   
   // Construct message from dynamic data
   // This is simplified - adjust based on your SMS template needs
   let message = `PureTask: `;
   
   if (data.message) {
     message += data.message;
   } else if (data.jobAddress) {
     message += `Update for ${data.jobAddress}`;
   } else {
     message += `You have a new update. Check the app for details.`;
   }
   
   return {
     json: {
       to: $json.communication.to_phone,
       body: message,
       from: $env.TWILIO_FROM_NUMBER,
       originalEvent: $('Webhook').item.json
     }
   };
   ```

#### 6.2: Add Twilio Node

1. **Add HTTP Request Node:**
   - Name: "Twilio Send SMS"
   - Method: POST
   - URL: `https://api.twilio.com/2010-04-01/Accounts/{{ $env.TWILIO_ACCOUNT_SID }}/Messages.json`

2. **Authentication:**
   - Type: Basic Auth
   - Username: `{{ $env.TWILIO_ACCOUNT_SID }}`
   - Password: `{{ $env.TWILIO_AUTH_TOKEN }}`

3. **Body (Form Data):**
   ```
   To: {{ $json.to }}
   From: {{ $json.from }}
   Body: {{ $json.body }}
   ```

#### 6.3: Handle Twilio Response

1. **Add Function Node:**
   - Name: "Check Twilio Response"

2. **Response Check Code:**
   ```javascript
   const response = $input.item.json;
   
   if (response.status === 'queued' || response.status === 'sent') {
     return {
       json: {
         success: true,
         channel: 'sms',
         messageId: response.sid,
         timestamp: new Date().toISOString(),
         originalEvent: $('Webhook').item.json
       }
     };
   } else {
     throw new Error(`Twilio error: ${response.status} - ${JSON.stringify(response)}`);
   }
   ```

---

### Step 7: Retry Logic

**Purpose:** Retry failed sends with exponential backoff

1. **Add Error Trigger Node:**
   - Connect to all failure points
   - Name: "Error Handler"

2. **Add Function Node** (after Error Trigger):
   - Name: "Check Retry Count"

3. **Retry Logic Code:**
   ```javascript
   const originalData = $input.item.json.error?.context?.item?.json;
   const retryCount = originalData?.retryCount || 0;
   const maxRetries = 3;
   
   if (retryCount >= maxRetries) {
     // Max retries exceeded - send to Slack alert
     return {
       json: {
         shouldRetry: false,
         retryCount,
         error: $input.item.json.error.message,
         originalData
       }
     };
   }
   
   // Calculate delay (exponential backoff)
   const delays = [60000, 300000, 900000]; // 1min, 5min, 15min
   const delay = delays[retryCount] || 900000;
   
   return {
     json: {
       shouldRetry: true,
       retryCount: retryCount + 1,
       delay,
       originalData: {
         ...originalData,
         retryCount: retryCount + 1
       }
     }
   };
   ```

4. **Add Wait Node** (if shouldRetry):
   - Connect from Function node (when shouldRetry = true)
   - Wait for calculated delay

5. **Loop Back:**
   - Connect Wait node back to SendGrid/Twilio node
   - This creates retry loop

---

### Step 8: Slack Alerts

**Purpose:** Alert on permanent failures

1. **Add IF Node:**
   - After retry check
   - Condition: `{{ $json.shouldRetry }}` equals `false`

2. **Add Slack Node** (on false branch):
   - Webhook URL: `{{ $env.SLACK_WEBHOOK_URL }}`
   - Channel: `#puretask-alerts`
   - Message:
   ```
   🚨 *Email/SMS Send Failed*
   *Template:* {{ $json.originalData.communication.templateEnvVar }}
   *To:* {{ $json.originalData.communication.to_email || $json.originalData.communication.to_phone }}
   *Error:* {{ $json.error }}
   *Retries:* {{ $json.retryCount }}/3
   ```

---

### Step 9: Success Response

**Purpose:** Return success response to backend

1. **Add Function Node:**
   - After successful SendGrid/Twilio send
   - Name: "Format Success Response"

2. **Response Code:**
   ```javascript
   return {
     json: {
       success: true,
       channel: $json.channel,
       messageId: $json.messageId,
       timestamp: $json.timestamp
     }
   };
   ```

3. **Add Respond to Webhook Node:**
   - Connect from Format Success Response
   - Status Code: 200
   - Response Body: JSON (use expression to pass data)

---

## 🔧 Environment Variables (n8n)

Configure these in n8n Settings → Environment Variables:

```env
# SendGrid
SENDGRID_API_KEY=SG.xxx...
SENDGRID_FROM_EMAIL=noreply@puretask.com

# Twilio
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_FROM_NUMBER=+1234567890

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx...

# n8n Webhook Secret (for HMAC)
N8N_WEBHOOK_SECRET=your-secret-key

# Template IDs (optional - can be passed in payload)
SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED=d-xxxx
# ... (see email-registry.md for full list)
```

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
curl -X POST https://n8n.puretask.com/webhook/puretask-communications \
  -H "Content-Type: application/json" \
  -H "x-n8n-signature: <hmac-signature>" \
  -d @test-payload.json
```

### Test via Backend

```typescript
import { publishEvent } from "../lib/events";

await publishEvent({
  eventName: "job.booked",
  jobId: "test-job-123",
  payload: {
    communication: {
      templateId: "d-xxxx",
      to_email: "test@example.com",
      channel: "email",
      dynamic_data: {
        clientName: "Test User",
        jobAddress: "123 Test St",
      },
    },
  },
});
```

---

## ✅ Workflow Checklist

### Basic Functionality

- [ ] Webhook node configured
- [ ] HMAC verification working
- [ ] Payload validation working
- [ ] Channel routing working
- [ ] SendGrid email sending working
- [ ] Twilio SMS sending working
- [ ] Success responses returning

### Error Handling

- [ ] Error trigger configured
- [ ] Retry logic working
- [ ] Max retry limit enforced
- [ ] Slack alerts on permanent failures
- [ ] Error responses returning

### Production Readiness

- [ ] Environment variables set
- [ ] All template IDs configured
- [ ] Retry delays appropriate
- [ ] Monitoring/alerting set up
- [ ] Workflow tested with real templates
- [ ] Rate limiting considered (if needed)

---

## 📚 Related Documents

- `docs/n8n-universal-sender-workflow-spec.md` - Detailed specification
- `docs/email-registry.md` - Template registry
- `docs/NOTIFICATION_SERVICE_MIGRATION.md` - Migration guide

---

## 🚨 Troubleshooting

### Issue: Webhook not receiving requests

**Check:**
- Webhook URL is correct in backend `.env`
- n8n instance is accessible
- Firewall rules allow incoming requests

### Issue: HMAC verification failing

**Check:**
- `N8N_WEBHOOK_SECRET` matches in backend and n8n
- Signature calculation matches
- Headers are being passed correctly

### Issue: SendGrid/Twilio errors

**Check:**
- API keys are correct
- Template IDs are valid
- Dynamic data matches template requirements
- Rate limits not exceeded

---

*Implementation Guide - Last Updated: January 2025*

