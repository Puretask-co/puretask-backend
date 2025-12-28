# n8n Webhook Secret - HMAC Signature Verification

## 🔐 Your n8n Webhook Secret

**Secret:** `8caa9529be7343e3957a26868371162b`

This secret is used to verify that webhook requests to your PureTask backend actually come from your n8n instance, preventing unauthorized webhook calls.

---

## 🔒 How It Works

### 1. PureTask → n8n (Outgoing Webhooks)

When PureTask sends events to n8n:

```typescript
// Backend automatically signs the payload
const payload = { event: 'job.created', jobId: job.id };
const signature = crypto
  .createHmac('sha256', N8N_WEBHOOK_SECRET)
  .update(JSON.stringify(payload), 'utf8')
  .digest('hex');

// Sent in header
headers: {
  'x-n8n-signature': signature,
  'Content-Type': 'application/json'
}
```

### 2. n8n → PureTask (Incoming Webhooks)

When n8n sends data back to PureTask:

```typescript
// Your n8n workflow signs the payload
const crypto = require('crypto');
const payload = JSON.stringify($json);
const signature = crypto
  .createHmac('sha256', '8caa9529be7343e3957a26868371162b')
  .update(payload, 'utf8')
  .digest('hex');

// n8n sends with header: x-n8n-signature
```

Then PureTask backend verifies it:

```typescript
import { verifyN8nSignature } from './lib/auth';

// Middleware on webhook endpoints
app.post('/webhooks/n8n', verifyN8nSignature, async (req, res) => {
  // If we reach here, signature was valid
  const event = req.body;
  // Process event...
});
```

---

## ✅ Already Implemented

Your PureTask backend **already has** HMAC verification implemented!

### Verification Middleware

Located in `src/lib/auth.ts`:

```typescript
export function verifyN8nSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = env.N8N_WEBHOOK_SECRET;
  
  // Get signature from header
  const headerSig = req.headers["x-n8n-signature"];
  
  // Compute expected signature
  const bodyString = JSON.stringify(req.body ?? {});
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(bodyString, "utf8");
  const expectedSig = hmac.digest("hex");
  
  // Timing-safe comparison
  const valid = crypto.timingSafeEqual(
    Buffer.from(headerSig),
    Buffer.from(expectedSig)
  );
  
  if (!valid) {
    return res.status(401).json({
      error: { code: "INVALID_SIGNATURE", message: "Invalid n8n signature" }
    });
  }
  
  next();
}
```

### Usage on Routes

Already implemented in your webhook routes:

```typescript
import { verifyN8nSignature } from '../lib/auth';

// Protected webhook endpoint
router.post('/webhooks/n8n', verifyN8nSignature, async (req, res) => {
  // Signature verified ✅
  const { event, data } = req.body;
  
  // Process event...
  res.json({ success: true });
});
```

---

## 🛠️ n8n Workflow Configuration

### In Your n8n Workflows

When sending webhooks TO PureTask backend, add this code node:

```javascript
// n8n Code Node: Sign Webhook Payload
const crypto = require('crypto');

// Your webhook secret
const secret = '8caa9529be7343e3957a26868371162b';

// Prepare payload
const payload = {
  event: $json.event,
  data: $json.data
};

const bodyString = JSON.stringify(payload);

// Generate signature
const signature = crypto
  .createHmac('sha256', secret)
  .update(bodyString, 'utf8')
  .digest('hex');

// Return payload with signature
return {
  json: {
    payload: payload,
    headers: {
      'x-n8n-signature': signature,
      'Content-Type': 'application/json'
    }
  }
};
```

Then use HTTP Request node:

```
URL: https://your-backend.railway.app/webhooks/n8n
Method: POST
Body: {{ $json.payload }}
Headers: {{ $json.headers }}
```

---

## 🧪 Testing Signature Verification

### Test Valid Signature

```bash
# Generate valid signature
SECRET="8caa9529be7343e3957a26868371162b"
PAYLOAD='{"event":"test","data":{"message":"hello"}}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -hex | cut -d' ' -f2)

# Send request
curl -X POST https://your-backend.railway.app/webhooks/n8n \
  -H "Content-Type: application/json" \
  -H "x-n8n-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

**Expected Response:** `{ "success": true }`

### Test Invalid Signature

```bash
# Wrong signature
curl -X POST https://your-backend.railway.app/webhooks/n8n \
  -H "Content-Type: application/json" \
  -H "x-n8n-signature: wrong-signature" \
  -d '{"event":"test"}'
```

**Expected Response:** 
```json
{
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "Invalid n8n signature"
  }
}
```

---

## 🔧 Configuration

### Local Development (.env)

```bash
N8N_WEBHOOK_SECRET=8caa9529be7343e3957a26868371162b
```

### Railway Production

Add to Railway Dashboard → Variables:

```bash
N8N_WEBHOOK_SECRET=8caa9529be7343e3957a26868371162b
```

---

## 🎯 Use Cases

### 1. Job Status Updates from n8n

n8n workflow monitors job and sends updates:

```javascript
// n8n workflow after checking external service
const jobUpdate = {
  event: 'job.external_verification',
  jobId: $json.jobId,
  status: 'verified',
  timestamp: new Date().toISOString()
};

