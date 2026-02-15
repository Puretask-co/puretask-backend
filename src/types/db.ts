// src/types/db.ts
// TypeScript type definitions matching 001_init.sql schema exactly

// -------------------------
// ENUM TYPES
// -------------------------

export type UserRole =
  | "client"
  | "cleaner"
  | "admin"
  | "super_admin"
  | "support_agent"
  | "support_lead"
  | "ops_finance";

export type JobStatus =
  | "requested"
  | "accepted"
  | "on_my_way"
  | "in_progress"
  | "awaiting_approval"
  | "completed"
  | "disputed"
  | "cancelled";

export type PayoutStatus = "pending" | "paid" | "failed";

export type DisputeStatus = "open" | "resolved_refund" | "resolved_no_refund";

export type CreditReason =
  | "purchase"
  | "subscription_credit"
  | "job_escrow"
  | "job_release"
  | "refund"
  | "adjustment"
  | "invoice_payment";

export type ActorType = "client" | "cleaner" | "system" | "admin";

export type PhotoType = "before" | "after";

export type CleaningType = "basic" | "deep" | "move_out" | "recurring";

// -------------------------
// TABLE TYPES
// -------------------------

/**
 * Users table
 */
export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  // Email verification
  email_verified: boolean;
  email_verification_token: string | null;
  email_verification_token_expires_at: string | null;
  email_verified_at: string | null;
  // Password reset
  password_reset_token: string | null;
  password_reset_token_expires_at: string | null;
  password_reset_at: string | null;
  password_changed_at: string | null;
  // Two-factor authentication
  two_factor_enabled: boolean;
  two_factor_method: "totp" | "sms" | null;
  two_factor_secret: string | null;
  two_factor_phone: string | null;
  two_factor_backup_codes: string[] | null;
  two_factor_enabled_at: string | null;
  // Login tracking
  last_login_at: string | null;
  last_login_ip: string | null;
  // Account lockout
  locked_until: string | null;
  failed_login_attempts: number;
  last_failed_login_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Client profiles table
 */
export interface ClientProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  default_address: string | null;
  stripe_customer_id: string | null;
  push_token: string | null;
  grace_cancellations_total: number;
  grace_cancellations_used: number;
  created_at: string;
  updated_at: string;
}

/**
 * Cleaner profiles table
 */
export interface CleanerProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  tier: string; // bronze/silver/gold/platinum OR Developing/Semi Pro/Pro/Elite
  reliability_score: number; // 0-100
  hourly_rate_credits: number;
  base_rate_cph: number | null;
  deep_addon_cph: number | null;
  moveout_addon_cph: number | null;
  avg_rating: number | null;
  jobs_completed: number;
  low_flexibility_badge: boolean;
  payout_percent: number;
  stripe_connect_id: string | null;
  stripe_account_id: string | null; // Alias for stripe_connect_id
  push_token: string | null;
  latitude: number | null;
  longitude: number | null;
  is_available: boolean;
  travel_radius_km: number | null;
  max_jobs_per_day: number | null;
  accepts_high_risk: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Jobs table
 */
