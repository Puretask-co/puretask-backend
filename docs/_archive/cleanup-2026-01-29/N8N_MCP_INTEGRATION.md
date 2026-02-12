# n8n MCP Integration Guide

## 🔗 Your n8n MCP Server

**URL:** `https://puretask.app.n8n.cloud/mcp-server/http`

This is your n8n Model Context Protocol (MCP) server endpoint for AI-powered workflow automation.

---

## 🚀 Quick Setup

### 1. Add to Environment Variables

Add to your `.env` file:

```bash
N8N_MCP_SERVER_URL=https://puretask.app.n8n.cloud/mcp-server/http
N8N_WEBHOOK_URL=https://puretask.app.n8n.cloud/webhook/your-workflow-id
N8N_WEBHOOK_SECRET=your-hmac-secret
USE_EVENT_BASED_NOTIFICATIONS=true
```

### 2. Add to Railway

In Railway Dashboard → Variables:

```bash
N8N_MCP_SERVER_URL=https://puretask.app.n8n.cloud/mcp-server/http
N8N_WEBHOOK_URL=https://puretask.app.n8n.cloud/webhook/your-workflow-id
N8N_WEBHOOK_SECRET=your-hmac-secret
USE_EVENT_BASED_NOTIFICATIONS=true
```

---

## 🎯 What is n8n MCP?

The **Model Context Protocol (MCP)** allows AI assistants (like Claude) to:
- Interact with your n8n workflows
- Trigger automation based on events
- Query workflow status
- Access n8n data sources

---

## 🔧 How PureTask Uses n8n

### 1. **Event-Based Notifications**

PureTask sends events to n8n workflows:

```typescript
// When a job is created
await triggerN8nWorkflow('job.created', {
  jobId: job.id,
  clientEmail: client.email,
  cleanerEmail: cleaner.email,
  scheduledDate: job.scheduled_start_at
});
```

### 2. **Universal Notification Sender**

n8n workflow handles:
- Email (SendGrid)
- SMS (Twilio)
- Push notifications (OneSignal)
- Slack alerts

### 3. **Workflow Automation**

Examples:
- Auto-send reminders 1 hour before job
- Notify admin of disputes
- Send weekly summaries
- Track cleaner performance

---

## 📝 Available n8n Workflows

### Job Lifecycle Events

```typescript
// Events PureTask sends to n8n
const events = [
  'job.created',
  'job.accepted',
  'job.on_my_way',
  'job.started',
  'job.completed',
  'job.awaiting_approval',
  'job.approved',
  'job.disputed',
  'job.cancelled',
];
```

### Payment Events

```typescript
const paymentEvents = [
  'credits.purchased',
  'credits.low',
  'payout.processed',
  'payout.failed',
];
```

### Account Events

```typescript
const accountEvents = [
  'user.welcome',
  'user.email_verified',
  'user.password_reset',
  '2fa.enabled',
  'oauth.linked',
];
```

---

## 🔒 Security: HMAC Signature Verification

PureTask signs all n8n webhook requests with HMAC-SHA256:

```typescript
// Backend automatically signs requests
const signature = crypto
  .createHmac('sha256', N8N_WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

// Sent in header: x-n8n-signature
```

### n8n Workflow: Verify Signature

```javascript
// In n8n Code node
const secret = $env.N8N_WEBHOOK_SECRET;
const signature = $request.headers['x-n8n-signature'];
const body = JSON.stringify($json);

const expected = crypto
  .createHmac('sha256', secret)
  .update(body, 'utf8')
  .digest('hex');

if (signature !== expected) {
  throw new Error('Invalid signature');
}

return $json;
```

---

## 📊 Example: Send Job Notification

### PureTask Backend Code

```typescript
import { sendN8nNotification } from './lib/events';

// When job is created
await sendN8nNotification({
  event: 'job.created',
  jobId: job.id,
  clientEmail: client.email,
  clientName: client.first_name,
  address: job.address,
  scheduledDate: job.scheduled_start_at,
  creditAmount: job.credit_amount
});
```

### n8n Workflow Structure

```
1. Webhook Trigger (listens for job.created)
   ↓
2. Verify HMAC Signature
   ↓
3. Switch (based on event type)
   ↓
4. Send Email (SendGrid)
   ↓
5. Send SMS (Twilio) - if urgent
   ↓
6. Send Push (OneSignal)
   ↓
7. Log to Database
```

---

## 🛠️ Testing n8n Integration

### Test from Backend

