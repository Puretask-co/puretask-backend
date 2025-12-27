# PureTask Current System Inventory

**Generated:** $(date)  
**Purpose:** Complete inventory of all systems, features, and code built in PureTask  
**Status:** Evidence-based from migrations, types, services, routes, and workers

---

## 1. DATABASE SCHEMA (Complete)

### Core Identity Tables
- `users` - Base user table (id, email, password_hash, role, first_name, last_name, phone, referral_code)
- `client_profiles` - Client-specific data (stripe_customer_id, default_address, grace_cancellations, push_token)
- `cleaner_profiles` - Cleaner-specific data (tier, reliability_score, hourly_rate, stripe_connect_id, availability settings, payout settings, background_check_status)

### Job & Booking Tables
- `jobs` - Core job table (client_id, cleaner_id, status, scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at, address, credit_amount, cleaning_type, duration_hours, price_credits, held_credits, rating, notes)
- `job_events` - Audit log of all job lifecycle events (job_id, actor_type, actor_id, event_type, payload)
- `job_photos` - Before/after photos (job_id, uploaded_by, type, url, thumbnail_url, metadata)
- `job_checkins` - Check-in/check-out records (job_id, cleaner_id, type, lat, lng, distance_from_job_meters, is_within_radius)
- `job_status_history` - Status change history (job_id, from_status, to_status, changed_by_user_id, changed_by_type, reason)

### Credit & Payment Tables
- `credit_ledger` - Append-only ledger (user_id, job_id, delta_credits, reason, created_at)
- `payment_intents` - Stripe payment intent tracking (stripe_payment_intent_id, client_id, amount_cents, purpose, credits_amount, status)
- `stripe_events` - Deduplicated Stripe webhook events (stripe_event_id, type, payload, processed)
- `credit_purchases` - Credit purchase tracking (user_id, package_id, credits_amount, price_usd, stripe_checkout_session_id, stripe_payment_intent_id, status)
- `credit_accounts` - Credit account summaries (user_id, current_balance, held_balance, lifetime_purchased, lifetime_spent, lifetime_refunded)
- `credit_transactions` - Credit transaction history (account_id, amount, balance_after, type, reference_type, reference_id)

### Payout Tables
- `payouts` - Payout records (cleaner_id, job_id, amount_credits, amount_cents, stripe_transfer_id, status, created_at, updated_at)
- `payout_failures` - Failed payout tracking (payout_id, error_message, retry_count, next_retry_at)
- `payout_requests` - Payout requests for instant payouts (cleaner_id, amount_credits, status, requested_at, decided_at, payout_id)

### Dispute Tables
- `disputes` - Dispute records (job_id, client_id, status, client_notes, admin_notes)
- `dispute_actions` - Dispute action history (dispute_id, actor_user_id, actor_type, action, details, attachments)

### Reliability & Risk Tables
- `reliability_snapshots` - Reliability score snapshots (cleaner_id, score, tier, inputs, breakdown, computed_at)
- `cleaner_tier_history` - Tier change history (cleaner_id, from_tier, to_tier, reason, triggered_by, effective_from, effective_to)
- `client_risk_events` - Client risk event tracking (referenced in services)
- `cleaner_events` - Cleaner event tracking (referenced in services)

### Availability & Matching Tables
- `cleaner_availability` - Weekly availability schedule (cleaner_id, day_of_week, start_time, end_time, is_available)
- `cleaner_time_off` - Time-off blocks (cleaner_id, start_date, end_date, reason)
- `cleaner_service_areas` - Service area definitions (referenced in matching)
- `job_offers` - Job offer tracking (referenced in migrations)

### Messaging & Notifications Tables
- `messages` - Job-linked messages (job_id, sender_type, sender_id, content, is_read, read_at, attachments)
- `notification_preferences` - User notification preferences (user_id, email_enabled, sms_enabled, push_enabled)
- `notification_log` - Notification delivery log (user_id, channel, type, payload, status, error_message, sent_at)
- `notification_templates` - Notification templates (key, name, channel, subject, title, body, variables, is_active)
- `notification_failures` - Failed notification tracking (user_id, channel, type, payload, error_message, retry_count, last_attempt_at)

### Properties & Addresses Tables
- `properties` - Multi-property support (client_id, service_area_id, label, address, bedrooms, bathrooms, cleaning_score, last_basic_at, last_deep_at, last_moveout_at)
- `addresses` - User addresses (user_id, label, line1, line2, city, state, postal_code, country, lat, lng, is_default)
- `cities` - City definitions (name, country_code, state_region, timezone, is_active)
- `platform_service_areas` - Platform service areas (city_id, name, zip_codes, base_multiplier, is_active)