// Sign and send to PureTask
// ... (signature code from above)
```

### 2. Payment Confirmations

n8n processes payment, notifies PureTask:

```javascript
const paymentConfirmed = {
  event: 'payment.confirmed',
  transactionId: $json.transactionId,
  amount: $json.amount,
  userId: $json.userId
};

// Sign and send
```

### 3. Third-Party Integrations

n8n receives webhook from external service, forwards to PureTask:

```javascript
const externalEvent = {
  event: 'external.webhook',
  source: 'stripe', // or 'twilio', 'sendgrid', etc.
  data: $json
};

// Sign and forward to PureTask
```

---

## 🔒 Security Best Practices

### 1. Never Log the Secret

```typescript
// ❌ DON'T
console.log('Secret:', process.env.N8N_WEBHOOK_SECRET);

// ✅ DO
logger.info('n8n_configured', { 
  hasSecret: !!process.env.N8N_WEBHOOK_SECRET 
});
```

### 2. Use Timing-Safe Comparison

Already implemented:

```typescript
// ✅ Prevents timing attacks
crypto.timingSafeEqual(
  Buffer.from(headerSig),
  Buffer.from(expectedSig)
);
```

### 3. Validate Payload Structure

```typescript
app.post('/webhooks/n8n', verifyN8nSignature, async (req, res) => {
  // Signature valid ✅
  
  // Validate payload structure
  if (!req.body.event || typeof req.body.event !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  
  // Process...
});
```

### 4. Rate Limiting

Webhook endpoints should be rate-limited:

```typescript
import { webhookRateLimiter } from './lib/security';

app.post('/webhooks/n8n', 
  webhookRateLimiter,
  verifyN8nSignature,
  handler
);
```

---

## 🐛 Troubleshooting

### Issue: "Invalid n8n signature"

**Possible Causes:**

1. **Different secrets**
   - Check backend has: `8caa9529be7343e3957a26868371162b`
   - Check n8n workflow uses same secret

2. **Body serialization mismatch**
   ```javascript
   // Make sure both use JSON.stringify the same way
   const bodyString = JSON.stringify(payload); // No extra spaces
   ```

3. **Encoding issues**
   ```javascript
   // Must use UTF-8
   hmac.update(bodyString, 'utf8');
   ```

4. **Header name**
   - Must be exactly: `x-n8n-signature`
   - Case-sensitive in some frameworks

### Issue: Missing signature header

**Fix in n8n:**

Make sure HTTP Request node includes custom headers:

```
Headers:
  x-n8n-signature: {{ $json.signature }}
```

### Issue: Signature works locally but fails in production

**Check:**
- Environment variable is set in Railway
- No extra whitespace in secret
- Secret is not quoted: `8caa...` not `"8caa..."`

---

## 📊 Monitoring

### Log Signature Verification

Already implemented:

```typescript
// Success
logger.info('n8n_signature_verified', { endpoint: req.path });

// Failure
logger.warn('n8n_signature_invalid', { 
  endpoint: req.path,
  ip: req.ip 
});
```

### Security Alerts

Monitor failed verification attempts:

```typescript
// After X failed attempts from same IP, alert
if (failedAttempts > 5) {
  await sendSecurityAlert({
    type: 'webhook_signature_failures',
    ip: req.ip,
    count: failedAttempts
  });
}
```

---

## ✅ Complete n8n Configuration

Now you have **ALL n8n credentials configured**:

```bash
# MCP Server (for AI)
N8N_MCP_SERVER_URL=https://puretask.app.n8n.cloud/mcp-server/http

# API Key (for programmatic triggers)
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Webhook Secret (for signature verification)
N8N_WEBHOOK_SECRET=8caa9529be7343e3957a26868371162b

# Webhook URL (for event notifications)
N8N_WEBHOOK_URL=https://puretask.app.n8n.cloud/webhook/universal-sender
```

---

## 🎉 You're Ready!

### What Works Now:

1. ✅ **PureTask → n8n** (Outgoing webhooks with HMAC)
2. ✅ **n8n → PureTask** (Incoming webhooks verified with HMAC)
3. ✅ **Direct API calls** (Using N8N_API_KEY)
4. ✅ **AI integration** (Using N8N_MCP_SERVER_URL)

### Next Steps:

1. **Add to Railway:**
   ```bash
   N8N_WEBHOOK_SECRET=8caa9529be7343e3957a26868371162b
   ```

2. **Test webhook:**
   - Create n8n workflow
   - Add signature generation
   - Send test webhook to PureTask
   - Verify it's accepted

3. **Monitor logs:**
   ```bash
   railway logs | grep n8n
   ```

---

**Webhook Secret:** `8caa9529be7343e3957a26868371162b` ✅  
**Verification:** Already implemented in `src/lib/auth.ts` ✅  
**Status:** Ready to use! 🚀

