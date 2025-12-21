# Event System Specification

**Purpose:** Standardize event naming, payloads, and structure  
**Status:** ✅ Active specification

---

## 🎯 Event Naming Convention

### Format

```
{domain}.{action}
```

### Rules

- ✅ Use lowercase only
- ✅ Use dot (`.`) to separate domain and action
- ✅ Domain is a noun (job, payment, user, etc.)
- ✅ Action is a verb in past tense (booked, cancelled, completed, etc.)

### Examples

```typescript
// ✅ CORRECT
"job.booked"
"job.cancelled"
"job.completed"
"payment.succeeded"
"payout.sent"
"user.registered"
"cleaner.on_my_way"  // Special case: multi-word action

// ❌ WRONG
"booked"                    // Missing domain
"job_booked"                // Use dot, not underscore
"JOB_BOOKED"                // Use lowercase
"jobBooked"                 // Use dot, not camelCase
```

---

## 📋 Standard Event Types

### Job Events

| Event Name | Description | When Emitted |
|------------|-------------|--------------|
| `job.booked` | Job created by client | After job creation |
| `job.accepted` | Cleaner accepted job | After cleaner accepts |
| `job.cancelled` | Job cancelled | After cancellation |
| `job.completed` | Cleaner marked job complete | After completion |
| `job.approved` | Client approved job | After client approval |
| `job.disputed` | Client disputed job | After dispute creation |
| `job.started` | Cleaner started job | After check-in |
| `cleaner.on_my_way` | Cleaner en route | After "on my way" action |

### Payment Events

| Event Name | Description | When Emitted |
|------------|-------------|--------------|
| `payment.succeeded` | Payment completed | After successful payment |
| `payment.failed` | Payment failed | After payment failure |
| `payment.refunded` | Payment refunded | After refund processed |
| `payout.sent` | Payout to cleaner | After payout processed |
| `payout.failed` | Payout failed | After payout failure |

### User Events

| Event Name | Description | When Emitted |
|------------|-------------|--------------|
| `user.registered` | New user registered | After registration |
| `user.verified` | User email verified | After verification |
| `user.tier_changed` | User tier changed | After tier update |

### Communication Events

| Event Name | Description | When Emitted |
|------------|-------------|--------------|
| `communication.email` | Email should be sent | When email needed |
| `communication.sms` | SMS should be sent | When SMS needed |

---

## 📦 Event Payload Structure

### Standard Event Payload

```typescript
interface StandardEventPayload {
  // Event metadata
  eventName: string;          // e.g., "job.booked"
  jobId?: string | null;      // Job ID if applicable
  actorType?: "client" | "cleaner" | "admin" | "system" | null;
  actorId?: string | null;    // User ID who triggered event
  timestamp: string;          // ISO 8601 timestamp
  
  // Event-specific data
  payload: Record<string, unknown>;  // Event-specific fields
}
```

### Communication Event Payload

```typescript
interface CommunicationEventPayload {
  templateId: string;         // SendGrid/Twilio template ID (env var)
  to_email?: string;          // Email recipient
  to_phone?: string;          // SMS recipient
  channel: "email" | "sms";   // Communication channel
  dynamic_data: {             // Template variables
    [key: string]: unknown;
  };
  priority?: "high" | "normal";  // For retry logic
}
```

### Job Event Payload Example

```typescript
// job.booked event
{
  eventName: "job.booked",
  jobId: "123",
  actorType: "client",
  actorId: "client-456",
  timestamp: "2025-01-15T10:00:00Z",
  payload: {
    clientId: "client-456",
    address: "123 Main St",
    creditAmount: 100,
    scheduledStartAt: "2025-01-16T10:00:00Z",
    // Communication event nested (for n8n)
    communication: {
      templateId: env.EMAIL_TEMPLATE_JOB_BOOKED,
      to_email: "client@example.com",
      channel: "email",
      dynamic_data: {
        jobAddress: "123 Main St",
        creditAmount: 100,
        scheduledTime: "Jan 16, 10:00 AM",
      },
    },
  },
}
```

---

## 🔄 Event Flow

### 1. Backend Emits Event

```typescript
import { publishEvent } from "../lib/events";

await publishEvent({
  eventName: "job.booked",
  jobId: job.id,
  actorType: "client",
  actorId: userId,
  payload: {
    // Event data
  },
});
```

### 2. Event System Processes

```typescript
// src/lib/events.ts
export async function publishEvent(input: PublishEventInput) {
  // 1. Store in database (job_events table)
  await query("INSERT INTO job_events ...");
  
  // 2. Forward to n8n webhook
  await postJson(env.N8N_WEBHOOK_URL, {
    eventName: input.eventName,
    jobId: input.jobId,
    payload: input.payload,
    timestamp: new Date().toISOString(),
  });
  
  // 3. Log event
  logger.info("job_event_published", { ... });
}
```

