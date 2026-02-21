# Notification Deduplication Strategy

**In plain English:** "Deduplication" = don't send the same notification twice (e.g. same "job created" email to the same user for the same job). We do that by storing a key (e.g. jobId + type) and checking "already sent?" before sending. This doc explains the rules: which notifications are "ever sent once" vs "can resend after a cooldown." Use it when you add a new notification type or change when we allow resends.

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

## 🎯 Type-Aware Deduplication

**What it is:** The overall approach: some notification types use "ever sent" (strict), others use time-windowed (allow re-send after cooldown).  
**What it does:** Prevents duplicate notifications from cron/webhook retries while allowing legitimate re-sends (e.g. password reset).  
**How we use it:** Use getDedupeWindow(type) and alreadySent(dedupeKey); add new types to everSentTypes or timeWindowedTypes as needed.

We use **type-aware deduplication** to balance preventing duplicates with allowing legitimate re-sends.

### Strategy Overview

1. **"Ever Sent"** - For notifications that should never be sent twice with the same dedupe key
2. **Time-Windowed** - For notifications that should allow re-send after a cooldown period

---

## 📋 Deduplication Rules by Type

### ✅ "Ever Sent" (Strict Deduplication)

These notifications use "ever sent" because:
- They include unique identifiers in dedupe key (jobId, timestamp bucket)
- They represent one-time events that shouldn't repeat
- Resending would be confusing or spammy

| Type | Reason | Dedupe Key Includes |
|------|--------|---------------------|
| `welcome` | One-time welcome email | userId |
| `job.created` | Unique job creation event | jobId |
| `job.accepted` | Unique acceptance event | jobId |
| `job.on_my_way` | Unique status update | jobId |
| `job.started` | Unique status update | jobId |
| `job.completed` | Unique completion event | jobId |
| `job.awaiting_approval` | Unique status update | jobId |
| `job.approved` | Unique approval event | jobId |
| `job.disputed` | Unique dispute event | jobId |
| `job.cancelled` | Unique cancellation event | jobId |
| `job.reminder_24h` | Has timestamp bucket | jobId + hour bucket |
| `job.reminder_2h` | Has timestamp bucket | jobId + hour bucket |
| `job.no_show_warning` | Has timestamp bucket | jobId + hour bucket |
| `credits.purchased` | Unique purchase event | userId + transaction |
| `payout.processed` | Unique payout event | userId + payout ID |

**Example:** If a job is rescheduled, the reminder gets a new timestamp bucket, so it's a new dedupe key → new notification ✅

---

### ⏰ Time-Windowed (Allow Re-Send After Cooldown)

**What it is:** Notification types that allow re-send after a cooldown (e.g. 1 hour for password reset, 24h for credits low).  
**What it does:** Lets users receive the same notification again when legitimate (e.g. request password reset again).  
**How we use it:** Implement time-window check in alreadySent/send path; use the window minutes from timeWindowedTypes.

These notifications use time windows because:
- Users may legitimately need to receive them multiple times
- The same event can happen again (e.g., payment fails again)
- Cooldown prevents spam while allowing legitimate re-sends

| Type | Window | Reason |
|------|--------|--------|
| `password.reset` | 1 hour | User can request reset again if needed |
| `payment.failed` | 1 hour | Payment can fail multiple times, user needs to know |
| `payout.failed` | 24 hours | Payout issues need attention, but not spam |
| `credits.low` | 24 hours | Warn again if balance still low after a day |
| `subscription.renewal_reminder` | 24 hours | Daily reminder is acceptable |

**Example:** User requests password reset at 2 PM, gets email. Requests again at 2:30 PM → blocked (within 1 hour). Requests at 3:30 PM → allowed (outside window) ✅

---

## 🔑 Dedupe Key Format

```
${type}:${channel}:${userId}:${jobId || ""}:${timestampBucket || ""}
```

### Examples

**Job reminder (has timestamp bucket):**
```
job.reminder_24h:email:user123:job456:2025-01-15T14
```
- Rescheduled to 3 PM → `job.reminder_24h:email:user123:job456:2025-01-15T15` (new key) ✅

