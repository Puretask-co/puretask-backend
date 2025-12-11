"use strict";
// src/lib/alerting.ts
// Lightweight alerting helpers for Slack webhook and SendGrid email (if configured)
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertTemplates = void 0;
exports.sendAlert = sendAlert;
const env_1 = require("../config/env");
const logger_1 = require("./logger");
async function sendAlert(params) {
    const { level, title, message, details = {} } = params;
    // Always log
    logger_1.logger.warn("system_alert", { level, title, message, details });
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
exports.alertTemplates = {
    payoutHold: (payoutId, cleanerId, jobId, amountCents) => ({
        level: "warning",
        title: "Payout held",
        message: `Payout ${payoutId} placed on hold`,
        details: { payoutId, cleanerId, jobId, amountCents },
    }),
    payoutReversed: (payoutId, reason, adminId) => ({
        level: "warning",
        title: "Payout reversed",
        message: `Payout ${payoutId} reversed`,
        details: { payoutId, reason, adminId },
    }),
    reconFlagResolved: (payoutId, status, note) => ({
        level: "info",
        title: "Payout reconciliation resolved",
        message: `Reconciliation flag for payout ${payoutId} marked ${status}`,
        details: { payoutId, status, note },
    }),
    disputeRouted: (disputeId, routeTo, note, queues) => ({
        level: "info",
        title: "Dispute routed",
        message: `Dispute ${disputeId} routed to ${routeTo}`,
        details: { disputeId, routeTo, note, queues },
    }),
    fraudResolved: (alertId, resolution, adminId) => ({
        level: "info",
        title: "Fraud alert resolved",
        message: `Fraud alert ${alertId} resolved as ${resolution}`,
        details: { alertId, resolution, adminId },
    }),
};
async function sendSlackAlert(payload) {
    if (!env_1.env.ALERT_SLACK_WEBHOOK_URL)
        return;
    try {
        await fetch(env_1.env.ALERT_SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: `🚨 ${payload["title"]}: ${payload["message"]}`, blocks: [] }),
        });
    }
    catch (err) {
        logger_1.logger.error("slack_alert_failed", { error: err.message });
    }
}
async function sendEmailAlert(payload) {
    if (!env_1.env.SENDGRID_API_KEY || !env_1.env.ALERT_EMAIL_TO)
        return;
    try {
        await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env_1.env.SENDGRID_API_KEY}`,
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: env_1.env.ALERT_EMAIL_TO }] }],
                from: { email: env_1.env.ALERT_EMAIL_FROM },
                subject: `[${payload["level"]}] ${payload["title"]}`,
                content: [
                    {
                        type: "text/plain",
                        value: `${payload["message"]}\n\nDetails: ${JSON.stringify(payload["details"] || {}, null, 2)}`,
                    },
                ],
            }),
        });
    }
    catch (err) {
        logger_1.logger.error("email_alert_failed", { error: err.message });
    }
}
