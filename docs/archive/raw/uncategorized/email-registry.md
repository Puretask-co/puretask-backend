# PureTask Email Registry

**Purpose:** Single source of truth for all email templates  
**Last Updated:** January 2025  
**Status:** 🟡 In Progress - Template IDs need to be populated from SendGrid

---

## 📋 Email Template Registry

This document serves as the master registry for all email templates used in PureTask. Each email must include all required information for both backend event emission and n8n workflow processing.

---

## 📧 Email Templates

### Job Lifecycle Emails

#### 1. Job Booking Confirmation (Client)

**Template Key:** `email.client.job_booked`  
**SendGrid Template ID:** `d-xxxx` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED`  
**Subject:** "Your cleaning job has been booked!"  
**Trigger Event:** `job.booked`

**Required Dynamic Variables:**
```json
{
  "clientName": "John Doe",
  "jobAddress": "123 Main St, City, State",
  "scheduledStartTime": "Jan 16, 2025 at 10:00 AM",
  "creditAmount": 100,
  "jobId": "job-123"
}
```

**Event Payload Example:**
```typescript
{
  eventName: "job.booked",
  jobId: "job-123",
  payload: {
    communication: {
      templateEnvVar: "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED",
      to_email: "client@example.com",
      channel: "email",
      dynamic_data: {
        clientName: "John Doe",
        jobAddress: "123 Main St",
        scheduledStartTime: "Jan 16, 10:00 AM",
        creditAmount: 100,
        jobId: "job-123"
      }
    }
  }
}
```

---

#### 2. Job Accepted Notification (Client)

**Template Key:** `email.client.job_accepted`  
**SendGrid Template ID:** `d-yyyy` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED`  
**Subject:** "Your cleaning job has been accepted!"  
**Trigger Event:** `job.accepted`

**Required Dynamic Variables:**
```json
{
  "clientName": "John Doe",
  "cleanerName": "Jane Smith",
  "jobAddress": "123 Main St",
  "scheduledStartTime": "Jan 16, 2025 at 10:00 AM",
  "jobId": "job-123"
}
```

---

#### 3. Cleaner On My Way (Client)

**Template Key:** `email.client.cleaner_on_my_way`  
**SendGrid Template ID:** `d-zzzz` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY`  
**Subject:** "Your cleaner is on the way!"  
**Trigger Event:** `cleaner.on_my_way`

**Required Dynamic Variables:**
```json
{
  "clientName": "John Doe",
  "cleanerName": "Jane Smith",
  "jobAddress": "123 Main St",
  "estimatedArrivalTime": "10 minutes",
  "jobId": "job-123"
}
```

---

#### 4. Job Completed - Awaiting Approval (Client)

**Template Key:** `email.client.job_completed`  
**SendGrid Template ID:** `d-aaaa` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED`  
**Subject:** "Your cleaning job is complete - please approve"  
**Trigger Event:** `job.completed`

**Required Dynamic Variables:**
```json
{
  "clientName": "John Doe",
  "cleanerName": "Jane Smith",
  "jobAddress": "123 Main St",
  "completionTime": "Jan 16, 2025 at 12:00 PM",
  "jobId": "job-123",
  "approvalLink": "https://app.puretask.com/jobs/job-123/approve"
}
```

---

#### 5. Job Approved Notification (Cleaner)

**Template Key:** `email.cleaner.job_approved`  
**SendGrid Template ID:** `d-bbbb` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED`  
**Subject:** "Your job has been approved!"  
**Trigger Event:** `job.approved`

**Required Dynamic Variables:**
```json
{
  "cleanerName": "Jane Smith",
  "clientName": "John Doe",
  "jobAddress": "123 Main St",
  "creditAmount": 100,
  "earnings": 85,
  "jobId": "job-123"
}
```

---

#### 6. Job Disputed Notification (Cleaner)

**Template Key:** `email.cleaner.job_disputed`  
**SendGrid Template ID:** `d-cccc` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED`  
**Subject:** "A job has been disputed"  
**Trigger Event:** `job.disputed`

