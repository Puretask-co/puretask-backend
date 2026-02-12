# Notification Templates Outline

## New Notification Types Implemented

### 1. `job.reminder_24h` - 24-Hour Job Reminder (Client)
**Channels:** Email + Push  
**Trigger:** 24 hours before `scheduled_start_at`  
**Recipient:** Client

#### Email Template
- **Subject:** `"Reminder: Your cleaning is tomorrow"`
- **Body:**
  ```
  Hi {clientName},

  Reminder: Your cleaning job ({jobId}) is scheduled for tomorrow at {scheduledTime}.

  Address: {address}

  Please ensure access is available. We'll notify you when your cleaner is on the way.

  Thanks,
  The PureTask Team
  ```

#### Push Notification Template
- **Title:** `"Cleaning Tomorrow"`
- **Body:** `"Your cleaning is tomorrow at {scheduledTime}"`

#### SMS Template
- **Not used** for this notification type (24h reminder is non-urgent)

---

### 2. `job.reminder_2h` - 2-Hour Job Reminder (Cleaner)
**Channels:** SMS + Push  
**Trigger:** 2 hours before `scheduled_start_at`  
**Recipient:** Cleaner

#### Email Template
- **Subject:** `"Reminder: Your cleaning starts in 2 hours"`
- **Body:**
  ```
  Hi {cleanerName},

  Reminder: Your cleaning job ({jobId}) starts in 2 hours at {scheduledTime}.

  Address: {address}

  Please prepare to check in when you arrive.

  Thanks,
  The PureTask Team
  ```

#### SMS Template
- **Body:** `"PureTask: Job {jobId} starts in 2 hours at {scheduledTime}. Please check in when you arrive."`
- **Note:** `{jobId}` is truncated to first 8 characters in SMS

#### Push Notification Template
- **Title:** `"Job Starts Soon"`
- **Body:** `"Job starts in 2 hours at {scheduledTime}"`

---

### 3. `job.no_show_warning` - No-Show Warning (Cleaner)
**Channels:** SMS + Push  
**Trigger:** 15 minutes after `scheduled_start_at` with no check-in  
**Recipient:** Cleaner

#### Email Template
- **Subject:** `"Action needed: Check in for your job"`
- **Body:**
  ```
  Hi {cleanerName},

  Action needed: Your cleaning job ({jobId}) was scheduled to start at {scheduledTime}, but we haven't received your check-in.

  Please check in via the app if you've arrived, or contact support if there's an issue.

  Thanks,
  The PureTask Team
  ```

#### SMS Template
- **Body:** `"PureTask: Job {jobId} was scheduled for {scheduledTime}. Please check in or contact support."`
- **Note:** `{jobId}` is truncated to first 8 characters in SMS

#### Push Notification Template
- **Title:** `"Action Needed"`
- **Body:** `"Please check in for job starting at {scheduledTime}"`

---

### 4. `payment.failed` - Payment Failed (Client)
**Channels:** Email  
**Trigger:** Payment intent fails  
**Recipient:** Client

#### Email Template
- **Subject:** `"Payment failed - please update your payment method"`
- **Body:**
  ```
  Hi {clientName},

  We encountered an issue processing your payment for job {jobId}.

  Please update your payment method in the app to complete the booking.

  Thanks,
  The PureTask Team
  ```

#### SMS Template
- **Not used** for this notification type (payment issues are handled via email)

#### Push Notification Template
- **Not used** for this notification type (payment issues are handled via email)

---

### 5. `subscription.renewal_reminder` - Subscription Renewal Reminder (Client)
**Channels:** Email  
**Trigger:** 7 days before subscription renewal  
**Recipient:** Client

#### Email Template
- **Subject:** `"Your subscription renews soon"`
- **Body:**
  ```
  Hi {clientName},

  Your subscription will renew in 7 days.

  If you'd like to make changes or cancel, please do so before the renewal date.

  Thanks,
  The PureTask Team
  ```

#### SMS Template
- **Not used** for this notification type (subscription reminders are non-urgent)

#### Push Notification Template
- **Not used** for this notification type (subscription reminders are non-urgent)

---

## Template Data Variables

All templates use the following data variables (with fallbacks):

### Common Variables
- `jobId` - Job ID (string, default: "N/A" for email, truncated to 8 chars for SMS)
- `clientName` - Client's name (string, default: "Customer")
- `cleanerName` - Cleaner's name (string, default: "Your cleaner")
- `address` - Job address (string, default: "")
- `creditAmount` - Credit amount (number, default: 0)
- `scheduledTime` - Scheduled time formatted (string, default: "")
- `scheduledDate` - Scheduled date formatted (string, default: "")
- `amount` - Payment amount in cents (number, default: 0)
- `name` - Generic name (string, default: "there")
- `resetUrl` - Password reset URL (string, default: "[Reset Link]")

### Variable Usage by Template

| Template | Variables Used |
|----------|---------------|
| `job.reminder_24h` | `clientName`, `jobId`, `scheduledTime`, `address` |
| `job.reminder_2h` | `cleanerName`, `jobId`, `scheduledTime`, `address` |
| `job.no_show_warning` | `cleanerName`, `jobId`, `scheduledTime` |
| `payment.failed` | `clientName`, `jobId` |
| `subscription.renewal_reminder` | `clientName` |

---

## Channel Strategy

### Email
- Used for: All notification types (comprehensive information)
- Format: Multi-line text with full details
- Purpose: Official record, detailed information

### SMS
- Used for: Urgent/time-sensitive notifications only
  - `job.reminder_2h` (cleaner needs to prepare)
  - `job.no_show_warning` (immediate action required)
- Format: Short, concise (160 chars or less)
- Purpose: Immediate attention, mobile-friendly

### Push
- Used for: Real-time updates and reminders
  - `job.reminder_24h` (client reminder)
  - `job.reminder_2h` (cleaner reminder)
  - `job.no_show_warning` (cleaner action needed)
- Format: Title + short body
- Purpose: Instant notification, app engagement

---

## Implementation Notes

1. **SMS Length:** Job IDs are truncated to 8 characters in SMS to save space
2. **Fallbacks:** All templates have fallback values for missing data
3. **Consistency:** All templates end with "Thanks, The PureTask Team"
4. **Tone:** Professional but friendly, action-oriented for urgent notifications
5. **Localization:** Times and dates are formatted using `toLocaleTimeString()` and `toLocaleDateString()`

---

**Last Updated:** 2025-01-15  
**File Location:** `src/services/notifications/templates.ts`
