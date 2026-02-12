/**
 * Pure metric boundary functions for gamification.
 * Used by cleanerLevelService and unit-tested for spec compliance.
 * See docs/active/METRICS_CONTRACT.md and docs/active/SPEC_REQUIREMENTS_MATRIX.md
 */

import { env } from "../config/env";

/** Check if clock-in time is within on-time window (±early/late minutes of scheduled start) */
export function isOnTime(
  clockInAt: Date,
  scheduledStartAt: Date,
  earlyMin = env.ON_TIME_EARLY_MINUTES ?? 15,
  lateMin = env.ON_TIME_LATE_MINUTES ?? 15
): boolean {
  const earlyBound = new Date(scheduledStartAt.getTime() - earlyMin * 60 * 1000);
  const lateBound = new Date(scheduledStartAt.getTime() + lateMin * 60 * 1000);
  return clockInAt >= earlyBound && clockInAt <= lateBound;
}

/** Check if job qualifies for good-faith decline due to short notice (< 18h from request to start) */
export function isShortNotice(
  requestSentAt: Date,
  jobStartAt: Date,
  thresholdHours = env.GOOD_FAITH_SHORT_NOTICE_HOURS ?? 18
): boolean {
  const hoursDiff = (jobStartAt.getTime() - requestSentAt.getTime()) / (1000 * 60 * 60);
  return hoursDiff < thresholdHours;
}

/** Check if message qualifies as meaningful (≥ min chars) */
export function isMeaningfulMessage(body: string, minChars = 25): boolean {
  return (body || "").trim().length >= minChars;
}

/** Check if photo timestamps fall within job window (clock-in to clock-out) */
export function isPhotoWithinJobWindow(
  photoCreatedAt: Date,
  clockInAt: Date,
  clockOutAt: Date
): boolean {
  return photoCreatedAt >= clockInAt && photoCreatedAt <= clockOutAt;
}

/** Good-faith decline limit: max count per 7 days */
export const GOOD_FAITH_DECLINE_LIMIT_PER_7_DAYS = 6;
