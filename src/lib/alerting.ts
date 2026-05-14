// src/lib/alerting.ts
// Lightweight alerting helpers for Slack webhook and SendGrid email (if configured)

import { env } from "../config/env";
import { logger } from "./logger";

// ============================================
// Error-spike detector
// ============================================
// Per-instance rolling counter; when 5xx errors exceed the threshold in a
// sliding minute, fire sendAlert(). Each replica detects spikes
// independently — that's intentional: N alerts confirm the spike is real,
// not a single-replica anomaly.
//
// See docs/active/AUDIT_REANALYSIS_2026-05-13.md § B.12.
const ERROR_SPIKE_THRESHOLD = parseInt(process.env.ERROR_SPIKE_THRESHOLD ?? "10", 10);
const ERROR_SPIKE_WINDOW_MS = 60_000;
const ERROR_ALERT_COOLDOWN_MS = 5 * 60_000;

let errorTimestamps: number[] = [];
let lastSpikeAlertAt = 0;

/**
 * Record an unhandled error for the rolling-window spike detector.
 * Call from the global error middleware.
 */
export function recordErrorForAlerting(
  err: Error & { code?: string; statusCode?: number },
  req: { path: string; method: string }
): void {
  const status = err.statusCode ?? 500;
  // Only track server-side errors — 4xx is user input, not a system spike.
  if (status < 500) return;

  const now = Date.now();
  errorTimestamps.push(now);
  // Drop anything outside the window.
  while (errorTimestamps.length > 0 && now - errorTimestamps[0]! > ERROR_SPIKE_WINDOW_MS) {
    errorTimestamps.shift();
  }

  if (
    errorTimestamps.length >= ERROR_SPIKE_THRESHOLD &&
    now - lastSpikeAlertAt > ERROR_ALERT_COOLDOWN_MS
  ) {
    lastSpikeAlertAt = now;
    void sendAlert({
      level: "critical",
      title: "Server error spike",
      message: `${errorTimestamps.length} unhandled 5xx in the last minute (threshold: ${ERROR_SPIKE_THRESHOLD})`,
      details: {
        recentPath: req.path,
        recentMethod: req.method,
        recentCode: err.code,
        recentMessage: err.message,
        windowMs: ERROR_SPIKE_WINDOW_MS,
        cooldownMs: ERROR_ALERT_COOLDOWN_MS,
      },
    });
  }
}

interface AlertParams {
  level: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  details?: Record<string, unknown>;
}

export async function sendAlert(params: AlertParams): Promise<void> {
  const { level, title, message, details = {} } = params;

  // Always log
  logger.warn("system_alert", { level, title, message, details });

  const payload = {
    level,
    title,
    message,
    details,
    timestamp: new Date().toISOString(),
  };

  await Promise.all([sendSlackAlert(payload), sendEmailAlert(payload)]);
}

// Convenience templates
export const alertTemplates = {
  payoutHold: (
    payoutId: string,
    cleanerId: string | null,
    jobId: string | null,
    amountCents: number
  ) => ({
    level: "warning" as const,
    title: "Payout held",
    message: `Payout ${payoutId} placed on hold`,
    details: { payoutId, cleanerId, jobId, amountCents },
  }),
  payoutReversed: (payoutId: string, reason: string, adminId: string) => ({
    level: "warning" as const,
    title: "Payout reversed",
    message: `Payout ${payoutId} reversed`,
    details: { payoutId, reason, adminId },
  }),
  reconFlagResolved: (payoutId: string, status: string, note?: string) => ({
    level: "info" as const,
    title: "Payout reconciliation resolved",
    message: `Reconciliation flag for payout ${payoutId} marked ${status}`,
    details: { payoutId, status, note },
  }),
  disputeRouted: (
    disputeId: string,
    routeTo: string,
    note?: string,
    queues?: readonly string[]
  ) => ({
    level: "info" as const,
    title: "Dispute routed",
    message: `Dispute ${disputeId} routed to ${routeTo}`,
    details: { disputeId, routeTo, note, queues },
  }),
  fraudResolved: (alertId: string, resolution: string, adminId: string) => ({
    level: "info" as const,
    title: "Fraud alert resolved",
    message: `Fraud alert ${alertId} resolved as ${resolution}`,
    details: { alertId, resolution, adminId },
  }),
  /** Section 6: Dead-letter jobs alert */
  deadLetterJobs: (count: number, jobIds: string[], threshold: number) => ({
    level: "error" as const,
    title: "Dead-letter jobs detected",
    message: `${count} durable jobs in dead state (threshold: ${threshold})`,
    details: { count, jobIds: jobIds.slice(0, 20), threshold },
  }),
};

async function sendSlackAlert(payload: Record<string, unknown>): Promise<void> {
  if (!env.ALERT_SLACK_WEBHOOK_URL) return;
  try {
    await fetch(env.ALERT_SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `🚨 ${payload["title"]}: ${payload["message"]}`, blocks: [] }),
    });
  } catch (err) {
    logger.error("slack_alert_failed", { error: (err as Error).message });
  }
}

async function sendEmailAlert(payload: Record<string, unknown>): Promise<void> {
  if (!env.SENDGRID_API_KEY || !env.ALERT_EMAIL_TO) return;
  try {
    await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: env.ALERT_EMAIL_TO }] }],
        from: { email: env.ALERT_EMAIL_FROM },
        subject: `[${payload["level"]}] ${payload["title"]}`,
        content: [
          {
            type: "text/plain",
            value: `${payload["message"]}\n\nDetails: ${JSON.stringify(payload["details"] || {}, null, 2)}`,
          },
        ],
      }),
    });
  } catch (err) {
    logger.error("email_alert_failed", { error: (err as Error).message });
  }
}
