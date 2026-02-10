# Backend Notification Sender Analysis

## ✅ What You HAVE (Centralized Notification System)

You **DO have** a centralized backend notification sender! Here's what exists:

### 📁 Location
**Primary Service:** `src/services/notifications/notificationService.ts`

### 🎯 Core Function: `sendNotification()`

Your main notification sender function is:

```typescript
sendNotification(input: NotificationPayload): Promise<NotificationResult>
```

**Location:** `src/services/notifications/notificationService.ts:33`

### ✅ The Four Jobs (All Implemented)

#### 1. ✅ Accept Events
- **Function:** `sendNotification(input: NotificationPayload)`
- **Accepts:** `NotificationType` (e.g., `"job.accepted"`, `"payment.failed"`)
- **Location:** `src/services/notifications/notificationService.ts:33`

#### 2. ✅ Build Template Data
- **Functions:** 
  - `getUserContactInfo(userId)` - Fetches user email/phone/pushToken
  - `sendNotificationToUser(userId, type, data, channels)` - Helper that builds payload
- **Location:** 
  - `src/services/notifications/notificationService.ts:279` (getUserContactInfo)
  - `src/services/notifications/notificationService.ts:301` (sendNotificationToUser)
- **Data Building:** Happens in `jobNotifications.ts` (e.g., `notifyJobCreated`, `notifyJobAccepted`)

#### 3. ✅ Render Messages (Using templates.ts)
- **Functions:**
  - `getEmailSubject(type)` - Email subject lines
  - `getEmailBody(type, data)` - Email body text
  - `getSmsBody(type, data)` - SMS message text
  - `getPushTitle(type)` - Push notification title
  - `getPushBody(type, data)` - Push notification body
- **Location:** `src/services/notifications/templates.ts`
- **All notification types have templates defined**

#### 4. ✅ Send via Providers + Log Delivery
- **Providers:**
  - **Email:** SendGrid (`sendEmailNotification()`)
  - **SMS:** Twilio (`sendSmsNotification()`)
  - **Push:** OneSignal (`sendPushNotification()`)
- **Location:** `src/services/notifications/notificationService.ts:140-267`
- **Logging:**
  - ✅ Success: Logged via `logger.info("notification_sent", ...)`
  - ✅ Failures: Recorded to `notification_failures` table
  - ✅ Retry: Worker `retryFailedNotifications` processes failures

### 📊 Delivery Logging

You have **multiple logging mechanisms**:

1. **`notification_failures` table** - Tracks failed notifications for retry
   - Location: `DB/migrations/001_init.sql:240`
   - Used by: `recordNotificationFailure()` in `notificationService.ts:99`

2. **`notification_log` table** - General notification history
   - Location: `DB/migrations/002_supplementary.sql:34`
   - Status: Created but **not actively written to** in current code

3. **`notification_logs` table** - Alternative logging table
   - Location: `DB/migrations/014_payout_improvements.sql:144`
   - Status: Created but **not actively written to** in current code

4. **Structured Logging** - Via `logger.info()` / `logger.error()`
   - All notifications are logged with structured data

### 🔄 Duplicate Prevention

**Status:** ⚠️ **PARTIALLY IMPLEMENTED**

**What exists:**
- ✅ Failure tracking in `notification_failures` table
- ✅ Retry worker that processes failures (`retryFailedNotifications`)
- ✅ Event-based notifications via n8n (can prevent duplicates at workflow level)

**What's missing:**
- ❌ **No explicit duplicate prevention** (e.g., idempotency keys, deduplication checks)
- ❌ **No check** before sending if notification was already sent recently
- ❌ **No deduplication** based on `(userId, type, jobId, timestamp)` tuple

**Recommendation:** Add idempotency check before sending:
```typescript
// Before sending, check if this exact notification was sent recently
const recentNotification = await query(`
  SELECT id FROM notification_log 
  WHERE user_id = $1 
    AND type = $2 
    AND channel = $3
    AND created_at > NOW() - INTERVAL '5 minutes'
  LIMIT 1
`, [userId, type, channel]);
```

### 🏗️ Architecture

#### Centralized Integration Clients
- ✅ `src/integrations/sendgrid.ts` - SendGrid client
- ✅ `src/integrations/twilio.ts` - Twilio client
- ✅ OneSignal: Direct API calls (no separate client file)

#### Service Structure
```
src/services/notifications/
├── index.ts                    # Public exports
├── notificationService.ts      # Main sender (✅ YOU HAVE THIS)
├── eventBasedNotificationService.ts  # n8n event-based alternative
├── templates.ts                # Message templates (✅ YOU HAVE THIS)
├── types.ts                    # TypeScript types
├── jobNotifications.ts         # Job-specific notification helpers
├── preferencesService.ts       # User notification preferences
└── providers/
    ├── emailProvider.ts        # Email provider wrapper
    ├── smsProvider.ts          # SMS provider wrapper
    ├── sendgrid.ts             # SendGrid implementation
    ├── twilio.ts               # Twilio implementation
    └── onesignal.ts            # OneSignal implementation
```

