/**
 * Canonical job status and transitions — single source of truth for backend, frontend, and n8n.
 * Backend: import from here or from ../state/jobStateMachine (same data).
 * Frontend/n8n: use the JSON-safe constants below or GET /config/job-status if we add that route.
 */

import type { JobStatus } from "../types/db";
import {
  type JobEventType,
  allowedTransitions,
  eventPermissions,
} from "../state/jobStateMachine";

export type { JobStatus, JobEventType };

/** All valid job statuses in order of typical flow. Terminal: completed, disputed, cancelled. */
export const JOB_STATUSES: readonly JobStatus[] = [
  "requested",
  "accepted",
  "on_my_way",
  "in_progress",
  "awaiting_approval",
  "completed",
  "disputed",
  "cancelled",
] as const;

/** All events that drive status transitions. */
export const JOB_EVENT_TYPES: readonly JobEventType[] = [
  "job_created",
  "job_accepted",
  "cleaner_on_my_way",
  "job_started",
  "job_completed",
  "client_approved",
  "client_disputed",
  "dispute_resolved_refund",
  "dispute_resolved_no_refund",
  "job_cancelled",
] as const;

/** Transition matrix: from status -> event -> next status. JSON-serializable for frontend/n8n. */
export const TRANSITIONS_MATRIX: Record<string, Record<string, string>> = (() => {
  const out: Record<string, Record<string, string>> = {};
  for (const [from, map] of Object.entries(allowedTransitions)) {
    out[from] = { ...(map as Record<string, string>) };
  }
  return out;
})();

/** Who can trigger each event. JSON-serializable. */
export const EVENT_PERMISSIONS: Record<string, string[]> = { ...eventPermissions };

/** Canonical payload for frontend/n8n (e.g. GET /config/job-status or shared constants). */
export const JOB_STATUS_CANONICAL = {
  statuses: [...JOB_STATUSES],
  events: [...JOB_EVENT_TYPES],
  transitions: TRANSITIONS_MATRIX,
  eventPermissions: EVENT_PERMISSIONS,
} as const;