**Required Dynamic Variables:**
```json
{
  "cleanerName": "Jane Smith",
  "clientName": "John Doe",
  "jobAddress": "123 Main St",
  "disputeReason": "Quality issue",
  "jobId": "job-123"
}
```

---

#### 7. Job Cancelled Notification (Client/Cleaner)

**Template Key:** `email.user.job_cancelled`  
**SendGrid Template ID:** `d-dddd` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_USER_JOB_CANCELLED`  
**Subject:** "Job cancelled"  
**Trigger Event:** `job.cancelled`

**Required Dynamic Variables:**
```json
{
  "userName": "John Doe",
  "userType": "client", // or "cleaner"
  "jobAddress": "123 Main St",
  "scheduledStartTime": "Jan 16, 2025 at 10:00 AM",
  "refundAmount": 90, // if applicable
  "jobId": "job-123"
}
```

---

### Payment & Credit Emails

#### 8. Credit Purchase Confirmation (Client)

**Template Key:** `email.client.credit_purchase`  
**SendGrid Template ID:** `d-eeee` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE`  
**Subject:** "Credit purchase confirmed"  
**Trigger Event:** `payment.succeeded` (for credit purchases)

**Required Dynamic Variables:**
```json
{
  "clientName": "John Doe",
  "creditAmount": 100,
  "paymentAmount": 95.00,
  "newBalance": 200,
  "transactionId": "txn_123"
}
```

---

#### 9. Payout Sent Notification (Cleaner)

**Template Key:** `email.cleaner.payout_sent`  
**SendGrid Template ID:** `d-ffff` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT`  
**Subject:** "Your payout has been sent"  
**Trigger Event:** `payout.sent`

**Required Dynamic Variables:**
```json
{
  "cleanerName": "Jane Smith",
  "payoutAmount": 425.00,
  "currency": "USD",
  "payoutDate": "Jan 20, 2025",
  "jobsIncluded": 5,
  "payoutId": "po_123"
}
```

---

### User Account Emails

#### 10. Welcome Email (New User)

**Template Key:** `email.user.welcome`  
**SendGrid Template ID:** `d-gggg` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_USER_WELCOME`  
**Subject:** "Welcome to PureTask!"  
**Trigger Event:** `user.registered`

**Required Dynamic Variables:**
```json
{
  "userName": "John Doe",
  "userRole": "client", // or "cleaner"
  "email": "user@example.com"
}
```

---

#### 11. Email Verification (User)

**Template Key:** `email.user.email_verification`  
**SendGrid Template ID:** `d-hhhh` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION`  
**Subject:** "Verify your email address"  
**Trigger Event:** `user.registered` or manual verification request

**Required Dynamic Variables:**
```json
{
  "userName": "John Doe",
  "verificationLink": "https://app.puretask.com/verify?token=abc123",
  "expiresIn": "24 hours"
}
```

---

#### 12. Password Reset (User)

**Template Key:** `email.user.password_reset`  
**SendGrid Template ID:** `d-iiii` (to be populated)  
**Env Var:** `SENDGRID_TEMPLATE_USER_PASSWORD_RESET`  
**Subject:** "Reset your password"  
**Trigger Event:** `user.password_reset_requested`

**Required Dynamic Variables:**
```json
{
  "userName": "John Doe",
  "resetLink": "https://app.puretask.com/reset-password?token=xyz789",
  "expiresIn": "1 hour"
}
```

---

## 📱 SMS Templates (Twilio)

### Emergency SMS

#### 13. Emergency Alert (User)

**Template Key:** `sms.user.emergency`  
**Twilio Template:** Custom message  
**Env Var:** `SMS_TEMPLATE_EMERGENCY` (optional)  
**Trigger Event:** `communication.sms` (high priority)

**Required Dynamic Variables:**
```json
{
  "userName": "John Doe",
  "message": "Your cleaner is running 15 minutes late",
  "jobAddress": "123 Main St",
  "jobId": "job-123"
}
```

---

#### 14. Job Reminder (Client/Cleaner)

**Template Key:** `sms.user.job_reminder`  
**Twilio Template:** Custom message  
**Env Var:** `SMS_TEMPLATE_JOB_REMINDER`  
**Trigger Event:** `job.reminder` (scheduled)

**Required Dynamic Variables:**
```json
{
  "userName": "John Doe",
  "userType": "client",
  "jobAddress": "123 Main St",
  "scheduledStartTime": "Jan 16, 2025 at 10:00 AM",
  "timeUntilJob": "2 hours"
}
```

---

## 🔧 Environment Variables Configuration

Add these to `.env` and `ENV_EXAMPLE.md`:

```env
# Email Templates
SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED=d-xxxx
SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED=d-yyyy
SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY=d-zzzz
SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED=d-aaaa
SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED=d-bbbb
SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED=d-cccc
SENDGRID_TEMPLATE_USER_JOB_CANCELLED=d-dddd
SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE=d-eeee
SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT=d-ffff
SENDGRID_TEMPLATE_USER_WELCOME=d-gggg
SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION=d-hhhh
SENDGRID_TEMPLATE_USER_PASSWORD_RESET=d-iiii

