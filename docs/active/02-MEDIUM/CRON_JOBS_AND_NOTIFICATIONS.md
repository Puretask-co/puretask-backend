# Cron Jobs & Notifications Inventory

**In plain English:** "Cron jobs" are tasks that run on a schedule (e.g. every 5 minutes, every day at 2 AM). This doc lists all of ours: what runs when, what it does (e.g. auto-cancel stale bookings, weekly payouts), and which ones are active vs not yet scheduled. Use it when you need to add a new scheduled task or understand when something runs.

**What it is:** An inventory of cron jobs and notifications (existing, missing, scheduled, not scheduled).  
**What it does:** Shows what runs when and what notifications we send so we can add or tune them.  
**How we use it:** Use Existing Cron Jobs and Existing Notifications to see what's in place; use Missing sections and Action Plan to prioritize what to add.

---

## New here? Key terms (plain English)

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

## 📋 Existing Cron Jobs

**What it is:** The list of cron jobs we have (scheduled, available but not scheduled, disabled).  
**What it does:** Shows what runs when and what exists but isn't scheduled.  
**How we use it:** Reference when adding a new job or changing schedule; see scheduler.ts.

### Currently Scheduled (in `src/workers/scheduler.ts`)
**What it is:** Jobs that run on a schedule in production.  
**What it does:** Lists worker, schedule, purpose, and status.  
**How we use it:** Check when a job runs; add or change schedule in scheduler.ts.

| Worker | Schedule | Frequency | Purpose | Status |
|--------|----------|-----------|---------|--------|
| **auto-cancel** | `*/5 * * * *` | Every 5 minutes | Auto-cancel stale bookings past scheduled start time | ✅ Active |
| **lock-recovery** | `*/15 * * * *` | Every 15 minutes | Recover expired locks from crashed workers | ✅ Active |
| **kpi-daily** | `0 1 * * *` | Daily at 1 AM | Daily KPI snapshot for analytics | ✅ Active |
| **subscription-jobs** | `0 2 * * *` | Daily at 2 AM | Create jobs from active subscriptions | ✅ Active |
| **backup-daily** | `0 3 * * *` | Daily at 3 AM | Daily database backup | ✅ Active |
| **payout-weekly** | `0 0 * * 0` | Every Sunday at midnight | Weekly payout processing for cleaners | ✅ Active |
| **weekly-summary** | `0 4 * * 1` | Every Monday at 4 AM | Generate weekly summary reports | ✅ Active |

### Available but Not Scheduled

**What it is:** Workers that exist but are not yet added to the scheduler.  
**What it does:** Lists recommended schedule and purpose so we can add them when needed.  
**How we use it:** Add to scheduler.ts when ready; use recommended schedule as a starting point.

| Worker | Purpose | Recommended Schedule | Status |
|--------|----------|---------------------|--------|
| **retry-notifications** | Retry failed email/SMS notifications | `*/10 * * * *` (every 10 min) | ⚠️ Not scheduled |
| **webhook-retry** | Retry failed webhook deliveries | `*/5 * * * *` (every 5 min) | ⚠️ Not scheduled |
| **reliability-recalc** | Recalculate cleaner reliability scores | `0 3 * * *` (daily at 3 AM) | ⚠️ Not scheduled |
| **nightly-scores** | Recompute client risk + cleaner reliability scores | `0 2 * * *` (daily at 2 AM) | ⚠️ Not scheduled |
| **credit-economy** | Credit decay & tier lock maintenance | `0 4 * * *` (daily at 4 AM) | ⚠️ Not scheduled |
| **photo-cleanup** | Delete photos older than 90 days | `0 5 * * *` (daily at 5 AM) | ⚠️ Not scheduled |
| **auto-expire** | Auto-expire jobs in awaiting_approval status | `0 * * * *` (hourly) | ⚠️ Not scheduled |
| **onboarding-reminders** | Send reminders to incomplete onboarding | `0 */6 * * *` (every 6 hours) | ⚠️ Not scheduled |
| **payout-retry** | Retry failed payouts | `*/30 * * * *` (every 30 min) | ⚠️ Not scheduled |
| **payout-reconciliation** | Flag payout/earnings mismatches | `0 6 * * *` (daily at 6 AM) | ⚠️ Not scheduled |
| **expire-boosts** | Expire expired boosts | `0 0 * * *` (daily at midnight) | ⚠️ Not scheduled |

### Disabled/Deprecated
**What it is:** Workers we no longer run (moved, removed, or merged).  
**What it does:** Avoids confusion about old jobs.  
**How we use it:** Don't re-enable unless we have a reason; use for reference only.