### 📝 Usage Pattern

**Current usage throughout codebase:**

```typescript
// Direct usage
import { sendNotification } from "./services/notifications";
await sendNotification({
  userId: "user123",
  email: "user@example.com",
  type: "job.accepted",
  channel: "email",
  data: { jobId: "job456", cleanerName: "John" }
});

// Convenience helper
import { sendNotificationToUser } from "./services/notifications";
await sendNotificationToUser(
  userId,
  "job.accepted",
  { jobId: "job456", cleanerName: "John" },
  ["email", "push"]  // Multiple channels
);

// Job-specific helpers
import { notifyJobCreated, notifyJobAccepted } from "./services/notifications/jobNotifications";
await notifyJobCreated(job);
```

### 🔍 Files That Use Notifications

Found **7 files** that call notification functions:
1. `src/workers/v1-core/noShowDetection.ts` - No-show warnings
2. `src/workers/v1-core/jobReminders.ts` - Job reminders
3. `src/workers/v1-core/retryFailedNotifications.ts` - Retry failed notifications
4. `src/lib/events.ts` - Event-based notifications (legacy)
5. `src/services/notifications/notificationService.ts` - Main service
6. `src/services/weeklySummaryService.ts` - Weekly summaries
7. `src/services/notifications/jobNotifications.ts` - Job lifecycle notifications

---

## ⚠️ What's MISSING or Could Be Improved

### 1. ❌ Explicit Duplicate Prevention
**Current:** No check if notification was already sent
**Recommendation:** Add idempotency check before sending

### 2. ⚠️ Delivery Logging Not Fully Utilized
**Current:** `notification_log` and `notification_logs` tables exist but aren't written to
**Recommendation:** Write successful sends to `notification_log` table

### 3. ⚠️ Event-Based vs Direct Calls
**Current:** Dual mode (event-based via n8n OR direct provider calls)
**Status:** This is actually good architecture, but could be better documented

### 4. ⚠️ Template Data Building Scattered
**Current:** Template data is built in multiple places:
- `jobNotifications.ts` - Job-specific data
- `notificationService.ts` - User contact info
- Individual service files - Custom data

**Recommendation:** Consider centralizing template data builders

---

## ✅ Summary: Do You Have a Backend Notification Sender?

### **YES! ✅**

You have a **fully functional, centralized backend notification sender** that:

1. ✅ Accepts events (via `sendNotification()`)
2. ✅ Builds template data (via `sendNotificationToUser()` and helpers)
3. ✅ Renders messages (via `templates.ts`)
4. ✅ Sends via providers (SendGrid/Twilio/OneSignal)
5. ✅ Logs delivery (structured logging + failure tracking)

### What Makes It a "Notification Sender"

Your `sendNotification()` function in `src/services/notifications/notificationService.ts` is **exactly** what a backend notification sender should be:

```typescript
// This IS your notification sender
export async function sendNotification(input: NotificationPayload): Promise<NotificationResult> {
  // 1. Accepts event (input.type, input.channel, input.data)
  // 2. Builds template data (via getUserContactInfo, templates)
  // 3. Renders message (via getEmailBody, getSmsBody, etc.)
  // 4. Sends via providers (SendGrid/Twilio/OneSignal)
  // 5. Logs delivery (logger + notification_failures table)
}
```

### Improvements Needed

1. **Add duplicate prevention** (idempotency checks)
2. **Write to notification_log table** for successful sends
3. **Document the dual-mode architecture** (event-based vs direct)

---

## 📋 Quick Reference

### Main Entry Point
```typescript
import { sendNotification, sendNotificationToUser } from "./services/notifications";
```

### File Locations
- **Main Service:** `src/services/notifications/notificationService.ts`
- **Templates:** `src/services/notifications/templates.ts`
- **Types:** `src/services/notifications/types.ts`
- **Job Helpers:** `src/services/notifications/jobNotifications.ts`

### Database Tables
- `notification_failures` - Failed notifications (actively used)
- `notification_log` - General log (exists but not written to)
- `notification_logs` - Alternative log (exists but not written to)

### Providers
- **Email:** SendGrid (`@sendgrid/mail`)
- **SMS:** Twilio (`twilio`)
- **Push:** OneSignal (direct API calls)

---

**Last Updated:** 2025-01-15  
**Status:** ✅ Centralized notification sender exists and is functional