# SMS Templates (optional)
SMS_TEMPLATE_EMERGENCY=emergency_alert
SMS_TEMPLATE_JOB_REMINDER=job_reminder
```

---

## 📝 Usage in Backend

### Event Emission Pattern

```typescript
import { publishEvent } from "../lib/events";
import { env } from "../config/env";

// Emit job booked event
await publishEvent({
  eventName: "job.booked",
  jobId: job.id,
  actorType: "client",
  actorId: userId,
  payload: {
    communication: {
      templateEnvVar: "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED",
      templateId: env.SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED,
      to_email: user.email,
      channel: "email",
      dynamic_data: {
        clientName: user.fullName,
        jobAddress: job.address,
        scheduledStartTime: formatDate(job.scheduled_start_at),
        creditAmount: job.credit_amount,
        jobId: job.id,
      },
    },
  },
});
```

---

## 🔄 n8n Workflow Mapping

### Event → Template Mapping

| Event Name | Template Key | Template ID Env Var |
|------------|-------------|-------------------|
| `job.booked` | `email.client.job_booked` | `SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED` |
| `job.accepted` | `email.client.job_accepted` | `SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED` |
| `cleaner.on_my_way` | `email.client.cleaner_on_my_way` | `SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY` |
| `job.completed` | `email.client.job_completed` | `SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED` |
| `job.approved` | `email.cleaner.job_approved` | `SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED` |
| `job.disputed` | `email.cleaner.job_disputed` | `SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED` |
| `job.cancelled` | `email.user.job_cancelled` | `SENDGRID_TEMPLATE_USER_JOB_CANCELLED` |
| `payment.succeeded` (credits) | `email.client.credit_purchase` | `SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE` |
| `payout.sent` | `email.cleaner.payout_sent` | `SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT` |
| `user.registered` | `email.user.welcome` | `SENDGRID_TEMPLATE_USER_WELCOME` |

---

## ✅ Registry Maintenance Rules

1. **Every email template must be registered here**
2. **Template IDs must come from SendGrid** (populate after template creation)
3. **Env vars must match naming convention:** `SENDGRID_TEMPLATE_{DOMAIN}_{ACTION}`
4. **All dynamic variables must be documented**
5. **Trigger events must be specified**

---

## 🚧 TODO

- [ ] Populate actual SendGrid Template IDs (replace `d-xxxx` placeholders)
- [ ] Create templates in SendGrid dashboard
- [ ] Test each template with sample data
- [ ] Verify all env vars are in `.env.example`
- [ ] Update backend event emission code to use registry
- [ ] Create n8n workflow mappings

---

*This registry is the single source of truth for all email/SMS templates in PureTask.*

---

*Last Updated: January 2025*
