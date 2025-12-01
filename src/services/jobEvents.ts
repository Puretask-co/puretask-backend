// src/services/jobEvents.ts
// Job events logging using job_events table from 001_init.sql

import { query } from "../db/client";
import { JobEvent, ActorType } from "../types/db";

export type { ActorType };

export interface LogJobEventParams {
  jobId?: string | null;
  actorType?: ActorType | null;
  actorId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}

/**
 * Log a job event to job_events table
 * Matches 001_init.sql schema: (id, job_id, actor_type, actor_id, event_type, payload, created_at)
 */
export async function logJobEvent(params: LogJobEventParams): Promise<void> {
  const {
    jobId = null,
    actorType = null,
    actorId = null,
    eventType,
    payload = {},
  } = params;

  await query(
    `
      INSERT INTO job_events (
        job_id,
        actor_type,
        actor_id,
        event_type,
        payload
      )
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `,
    [jobId, actorType, actorId, eventType, JSON.stringify(payload)]
  );
}

/**
 * Get all events for a specific job
 */
export async function getJobEventsForJob(
  jobId: string
): Promise<JobEvent[]> {
  const result = await query<JobEvent>(
    `
      SELECT *
      FROM job_events
      WHERE job_id = $1
      ORDER BY created_at DESC
    `,
    [jobId]
  );

  return result.rows;
}

/**
 * Get events by event type
 */
export async function getEventsByType(
  eventType: string,
  limit: number = 100
): Promise<JobEvent[]> {
  const result = await query<JobEvent>(
    `
      SELECT *
      FROM job_events
      WHERE event_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [eventType, limit]
  );

  return result.rows;
}

/**
 * Get events by actor
 */
export async function getEventsByActor(
  actorId: string,
  limit: number = 100
): Promise<JobEvent[]> {
  const result = await query<JobEvent>(
    `
      SELECT *
      FROM job_events
      WHERE actor_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [actorId, limit]
  );

  return result.rows;
}
