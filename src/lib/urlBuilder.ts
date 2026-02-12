// src/lib/urlBuilder.ts
// URL builder utilities for notifications and deep links
// All URLs are role-correct and include proper auth handling

import { env } from "../config/env";

const APP_URL = env.APP_URL || "http://localhost:3000";

/**
 * Build a client-facing job URL
 * Note: returnTo is handled by frontend middleware, not included in notification links
 */
export function buildClientJobUrl(jobId: string): string {
  return `${APP_URL}/client/jobs/${jobId}`;
}

/**
 * Build a cleaner-facing job URL
 * Note: returnTo is handled by frontend middleware, not included in notification links
 */
export function buildCleanerJobUrl(jobId: string): string {
  return `${APP_URL}/cleaner/jobs/${jobId}`;
}

/**
 * Build a role-agnostic job URL (uses generic /jobs/:id)
 * Frontend should handle role routing
 * Note: returnTo is handled by frontend middleware, not included in notification links
 */
export function buildJobUrl(jobId: string): string {
  return `${APP_URL}/jobs/${jobId}`;
}

/**
 * Build a cleaner check-in URL
 * This is the URL cleaners use to check in when they arrive
 * Note: returnTo is handled by frontend middleware, not included in notification links
 */
export function buildCheckInUrl(jobId: string): string {
  return `${APP_URL}/cleaner/jobs/${jobId}/check-in`;
}

/**
 * Build a payment method update URL
 * For clients to update their payment method
 * Note: Matches frontend route /client/billing
 */
export function buildPaymentUrl(returnTo?: string): string {
  const base = `${APP_URL}/client/billing`;
  if (returnTo) {
    return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
  }
  return base;
}

/**
 * Build a subscription management URL
 * For clients to manage their subscription
 * Note: returnTo is handled by frontend middleware, not included in notification links
 */
export function buildSubscriptionUrl(): string {
  return `${APP_URL}/client/subscription`;
}

/**
 * Build a support/help URL
 * Note: returnTo is handled by frontend middleware, not included in notification links
 */
export function buildSupportUrl(): string {
  return `${APP_URL}/support`;
}

/**
 * Build a password reset URL
 * Note: This should include the reset token, not just the base URL
 */
export function buildPasswordResetUrl(token: string): string {
  return `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Build a role-correct job URL based on user role
 * This is the main function to use when you know the user's role
 * Note: returnTo is handled by frontend middleware, not included in notification links
 */
export function buildRoleCorrectJobUrl(
  jobId: string,
  userRole: "client" | "cleaner" | "admin"
): string {
  switch (userRole) {
    case "client":
      return buildClientJobUrl(jobId);
    case "cleaner":
      return buildCleanerJobUrl(jobId);
    case "admin":
      // Admins can use either, default to client view
      return buildClientJobUrl(jobId);
    default:
      return buildJobUrl(jobId);
  }
}