### Teams Tables
- `cleaner_teams` - Cleaner team definitions (owner_cleaner_id, name, description, max_members, is_active)
- `team_members` - Team membership (team_id, cleaner_id, role, status, invited_at, accepted_at)

### Subscription & Premium Tables
- `cleaning_subscriptions` - Subscription definitions (client_id, cleaner_id, frequency, next_job_date, preferred_time, credit_amount, status)
- `cleaner_boosts` - Cleaner boost promotions (referenced in premium service)
- `cleaner_goals` - Cleaner goal tracking (referenced in cleanerGoalsService)

### Analytics & KPI Tables
- `kpi_snapshots` - Daily KPI snapshots (date, total_jobs, completed_jobs, disputed_jobs, cancelled_jobs)
- `backup_snapshots` - Backup snapshots (label, metadata, data)

### Admin & Audit Tables
- `admin_audit_log` - Admin action audit log (admin_user_id, action, entity_type, entity_id, old_values, new_values, reason, ip_address, user_agent, metadata)
- `reconciliation_flags` - Reconciliation flags for payout/job issues (referenced in reconciliationService)

### Webhook & Retry Tables
- `webhook_failures` - Webhook retry queue (source, event_id, event_type, payload, error_message, retry_count, max_retries, next_retry_at, status)
- `stripe_object_processed` - Stripe object deduplication (referenced in migrations)

### Referral Tables
- `referrals` - Referral tracking (referenced in referralService)

### Review Tables
- `reviews` - Review/rating system (job_id, reviewer_id, reviewee_id, reviewer_type, rating, comment, is_public, response)

### ENUM Types Defined
- `user_role`: 'client', 'cleaner', 'admin'
- `job_status`: 'requested', 'accepted', 'on_my_way', 'in_progress', 'awaiting_approval', 'completed', 'disputed', 'cancelled'
- `payout_status`: 'pending', 'paid', 'failed'
- `dispute_status`: 'open', 'resolved_refund', 'resolved_no_refund'
- `credit_reason`: 'purchase', 'job_escrow', 'job_release', 'refund', 'adjustment'
- `cleaner_event_type`: 'late_reschedule', 'cancel_24_48', 'cancel_lt24', 'no_show', 'dispute_cleaner_at_fault', 'inconvenience_high', 'inconvenience_pattern', 'streak_bonus', 'photo_compliance_bonus'
- `client_risk_band`: 'normal', 'mild', 'elevated', 'high', 'critical'
- `client_risk_event_type`: 'late_reschedule_lt24', 'late_reschedule_pattern', 'cancel_24_48', 'cancel_24_48_grace', 'cancel_lt24', 'cancel_lt24_grace', 'cancel_after_decline', 'no_show', 'dispute_client_at_fault', 'card_decline', 'chargeback', 'inconvenience_pattern_3', 'inconvenience_pattern_5', 'abuse_flag'
- `reschedule_status`: 'pending', 'accepted', 'declined', 'expired'
- `reschedule_bucket`: 'lt24', '24_48', 'gt48'

---

## 2. JOB STATE MACHINE

### Current States
1. `requested` - Job created, awaiting cleaner assignment
2. `accepted` - Cleaner has accepted the job
3. `on_my_way` - Cleaner is en route
4. `in_progress` - Job is actively being worked on
5. `awaiting_approval` - Cleaner marked complete, waiting for client approval
6. `completed` - Job successfully completed and approved (TERMINAL)
7. `disputed` - Client disputed the job
8. `cancelled` - Job was cancelled (TERMINAL)

### Events
- `job_created` - Job created (client/admin/system)
- `job_accepted` - Cleaner accepted job (cleaner)
- `cleaner_on_my_way` - Cleaner marked as en route (cleaner)
- `job_started` - Job work started (cleaner)
- `job_completed` - Cleaner marked job complete (cleaner)
- `client_approved` - Client approved completion (client)
- `client_disputed` - Client disputed job (client)
- `dispute_resolved_refund` - Dispute resolved with refund (admin)
- `dispute_resolved_no_refund` - Dispute resolved without refund (admin)
- `job_cancelled` - Job cancelled (client/admin/system)

### Transition Rules
- All transitions validated in `src/state/jobStateMachine.ts`
- Role-based permissions enforced
- Invalid transitions throw errors
- Terminal states: `completed`, `cancelled`

