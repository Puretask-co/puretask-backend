# Architecture Migration Guide

**Purpose:** Migrate from current violations to clean architecture  
**Status:** 🟡 Migration in progress  
**Target:** All communications through n8n, no direct SendGrid/Twilio in production

---

## 🎯 Migration Goals

1. ✅ Remove all direct SendGrid/Twilio calls from production code paths
2. ✅ Replace with event emissions to n8n
3. ✅ Keep test/dev modes working (allow direct calls for testing)
4. ✅ Migrate alerting to n8n (eventually)
5. ✅ Document event payload structure

---

## 📋 Current State Analysis

### Files with Direct SendGrid/Twilio Calls

#### 1. `src/services/notifications/notificationService.ts`

**Current Code:**
```typescript
// Direct SendGrid call
async function sendEmailNotification(input: NotificationPayload) {
  const sgMail = await import("@sendgrid/mail").then((m) => m.default);
  sgMail.setApiKey(env.SENDGRID_API_KEY);
  await sgMail.send({ ... });
}

// Direct Twilio call
async function sendSmsNotification(input: NotificationPayload) {
  const twilio = await import("twilio").then((m) => m.default);
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  await client.messages.create({ ... });
}
```

**Status:** ❌ Violation - Direct calls in production path

#### 2. `src/services/notifications/providers/sendgrid.ts`

**Current Code:**
```typescript
export class SendGridProvider {
  async send(payload: EmailPayload) {
    const response = await fetch(SENDGRID_API_URL, {
      headers: { "Authorization": `Bearer ${env.SENDGRID_API_KEY}` },
      body: JSON.stringify({ ... }),
    });
  }
}
```

**Status:** ❌ Violation - Direct SendGrid API calls

#### 3. `src/services/notifications/providers/twilio.ts`

**Current Code:**
```typescript
export class TwilioProvider {
  async send(payload: SMSPayload) {
    const url = `${TWILIO_API_URL}/Accounts/${accountSid}/Messages.json`;
    await fetch(url, { ... });
  }
}
```

**Status:** ❌ Violation - Direct Twilio API calls

#### 4. `src/lib/alerting.ts`

**Current Code:**
```typescript
async function sendEmailAlert(payload: Record<string, unknown>) {
  await fetch("https://api.sendgrid.com/v3/mail/send", {
    headers: { "Authorization": `Bearer ${env.SENDGRID_API_KEY}` },
    body: JSON.stringify({ ... }),
  });
}
```

**Status:** ⚠️ Exception - Critical alerts allowed (migrate later)

---

## 🔄 Migration Plan

### Phase 1: Create Event-Based Notification System ✅

**Status:** Partially complete - `src/lib/events.ts` exists

**What exists:**
- `publishEvent()` function
- Event forwarding to n8n
- Event types defined

**What's missing:**
- Template ID mapping
- Standardized payload structure
- Migration of notification service

### Phase 2: Create n8n Email Workflow

**Steps:**

1. **Create n8n workflow:** `PT-Email-UniversalSender`
   - Receives events from backend
   - Validates secret
   - Maps event to SendGrid template
   - Sends email
   - Retries on failure
   - Alerts Slack on errors

2. **Template ID mapping:**
   ```typescript
   // Backend emits
   {
     eventName: "job.booked",
     templateId: env.EMAIL_TEMPLATE_JOB_BOOKED,  // "d-xxxx"
     to_email: "user@example.com",
     dynamic_data: { ... }
   }
   
   // n8n uses templateId to render SendGrid template
   ```

3. **Event payload structure:**
   ```typescript
   interface CommunicationEventPayload {
     templateId: string;           // SendGrid template ID
     to_email?: string;            // Email recipient
     to_phone?: string;            // SMS recipient
     dynamic_data: {               // Template variables
       [key: string]: any;
     };
     channel: "email" | "sms";     // Communication channel
     priority?: "high" | "normal"; // For retry logic
   }
   ```

### Phase 3: Migrate Notification Service

#### Step 3.1: Update `sendNotification()` to Emit Events

**Before:**
```typescript
export async function sendNotification(input: NotificationPayload) {
  switch (input.channel) {
    case "email":
      return await sendEmailNotification(input);  // ❌ Direct call
    case "sms":
      return await sendSmsNotification(input);    // ❌ Direct call
  }
}
```

**After:**
```typescript
export async function sendNotification(input: NotificationPayload) {
  // Map notification type to event name
  const eventName = getEventNameFromNotificationType(input.type);
  
  // Map notification type to template ID
  const templateId = getTemplateIdFromNotificationType(input.type);
  
  // Emit event (n8n handles delivery)
  await publishEvent({
    eventName,
    jobId: input.jobId || null,
    actorType: "system",
    actorId: null,
    payload: {
      templateId,
      to_email: input.email,
      to_phone: input.phone,
      channel: input.channel,
      dynamic_data: {
        ...input.data,
        userId: input.userId,
      },
    },
  });
  
  // Return success (n8n handles actual sending)
  return {
    success: true,
    channel: input.channel,
    messageId: undefined, // n8n will handle tracking
  };
}
```

#### Step 3.2: Add Helper Functions