### 3. n8n Receives Event

```javascript
// n8n workflow receives webhook
const event = $json.eventName;  // "job.booked"
const payload = $json.payload;

// Route to appropriate workflow
if (event.startsWith("job.")) {
  // Route to job workflow
} else if (event.startsWith("communication.")) {
  // Route to communication workflow
}
```

### 4. n8n Sends Communication

```javascript
// PT-Email-UniversalSender workflow
const templateId = payload.communication.templateId;
const toEmail = payload.communication.to_email;
const dynamicData = payload.communication.dynamic_data;

// Send via SendGrid
await sendgrid.send({
  templateId,
  to: toEmail,
  dynamicTemplateData: dynamicData,
});

// Retry on failure
// Alert Slack on errors
```

---

## 🎨 Template ID Mapping

### Environment Variables

```env
# Email Templates
EMAIL_TEMPLATE_JOB_BOOKED=d-xxxx
EMAIL_TEMPLATE_JOB_ACCEPTED=d-yyyy
EMAIL_TEMPLATE_JOB_COMPLETED=d-zzzz
EMAIL_TEMPLATE_JOB_CANCELLED=d-aaaa
EMAIL_TEMPLATE_JOB_DISPUTED=d-bbbb

# SMS Templates
SMS_TEMPLATE_EMERGENCY=d-cccc
SMS_TEMPLATE_JOB_REMINDER=d-dddd
```

### Template ID Reference

```typescript
// src/config/env.ts
export const env = {
  // ... other config
  EMAIL_TEMPLATE_JOB_BOOKED: process.env.EMAIL_TEMPLATE_JOB_BOOKED || "",
  EMAIL_TEMPLATE_JOB_ACCEPTED: process.env.EMAIL_TEMPLATE_JOB_ACCEPTED || "",
  // ... more templates
};

// Usage
await publishEvent({
  eventName: "job.booked",
  payload: {
    communication: {
      templateId: env.EMAIL_TEMPLATE_JOB_BOOKED,
      // ...
    },
  },
});
```

---

## ✅ Validation Rules

### Event Name Validation

- ✅ Must follow `{domain}.{action}` format
- ✅ Must be lowercase
- ✅ Domain must be noun
- ✅ Action must be past tense verb

### Payload Validation

- ✅ Must include `timestamp`
- ✅ Must include `eventName`
- ✅ Communication events must include `templateId`
- ✅ Communication events must include `channel`

---

## 📝 Adding New Events

### Step 1: Define Event Name

```typescript
// Add to src/lib/events.ts
export type JobEventType =
  | "job.booked"
  | "job.accepted"
  | "job.cancelled"
  // ... existing
  | "job.reminder_sent";  // ← New event
```

### Step 2: Add Template ID (if communication event)

```env
# .env.example
EMAIL_TEMPLATE_JOB_REMINDER=d-xxxx
```

### Step 3: Update Event Mapping

```typescript
// src/services/notifications/eventMapper.ts
const NOTIFICATION_TO_EVENT_MAP = {
  // ... existing
  "job_reminder": "job.reminder_sent",
};

const NOTIFICATION_TO_TEMPLATE_MAP = {
  // ... existing
  "job_reminder_email": env.EMAIL_TEMPLATE_JOB_REMINDER,
};
```

### Step 4: Create n8n Workflow (if needed)

- Create workflow: `PT-Email-JobReminder`
- Map event to workflow
- Test with sample event

---

## 🧪 Testing Events

### Emit Test Event

```typescript
await publishEvent({
  eventName: "job.booked",
  jobId: "test-job-123",
  actorType: "client",
  actorId: "test-client-456",
  payload: {
    test: true,
    communication: {
      templateId: env.EMAIL_TEMPLATE_JOB_BOOKED,
      to_email: "test@example.com",
      channel: "email",
      dynamic_data: {
        jobAddress: "123 Test St",
      },
    },
  },
});
```

### Verify Event in Database

```sql
SELECT * FROM job_events 
WHERE event_type = 'job.booked' 
ORDER BY created_at DESC 
LIMIT 1;
```

### Verify Event Reached n8n

- Check n8n execution logs
- Verify workflow triggered
- Verify email sent (in test environment)

---

## 📚 Related Documents

- `docs/architecture-what-lives-where.md` - Where events live
- `docs/ARCHITECTURE_MIGRATION_GUIDE.md` - Migrating to event system
- `src/lib/events.ts` - Event implementation

---

**This specification ensures consistent event handling across the system.**

---

*Last Updated: January 2025*
