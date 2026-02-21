# Notifications (Backend)

**What it is:** Single reference for the PureTask backend notification system: where we send from, how deduplication works, what’s implemented, and how to add or change templates.  
**What it does:** Describes the central service, dedupe rules, template registry, delivery logging, and template outline so you can add or change notification types without guessing.  
**How we use it:** Use when adding a new notification type, changing templates, or debugging duplicates/delivery.

---

## 1. Where we send from (sender flow)

**Primary service:** `src/services/notifications/notificationService.ts`

- **Main API:** `sendNotification(input: NotificationPayload)` — accepts type (e.g. `job.accepted`, `payment.failed`), builds message, sends via provider, logs.
- **Helper:** `sendNotificationToUser(userId, type, data, channels)` — builds payload and calls `sendNotification`.
- **Templates:** `src/services/notifications/templates.ts` — `getEmailSubject`, `getEmailBody`, `getSmsBody`, `getPushTitle`, `getPushBody`; all types have templates.
- **Providers:** Email (SendGrid), SMS (Twilio), Push (OneSignal). Failures go to `notification_failures`; worker `retryFailedNotifications` retries.
- **Logging:** `notification_log` table (all attempts: sent, failed, skipped); `notification_failures` for retry.

**Implementing a new type:** Add template in `templates.ts`, call `sendNotificationToUser` or `sendNotification` from services/workers; set `dedupeKey` or rely on automatic generation.

---

## 2. Deduplication (don’t send the same thing twice)

We use **type-aware deduplication**: some types are “ever sent once” (strict), others allow re-send after a cooldown.

### 2.1 Dedupe key format

```
${type}:${channel}:${userId}:${jobId || ""}:${timestampBucket || ""}
```

### 2.2 Rules by type

**Ever sent (strict):** Same dedupe key → never send again. Used for one-time or unique events.

| Type | Dedupe key includes |
|------|---------------------|
| `welcome` | userId |
| `job.created`, `job.accepted`, `job.on_my_way`, `job.started`, `job.completed`, `job.awaiting_approval`, `job.approved`, `job.disputed`, `job.cancelled` | jobId |
| `job.reminder_24h`, `job.reminder_2h`, `job.no_show_warning` | jobId + hour bucket |
| `credits.purchased`, `payout.processed` | userId + transaction/payout ID |

**Time-windowed (allow re-send after cooldown):**

| Type | Window | Reason |
|------|--------|--------|
| `password.reset` | 1 hour | User can request again |
| `payment.failed` | 1 hour | Payment can fail again |
| `payout.failed` | 24 hours | Issue needs attention, not spam |
| `credits.low` | 24 hours | Warn again if still low |
| `subscription.renewal_reminder` | 24 hours | Daily reminder OK |

**Implementation:** `getDedupeWindow(type)` returns `{ window: "ever" }` or `{ window: "time", minutes }`. Default for unknown types: “ever”. Check `alreadySent(dedupeKey)` before sending.

### 2.3 Edge cases

- Job rescheduled → new timestamp bucket → new key → new reminder.
- Payment fails twice → same key; 1-hour window allows second notification.
- Cron overlap / webhook replay → same key → blocked.

---

## 3. What’s implemented (maturity)

- **Template registry:** `templates.ts` — registry-style; per-type metadata (channels, required vars, URLs); pure rendering; backwards-compatible helpers.
- **URL builders:** `src/lib/urlBuilder.ts` — `buildClientJobUrl`, `buildCleanerJobUrl`, `buildCheckInUrl`, `buildPaymentUrl`, `buildPasswordResetUrl`, etc.
- **Dedupe:** `dedupeKey` on payload; `alreadySent(dedupeKey)`; automatic key generation in `sendNotificationToUser()`.
- **Delivery logging:** `logDeliveryAttempt()` → `notification_log` (user, channel, type, status, error, provider message ID, dedupe key, recipient, timestamp).
- **Job notifications:** All lifecycle notifications include `jobUrl`; workers (e.g. `jobReminders.ts`) use templates and URLs.

---

## 4. Templates outline (types and variables)

**Defined in:** `src/services/notifications/templates.ts`

**Key types (examples):**

- **job.reminder_24h** — Client; 24h before job; email + push; vars: clientName, jobId, scheduledTime, address.
- **job.reminder_2h** — Cleaner; 2h before; SMS + push; vars: cleanerName, jobId, scheduledTime, address; jobId truncated to 8 chars in SMS.
- **job.no_show_warning** — Cleaner; 15 min after scheduled start with no check-in; SMS + push.
- **payment.failed** — Client; email only; vars: clientName, jobId.
- **subscription.renewal_reminder** — Client; 7 days before renewal; email only.

**Common variables:** jobId, clientName, cleanerName, address, creditAmount, scheduledTime, scheduledDate, amount, name, resetUrl. Use fallbacks (e.g. “Customer”, “N/A”) for missing data.

**Channel strategy:** Email = full detail; SMS = urgent/short (reminder_2h, no_show_warning); Push = real-time reminders and actions.

---

## 5. Implementation notes

- SMS: keep under 160 chars; jobId truncated to 8 chars where needed.
- All templates: consistent fallbacks, “Thanks, The PureTask Team,” professional tone.
- Times/dates: use `toLocaleTimeString()` / `toLocaleDateString()` for formatting.

---

**Sources consolidated (2026-02):** Content merged from `02-MEDIUM/NOTIFICATION_DEDUPE_STRATEGY.md`, `NOTIFICATION_MATURITY_UPGRADES.md`, `NOTIFICATION_SENDER_ANALYSIS.md`, and `NOTIFICATION_TEMPLATES_OUTLINE.md`. Originals archived to `docs/archive/raw/consolidated-sources/02-MEDIUM/`.