export interface Job {
  id: string;
  client_id: string;
  cleaner_id: string | null;
  address_id: string | null;
  status: JobStatus;
  scheduled_start_at: string;
  scheduled_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  credit_amount: number;
  cleaning_type: CleaningType | null;
  duration_hours: number | null;
  price_credits: number | null;
  held_credits: number;
  cleaner_payout_amount_cents: number | null;
  rating: number | null; // 1-5
  client_notes: string | null;
  notes_cleaner: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Job events table - audit log
 */
export interface JobEvent {
  id: string;
  job_id: string;
  actor_type: ActorType;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Credit ledger table - source of truth for balances
 * balance = SUM(delta_credits) per user_id
 */
export interface CreditLedgerEntry {
  id: string;
  user_id: string;
  job_id: string | null;
  delta_credits: number; // + added, - deducted
  reason: CreditReason;
  created_at: string;
}

/**
 * Payment intents table
 */
export interface PaymentIntent {
  id: string;
  job_id: string | null;
  client_id: string | null;
  stripe_payment_intent_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  purpose: "wallet_topup" | "job_charge";
  credits_amount: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Stripe events table
 */
export interface StripeEvent {
  id: string;
  stripe_event_id: string;
  type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
  processed_at: string | null;
}

/**
 * Payouts table
 */
export interface Payout {
  id: string;
  cleaner_id: string;
  job_id: string;
  stripe_transfer_id: string | null;
  amount_credits: number;
  amount_cents: number;
  total_usd: number;
  status: PayoutStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Disputes table
 */
export interface Dispute {
  id: string;
  job_id: string;
  client_id: string;
  status: DisputeStatus;
  client_notes: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * KPI snapshots table
 */
export interface KpiSnapshot {
  id: string;
  date: string;
  total_jobs: number;
  completed_jobs: number;
  disputed_jobs: number;
  cancelled_jobs: number;
  created_at: string;
}

/**
 * Notification failures table
 */
export interface NotificationFailure {
  id: string;
  user_id: string | null;
  channel: string; // sms/email/push
  type: string;
  payload: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  last_attempt_at: string | null;
  created_at: string;
}

/**
 * Job photos table
 */
export interface JobPhoto {
  id: string;
  job_id: string;
  uploaded_by: string;
  type: "before" | "after";
  url: string;
  thumbnail_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Backup snapshot table
 */
export interface BackupSnapshot {
  id: string;
  label: string;
  created_at: string;
  metadata: Record<string, unknown>;
  data: Record<string, unknown>;
}

/**
 * Messages table
 */
export interface Message {
  id: string;
  job_id: string;
  sender_type: ActorType;
  sender_id: string;
  content: string;
  is_read: boolean; // Matches schema column name
  read_at: string | null; // Timestamp when message was read
  attachments?: any; // JSONB array of attachments
  created_at: string;
}

/**
 * Cleaner earnings table
 */
export interface CleanerEarning {
  id: string;
  cleaner_id: string;
  job_id: string;
  amount_credits: number;
  amount_cents: number;
  status: PayoutStatus;
  created_at: string;
}

/**
 * Webhook failures table for retry queue
 */
export interface WebhookFailure {
  id: string;
  source: string;
  event_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  status: "pending" | "processing" | "succeeded" | "failed" | "dead";
  created_at: string;
  updated_at: string;
}

/**
 * Cleaner availability table
 */
export interface CleanerAvailability {
  id: string;
  cleaner_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, etc.
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Cleaner time off / blocked dates
 */
export interface CleanerTimeOff {
  id: string;
  cleaner_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
}

/**
 * Addresses table
 */
export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Stripe customers table
 */
export interface StripeCustomer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  default_payment_method_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Stripe Connect accounts table
 */
export interface StripeConnectAccount {
  id: string;
  cleaner_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Job status history table
 */
export interface JobStatusHistory {
  id: string;
  job_id: string;
  from_status: string | null;
  to_status: string;
  changed_by_user_id: string | null;
  changed_by_type: ActorType | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Job checkins table
 */
export interface JobCheckin {
  id: string;
  job_id: string;
  cleaner_id: string;
  type: "check_in" | "check_out";
  lat: number | null;
  lng: number | null;
  distance_from_job_meters: number | null;
  is_within_radius: boolean | null;
  device_info: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Dispute actions table
 */
export interface DisputeAction {
  id: string;
  dispute_id: string;
  actor_user_id: string | null;
  actor_type: ActorType;
  action: string;
  details: Record<string, unknown>;
  attachments: unknown[];
  created_at: string;
}

/**
 * Payout requests table
 */
export interface PayoutRequest {
  id: string;
  cleaner_id: string;
  amount_credits: number;
  amount_cents: number;
  status: "pending" | "approved" | "rejected" | "processing" | "completed" | "failed";
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  rejection_reason: string | null;
  payout_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Reliability snapshots table
 */
export interface ReliabilitySnapshot {
  id: string;
  cleaner_id: string;
  score: number;
  tier: string | null;
  inputs: Record<string, unknown>;
  breakdown: Record<string, unknown> | null;
  computed_at: string;
  created_at: string;
}

/**
 * Cleaner tier history table
 */
export interface CleanerTierHistory {
  id: string;
  cleaner_id: string;
  from_tier: string | null;
  to_tier: string;
  reason: string | null;
  triggered_by: "system" | "admin" | null;
  triggered_by_user_id: string | null;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

/**
 * Notification templates table
 */
export interface NotificationTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  channel: "email" | "sms" | "push" | "in_app";
  subject: string | null;
  title: string | null;
  body: string;
  variables: unknown[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Admin audit log table
 */
export interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Credit accounts table
 */
export interface CreditAccount {
  id: string;
  user_id: string;
  current_balance: number;
  held_balance: number;
  lifetime_purchased: number;
  lifetime_spent: number;
  lifetime_refunded: number;
  created_at: string;
  updated_at: string;
}

/**
 * Credit transactions table
 */
export interface CreditTransaction {
  id: string;
  account_id: string;
  amount: number;
  balance_after: number;
  type: "purchase" | "hold" | "release" | "refund" | "adjustment" | "payout" | "bonus" | "expiry";
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * User preferences table
 */
export interface UserPreferences {
  id: string;
  user_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
  language: string;
  timezone: string;
  currency: string;
  // Auth notification preferences
  notify_login_from_new_device: boolean;
  notify_password_changed: boolean;
  notify_email_changed: boolean;
  notify_2fa_disabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Reviews table
 */
export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_type: "client" | "cleaner";
  rating: number;
  comment: string | null;
  is_public: boolean;
  response: string | null;
  response_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Risk bands for clients
 */
export type ClientRiskBand = "normal" | "mild" | "elevated" | "high" | "critical";

/**
 * Client risk score table
 */
export interface ClientRiskScore {
  client_id: string;
  risk_score: number;
  risk_band: ClientRiskBand;
  last_recomputed_at: string;
}

/**
 * Reschedule status
 */
export type RescheduleStatus = "pending" | "accepted" | "declined" | "expired";

/**
 * Reschedule bucket
 */
export type RescheduleBucket = "lt24" | "24_48" | "gt48";

/**
 * Reschedule events table
 */
export interface RescheduleEvent {
  id: string;
  job_id: string;
  client_id: string;
  cleaner_id: string;
  requested_by: "client" | "cleaner";
  requested_to: "client" | "cleaner";
  t_request: string;
  t_start_original: string;
  t_start_new: string;
  hours_before_original: number;
  bucket: RescheduleBucket;
  reason_code: string | null;
  status: RescheduleStatus;
  declined_by: "client" | "cleaner" | null;
  decline_reason_code: string | null;
  is_reasonable: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Cancellation events table
 */
export interface CancellationEvent {
  id: string;
  job_id: string;
  client_id: string | null;
  cleaner_id: string | null;
  cancelled_by: "client" | "cleaner" | "system" | "admin";
  type: string | null;
  t_cancel: string;
  hours_before_start: number | null;
  bucket: string | null;
  reason_code: string | null;
  after_reschedule_declined: boolean;
  fee_pct: number;
  fee_credits: number;
  refund_credits: number;
  cleaner_comp_credits: number;
  platform_comp_credits: number;
  grace_used: boolean;
  bonus_credits_to_client: number;
  is_emergency: boolean;
  job_status_at_cancellation: string | null;
  created_at: string;
}

/**
 * Inconvenience logs table
 */
export interface InconvenienceLog {
  id: string;
  job_id: string;
  client_id: string;
  cleaner_id: string;
  caused_by: "client" | "cleaner";
  score: number; // 1-4
  reason_link: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Cleaner flexibility profile table
 */
export interface CleanerFlexProfile {
  cleaner_id: string;
  reasonable_declines_14d: number;
  reasonable_declines_30d: number;
  low_flexibility_active: boolean;
  badge_assigned_at: string | null;
  badge_removed_at: string | null;
  last_evaluated_at: string;
}

/**
 * Client flexibility profile table
 */
export interface ClientFlexProfile {
  client_id: string;
  flex_score: number;
  reschedules_30d: number;
  late_reschedules_30d: number;
  cancellations_30d: number;
  last_computed_at: string;
  metadata: Record<string, unknown> | null;
}

// -------------------------
// UTILITY TYPES
// -------------------------

/**
 * User with balance (computed from credit_ledger)
 */
export interface UserWithBalance extends User {
  credit_balance: number;
}

/**
 * Job with related data
 */
export interface JobWithDetails extends Job {
  client_email?: string;
  cleaner_email?: string;
}

/**
 * Create job input
 */
export interface CreateJobInput {
  client_id: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  address: string;
  latitude?: number;
  longitude?: number;
  credit_amount: number;
  client_notes?: string;
}

/**
 * Event for publishing
 */
export interface PublishEventInput {
  job_id?: string;
  actor_type: ActorType;
  actor_id?: string;
  event_type: string;
  payload?: Record<string, unknown>;
}

// -------------------------
// AUTH ENHANCEMENT TYPES
// -------------------------

/**
 * User sessions table (JWT tracking and revocation)
 */
export interface UserSession {
  id: string;
  user_id: string;
  token_jti: string;
  device_info: Record<string, unknown> | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  last_activity_at: string;
  expires_at: string;
  revoked: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}

/**
 * OAuth accounts table (Google, Facebook, etc.)
 */
export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: "google" | "facebook" | "apple" | "github";
  provider_account_id: string;
  provider_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  profile_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Two-factor codes table (SMS 2FA)
 */
export interface TwoFactorCode {
  id: string;
  user_id: string;
  code: string;
  method: "sms" | "totp";
  phone: string | null;
  used: boolean;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Security events table (audit log)
 */
export interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  status: "success" | "failed" | "suspicious";
  ip_address: string | null;
  user_agent: string | null;
  device_info: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Login attempts table
 */
export interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string;
  success: boolean;
  user_agent: string | null;
  failure_reason: string | null;
  created_at: string;
}

/**
 * Email change requests table
 */
export interface EmailChangeRequest {
  id: string;
  user_id: string;
  old_email: string;
  new_email: string;
  verification_token: string;
  token_expires_at: string;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
}

/**
 * Trusted devices table
 */
export interface TrustedDevice {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_name: string | null;
  device_info: Record<string, unknown> | null;
  ip_address: string | null;
  last_used_at: string;
  trusted_at: string;
  expires_at: string | null;
  revoked: boolean;
  revoked_at: string | null;
  created_at: string;
}
