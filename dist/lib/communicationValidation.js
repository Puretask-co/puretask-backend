"use strict";
// src/lib/communicationValidation.ts
// Validation functions for communication event payloads
// Ensures email/SMS payloads match registry before emission
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_TO_EVENT_MAP = exports.CommunicationPayloadSchema = exports.VALID_TEMPLATE_ENV_VARS = void 0;
exports.validateEmailPayload = validateEmailPayload;
exports.validateTemplateKey = validateTemplateKey;
exports.getTemplateIdFromEnvVar = getTemplateIdFromEnvVar;
exports.createCommunicationPayload = createCommunicationPayload;
exports.getEventNameFromTemplateKey = getEventNameFromTemplateKey;
const zod_1 = require("zod");
// ============================================
// Communication Payload Schemas
// ============================================
/**
 * Valid template environment variable names (from email-registry.md)
 */
exports.VALID_TEMPLATE_ENV_VARS = [
    "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED",
    "SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED",
    "SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY",
    "SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED",
    "SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED",
    "SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED",
    "SENDGRID_TEMPLATE_USER_JOB_CANCELLED",
    "SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE",
    "SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT",
    "SENDGRID_TEMPLATE_USER_WELCOME",
    "SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION",
    "SENDGRID_TEMPLATE_USER_PASSWORD_RESET",
    "SMS_TEMPLATE_EMERGENCY",
    "SMS_TEMPLATE_JOB_REMINDER",
];
/**
 * Communication payload schema (for n8n)
 */
exports.CommunicationPayloadSchema = zod_1.z.object({
    templateEnvVar: zod_1.z.enum(exports.VALID_TEMPLATE_ENV_VARS, {
        errorMap: () => ({
            message: `Invalid template env var. Must be one of: ${exports.VALID_TEMPLATE_ENV_VARS.join(", ")}`,
        }),
    }),
    templateId: zod_1.z.string().min(1, "Template ID required"),
    to_email: zod_1.z.string().email().optional(),
    to_phone: zod_1.z.string().optional(),
    channel: zod_1.z.enum(["email", "sms"], {
        errorMap: () => ({ message: "Channel must be 'email' or 'sms'" }),
    }),
    priority: zod_1.z.enum(["high", "normal"]).optional().default("normal"),
    dynamic_data: zod_1.z.record(zod_1.z.unknown(), {
        required_error: "Dynamic data is required",
    }),
});
// ============================================
// Validation Functions
// ============================================
/**
 * Validate email payload structure
 * Throws if validation fails
 */
function validateEmailPayload(payload) {
    const result = exports.CommunicationPayloadSchema.safeParse(payload);
    if (!result.success) {
        const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        throw new Error(`Invalid email payload: ${errors}`);
    }
    const validated = result.data;
    // Additional validation: email channel requires to_email
    if (validated.channel === "email" && !validated.to_email) {
        throw new Error("Email channel requires to_email field");
    }
    // Additional validation: SMS channel requires to_phone
    if (validated.channel === "sms" && !validated.to_phone) {
        throw new Error("SMS channel requires to_phone field");
    }
    // Additional validation: templateEnvVar should match channel
    const isEmailTemplate = validated.templateEnvVar.startsWith("SENDGRID_TEMPLATE_");
    const isSMSTemplate = validated.templateEnvVar.startsWith("SMS_TEMPLATE_");
    if (validated.channel === "email" && !isEmailTemplate) {
        throw new Error(`Email channel requires SENDGRID_TEMPLATE_* env var, got: ${validated.templateEnvVar}`);
    }
    if (validated.channel === "sms" && !isSMSTemplate) {
        throw new Error(`SMS channel requires SMS_TEMPLATE_* env var, got: ${validated.templateEnvVar}`);
    }
    return validated;
}
/**
 * Validate template key exists in registry
 * Maps template keys to env vars
 */
function validateTemplateKey(templateKey) {
    // Template key format: email.client.job_booked
    // Env var format: SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED
    const envVar = templateKeyToEnvVar(templateKey);
    if (!exports.VALID_TEMPLATE_ENV_VARS.includes(envVar)) {
        throw new Error(`Invalid template key: ${templateKey}. Must map to one of: ${exports.VALID_TEMPLATE_ENV_VARS.join(", ")}`);
    }
    return envVar;
}
/**
 * Convert template key to environment variable name
 * Example: "email.client.job_booked" → "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED"
 */
function templateKeyToEnvVar(templateKey) {
    // Split template key: email.client.job_booked
    const parts = templateKey.split(".");
    if (parts.length < 3) {
        throw new Error(`Invalid template key format: ${templateKey}. Expected format: {channel}.{domain}.{action}`);
    }
    const [channel, domain, ...actionParts] = parts;
    const action = actionParts.join("_");
    // Convert to uppercase and replace dots with underscores
    const envVar = `SENDGRID_TEMPLATE_${domain.toUpperCase()}_${action.toUpperCase().replace(/-/g, "_")}`;
    // Handle SMS templates
    if (channel === "sms") {
        return `SMS_TEMPLATE_${action.toUpperCase().replace(/-/g, "_")}`;
    }
    return envVar;
}
/**
 * Get template ID from environment variable
 */
function getTemplateIdFromEnvVar(envVar) {
    const { env } = require("../config/env");
    const templateId = env[envVar];
    if (!templateId) {
        throw new Error(`Template ID not found for env var: ${envVar}. Check environment configuration.`);
    }
    return templateId;
}
/**
 * Create validated communication payload for n8n
 */
function createCommunicationPayload(options) {
    // Validate template key
    const envVar = validateTemplateKey(options.templateKey);
    // Build payload
    const payload = {
        templateEnvVar: envVar,
        templateId: options.templateId,
        channel: options.channel,
        priority: options.priority || "normal",
        dynamic_data: options.dynamic_data,
    };
    if (options.channel === "email" && options.to_email) {
        payload.to_email = options.to_email;
    }
    if (options.channel === "sms" && options.to_phone) {
        payload.to_phone = options.to_phone;
    }
    // Validate payload
    return validateEmailPayload(payload);
}
// ============================================
// Template Registry Helper
// ============================================
/**
 * Template key to event name mapping
 */
exports.TEMPLATE_TO_EVENT_MAP = {
    "email.client.job_booked": "job.booked",
    "email.client.job_accepted": "job.accepted",
    "email.client.cleaner_on_my_way": "cleaner.on_my_way",
    "email.client.job_completed": "job.completed",
    "email.cleaner.job_approved": "job.approved",
    "email.cleaner.job_disputed": "job.disputed",
    "email.user.job_cancelled": "job.cancelled",
    "email.client.credit_purchase": "payment.succeeded",
    "email.cleaner.payout_sent": "payout.sent",
    "email.user.welcome": "user.registered",
    "email.user.email_verification": "user.verification_requested",
    "email.user.password_reset": "user.password_reset_requested",
    "sms.user.emergency": "communication.sms",
    "sms.user.job_reminder": "job.reminder",
};
/**
 * Get event name from template key
 */
function getEventNameFromTemplateKey(templateKey) {
    return exports.TEMPLATE_TO_EVENT_MAP[templateKey] || `communication.${templateKey.split(".")[0]}`;
}
