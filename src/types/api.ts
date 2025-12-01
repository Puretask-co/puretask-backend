// src/types/api.ts
// API request/response DTOs and shared types

import type { JobStatus, CleaningType } from "./db";

/**
 * Create Job Request
 */
export interface CreateJobRequest {
  scheduled_start_at: string; // ISO 8601 datetime
  scheduled_end_at?: string; // ISO 8601 datetime
  estimated_hours: number;
  cleaning_type: CleaningType;
  base_rate_cph: number;
  addon_rate_cph?: number;
  total_rate_cph: number;
}

/**
 * Update Job Request
 */
export interface UpdateJobRequest {
  scheduled_start_at?: string;
  scheduled_end_at?: string;
  estimated_hours?: number;
}

/**
 * Job Transition Request
 */
export interface JobTransitionRequest {
  event_type:
    | "job_created"
    | "job_requested"
    | "job_accepted"
    | "cleaner_en_route"
    | "job_started"
    | "job_completed"
    | "client_approved"
    | "client_disputed"
    | "dispute_resolved"
    | "job_cancelled";
  payload?: Record<string, any>;
}

/**
 * Approve Job Request
 */
export interface ApproveJobRequest {
  rating?: number; // 1-5
  notes?: string;
}

/**
 * Dispute Job Request
 */
export interface DisputeJobRequest {
  reason: string;
  details?: string;
}

/**
 * Check-in Request (for job_started event)
 */
export interface CheckInRequest {
  lat: number;
  lng: number;
}

/**
 * Check-out Request (for job_completed event)
 */
export interface CheckOutRequest {
  lat: number;
  lng: number;
  actual_hours: number;
}

/**
 * Admin Override Request
 */
export interface AdminOverrideRequest {
  toStatus: JobStatus;
  reason: string;
}

/**
 * Credit Purchase Request
 */
export interface PurchaseCreditsRequest {
  credits_amount: number;
  payment_method_id?: string; // Stripe payment method
}

/**
 * Standard API Response
 */
export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

