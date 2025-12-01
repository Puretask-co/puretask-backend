// src/lib/events.ts
// Centralized event publishing system for PureTask
// Uses job_events table from 001_init.sql
// Wires events to notifications and n8n

import { query } from "../db/client";
import { logger } from "./logger";
import { env } from "../config/env";
import { postJson } from "./httpClient";
import { JobEvent, ActorType, Job } from "../types/db";

export type JobEventType =
  | "job_created"
  | "job_accepted"
  | "cleaner_on_my_way"
  | "job_started"
  | "job_completed"
  | "client_approved"
  | "client_disputed"
  | "dispute_resolved_refund"
  | "dispute_resolved_no_refund"
  | "job_cancelled"
  | "job_auto_cancelled"
  | "job_overridden"
  | "payment_succeeded";

export interface PublishEventInput {
  jobId?: string | null;
  actorType?: ActorType | null;
  actorId?: string | null;
  eventName: JobEventType | string;
  payload?: Record<string, unknown>;
}

/**
 * Publish an application event to job_events table
 * Matches 001_init.sql schema: (id, job_id, actor_type, actor_id, event_type, payload, created_at)
 */
export async function publishEvent(input: PublishEventInput): Promise<void> {
  const {
    jobId = null,
    actorType = null,
    actorId = null,
    eventName,
    payload = {},
  } = input;

  const payloadJson = JSON.stringify(payload);

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
    [jobId, actorType, actorId, eventName, payloadJson]
  );

  logger.info("job_event_published", {
    jobId,
    eventName,
    actorType,
    actorId,
  });

  // Send notifications for key events
  await maybeSendNotifications(jobId, eventName, payload);

  // Forward to n8n webhook if configured
  await maybeForwardToN8n(jobId, actorType, actorId, eventName, payload);
}

/**
 * Send notifications for key job events
 */
async function maybeSendNotifications(
  jobId: string | null,
  eventName: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!jobId) return;

  try {
    // Dynamically import to avoid circular dependencies
    const { sendNotification } = await import("../services/notifications");

    // Map events to notification types
    const notificationEvents = [
      "job_accepted",
      "cleaner_on_my_way",
      "job_started",
      "job_completed",
      "client_approved",
      "client_disputed",
    ];

    if (!notificationEvents.includes(eventName)) {
      return;
    }

    // Get job to find client/cleaner
    const jobResult = await query<Job>(
      `SELECT * FROM jobs WHERE id = $1`,
      [jobId]
    );
    const job = jobResult.rows[0];
    if (!job) return;

    // Determine who to notify based on event
    let targetUserId: string | null = null;

    switch (eventName) {
      case "job_accepted":
      case "cleaner_on_my_way":
      case "job_started":
      case "job_completed":
        // Notify client about cleaner actions
        targetUserId = job.client_id;
        break;
      case "client_approved":
      case "client_disputed":
        // Notify cleaner about client actions
        targetUserId = job.cleaner_id;
        break;
    }

    if (!targetUserId) return;

    // Get user contact info
    const userResult = await query<{ email: string }>(
      `SELECT email FROM users WHERE id = $1`,
      [targetUserId]
    );
    const user = userResult.rows[0];
    if (!user) return;

    // Send notification (non-blocking)
    await sendNotification({
      userId: targetUserId,
      email: user.email,
      channel: "email",
      type: eventName as any,
      data: {
        jobId,
        address: job.address,
        creditAmount: job.credit_amount,
        ...payload,
      },
    });

    // Also send push if it's an urgent event
    const pushEvents = ["cleaner_on_my_way", "job_started", "job_completed"];
    if (pushEvents.includes(eventName)) {
      await sendNotification({
        userId: targetUserId,
        channel: "push",
        type: eventName as any,
        data: {
          jobId,
          address: job.address,
          ...payload,
        },
      });
    }
  } catch (err) {
    logger.error("event_notification_failed", {
      jobId,
      eventName,
      error: (err as Error).message,
    });
  }
}

/**
 * Forward event to n8n webhook
 */
async function maybeForwardToN8n(
  jobId: string | null,
  actorType: ActorType | null,
  actorId: string | null,
  eventName: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!env.N8N_WEBHOOK_URL) return;

  try {
    await postJson(env.N8N_WEBHOOK_URL, {
      jobId,
      actorType,
      actorId,
      eventName,
      payload,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("n8n_forward_failed", {
      error: (err as Error).message,
      jobId,
      eventName,
    });
  }
}

/**
 * Get events for a specific job
 */
export async function getJobEvents(jobId: string, limit: number = 100): Promise<JobEvent[]> {
  const result = await query<JobEvent>(
    `
      SELECT *
      FROM job_events
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [jobId, limit]
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