### State Machine Implementation
- File: `src/state/jobStateMachine.ts`
- Functions: `getNextStatus()`, `canTransition()`, `getValidEvents()`, `isTerminalStatus()`, `canActorTriggerEvent()`, `validateTransition()`

---

## 3. WORKERS (All Registered)

### Core Workers (Active)
1. **autoCancelJobs** - Auto-cancels jobs based on time/conditions
2. **payouts** - Processes payouts (via processPayouts)
3. **kpi-snapshot** - Captures KPI snapshots (via kpiSnapshot)
4. **retry-events** - Retries failed events (via retryFailedEvents)
5. **photo-cleanup** - Cleans up old photos (90-day retention)
6. **nightly-scores** - Nightly recomputation of reliability/risk scores

### Re-enabled Workers (Now Active)
7. **cleaning-scores** - Recalculates property cleaning scores
8. **credit-economy** - Credit economy maintenance (decay, tier locks, fraud alerts)
9. **expire-boosts** - Expires old cleaner boosts
10. **goal-checker** - Checks and awards cleaner goals
11. **kpi-daily** - Daily KPI snapshot (via kpiDailySnapshot - richer metrics)
12. **reliability-recalc** - Recalculates all cleaner reliability scores
13. **stuck-detection** - Detects stuck jobs/payouts, ledger issues, webhook failures, fraud alerts
14. **subscription-jobs** - Creates jobs from subscriptions
15. **weekly-summary** - Sends weekly summary emails to clients/cleaners

### Worker Registration
- File: `src/workers/index.ts`
- All workers can be run individually or via `all` command
- Workers must be scheduled via cron/queue externally

---

## 4. ROUTES / APIs

### Authentication & Core
- `auth.ts` - Authentication routes (login, register, refresh token)
- `status.ts` - System status/health checks
- `health.ts` - Health endpoint

### Booking & Jobs
- `jobs.ts` - Job CRUD operations
- `assignment.ts` - Job assignment logic
- `cancellation.ts` - Job cancellation handling
- `reschedule.ts` - Job rescheduling
- `tracking.ts` - Job tracking/check-ins
- `photos.ts` - Job photo uploads/management
- `events.ts` - Job event tracking

### Matching & Scoring
- `matching.ts` - Matching algorithm endpoints
- `scoring.ts` - Scoring endpoints
- `v2.ts` - V2 API endpoints

### Credits & Payments
- `credits.ts` - Credit operations (purchase, balance)
- `payments.ts` - Payment processing
- `stripe.ts` - Stripe webhook handling
- `clientInvoices.ts` - Client invoice management

### Payouts
- No dedicated route (handled in services/workers)

### Notifications & Messaging
- `notifications.ts` - Notification management
- `messages.ts` - Message/chat endpoints

### Analytics
- `analytics.ts` - Analytics endpoints
- `alerts.ts` - Alert management

### Admin & Ops
- `admin.ts` - Comprehensive admin routes (1496 lines)
- `manager.ts` - Manager dashboard routes
- `managerDashboard.ts` - Manager dashboard data
- `cleanerPortal.ts` - Cleaner portal routes
- `support.ts` - Support routes

### Premium & Features
- `premium.ts` - Premium features (boosts, subscriptions)

### Cleaner
- `cleaner.ts` - Cleaner-specific routes

---

## 5. SERVICES (Key Domains)

### Booking & Jobs
- `jobsService.ts` - Core job operations
- `jobEvents.ts` - Job event handling
- `jobMatchingService.ts` - Job matching logic
- `jobTrackingService.ts` - Job tracking/check-ins
- `jobPhotosService.ts` - Job photo management

### Credits & Payments
- `creditsService.ts` - Credit ledger operations (escrow, release, refund)
- `creditsPurchaseService.ts` - Credit purchase handling
- `paymentService.ts` - Payment processing
- `refundProcessor.ts` - Refund processing
- `chargebackProcessor.ts` - Chargeback handling
- `payoutsService.ts` - Payout operations
- `payoutImprovementsService.ts` - Payout improvements
- `reconciliationService.ts` - Reconciliation logic
- `creditEconomyService.ts` - Credit economy maintenance (decay, tier locks, fraud)

### Matching & Availability
- `availabilityService.ts` - Availability management
- `jobMatchingService.ts` - Matching algorithm