**Password reset (no jobId, no timestamp):**
```
password.reset:email:user123::
```
- Within 1 hour → blocked (duplicate)
- After 1 hour → allowed (new attempt)

**Job created (has jobId):**
```
job.created:email:user123:job456:
```
- Different job → new jobId → new key ✅
- Same job → same key → blocked (ever sent) ✅

---

## 🛡️ Why This Approach?

**What it is:** Rationale for mixing "ever sent" and time-windowed instead of one strategy for all types.  
**What it does:** Explains why "ever sent" alone blocks legitimate re-sends and why time window alone can allow duplicate reminders.  
**How we use it:** Use when deciding how to classify a new notification type or when debugging dedupe behavior.

### Problem with "Ever Sent" for All Types

**Scenario:** User requests password reset, email sent. User doesn't receive it (spam folder), requests again 2 hours later.

**With "ever sent":** ❌ Blocked - user can't reset password  
**With time window:** ✅ Allowed after 1 hour - user can try again

### Problem with Time Window for All Types

**Scenario:** Job reminder sent at 2 PM. Cron job runs again at 2:01 PM (retry/overlap).

**With time window:** ❌ Might allow duplicate if window is too short  
**With "ever sent":** ✅ Blocked - same dedupe key (includes timestamp bucket)

---

## 📊 Decision Matrix

| Notification Type | Dedupe Strategy | Window | Why |
|------------------|----------------|--------|-----|
| Job lifecycle events | Ever sent | N/A | Unique events, dedupe key includes jobId |
| Reminders | Ever sent | N/A | Dedupe key includes timestamp bucket |
| Welcome | Ever sent | N/A | One-time event |
| Password reset | Time window | 1 hour | User may need to request again |
| Payment failed | Time window | 1 hour | Payment can fail multiple times |
| Credits low | Time window | 24 hours | Warn again if still low |
| Payout failed | Time window | 24 hours | Issue needs attention, not spam |

---

## 🔧 Implementation

**What it is:** The code pattern for getDedupeWindow(type) and how it maps types to "ever" or "time" with optional minutes.  
**What it does:** Centralizes dedupe logic so send path and alreadySent use the same rules.  
**How we use it:** Implement or extend in notification service; keep everSentTypes and timeWindowedTypes in sync with the rules above.

```typescript
function getDedupeWindow(type: NotificationType): { window: "ever" | "time"; minutes?: number } {
  // Strict "ever sent" for job lifecycle, welcome, etc.
  if (everSentTypes.includes(type)) {
    return { window: "ever" };
  }

  // Time-windowed for password reset, payment failed, etc.
  const windowMinutes = timeWindowedTypes[type];
  if (windowMinutes) {
    return { window: "time", minutes: windowMinutes };
  }

  // Default: "ever sent" for safety
  return { window: "ever" };
}
```

---

## ✅ Benefits

1. **Prevents duplicates** from cron replays, webhook replays, retries
2. **Allows legitimate re-sends** for password reset, payment failures
3. **Type-aware** - each notification type has appropriate rules
4. **Safe defaults** - unknown types default to "ever sent"

---

## 🚨 Edge Cases Handled

**What it is:** Scenarios that could cause wrong behavior (rescheduled job, payment fails twice, cron overlap) and how we handle them.  
**What it does:** Documents that job reschedule gets new key, payment failed can resend after window, cron overlap is blocked.  
**How we use it:** Use when testing or debugging dedupe; ensure these cases still pass after changes.

1. **Job rescheduled** → New timestamp bucket → New dedupe key → New reminder ✅
2. **Payment fails twice** → Same dedupe key, but 1-hour window allows second notification ✅
3. **Password reset spam** → Blocked within 1 hour, but allows legitimate re-request ✅
4. **Cron overlap** → Same dedupe key → Blocked (ever sent or within window) ✅

---

**Last Updated:** 2025-01-15  
**Status:** ✅ Type-aware deduplication implemented