| Worker | Reason | Status |
|--------|--------|--------|
| **stuck-detection** | Moved to monitoring/alerts | ❌ Disabled |
| **goal-checker** | Feature removed | ❌ Disabled |
| **cleaning-scores** | Merged into nightly-scores | ❌ Disabled |

---

## 📧 Existing Notifications

**What it is:** The list of notification types and channels we have.  
**What it does:** Shows what we send (job lifecycle, payment, account) and via which channel.  
**How we use it:** Reference when adding a new notification type; see types.ts and notification service.

### Notification Types (from `src/services/notifications/types.ts`)
**What it is:** All notification types we support (job.*, credits.*, payout.*, welcome, etc.).  
**What it does:** Lists type, purpose, and recipient.  
**How we use it:** Use when adding a new type; keep in sync with types.ts.

#### Job Lifecycle Notifications
- ✅ **job.created** - Job booking confirmation (client)
- ✅ **job.accepted** - Cleaner accepted job (client)
- ✅ **job.on_my_way** - Cleaner en route (client)
- ✅ **job.started** - Job started (client)
- ✅ **job.completed** - Job completed, awaiting approval (client)
- ✅ **job.awaiting_approval** - Job completed, needs client review (client)
- ✅ **job.approved** - Client approved job (cleaner)
- ✅ **job.disputed** - Job disputed (cleaner + admin)
- ✅ **job.cancelled** - Job cancelled (both parties)

#### Payment Notifications
- ✅ **credits.purchased** - Credits purchased successfully (client)
- ✅ **credits.low** - Low credit balance warning (client)
- ✅ **payout.processed** - Payout sent to cleaner (cleaner)
- ✅ **payout.failed** - Payout failed (cleaner)

#### Account Notifications
- ✅ **welcome** - Welcome email for new users
- ✅ **password.reset** - Password reset link
- ✅ **email.verification** - Email verification code
- ✅ **phone.verification** - SMS verification code

### Notification Channels

**What it is:** Which channel (email, SMS, push) we use for which notification types.  
**What it does:** Ensures we pick the right channel (e.g. SMS for urgent, email for detail).  
**How we use it:** Use when adding a new notification type; follow the channel strategy.

| Channel | Provider | Status | Used For |
|---------|----------|--------|----------|
| **Email** | SendGrid / n8n | ✅ Active | All notification types |
| **SMS** | Twilio / n8n | ✅ Active | Urgent job updates, verification |
| **Push** | OneSignal | ✅ Active | Real-time job updates |

### Notification Triggers (Event-Based)
**What it is:** Which backend events trigger which notification type.  
**What it does:** Maps event (e.g. job_accepted) to notification (e.g. job.accepted).  
**How we use it:** Use when adding a new event or notification; keep in sync with event handlers.

Notifications are automatically sent when these events occur:
- `job_accepted` → `job.accepted` (email + push to client)
- `cleaner_on_my_way` → `job.on_my_way` (email + push to client)
- `job_started` → `job.started` (email + push to client)
- `job_completed` → `job.completed` (email + push to client)
- `client_approved` → `job.approved` (email + push to cleaner)
- `client_disputed` → `job.disputed` (email to cleaner + admin)

---

## 🚨 Missing Cron Jobs (Should Have)

**What it is:** Cron jobs we should add (critical, important, nice-to-have).  
**What it does:** Prioritizes what to build next so we don't miss important scheduled tasks.  
**How we use it:** Work Critical first; add to scheduler.ts when implemented.

### Critical (High Priority)

1. **Notification Retry Worker** ⚠️
   - **Schedule**: `*/10 * * * *` (every 10 minutes)
   - **Purpose**: Retry failed notifications from `notification_failures` table
   - **Why needed**: Ensure no notifications are lost
   - **File**: `src/workers/v1-core/retryFailedNotifications.ts` (exists, not scheduled)

2. **Webhook Retry Worker** ⚠️
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Purpose**: Retry failed webhook deliveries
   - **Why needed**: Critical for Stripe/payment webhooks
   - **File**: `src/workers/v1-core/webhookRetry.ts` (exists, not scheduled)

3. **Reliability Recalculation** ⚠️
   - **Schedule**: `0 3 * * *` (daily at 3 AM)
   - **Purpose**: Recalculate cleaner reliability scores based on recent jobs
   - **Why needed**: Keep matching accurate
   - **File**: `src/workers/reliability/reliabilityRecalc.ts` (exists, not scheduled)

