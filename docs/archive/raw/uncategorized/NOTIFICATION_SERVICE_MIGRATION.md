# Notification Service Migration Guide

**Purpose:** Migrate from direct SendGrid/Twilio calls to event-based architecture  
**Status:** 🚧 In Progress  
**Target:** All email/SMS via n8n, backend only emits events

---

## 📋 Migration Overview

### Current Architecture (Before)

```
Backend → sendNotification() → SendGrid/Twilio SDK → Direct API calls
```

### Target Architecture (After)

```
Backend → publishEvent() → n8n Webhook → n8n Workflow → SendGrid/Twilio
```

---

## 🔄 Migration Strategy

### Phase 1: Parallel System (Current)

**Status:** ✅ Implemented

- New function: `sendNotificationViaEvent()` (event-based)
- Existing function: `sendNotification()` (direct calls) - kept for backward compatibility
- Feature flag: `USE_EVENT_BASED_NOTIFICATIONS` (optional)

**Usage:**
```typescript
import { sendNotificationViaEvent } from "./eventBasedNotificationService";

// New code uses event-based
await sendNotificationViaEvent({
  type: "job.booked",
  channel: "email",
  email: "client@example.com",
  data: { jobId: "123", ... },
});
```

### Phase 2: Gradual Migration

1. Identify all call sites
2. Migrate one service at a time
3. Test each migration
4. Monitor for errors

### Phase 3: Complete Cutover

1. Remove direct SendGrid/Twilio calls
2. Remove `sendNotification()` (keep only event-based version)
3. Update all imports
4. Remove unused dependencies (optional)

---

## 🔍 Finding Call Sites

### Current Call Sites

```bash
# Find all sendNotification calls
grep -r "sendNotification" src/

# Find all sendNotificationToUser calls  
grep -r "sendNotificationToUser" src/
```

**Known call sites:**
- `src/services/notifications/jobNotifications.ts` - Job lifecycle notifications
- `src/lib/events.ts` - Event-driven notifications
- `src/services/weeklySummaryService.ts` - Weekly summaries
- `src/workers/retryFailedNotifications.ts` - Retry worker

---

## 📝 Step-by-Step Migration

### Step 1: Update Notification Service

**File:** `src/services/notifications/notificationService.ts`

**Before:**
```typescript
export async function sendNotification(input: NotificationPayload): Promise<NotificationResult> {
  switch (input.channel) {
    case "email":
      result = await sendEmailNotification(input);  // ❌ Direct SendGrid call
      break;
    case "sms":
      result = await sendSmsNotification(input);    // ❌ Direct Twilio call
      break;
  }
}
```

**After:**
```typescript
import { sendNotificationViaEvent } from "./eventBasedNotificationService";
import { env } from "../../config/env";

export async function sendNotification(input: NotificationPayload): Promise<NotificationResult> {
  // Feature flag: use event-based if n8n is configured
  if (env.N8N_WEBHOOK_URL && env.USE_EVENT_BASED_NOTIFICATIONS !== "false") {
    return await sendNotificationViaEvent(input);
  }
  
  // Fallback to direct calls (for backward compatibility during migration)
  // TODO: Remove after migration complete
  switch (input.channel) {
    case "email":
      result = await sendEmailNotification(input);
      break;
    case "sms":
      result = await sendSmsNotification(input);
      break;
  }
}
```

### Step 2: Update Job Notifications

**File:** `src/services/notifications/jobNotifications.ts`

**Before:**
```typescript
import { sendNotificationToUser } from "./notificationService";

export async function notifyJobCreated(job: Job, clientId: string) {
  await sendNotificationToUser(clientId, "job.created", {
    jobId: job.id,
    address: job.address,
    // ...
  });
}
```

**After:**
```typescript
import { sendNotificationViaEvent } from "./eventBasedNotificationService";
import { getUserContactInfo } from "./notificationService";

export async function notifyJobCreated(job: Job, clientId: string) {
  const contact = await getUserContactInfo(clientId);
  if (!contact) return;
  
  await sendNotificationViaEvent({
    userId: clientId,
    type: "job.created",
    channel: "email",
    email: contact.email,
    data: {
      jobId: job.id,
      address: job.address,
      // ...
    },
  });
}
```

