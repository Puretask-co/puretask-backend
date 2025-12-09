// src/lib/alerting.ts
// Lightweight alerting helpers for Slack webhook and SendGrid email (if configured)

import { env } from "../config/env";
import { logger } from "./logger";

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
  payoutHold: (payoutId: string, cleanerId: string | null, jobId: string | null, amountCents: number) => ({
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
  disputeRouted: (disputeId: string, routeTo: string, note?: string, queues?: readonly string[]) => ({
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

