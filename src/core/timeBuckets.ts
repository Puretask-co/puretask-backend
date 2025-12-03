// src/core/timeBuckets.ts
// Time bucket calculations for cancellation and rescheduling

import { TimeBucket, CancellationWindow } from './types';

/**
 * Calculate hours difference between two dates
 */
export function hoursDiff(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60 * 60);
}

/**
 * Calculate minutes difference between two dates
 */
export function minutesDiff(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60);
}

/**
 * Calculate days ago from a reference date
 */
export function daysAgo(date: Date, now: Date): number {
  const diffMs = now.getTime() - date.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Compute cancellation / reschedule time bucket.
 * If hoursBefore < 0 => treat as lt24 for cancellation logic; no_show handled elsewhere.
 * 
 * Time windows per policy:
 * - >48 hours: free cancellation
 * - 24-48 hours: 50% fee
 * - <24 hours: 100% fee
 */
export function getTimeBucket(hoursBefore: number): TimeBucket {
  if (hoursBefore === Infinity) return 'gt48';
  if (hoursBefore > 48) return 'gt48';
  if (hoursBefore >= 24) return '24_48';
  if (hoursBefore >= 0) return 'lt24';
  return 'lt24';
}

/**
 * Returns hours_before_start (t_start - t_cancel)
 */
export function computeHoursBeforeStart(
  scheduledStart: Date,
  cancelTime: Date
): number {
  return hoursDiff(cancelTime, scheduledStart);
}

/**
 * Compute cancellation window from hours before
 */
export function computeWindow(hoursBefore: number): CancellationWindow | null {
  if (hoursBefore > 48) return 'free';
  if (hoursBefore > 24) return '50%';
  if (hoursBefore > 0) return '100%';
  return null; // past start -> no-show territory
}

/**
 * Get base fee percentage for a cancellation window
 */
export function baseFeePctForWindow(window: CancellationWindow | null): number {
  if (window === 'free' || window === null) return 0;
  if (window === '50%') return 50;
  if (window === '100%') return 100;
  return 0;
}

/**
 * Convert time bucket to readable string
 */
export function bucketToString(bucket: TimeBucket): string {
  switch (bucket) {
    case 'gt48': return '>48 hours';
    case '24_48': return '24-48 hours';
    case 'lt24': return '<24 hours';
    case 'no_show': return 'No-show';
    default: return 'Unknown';
  }
}