### Reliability & Risk
- `reliabilityService.ts` - Reliability score calculation
- `clientRiskService.ts` - Client risk scoring
- `rollingWindowService.ts` - Rolling window calculations
- `scoring.ts` - Scoring algorithms

### Disputes
- `disputesService.ts` - Dispute handling

### Notifications
- `notifications/index.ts` - Notification orchestration
- `notifications/jobNotifications.ts` - Job-specific notifications
- `notifications/notificationService.ts` - Core notification service
- `notifications/preferencesService.ts` - Notification preferences
- `notifications/providers/onesignal.ts` - OneSignal provider
- `notifications/providers/sendgrid.ts` - SendGrid provider
- `notifications/providers/twilio.ts` - Twilio provider
- `notifications/templates.ts` - Notification templates

### Messaging
- `messagesService.ts` - Message handling

### Analytics & KPIs
- `analyticsService.ts` - Analytics operations
- `kpiService.ts` - KPI calculations
- `operationalMetricsService.ts` - Operational metrics

### Admin & Ops
- `adminService.ts` - Admin operations
- `adminJobsService.ts` - Admin job management
- `adminRepairService.ts` - Admin repair/health checks
- `managerDashboardService.ts` - Manager dashboard data

### Premium & Features
- `premiumService.ts` - Premium features (boosts, subscriptions)
- `cleanerGoalsService.ts` - Cleaner goal management
- `propertiesService.ts` - Property management
- `referralService.ts` - Referral system

### Other Services
- `authService.ts` - Authentication logic
- `userManagementService.ts` - User management
- `calendarService.ts` - Calendar operations
- `supportService.ts` - Support operations
- `backgroundCheckService.ts` - Background check handling
- `invoiceService.ts` - Invoice operations
- `teamsService.ts` - Team management
- `cleanerOnboardingService.ts` - Cleaner onboarding
- `cleanerClientsService.ts` - Cleaner-client relationships
- `cleanerJobsService.ts` - Cleaner job operations
- `stripeConnectService.ts` - Stripe Connect integration
- `webhookRetryService.ts` - Webhook retry logic
- `weeklySummaryService.ts` - Weekly summary generation
- `backupService.ts` - Backup operations
- `aiService.ts` - AI operations

---

## 6. CREDIT & LEDGER SYSTEM

### Ledger Model
- **Append-only** `credit_ledger` table
- Balance calculated as SUM(delta_credits) per user
- No stored balance field (derived)

### Credit Reasons
- `purchase` - Client purchased credits
- `job_escrow` - Credits escrowed for job
- `job_release` - Credits released to cleaner
- `refund` - Credits refunded to client
- `adjustment` - Manual adjustment

### Key Functions (creditsService.ts)
- `getUserBalance()` - Get current balance
- `addLedgerEntry()` - Add ledger entry
- `ensureUserHasCredits()` - Check sufficient balance
- `escrowJobCredits()` - Escrow credits for job
- `releaseJobCreditsToCleaner()` - Release to cleaner
- `refundJobCreditsToClient()` - Refund to client

### Flow
1. Client purchases credits → `purchase` entry
2. Job created → `job_escrow` entry (deducts from client)
3. Job completed → `job_release` entry (credits cleaner)
4. Dispute/refund → `refund` entry (credits client back)

---

## 7. PAYOUT SYSTEM

### Payout Types
- **Weekly payouts** (default) - Batched weekly
- **Instant payouts** (not implemented/enabled)

### Payout Tables
- `payouts` - Payout records
- `payout_failures` - Failed payout tracking
- `payout_requests` - Instant payout requests (not used if instant disabled)

### Workers
- `payoutWeekly` - Weekly payout processing
- `processPayouts` - Payout processing logic
- `payoutRetry` - Retry failed payouts
- `payoutReconciliation` - Reconciliation

### Status Flow
- `pending` → `paid` / `failed`

---

## 8. MATCHING SYSTEM

### Components
- `availabilityService.ts` - Availability management
- `jobMatchingService.ts` - Matching algorithm
- Matching DB helpers in `core/matchingDb.ts`

### Data Sources
- `cleaner_availability` - Weekly schedules
- `cleaner_time_off` - Time-off blocks
- `cleaner_service_areas` - Service areas
- `cleaner_profiles` - Reliability/tier/rates
- Risk/reliability scores

### Assignment Flow
- Matching algorithm ranks cleaners
- Top cleaner assigned
- Job status transitions to `accepted`

---

## 9. RELIABILITY SYSTEM