```typescript
// src/services/notifications/eventMapper.ts

const NOTIFICATION_TO_EVENT_MAP: Record<string, string> = {
  "job_accepted": "job.accepted",
  "job_completed": "job.completed",
  "client_approved": "job.approved",
  "client_disputed": "job.disputed",
  // ... more mappings
};

const NOTIFICATION_TO_TEMPLATE_MAP: Record<string, string> = {
  "job_accepted": env.EMAIL_TEMPLATE_JOB_ACCEPTED || "",
  "job_completed": env.EMAIL_TEMPLATE_JOB_COMPLETED || "",
  "client_approved": env.EMAIL_TEMPLATE_JOB_APPROVED || "",
  "client_disputed": env.EMAIL_TEMPLATE_JOB_DISPUTED || "",
  // ... more mappings
};

export function getEventNameFromNotificationType(
  type: NotificationType
): string {
  return NOTIFICATION_TO_EVENT_MAP[type] || `notification.${type}`;
}

export function getTemplateIdFromNotificationType(
  type: NotificationType,
  channel: NotificationChannel
): string {
  const key = `${type}_${channel}`;
  return NOTIFICATION_TO_TEMPLATE_MAP[key] || "";
}
```

#### Step 3.3: Keep Providers for Test Mode

```typescript
// src/services/notifications/notificationService.ts

export async function sendNotification(input: NotificationPayload) {
  // In test/dev mode, allow direct calls for testing
  if (env.NODE_ENV === "test" || env.USE_DIRECT_NOTIFICATIONS === "true") {
    // Use direct providers (for testing only)
    return await sendNotificationDirect(input);
  }
  
  // Production: emit event
  return await sendNotificationViaEvent(input);
}

// Keep old implementation for test mode
async function sendNotificationDirect(input: NotificationPayload) {
  // ... existing implementation
}

// New event-based implementation
async function sendNotificationViaEvent(input: NotificationPayload) {
  // ... event emission
}
```

### Phase 4: Update Event System

#### Step 4.1: Extend `publishEvent()` for Communication Events

```typescript
// src/lib/events.ts

export interface CommunicationEventPayload {
  templateId: string;
  to_email?: string;
  to_phone?: string;
  channel: "email" | "sms";
  dynamic_data: Record<string, unknown>;
  priority?: "high" | "normal";
}

export async function publishCommunicationEvent(
  input: CommunicationEventPayload
): Promise<void> {
  // Emit communication-specific event
  await publishEvent({
    eventName: `communication.${input.channel}`,
    jobId: null,
    actorType: "system",
    actorId: null,
    payload: input,
  });
}
```

#### Step 4.2: Update n8n Webhook Handler

Ensure `src/routes/events.ts` (or wherever n8n webhook is) can handle communication events:

```typescript
// Current: Forwards all events to n8n
// n8n webhook receives event and routes to appropriate workflow
```

---

## 🧪 Testing Strategy

### Test Mode (Direct Calls)

```env
NODE_ENV=test
USE_DIRECT_NOTIFICATIONS=true
```

- Uses direct SendGrid/Twilio calls
- No n8n dependency
- Faster tests
- Can test notification logic

### Development Mode (Events)

```env
NODE_ENV=development
USE_DIRECT_NOTIFICATIONS=false
N8N_WEBHOOK_URL=http://localhost:5678/webhook/puretask
```

- Emits events
- n8n handles delivery
- Tests full integration
- Slower but more realistic

### Production Mode (Events Only)

```env
NODE_ENV=production
USE_DIRECT_NOTIFICATIONS=false
N8N_WEBHOOK_URL=https://n8n.puretask.com/webhook/puretask
```

- Only events (no direct calls)
- n8n handles all delivery
- Full retry logic
- Slack alerts

---

## 📝 Migration Checklist

### Backend Changes

- [ ] Create `eventMapper.ts` for notification → event mapping
- [ ] Update `sendNotification()` to emit events (with test mode fallback)
- [ ] Add template ID env vars
- [ ] Update `publishEvent()` to handle communication events
- [ ] Keep providers for test mode only
- [ ] Add feature flag: `USE_DIRECT_NOTIFICATIONS`
- [ ] Update tests to work with both modes
- [ ] Document event payload structure

### n8n Changes

- [ ] Create `PT-Email-UniversalSender` workflow
- [ ] Create `PT-SMS-UniversalSender` workflow
- [ ] Add retry logic
- [ ] Add Slack alerting
- [ ] Test with sample events
- [ ] Document template ID mapping

### Configuration

- [ ] Add template ID env vars to `.env.example`
- [ ] Update deployment configs (Railway, etc.)
- [ ] Update n8n webhook URL config
- [ ] Document migration timeline

### Documentation

- [ ] Update `architecture-what-lives-where.md` (mark as migrated)
- [ ] Create event payload spec
- [ ] Document test mode vs production mode
- [ ] Update API docs

---

## 🚀 Rollout Plan

### Week 1: Prepare

1. Create n8n workflows
2. Set up template IDs
3. Test event emission

### Week 2: Soft Launch

1. Deploy backend changes with feature flag
2. Test in development environment
3. Verify events reach n8n
4. Verify emails sent correctly

### Week 3: Production Migration

1. Enable feature flag in production
2. Monitor for issues
3. Keep direct providers as fallback (removed later)

### Week 4: Cleanup

1. Remove direct providers from production code
2. Update CI checks to block direct calls
3. Remove feature flag
4. Update documentation

---

## ⚠️ Rollback Plan

If issues occur:

1. Set `USE_DIRECT_NOTIFICATIONS=true` in production
2. Revert to direct SendGrid/Twilio calls
3. Fix issues in n8n workflows
4. Retry migration

---

## 📊 Success Metrics

Migration is successful when:

- ✅ 100% of emails go through n8n (no direct SendGrid calls)
- ✅ 100% of SMS go through n8n (no direct Twilio calls)
- ✅ All tests pass with event-based system
- ✅ No increase in notification failures
- ✅ Retry logic working in n8n
- ✅ Slack alerts working

---

**This migration maintains backward compatibility while moving to the new architecture.**

---

*Last Updated: January 2025*  
*Migration Status: 🟡 Planning Phase*