4. **Auto-Expire Awaiting Approval** ⚠️
   - **Schedule**: `0 * * * *` (hourly)
   - **Purpose**: Auto-approve jobs stuck in `awaiting_approval` for >48 hours
   - **Why needed**: Prevent jobs from getting stuck
   - **File**: `src/workers/v1-core/autoExpireAwaitingApproval.ts` (exists, not scheduled)

5. **Photo Cleanup** ⚠️
   - **Schedule**: `0 5 * * *` (daily at 5 AM)
   - **Purpose**: Delete photos older than 90 days (per retention policy)
   - **Why needed**: Comply with data retention, save storage costs
   - **File**: `src/workers/v2-operations/photoRetentionCleanup.ts` (exists, not scheduled)

### Important (Medium Priority)
**What it is:** Cron jobs we should add soon (nightly scores, photo cleanup, etc.).  
**What it does:** Improves data quality and automation.  
**How we use it:** Schedule after Critical; see recommended schedule in list below.

6. **Nightly Score Recompute** ⚠️
   - **Schedule**: `0 2 * * *` (daily at 2 AM)
   - **Purpose**: Recompute client risk scores, cleaner flexibility scores
   - **Why needed**: Keep scoring accurate for matching
   - **File**: `src/workers/reliability/nightlyScoreRecompute.ts` (exists, not scheduled)

7. **Credit Economy Maintenance** ⚠️
   - **Schedule**: `0 4 * * *` (daily at 4 AM)
   - **Purpose**: Apply credit decay, update tier locks
   - **Why needed**: Maintain credit economy balance
   - **File**: `src/workers/v2-operations/creditEconomyMaintenance.ts` (exists, not scheduled)

8. **Onboarding Reminders** ⚠️
   - **Schedule**: `0 */6 * * *` (every 6 hours)
   - **Purpose**: Send reminders to users with incomplete onboarding
   - **Why needed**: Improve user activation
   - **File**: `src/workers/onboardingReminderWorker.ts` (exists, not scheduled)

9. **Payout Retry** ⚠️
   - **Schedule**: `*/30 * * * *` (every 30 minutes)
   - **Purpose**: Retry failed Stripe payouts
   - **Why needed**: Ensure cleaners get paid
   - **File**: `src/workers/v2-operations/payoutRetry.ts` (exists, not scheduled)

10. **Payout Reconciliation** ⚠️
    - **Schedule**: `0 6 * * *` (daily at 6 AM)
    - **Purpose**: Flag payout/earnings mismatches for admin review
    - **Why needed**: Catch payment discrepancies early
    - **File**: `src/workers/v2-operations/payoutReconciliation.ts` (exists, not scheduled)

11. **Expire Boosts** ⚠️
    - **Schedule**: `0 0 * * *` (daily at midnight)
    - **Purpose**: Expire expired boosts
    - **Why needed**: Clean up expired data
    - **File**: `src/workers/v4-analytics/expireBoosts.ts` (exists, not scheduled)

### Nice-to-Have (Low Priority)
**What it is:** Cron jobs we can add later (job reminder, expire boosts, etc.).  
**What it does:** Improves UX and ops when we have capacity.  
**How we use it:** Add when Phase 1 and 2 are done; see list below.

12. **Job Reminder (24h before)** 🔴
    - **Schedule**: `0 9 * * *` (daily at 9 AM)
    - **Purpose**: Send reminder to client 24 hours before scheduled job
    - **Why needed**: Reduce no-shows, improve UX
    - **Status**: ❌ Not implemented

13. **Job Reminder (2h before)** 🔴
    - **Schedule**: `*/30 * * * *` (every 30 minutes, check for jobs starting in 2h)
    - **Purpose**: Send reminder to cleaner 2 hours before job
    - **Why needed**: Reduce no-shows
    - **Status**: ❌ Not implemented

14. **Inactive User Re-engagement** 🔴
    - **Schedule**: `0 10 * * 1` (every Monday at 10 AM)
    - **Purpose**: Send re-engagement emails to users inactive >30 days
    - **Why needed**: Improve retention
    - **Status**: ❌ Not implemented

15. **Weekly Cleaner Performance Report** 🔴
    - **Schedule**: `0 8 * * 1` (every Monday at 8 AM)
    - **Purpose**: Email cleaners their weekly stats (jobs completed, earnings, rating)
    - **Why needed**: Keep cleaners engaged
    - **Status**: ❌ Not implemented