### Components
- `reliabilityService.ts` - Reliability calculation
- `reliability_snapshots` - Score snapshots
- `cleaner_tier_history` - Tier change history
- `creditEconomyService.ts` - Decay/tier locks

### Workers
- `nightlyScoreRecompute` - Nightly recomputation
- `reliabilityRecalc` - Full recalculation
- `creditEconomyMaintenance` - Decay/cleanup

### Reliability Signals
- Job completions (positive)
- Late arrivals (negative)
- Cancellations (negative)
- No-shows (negative)
- Disputes (negative if cleaner at fault)
- Streak bonuses (positive)

### Tier System
- Stored in `cleaner_profiles.tier`
- History in `cleaner_tier_history`
- Affects matching priority, payout eligibility

---

## 10. RISK SYSTEM

### Components
- `clientRiskService.ts` - Client risk scoring
- `rollingWindowService.ts` - Rolling window calculations
- Risk bands: 'normal', 'mild', 'elevated', 'high', 'critical'

### Risk Signals
- Late reschedules
- Cancellations (especially <24h)
- Disputes
- Card declines
- Chargebacks
- Abuse flags

### Actions
- Prepayment enforcement
- Booking restrictions
- Payout holds
- Fraud alerts (via creditEconomyService)

---

## 11. DISPUTE SYSTEM

### Dispute Flow
1. Job in `awaiting_approval` state
2. Client disputes → `client_disputed` event → `disputed` state
3. Admin resolves → `dispute_resolved_refund` or `dispute_resolved_no_refund`
4. Job transitions to `cancelled` (with refund) or `completed` (no refund)

### Dispute Tables
- `disputes` - Dispute records
- `dispute_actions` - Dispute action history

### Economic Effects
- Refunds via `creditsService.refundJobCreditsToClient()`
- Cleaner earnings adjusted (pre-payout) or clawed back (post-payout)
- Reliability penalties applied

---

## 12. MESSAGING & NOTIFICATIONS

### Messaging
- `messages` table - Job-linked messages
- `messagesService.ts` - Message handling
- Messages are job-scoped (job_id required)

### Notifications
- **Providers**: SendGrid (email), Twilio (SMS), OneSignal (push)
- **Templates**: Stored in code (`notifications/templates.ts`)
- **Preferences**: `notification_preferences` table
- **Logging**: `notification_log` table
- **Retries**: `notification_failures` table + `retryFailedNotifications` worker

### Notification Types
- Job lifecycle (created, accepted, completed, cancelled)
- Dispute notifications
- Payout notifications
- Weekly summaries

---

## 13. ADMIN & OPS

### Admin Routes (`admin.ts` - 1496 lines)
- Job management (view, cancel, reassign, override state)
- User management (view, suspend, restrict)
- Payout management (view, pause, retry)
- Dispute resolution
- Wallet/credit adjustments
- System health checks

### Audit Logging
- `admin_audit_log` table
- Tracks: admin_user_id, action, entity_type, entity_id, old_values, new_values, reason, ip_address, user_agent

### Repair Services
- `adminRepairService.ts` - Stuck job/payout detection, ledger reconciliation
- `stuckJobDetection` worker - Health checks, alerts

---

## 14. ANALYTICS & KPIs

### KPI Snapshots
- `kpi_snapshots` table - Daily snapshots
- Fields: date, total_jobs, completed_jobs, disputed_jobs, cancelled_jobs
- Upsert strategy (ON CONFLICT UPDATE)

### Workers
- `kpiSnapshot` - Basic snapshot (active)
- `kpiDailySnapshot` - Extended metrics (re-enabled)
- `metricsSnapshot` - Metrics snapshot

### Analytics Service
- `analyticsService.ts` - Analytics queries
- `kpiService.ts` - KPI calculations
- `operationalMetricsService.ts` - Operational metrics

---

## 15. SUBSCRIPTIONS

### Subscription System
- `cleaning_subscriptions` table
- `subscriptionJobs` worker - Creates jobs from subscriptions
- Subscription features in `premiumService.ts`

### Subscription Flow
- Client creates subscription
- Worker generates jobs on schedule
- Jobs follow normal lifecycle

### Status
- Subscription worker was disabled, now re-enabled
- Ensure subscriptions table populated before running

---

## 16. PROPERTIES & ADDRESSES

### Properties
- `properties` table - Multi-property support
- `propertiesService.ts` - Property management
- `cleaning_score` field - Property cleanliness score
- Property-linked jobs (job.property_id)

