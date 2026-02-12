# Notification System Maturity Upgrades

**In plain English:** We upgraded how we send notifications (email, SMS, push): one place to send from, templates in a registry, dedupe keys so we don't send duplicates, and logging so we know what was sent. This doc lists what was done (template registry, URL builders, idempotency, delivery logging) and what's next. Use it when you work on the notification system or add a new notification type.

---

## New here? Key terms (plain English)

**What it is:** A glossary of backend/DevOps terms used in this doc.  
**What it does:** Lets new readers understand Idempotency, Migration, etc.  
**How we use it:** Refer to this table when you see an unfamiliar term below.

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## ✅ Completed Upgrades

**What it is:** A list of notification-system improvements already implemented (template registry, URL builders, dedupe, delivery logging, etc.).  
**What it does:** Documents what was done so we don't redo it and so new contributors know the current state.  
**How we use it:** Refer when adding new notification types or changing templates; use the patterns (e.g. renderNotification, logDeliveryAttempt) already in place.

### 1. Scalable Template Registry (`templates.ts`)
- ✅ Rewritten into registry-style structure
- ✅ Centralized per-notification metadata (channels, required vars, primary action URLs)
- ✅ Data-driven templates for easy addition of new notifications
- ✅ Pure rendering functions (testable)
- ✅ Backwards-compatible helpers maintained (`getEmailSubject`, `getEmailBody`, etc.)

### 2. URL Builder Utilities (`src/lib/urlBuilder.ts`)
- ✅ Role-correct URL builders:
  - `buildClientJobUrl(jobId)` - Client-facing job URLs
  - `buildCleanerJobUrl(jobId)` - Cleaner-facing job URLs
  - `buildCheckInUrl(jobId)` - Check-in URLs for cleaners
  - `buildPaymentUrl()` - Payment method update URLs
  - `buildSubscriptionUrl()` - Subscription management URLs
  - `buildSupportUrl()` - Support/help URLs
  - `buildPasswordResetUrl(token)` - Password reset URLs
  - `buildRoleCorrectJobUrl(jobId, role)` - Role-aware job URL builder

### 3. Idempotency & Deduplication
- ✅ Added `dedupeKey` to `NotificationPayload` type
- ✅ `alreadySent(dedupeKey)` function checks `notification_log` table
- ✅ Automatic dedupe key generation in `sendNotificationToUser()`
- ✅ Format: `${type}:${channel}:${userId}:${jobId || ""}:${timestampBucket || ""}`
- ✅ Prevents duplicates from:
  - Retries
  - Cron overlap
  - Webhook replays
  - Deploys

### 4. Delivery Logging
- ✅ `logDeliveryAttempt()` function writes to `notification_log` table
- ✅ Logs all attempts: `sent`, `failed`, `skipped`
- ✅ Includes:
  - User ID
  - Channel
  - Type
  - Status
  - Error message (if failed)
  - Provider message ID (if sent)
  - Dedupe key
  - Recipient (email/phone)
  - Timestamp

### 5. Updated Notification Service
- ✅ Uses new `renderNotification()` function
- ✅ Falls back to old template functions for backwards compatibility
- ✅ Push notifications include deep link URLs
- ✅ All notifications log to `notification_log` table

### 6. Updated Job Notifications
- ✅ All job lifecycle notifications include URLs:
  - `notifyJobCreated()` - Includes `jobUrl`
  - `notifyJobAccepted()` - Includes `jobUrl`
  - `notifyCleanerOnTheWay()` - Includes `jobUrl`
  - `notifyJobStarted()` - Includes `jobUrl`
  - `notifyJobCompleted()` - Includes `jobUrl`
  - `notifyJobDisputed()` - Includes role-correct `jobUrl`

### 7. Updated Workers
- ✅ `jobReminders.ts`:
  - 24h reminder includes `jobUrl` for clients
  - 2h reminder includes `checkInUrl` for cleaners
  - Includes `timeZoneLabel` for time display
- ✅ `noShowDetection.ts`:
  - Includes `checkInUrl` and `supportUrl`
  - Includes `timeZoneLabel`

---

## 📋 Remaining Tasks (Future Enhancements)