### Step 3: Update Events Service

**File:** `src/lib/events.ts`

**Before:**
```typescript
async function maybeSendNotifications(...) {
  const { sendNotification } = await import("../services/notifications");
  await sendNotification({ ... });
}
```

**After:**
```typescript
async function maybeSendNotifications(...) {
  // Events already published - n8n will handle notifications
  // No need to call sendNotification here
  // Remove this function or make it a no-op
}
```

---

## ✅ Migration Checklist

### Pre-Migration

- [x] Create `eventBasedNotificationService.ts`
- [x] Create email registry (`docs/email-registry.md`)
- [x] Create n8n workflow spec (`docs/n8n-universal-sender-workflow-spec.md`)
- [x] Add validation functions (`src/lib/communicationValidation.ts`)
- [ ] Implement n8n workflows (in n8n dashboard)
- [ ] Test n8n webhook connectivity
- [ ] Verify template IDs are configured

### Migration Phase

- [ ] Add feature flag `USE_EVENT_BASED_NOTIFICATIONS`
- [ ] Update `notificationService.ts` to use event-based by default
- [ ] Migrate `jobNotifications.ts`
- [ ] Migrate `events.ts` (remove `maybeSendNotifications` calls)
- [ ] Migrate `weeklySummaryService.ts`
- [ ] Update `retryFailedNotifications.ts` worker
- [ ] Test each migration step

### Post-Migration

- [ ] Remove direct SendGrid/Twilio calls
- [ ] Remove `sendEmailNotification()` function
- [ ] Remove `sendSmsNotification()` function
- [ ] Update all imports
- [ ] Remove unused dependencies (optional)
- [ ] Update CI checks to prevent direct calls

---

## 🧪 Testing

### Test Event Emission

```typescript
import { sendNotificationViaEvent } from "./eventBasedNotificationService";

// Test email notification
await sendNotificationViaEvent({
  type: "job.booked",
  channel: "email",
  email: "test@example.com",
  data: {
    jobId: "test-123",
    clientName: "Test User",
    jobAddress: "123 Test St",
    scheduledStartTime: "Jan 16, 10:00 AM",
    creditAmount: 100,
  },
});

// Verify event was published (check logs)
// Verify n8n received webhook
// Verify email was sent via SendGrid
```

### Test n8n Webhook

```bash
# Test webhook endpoint (if accessible)
curl -X POST https://n8n.puretask.com/webhook/puretask-communications \
  -H "Content-Type: application/json" \
  -H "x-n8n-signature: <hmac>" \
  -d '{
    "eventName": "job.booked",
    "jobId": "test-123",
    "communication": {
      "templateId": "d-xxxx",
      "to_email": "test@example.com",
      "channel": "email",
      "dynamic_data": {
        "clientName": "Test User"
      }
    }
  }'
```

---

## 🚨 Rollback Plan

If issues occur during migration:

1. **Feature Flag Rollback:**
   ```typescript
   // Set in .env
   USE_EVENT_BASED_NOTIFICATIONS=false
   ```

2. **Revert Code Changes:**
   ```bash
   git revert <commit-hash>
   ```

3. **Restore Direct Calls:**
   - Re-enable `sendEmailNotification()` and `sendSmsNotification()`
   - Update `sendNotification()` to use direct calls

---

## 📚 Related Documents

- `docs/email-registry.md` - Email template registry
- `docs/n8n-universal-sender-workflow-spec.md` - n8n workflow specification
- `docs/architecture-what-lives-where.md` - Architecture boundaries
- `docs/ARCHITECTURE_MIGRATION_GUIDE.md` - General migration guide

---

## 🎯 Success Criteria

Migration is complete when:

- ✅ All email/SMS notifications go through events
- ✅ No direct SendGrid/Twilio calls in production code
- ✅ n8n workflows handle all communications
- ✅ Retry logic works via n8n
- ✅ All tests pass
- ✅ Monitoring shows successful event delivery

---

*Migration Guide - Last Updated: January 2025*