### Addresses
- `addresses` table - User addresses
- Multiple addresses per user
- Default address flag

---

## 17. TEAMS

### Team System
- `cleaner_teams` table - Team definitions
- `team_members` table - Team membership
- `teamsService.ts` - Team management

---

## 18. PREMIUM FEATURES

### Boosts
- `cleaner_boosts` table (referenced)
- `expireBoosts` worker - Expires old boosts
- `premiumService.ts` - Boost management

### Goals
- `cleaner_goals` table (referenced)
- `goalChecker` worker - Checks and awards goals
- `cleanerGoalsService.ts` - Goal management

### Referrals
- `referrals` table (referenced)
- `referralService.ts` - Referral logic
- User referral codes

---

## 19. PHOTOS & EVIDENCE

### Job Photos
- `job_photos` table - Before/after photos
- `jobPhotosService.ts` - Photo management
- `photoRetentionCleanup` worker - 90-day retention cleanup

### Photo Types
- `before` - Before job photos
- `after` - After job photos

---

## 20. STRIPE INTEGRATION

### Stripe Objects
- `payment_intents` - Payment intent tracking
- `stripe_events` - Webhook event deduplication
- `stripe_customers` - Customer records
- `stripe_connect_accounts` - Connect accounts
- `stripe_object_processed` - Deduplication tracking

### Services
- `paymentService.ts` - Payment processing
- `stripeConnectService.ts` - Connect integration
- `webhookRetryService.ts` - Webhook retry logic

### Webhook Handling
- `stripe.ts` route - Webhook endpoint
- `webhookRetry` worker - Retry failed webhooks
- `webhook_failures` table - Retry queue

---

## 21. CORE LIBRARIES

### Core Services
- `core/availabilityService.ts` - Availability logic
- `core/cancellationService.ts` - Cancellation logic
- `core/clientRiskService.ts` - Client risk scoring
- `core/flexibilityService.ts` - Flexibility calculations
- `core/inconvenienceService.ts` - Inconvenience scoring
- `core/matchingService.ts` - Matching algorithm
- `core/reliabilityScoreV2Service.ts` - Reliability v2
- `core/rescheduleService.ts` - Reschedule logic
- `core/rollingWindowService.ts` - Rolling windows
- `core/scoring.ts` - Scoring algorithms
- `core/timeBuckets.ts` - Time bucket calculations

### DB Helpers
- `core/db/availabilityDb.ts` - Availability queries
- `core/db/clientRiskDb.ts` - Client risk queries
- `core/db/matchingDb.ts` - Matching queries
- `core/db/rescheduleDb.ts` - Reschedule queries

---

## 22. MIGRATIONS

### Migration Order (per MIGRATIONS.md)
1. `000_CONSOLIDATED_SCHEMA.sql` - Baseline schema
2. `019_comprehensive_schema_additions.sql` - Additions
3. `020_*` - Additional migrations
4. `021_*` - Additional migrations
5. `022_schema_enhancements.sql` - Enhancements
6. `023_cleaner_portal_invoicing.sql` - Portal invoicing

### Total Migrations: 38 files
- Includes fixes, enhancements, and feature additions
- Some are fix migrations (column renames, FK fixes)

---

## 23. TESTING

### Test Structure
- `src/tests/unit/` - Unit tests
- `src/tests/integration/` - Integration tests
- `src/tests/smoke/` - Smoke tests
- Test helpers in `src/tests/helpers/`

### Key Test Files
- `credits.test.ts` - Credit system tests
- `disputeFlow.test.ts` - Dispute flow tests
- `jobLifecycle.test.ts` - Job lifecycle tests

---

## 24. DEPENDENCIES TO RUN

### Environment Variables Needed
- Database connection (DATABASE_URL)
- Stripe keys (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- Stripe Connect keys (if using)
- Email provider (SENDGRID_API_KEY)
- SMS provider (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
- Push notifications (ONESIGNAL_APP_ID, ONESIGNAL_API_KEY)
- JWT secrets
- Queue/cron configuration

### External Services
- PostgreSQL database
- Stripe (payments, payouts, Connect)
- SendGrid (email)
- Twilio (SMS)
- OneSignal (push)
- Object storage (for photos)
- Cron/queue system (for workers)

### Database Setup
- Run migrations in order (per MIGRATIONS.md)
- Seed initial data (tiers, pricing, thresholds)
- Configure indexes

---

## END OF INVENTORY

This inventory represents everything currently built and present in the codebase as of the time of generation.