16. **Monthly Client Summary** 🔴
    - **Schedule**: `0 9 * * 1` (first Monday of month at 9 AM)
    - **Purpose**: Monthly summary of jobs, spending, savings
    - **Why needed**: Client retention
    - **Status**: ❌ Not implemented

17. **Subscription Renewal Reminder** 🔴
    - **Schedule**: `0 10 * * *` (daily at 10 AM, check subscriptions expiring in 7 days)
    - **Purpose**: Remind clients about upcoming subscription renewal
    - **Why needed**: Reduce churn
    - **Status**: ❌ Not implemented

18. **Background Check Expiry Warning** 🔴
    - **Schedule**: `0 9 * * *` (daily at 9 AM, check checks expiring in 30 days)
    - **Purpose**: Warn cleaners about expiring background checks
    - **Why needed**: Compliance
    - **Status**: ❌ Not implemented

19. **Dispute Escalation** 🔴
    - **Schedule**: `0 */4 * * *` (every 4 hours)
    - **Purpose**: Escalate disputes unresolved >48 hours to admin
    - **Why needed**: Faster dispute resolution
    - **Status**: ❌ Not implemented

20. **Database Cleanup (Old Logs)** 🔴
    - **Schedule**: `0 7 * * 0` (every Sunday at 7 AM)
    - **Purpose**: Delete old logs, events, notifications >90 days
    - **Why needed**: Database maintenance
    - **Status**: ❌ Not implemented

---

## 📧 Missing Notifications (Should Have)

**What it is:** Notification types we should add (reminders, receipts, etc.).  
**What it does:** Prioritizes what to implement next.  
**How we use it:** Add Critical first; then Important; then Nice-to-Have.

### Critical (High Priority)
**What it is:** Notifications we need soon (e.g. job reminder, payment receipt).  
**What it does:** Improves UX and compliance.  
**How we use it:** Implement and wire to events; add to types and templates.

1. **Job Reminder (24h before)** 🔴
   - **Type**: `job.reminder_24h`
   - **Channel**: Email + Push
   - **Trigger**: 24 hours before `scheduled_start_at`
   - **Recipient**: Client
   - **Why needed**: Reduce no-shows

2. **Job Reminder (2h before)** 🔴
   - **Type**: `job.reminder_2h`
   - **Channel**: SMS + Push
   - **Trigger**: 2 hours before `scheduled_start_at`
   - **Recipient**: Cleaner
   - **Why needed**: Reduce no-shows

3. **No-Show Warning** 🔴
   - **Type**: `job.no_show_warning`
   - **Channel**: SMS + Push
   - **Trigger**: 15 minutes after `scheduled_start_at` with no check-in
   - **Recipient**: Cleaner
   - **Why needed**: Prompt cleaner to check in

4. **Payment Failed** 🔴
   - **Type**: `payment.failed`
   - **Channel**: Email
   - **Trigger**: Payment intent fails
   - **Recipient**: Client
   - **Why needed**: Alert user to payment issue

5. **Subscription Renewal Reminder** 🔴
   - **Type**: `subscription.renewal_reminder`
   - **Channel**: Email
   - **Trigger**: 7 days before subscription renewal
   - **Recipient**: Client
   - **Why needed**: Reduce churn

### Important (Medium Priority)
**What it is:** Notifications we should add soon (weekly performance, etc.).  
**What it does:** Improves engagement and transparency.  
**How we use it:** Implement after Critical; add to types and templates.

6. **Weekly Cleaner Performance** 🔴
   - **Type**: `cleaner.weekly_summary`
   - **Channel**: Email
   - **Trigger**: Weekly (Monday)
   - **Recipient**: Cleaner
   - **Why needed**: Engagement

7. **Monthly Client Summary** 🔴
   - **Type**: `client.monthly_summary`
   - **Channel**: Email
   - **Trigger**: Monthly (1st of month)
   - **Recipient**: Client
   - **Why needed**: Retention

8. **Background Check Expiring** 🔴
   - **Type**: `cleaner.background_check_expiring`
   - **Channel**: Email + Push
   - **Trigger**: 30 days before expiry
   - **Recipient**: Cleaner
   - **Why needed**: Compliance

9. **Dispute Escalated** 🔴
   - **Type**: `dispute.escalated`
   - **Channel**: Email
   - **Trigger**: Dispute unresolved >48 hours
   - **Recipient**: Admin
   - **Why needed**: Faster resolution

10. **New Cleaner Application** 🔴
    - **Type**: `admin.new_cleaner_application`
    - **Channel**: Email
    - **Trigger**: New cleaner signs up
    - **Recipient**: Admin
    - **Why needed**: Fast onboarding

