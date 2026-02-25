// src/types/jobDetails.ts
// Response shape for GET /jobs/:jobId/details (single-call job-details API).
// Reuses Job and CreditLedgerEntry from db; defines DTOs for nested/related data.

import type { Job, CreditLedgerEntry } from "./db";

/**
 * Cleaner subset returned in job details (users + cleaner_profiles; optional level, badges).
 * Also used for GET /cleaners/:id response as CleanerProfileResponse.
 */
export interface JobDetailsCleaner {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  base_rate_cph: number | null;
  reliability_score: number | null;
  tier: string | null;
  avg_rating: number | null;
  jobs_completed: number;
  level?: number | null;
  badges?: Array<{ id: string; name: string; icon?: string | null }>;
}

/** Response shape for GET /cleaners/:id (shared with job-details cleaner). */
export type CleanerProfileResponse = JobDetailsCleaner;

/**
 * Check-in/check-out record (from job_checkins).
 */
export interface JobDetailsCheckin {
  id: string;
  job_id: string;
  cleaner_id: string;
  type: string;
  lat: number | null;
  lng: number | null;
  distance_from_job_meters: number | null;
  is_within_radius: boolean | null;
  created_at: string;
}

/**
 * Job photo (from job_photos).
 */
export interface JobDetailsPhoto {
  id: string;
  job_id: string;
  uploaded_by: string;
  type: string;
  url: string;
  thumbnail_url: string | null;
  created_at: string;
}

/**
 * Payment intent subset for job charge (from payment_intents).
 */
export interface JobDetailsPaymentIntent {
  id: string;
  job_id: string | null;
  client_id: string | null;
  stripe_payment_intent_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  purpose: string;
  credits_amount: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Payout subset (from payouts).
 */
export interface JobDetailsPayout {
  id: string;
  cleaner_id: string;
  job_id: string | null;
  stripe_transfer_id: string | null;
  amount_credits: number;
  amount_cents: number;
  total_usd: number;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Credits-held and top-up fields for job details (client wallet context).
 * Present when job has a client; derived from ledger + job.credit_amount.
 */
export interface JobDetailsCredits {
  /** Credits held in escrow for this job (job.credit_amount). */
  credits_held: number;
  /** Client's current credit balance (SUM delta_credits from credit_ledger). */
  balance_after_hold: number;
  /** True when client balance < 0 (needs top-up for future use). */
  top_up_required: boolean;
}

/**
 * Full response payload for GET /jobs/:jobId/details.
 */
export interface JobDetailsResponse {
  job: Job;
  cleaner: JobDetailsCleaner | null;
  checkins: JobDetailsCheckin[];
  photos: JobDetailsPhoto[];
  ledgerEntries: CreditLedgerEntry[];
  paymentIntent: JobDetailsPaymentIntent | null;
  payout: JobDetailsPayout | null;
  /** Credits context for client (held for this job, balance, top-up flag). Omitted if no client or credits disabled. */
  credits?: JobDetailsCredits;
}
