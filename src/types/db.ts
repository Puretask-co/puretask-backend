// src/types/db.ts
// TypeScript type definitions matching 001_init.sql schema exactly

// -------------------------
// ENUM TYPES
// -------------------------

export type UserRole = "client" | "cleaner" | "admin";

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
  | "job_escrow"
  | "job_release"
  | "refund"
  | "adjustment";

export type ActorType = "client" | "cleaner" | "system" | "admin";

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
  created_at: string;
  updated_at: string;
}

/**
 * Client profiles table
 */
export interface ClientProfile {
  id: string;
  user_id: string;
  default_address: string | null;
  stripe_customer_id: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Cleaner profiles table
 */
export interface CleanerProfile {
  id: string;
  user_id: string;
  tier: string; // bronze/silver/gold/platinum
  reliability_score: number; // 0-100
  hourly_rate_credits: number;
  stripe_connect_id: string | null;
  stripe_account_id: string | null; // Alias for stripe_connect_id
  push_token: string | null;
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
  status: JobStatus;
  scheduled_start_at: string;
  scheduled_end_at: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  credit_amount: number;
  rating: number | null; // 1-5
  client_notes: string | null;
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