### Short Link Service
- [ ] Implement short link service (`src/services/shortlinks/shortLinkService.ts`)
- [ ] Generate `shortUrl` for SMS messages
- [ ] Options:
  - Provider shortening (Twilio, Bitly, etc.)
  - Custom `go.puretask.co/j/{token}` redirect service

### Time Zone Handling
- [ ] Get actual timezone from job location or user preferences
- [ ] Replace hardcoded `"local time"` with actual timezone labels
- [ ] Format times in job location timezone (not device timezone)

### HTML Email Templates
- [ ] Add HTML rendering to email templates
- [ ] Use `rendered.email.html` in SendGrid payload
- [ ] Maintain plain text fallback

### Template Data Validation
- [ ] Runtime validation of required template data
- [ ] Better error messages for missing required fields
- [ ] Type-safe template data builders

### Notification Preferences Integration
- [ ] Respect user notification preferences in `sendNotificationToUser()`
- [ ] Skip channels user has disabled
- [ ] Log skipped notifications with reason

### URL Scheme Documentation
- [ ] Create `docs/URL_SCHEME_SPEC.md`
- [ ] Document all URL patterns
- [ ] Document `returnTo` parameter usage
- [ ] Document role-based routing

---

## 🔧 Usage Examples

**What it is:** Code snippets showing how to send notifications with URLs, dedupe keys, and the new template system.  
**What it does:** Gives copy-paste examples for common patterns.  
**How we use it:** Use when adding or changing notification calls in services or workers.

### Basic Notification with URL
```typescript
import { sendNotificationToUser } from "./services/notifications";
import { buildClientJobUrl } from "./lib/urlBuilder";

await sendNotificationToUser(userId, "job.completed", {
  jobId: "job123",
  clientName: "John",
  cleanerName: "Jane",
  jobUrl: buildClientJobUrl("job123"),
}, ["email", "push"]);
```

### Notification with Dedupe Key
```typescript
import { sendNotification } from "./services/notifications";

await sendNotification({
  userId: "user123",
  email: "user@example.com",
  type: "job.reminder_2h",
  channel: "sms",
  data: {
    jobId: "job123",
    scheduledTime: "2:00 PM",
    checkInUrl: buildCheckInUrl("job123"),
  },
  dedupeKey: "job.reminder_2h:sms:user123:job123:2025-01-15T14",
});
```

### Using New Template System Directly
```typescript
import { renderNotification } from "./services/notifications";

const rendered = renderNotification("job.completed", {
  jobId: "job123",
  clientName: "John",
  cleanerName: "Jane",
  jobUrl: buildClientJobUrl("job123"),
}, ["email", "sms", "push"]);

// rendered.email.subject
// rendered.email.text
// rendered.email.primaryActionUrl
// rendered.sms.text
// rendered.push.title
// rendered.push.body
// rendered.push.url
```

---

## 📊 Database Schema

### `notification_log` Table (Canonical Delivery Log)
```sql
CREATE TABLE notification_log (
  id              UUID PRIMARY KEY,
  user_id         TEXT REFERENCES users(id),
  channel         TEXT NOT NULL,  -- email/sms/push
  type            TEXT NOT NULL,  -- job.accepted, etc.
  payload         JSONB NOT NULL, -- includes dedupeKey, recipient, providerMessageId
  status          TEXT NOT NULL,  -- sent/failed/skipped
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ
);
```

### `notification_failures` Table (Retry Queue)
- Still used for retry worker
- Can be migrated to log-driven retry in future

---

## 🎯 Key Improvements

**What it is:** A short summary of the main benefits of the maturity upgrades.  
**What it does:** Highlights centralization, dedupe, logging, URLs, and maintainability.  
**How we use it:** Use when explaining the notification system to others or when justifying further work.

1. **No More Duplicates**: Idempotency prevents duplicate notifications
2. **Deep Links Work**: All notifications include role-correct URLs
3. **Better Logging**: Every attempt is logged for debugging and analytics
4. **Scalable Templates**: Adding new notification types is now trivial
5. **Type Safety**: Template data is type-checked
6. **Backwards Compatible**: Old code still works during migration

---

**Last Updated:** 2025-01-15  
**Status:** ✅ Core upgrades complete, short links and timezone handling pending