11. **High-Value Job Available** 🔴
    - **Type**: `cleaner.high_value_job`
    - **Channel**: Push
    - **Trigger**: Job posted with credits >X threshold
    - **Recipient**: Top-tier cleaners
    - **Why needed**: Better matching

12. **Inactive User Re-engagement** 🔴
    - **Type**: `user.re_engagement`
    - **Channel**: Email
    - **Trigger**: User inactive >30 days
    - **Recipient**: User
    - **Why needed**: Retention

### Nice-to-Have (Low Priority)
**What it is:** Notifications we can add later (rating reminder, referral bonus, etc.).  
**What it does:** Improves engagement when we have capacity.  
**How we use it:** Add when Phase 1 and 2 are done; see list below.

13. **Job Rating Reminder** 🔴
    - **Type**: `job.rating_reminder`
    - **Channel**: Push
    - **Trigger**: 24 hours after job completion, no rating
    - **Recipient**: Client
    - **Why needed**: Improve ratings

14. **Referral Bonus Earned** 🔴
    - **Type**: `referral.bonus_earned`
    - **Channel**: Email
    - **Trigger**: Referral completes first job
    - **Recipient**: Referrer
    - **Why needed**: Encourage referrals

15. **Tier Upgrade** 🔴
    - **Type**: `cleaner.tier_upgrade`
    - **Channel**: Email + Push
    - **Trigger**: Cleaner moves to higher tier
    - **Recipient**: Cleaner
    - **Why needed**: Engagement

16. **Credit Balance Low** 🔴
    - **Type**: `credits.low` (exists but may need improvement)
    - **Channel**: Email
    - **Trigger**: Balance < 100 credits
    - **Recipient**: Client
    - **Why needed**: Prevent service interruption

---

## 📊 Summary

**What it is:** Counts of cron jobs and notifications (scheduled, missing, total).  
**What it does:** Gives a quick view of coverage.  
**How we use it:** Use to track progress; aim for Phase 1 then Phase 2.

### Cron Jobs
**What it is:** Count of cron jobs (scheduled, not scheduled, missing).  
**What it does:** Shows how many we have vs need.  
**How we use it:** Reference when planning what to add next.

- **Currently Scheduled**: 7
- **Available but Not Scheduled**: 11
- **Missing (Need to Implement)**: 9
- **Total Needed**: 27

### Notifications

**What it is:** Count of notification types (implemented vs missing).  
**What it does:** Shows notification coverage at a glance.  
**How we use it:** Use to see progress; refer to Existing/Missing Notifications for details.

- **Currently Implemented**: 12
- **Missing (Need to Implement)**: 16
- **Total Needed**: 28

---

## 🎯 Recommended Action Plan

**What it is:** Phased plan to add missing cron jobs and notifications.  
**What it does:** Prioritizes Critical first, then Important, then Nice-to-Have.  
**How we use it:** Work through Phase 1, then Phase 2, then Phase 3.

### Phase 1: Critical (Do Now)
**What it is:** First batch: retry workers and job reminders.  
**What it does:** Ensures we don't lose notifications and users get reminders.  
**How we use it:** Add retry-notifications and webhook-retry to scheduler; implement job reminder notifications.

1. Add `retry-notifications` to scheduler (every 10 min)
2. Add `webhook-retry` to scheduler (every 5 min)
3. Add `reliability-recalc` to scheduler (daily at 3 AM)
4. Add `auto-expire` to scheduler (hourly)
5. Implement job reminder notifications (24h and 2h before)

### Phase 2: Important (Do Soon)

**What it is:** Second batch: add unscheduled workers, important notifications, etc.  
**What it does:** Lists tasks to do after Phase 1.  
**How we use it:** Do after Phase 1; add workers to scheduler and implement notifications.

6. Add remaining unscheduled workers to scheduler
7. Implement payment failed notifications
8. Implement subscription renewal reminders
9. Implement weekly/monthly summaries

### Phase 3: Nice-to-Have (Do Later)
**What it is:** Third batch: photo cleanup, onboarding reminders, nice-to-have notifications.  
**What it does:** Improves ops and engagement when we have capacity.  
**How we use it:** Add when Phase 1 and 2 are done; see list in Missing sections above.

10. Implement re-engagement campaigns
11. Implement performance reports
12. Implement referral notifications

---

**Last Updated**: 2025-01-15
**Next Review**: After Phase 1 completion
