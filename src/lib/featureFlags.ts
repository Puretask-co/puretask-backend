// src/lib/featureFlags.ts
// Section 14: Feature flags for staged rollout and kill switches

import { env } from "../config/env";

/**
 * Feature flags for launch readiness (Section 14).
 * Use env vars for now; can be replaced with LaunchDarkly/Unleash later.
 */
export const featureFlags = {
  /** Bookings can be created. Default: true. */
  get bookingsEnabled(): boolean {
    return env.BOOKINGS_ENABLED;
  },
  /** Payouts to cleaners. Default: false (opt-in). */
  get payoutsEnabled(): boolean {
    return env.PAYOUTS_ENABLED;
  },
  /** Credit purchases. Default: true. */
  get creditsEnabled(): boolean {
    return env.CREDITS_ENABLED;
  },
  /** Refunds. Default: true. */
  get refundsEnabled(): boolean {
    return env.REFUNDS_ENABLED;
  },
  /** Background workers. Default: true. */
  get workersEnabled(): boolean {
    return env.WORKERS_ENABLED;
  },
  /** Event-based notifications (n8n). Default: true if configured. */
  get eventNotificationsEnabled(): boolean {
    return env.USE_EVENT_BASED_NOTIFICATIONS;
  },
} as const;

/**
 * Kill switch: block payment operations (Section 14).
 */
export function isPaymentKillSwitchActive(): boolean {
  return !env.PAYOUTS_ENABLED && env.NODE_ENV === "production";
}

/**
 * Kill switch: block booking creation.
 */
export function isBookingKillSwitchActive(): boolean {
  return !env.BOOKINGS_ENABLED;
}

/**
 * Check if a feature is enabled before proceeding.
 */
export function requireFeature(
  name: keyof typeof featureFlags,
  action: string
): void {
  const enabled = featureFlags[name];
  if (!enabled) {
    throw new Error(`Feature ${name} is disabled. Cannot ${action}.`);
  }
}