```bash
curl -X POST https://puretask.app.n8n.cloud/webhook/test \
  -H "Content-Type: application/json" \
  -H "x-n8n-signature: YOUR_HMAC_SIGNATURE" \
  -d '{
    "event": "job.created",
    "jobId": "test-123",
    "clientEmail": "test@example.com"
  }'
```

### Test HMAC Signature Generation

```javascript
// Node.js
const crypto = require('crypto');
const secret = 'your-n8n-webhook-secret';
const body = JSON.stringify({ event: 'test' });
const signature = crypto
  .createHmac('sha256', secret)
  .update(body, 'utf8')
  .digest('hex');
console.log('Signature:', signature);
```

---

## 📱 MCP Server Capabilities

Your n8n MCP server can:

### 1. **Workflow Management**
```
List workflows
Trigger workflows
Get workflow status
View execution history
```

### 2. **Data Access**
```
Query n8n database
Access workflow variables
Read execution logs
```

### 3. **AI Integration**
```
Claude can interact with workflows
Auto-create workflows from descriptions
Debug workflow issues
Optimize workflow performance
```

---

## 🎯 Railway Deployment

Add to Railway environment variables:

```bash
# Required
N8N_MCP_SERVER_URL=https://puretask.app.n8n.cloud/mcp-server/http
N8N_WEBHOOK_URL=https://puretask.app.n8n.cloud/webhook/your-id
N8N_WEBHOOK_SECRET=your-secret

# Optional but recommended
USE_EVENT_BASED_NOTIFICATIONS=true
```

---

## 🔄 Workflow: Universal Notification Sender

### Setup in n8n

1. **Create Webhook Trigger**
   - URL: `https://puretask.app.n8n.cloud/webhook/universal-sender`
   - Method: POST
   - Authentication: HMAC signature verification

2. **Parse Event**
   ```javascript
   const event = $json.event;
   const data = $json;
   ```

3. **Route by Channel**
   - If `channel === 'email'` → SendGrid
   - If `channel === 'sms'` → Twilio
   - If `channel === 'push'` → OneSignal

4. **Send Notification**
   - Use appropriate service
   - Handle errors
   - Log results

5. **Return Status**
   ```json
   {
     "success": true,
     "messageId": "msg_123",
     "channel": "email"
   }
   ```

---

## 📚 Available Templates

### Email Templates (SendGrid)
- Job booked confirmation
- Job accepted by cleaner
- Cleaner on the way
- Job completed
- Payment receipt
- Weekly summary

### SMS Templates (Twilio)
- Job reminder (1 hour before)
- Emergency alerts
- Verification codes

### Push Templates (OneSignal)
- Real-time job updates
- New message notifications
- Payment confirmations

---

## 🐛 Troubleshooting

### Issue: Signature Verification Fails

**Check:**
1. Same secret in backend and n8n
2. Body is stringified identically
3. No whitespace changes
4. UTF-8 encoding

### Issue: Webhook Not Triggering

**Check:**
1. n8n workflow is active
2. Webhook URL is correct
3. Network connectivity
4. Firewall rules

### Issue: Slow Response

**Check:**
1. n8n workflow optimization
2. Async processing
3. Timeout settings (currently 30s)

---

## 🎉 Benefits of n8n Integration

✅ **Centralized Notifications**
- All channels in one place
- Easy to modify templates
- Visual workflow builder

✅ **No Code Changes**
- Update notifications without deploying
- A/B test messages
- Add new channels instantly

✅ **Powerful Automation**
- Complex workflows
- Conditional logic
- Data transformations

✅ **Monitoring & Logging**
- Execution history
- Error tracking
- Performance metrics

✅ **Scalability**
- Handle high volume
- Retry logic built-in
- Queue management

---

## 📝 Next Steps

1. **Configure n8n Webhooks**
   - Set up Universal Sender workflow
   - Configure HMAC verification
   - Test with sample events

2. **Add Email Templates**
   - Create SendGrid templates
   - Configure template IDs
   - Test email delivery

3. **Set Up SMS**
   - Configure Twilio account
   - Add phone numbers
   - Test SMS delivery

4. **Enable Push Notifications**
   - Configure OneSignal
   - Add app credentials
   - Test push delivery

5. **Monitor & Optimize**
   - Check execution logs
   - Optimize workflow performance
   - Set up alerts

---

**MCP Server URL:** `https://puretask.app.n8n.cloud/mcp-server/http`

**Status:** ✅ Ready to use

**Documentation:** https://docs.n8n.io/integrations/mcp/

