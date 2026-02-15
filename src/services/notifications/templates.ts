// src/services/notifications/templates.ts
// Scalable notification template registry + renderer

import { NotificationType } from "./types";

export type Channel = "email" | "sms" | "push";

// Prefer passing already-formatted strings (scheduledTime, addressDisplay).
// URLs should be fully formed + role-correct before reaching templates.
export type TemplateData = {
  jobId?: string;
  clientName?: string;
  cleanerName?: string;
  address?: string;
  scheduledTime?: string;
  scheduledDate?: string;
  creditAmount?: number;
  amount?: number;
  name?: string;
  resetUrl?: string;

  // Action URLs (role-correct)
  jobUrl?: string;
  checkInUrl?: string;
  paymentUrl?: string;
  subscriptionUrl?: string;
  supportUrl?: string;

  // Optional for SMS shortening
  shortUrl?: string;

  // Optional: show time zone label in copy
  timeZoneLabel?: string; // e.g. "America/Los_Angeles" or "local time"
};

export type RenderedEmail = {
  subject: string;
  text: string;
  // Future: html?: string;
  primaryActionUrl?: string;
};

export type RenderedSms = {
  text: string;
  primaryActionUrl?: string;
};

export type RenderedPush = {
  title: string;
  body: string;
  // This is the tap target. Your push provider adapter should map this.
  url?: string;
};

export type RenderedNotification = Partial<{
  email: RenderedEmail;
  sms: RenderedSms;
  push: RenderedPush;
}>;

type TemplateSpec = {
  type: NotificationType;
  channels: Channel[];
  // Per-channel required keys (runtime-validated)
  required?: Partial<Record<Channel, (keyof TemplateData)[]>>;
  // Which URL field is the primary action (if any)
  primaryActionKey?: keyof TemplateData;

  email?: {
    subject: (d: RequiredDefaults) => string;
    text: (d: RequiredDefaults) => string;
  };

  sms?: {
    text: (d: RequiredDefaults) => string;
  };

  push?: {
    title: (d: RequiredDefaults) => string;
    body: (d: RequiredDefaults) => string;
  };
};

// Defaults applied centrally so templates stay clean.
type RequiredDefaults = Required<
  Pick<
    TemplateData,
    "jobId" | "clientName" | "cleanerName" | "address" | "creditAmount" | "amount" | "name"
  >
> &
  Pick<
    TemplateData,
    | "scheduledTime"
    | "scheduledDate"
    | "resetUrl"
    | "jobUrl"
    | "checkInUrl"
    | "paymentUrl"
    | "subscriptionUrl"
    | "supportUrl"
    | "shortUrl"
    | "timeZoneLabel"
  >;

function withDefaults(data: TemplateData): RequiredDefaults {
  return {
    jobId: data.jobId || "N/A",
    clientName: data.clientName || "Customer",
    cleanerName: data.cleanerName || "Your cleaner",
    address: data.address || "",
    creditAmount: typeof data.creditAmount === "number" ? data.creditAmount : 0,
    amount: typeof data.amount === "number" ? data.amount : 0,
    name: data.name || "there",

    scheduledTime: data.scheduledTime || "",
    scheduledDate: data.scheduledDate || "",
    resetUrl: data.resetUrl,

    jobUrl: data.jobUrl,
    checkInUrl: data.checkInUrl,
    paymentUrl: data.paymentUrl,
    subscriptionUrl: data.subscriptionUrl,
    supportUrl: data.supportUrl,
    shortUrl: data.shortUrl,

    timeZoneLabel: data.timeZoneLabel || "local time",
  };
}

function shortJobId(jobId: string): string {
  return (jobId || "job").slice(0, 8);
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function assertRequired(spec: TemplateSpec, channel: Channel, data: RequiredDefaults): void {
  const req = spec.required?.[channel];
  if (!req?.length) return;

  // Only treat null/undefined as missing (empty strings are allowed)
  const missing = req.filter((k) => data[k] === undefined || data[k] === null);
  if (missing.length) {
    // In production you might want to log and still send a fallback.
    // For strictness, throw to catch template misuse early.
    throw new Error(
      `Notification template "${spec.type}" missing required data for ${channel}: ${missing.join(", ")}`
    );
  }
}

const TEMPLATES: Record<NotificationType, TemplateSpec> = {
  "job.created": {
    type: "job.created",
    channels: ["email"],
    required: { email: ["jobId", "clientName", "address"] },
    email: {
      subject: (d) => "Your cleaning job has been booked",
      text: (d) =>
        `Hi ${d.clientName},\n\nYour cleaning job (${d.jobId}) has been created and is awaiting a cleaner.\n\nAddress: ${d.address}\nCredits: ${d.creditAmount}\n\nWe'll notify you when a cleaner accepts your job.\n\nThanks,\nThe PureTask Team`,
    },
  },

  "job.accepted": {
    type: "job.accepted",
    channels: ["email", "sms", "push"],
    required: {
      email: ["clientName", "cleanerName"],
      sms: ["cleanerName"],
      push: ["cleanerName"],
    },
    primaryActionKey: "jobUrl",
    email: {
      subject: (d) => "A cleaner has accepted your job",
      text: (d) =>
        `Hi ${d.clientName},\n\nGreat news! ${d.cleanerName} has accepted your cleaning job (${d.jobId}).\n\n${d.jobUrl ? `View job details:\n${d.jobUrl}\n\n` : ""}You'll receive another notification when they're on their way.\n\nThanks,\nThe PureTask Team`,
    },
    sms: {
      text: (d) => {
        const link = d.shortUrl || d.jobUrl;
        return `PureTask: ${d.cleanerName} accepted your job.${link ? ` Details: ${link}` : ""}`;
      },
    },
    push: {
      title: () => "Cleaner Accepted!",
      body: (d) => `${d.cleanerName} accepted your job`,
    },
  },

  "job.on_my_way": {
    type: "job.on_my_way",
    channels: ["email", "sms", "push"],
    required: { email: ["clientName", "cleanerName"], sms: ["cleanerName"], push: ["cleanerName"] },
    primaryActionKey: "jobUrl",
    email: {
      subject: () => "Your cleaner is on the way",
      text: (d) =>
        `Hi ${d.clientName},\n\n${d.cleanerName} is on the way to your location for job ${d.jobId}.\n\nPlease ensure access is available.\n\n${d.jobUrl ? `View job:\n${d.jobUrl}\n\n` : ""}Thanks,\nThe PureTask Team`,
    },
    sms: {
      text: (d) => {
        const link = d.shortUrl || d.jobUrl;
        return `PureTask: ${d.cleanerName} is on the way.${link ? ` Track: ${link}` : ""}`;
      },
    },
    push: {
      title: () => "Cleaner On The Way",
      body: (d) => `${d.cleanerName} is on the way`,
    },
  },

  "job.started": {
    type: "job.started",
    channels: ["email", "sms", "push"],
    required: { email: ["clientName", "cleanerName"], push: ["cleanerName"] },
    primaryActionKey: "jobUrl",
    email: {
      subject: () => "Your cleaner has arrived",
      text: (d) =>
        `Hi ${d.clientName},\n\n${d.cleanerName} has arrived and started working on job ${d.jobId}.\n\n${d.jobUrl ? `View job:\n${d.jobUrl}\n\n` : ""}Thanks,\nThe PureTask Team`,
    },
    sms: {
      text: (d) => `PureTask: Your cleaner has arrived and started job ${shortJobId(d.jobId)}.`,
    },
    push: {
      title: () => "Cleaner Has Arrived",
      body: (d) => `${d.cleanerName} has started cleaning`,
    },
  },

  "job.completed": {
    type: "job.completed",
    channels: ["email", "sms", "push"],
    required: { email: ["clientName", "cleanerName", "jobUrl"], push: [], sms: [] },
    primaryActionKey: "jobUrl",
    email: {
      subject: () => "Cleaning completed - please review",
      text: (d) =>
        `Hi ${d.clientName},\n\n${d.cleanerName} has finished your cleaning job (${d.jobId}).\n\nReview & approve here:\n${d.jobUrl}\n\nThanks,\nThe PureTask Team`,
    },
    sms: {
      text: (d) => {
        const link = d.shortUrl || d.jobUrl;
        return `PureTask: Job ${shortJobId(d.jobId)} completed.${link ? ` Review: ${link}` : ""}`;
      },
    },
    push: {
      title: () => "Job Completed",
      body: () => "Tap to review and approve",
    },
  },

  "job.awaiting_approval": {
    type: "job.awaiting_approval",
    channels: ["email"],
    required: { email: ["clientName", "jobUrl"] },
    primaryActionKey: "jobUrl",
    email: {
      subject: () => "Your job is awaiting approval",
      text: (d) =>
        `Hi ${d.clientName},\n\nYour cleaning job (${d.jobId}) is complete and awaiting your approval.\n\nApprove here:\n${d.jobUrl}\n\nThanks,\nThe PureTask Team`,
    },
  },

  "job.approved": {
    type: "job.approved",
    channels: ["email", "push"],
    required: { email: ["clientName"], push: [] },
    email: {
      subject: () => "Thanks for approving your job",
      text: (d) =>
        `Hi ${d.clientName},\n\nThank you for approving job ${d.jobId}.\n\n${d.creditAmount} credits have been charged. We hope you enjoyed the service!\n\nThanks,\nThe PureTask Team`,
    },
    push: {
      title: () => "Job Approved",
      body: () => "Thanks for the review!",
    },
  },

  "job.disputed": {
    type: "job.disputed",
    channels: ["email"],
    required: { email: ["clientName", "jobUrl"] },
    primaryActionKey: "jobUrl",
    email: {
      subject: () => "Your dispute has been received",
      text: (d) =>
        `Hi ${d.clientName},\n\nWe received your dispute for job ${d.jobId}.\n\n${d.jobUrl ? `You can view the job here:\n${d.jobUrl}\n\n` : ""}Our team will review it and get back to you within 24–48 hours.\n\nThanks,\nThe PureTask Team`,
    },
  },

  "job.cancelled": {
    type: "job.cancelled",
    channels: ["email", "sms", "push"],
    required: { email: ["clientName"], sms: [], push: [] },
    email: {
      subject: () => "Your job has been cancelled",
      text: (d) =>
        `Hi ${d.clientName},\n\nYour job (${d.jobId}) has been cancelled.\n\nAny escrowed credits have been refunded to your account.\n\nThanks,\nThe PureTask Team`,
    },
    sms: {
      text: (d) =>
        `PureTask: Your job ${shortJobId(d.jobId)} has been cancelled. Credits refunded.`,
    },
    push: {
      title: () => "Job Cancelled",
      body: () => "Your job has been cancelled",
    },
  },

  "job.reminder_24h": {
    type: "job.reminder_24h",
    channels: ["email", "push"],
    required: { email: ["clientName", "scheduledTime", "jobUrl"], push: ["scheduledTime"] },
    primaryActionKey: "jobUrl",
    email: {
      subject: () => "Reminder: Your cleaning is tomorrow",
      text: (d) =>
        `Hi ${d.clientName},\n\nReminder: Your cleaning job (${d.jobId}) is scheduled for tomorrow at ${d.scheduledTime}${d.timeZoneLabel ? ` (${d.timeZoneLabel})` : ""}.\n\nAddress: ${d.address}\n\n${d.jobUrl ? `View booking:\n${d.jobUrl}\n\n` : ""}Please ensure access is available. We'll notify you when your cleaner is on the way.\n\nThanks,\nThe PureTask Team`,
    },
    push: {
      title: () => "Cleaning Tomorrow",
      body: (d) => `Your cleaning is tomorrow at ${d.scheduledTime}`,
    },
  },

  "job.reminder_2h": {
    type: "job.reminder_2h",
    channels: ["email", "sms", "push"],
    required: {
      email: ["cleanerName", "scheduledTime", "checkInUrl"],
      sms: ["scheduledTime"],
      push: ["scheduledTime"],
    },
    primaryActionKey: "checkInUrl",
    email: {
      subject: () => "Reminder: Your cleaning starts in 2 hours",
      text: (d) =>
        `Hi ${d.cleanerName},\n\nReminder: Your cleaning job (${d.jobId}) starts in 2 hours at ${d.scheduledTime}${d.timeZoneLabel ? ` (${d.timeZoneLabel})` : ""}.\n\nAddress: ${d.address}\n\nWhen you arrive, check in here:\n${d.checkInUrl}\n\nThanks,\nThe PureTask Team`,
    },
    sms: {
      text: (d) => {
        const link = d.shortUrl || d.checkInUrl;
        return `PureTask: Job ${shortJobId(d.jobId)} starts in 2 hours at ${d.scheduledTime}.${link ? ` Check in: ${link}` : ""}`;
      },
    },
    push: {
      title: () => "Job Starts Soon",
      body: (d) => `Job starts in 2 hours at ${d.scheduledTime}`,
    },
  },

  "job.no_show_warning": {
    type: "job.no_show_warning",
    channels: ["email", "sms", "push"],
    required: {
      email: ["cleanerName", "scheduledTime", "checkInUrl"],
      sms: ["scheduledTime"],
      push: ["scheduledTime"],
    },
    primaryActionKey: "checkInUrl",
    email: {
      subject: () => "Action needed: Check in for your job",
      text: (d) =>
        `Hi ${d.cleanerName},\n\nAction needed: Your cleaning job (${d.jobId}) was scheduled to start at ${d.scheduledTime}${d.timeZoneLabel ? ` (${d.timeZoneLabel})` : ""}, but we haven't received your check-in.\n\nCheck in now:\n${d.checkInUrl}\n\n${d.supportUrl ? `Support:\n${d.supportUrl}\n\n` : ""}Thanks,\nThe PureTask Team`,
    },
    sms: {
      text: (d) => {
        const link = d.shortUrl || d.checkInUrl;
        return `PureTask: Job ${shortJobId(d.jobId)} scheduled for ${d.scheduledTime}.${link ? ` Check in now: ${link}` : ""}`;
      },
    },
    push: {
      title: () => "Action Needed",
      body: (d) => `Please check in for job starting at ${d.scheduledTime}`,
    },
  },

  "credits.purchased": {
    type: "credits.purchased",
    channels: ["email", "push"],
    required: { email: ["clientName"], push: [] },
    email: {
      subject: () => "Credits added to your account",
      text: (d) =>
        `Hi ${d.clientName},\n\n${d.creditAmount} credits have been added to your account.\n\nYour new balance is ready to use for booking cleaning jobs.\n\nThanks,\nThe PureTask Team`,
    },
    push: {
      title: () => "Credits Added",
      body: (d) => `${d.creditAmount} credits added`,
    },
  },

  "credits.low": {
    type: "credits.low",
    channels: ["email"],
    required: { email: ["clientName"] },
    email: {
      subject: () => "Your credit balance is running low",
      text: (d) =>
        `Hi ${d.clientName},\n\nYour credit balance is running low.\n\nConsider purchasing more credits to continue booking cleaning services.\n\nThanks,\nThe PureTask Team`,
    },
  },

  "payout.processed": {
    type: "payout.processed",
    channels: ["email", "sms", "push"],
    required: { email: ["cleanerName"], sms: [], push: [] },
    email: {
      subject: () => "Your payout has been processed",
      text: (d) =>
        `Hi ${d.cleanerName},\n\nYour payout of $${dollars(d.amount)} has been processed and sent to your bank account.\n\nIt should arrive within 2–3 business days.\n\nThanks,\nThe PureTask Team`,
    },
    sms: { text: () => `PureTask: Your payout has been sent to your bank.` },
    push: { title: () => "Payout Sent", body: () => "Check your bank in 2–3 days" },
  },

  "payout.failed": {
    type: "payout.failed",
    channels: ["email"],
    required: { email: ["cleanerName"] },
    primaryActionKey: "supportUrl",
    email: {
      subject: () => "Payout issue - action required",
      text: (d) =>
        `Hi ${d.cleanerName},\n\nWe encountered an issue processing your payout.\n\nPlease check your payment settings in the app and ensure your bank details are correct.\n\n${d.supportUrl ? `Support:\n${d.supportUrl}\n\n` : ""}Thanks,\nThe PureTask Team`,
    },
  },

  "payment.failed": {
    type: "payment.failed",
    channels: ["email"],
    required: { email: ["clientName", "paymentUrl"] },
    primaryActionKey: "paymentUrl",
    email: {
      subject: () => "Payment failed - please update your payment method",
      text: (d) =>
        `Hi ${d.clientName},\n\nWe encountered an issue processing your payment for job ${d.jobId}.\n\nUpdate your payment method here:\n${d.paymentUrl}\n\n${d.supportUrl ? `Support:\n${d.supportUrl}\n\n` : ""}Thanks,\nThe PureTask Team`,
    },
  },

  welcome: {
    type: "welcome",
    channels: ["email"],
    required: { email: ["name"] },
    email: {
      subject: () => "Welcome to PureTask!",
      text: (d) =>
        `Hi ${d.name},\n\nWelcome to PureTask!\n\nWe're excited to have you. Get started by browsing available cleaning services or adding credits to your account.\n\nIf you have any questions, we're here to help.\n\nThanks,\nThe PureTask Team`,
    },
  },

  "password.reset": {
    type: "password.reset",
    channels: ["email"],
    required: { email: ["name", "resetUrl"] },
    primaryActionKey: "resetUrl",
    email: {
      subject: () => "Reset your PureTask password",
      text: (d) =>
        `Hi ${d.name},\n\nWe received a request to reset your password.\n\nClick the link below to set a new password:\n${d.resetUrl}\n\nIf you didn't request this, you can safely ignore this email.\n\nThanks,\nThe PureTask Team`,
    },
  },

  "subscription.renewal_reminder": {
    type: "subscription.renewal_reminder",
    channels: ["email"],
    required: { email: ["clientName", "subscriptionUrl"] },
    primaryActionKey: "subscriptionUrl",
    email: {
      subject: () => "Your subscription renews soon",
      text: (d) =>
        `Hi ${d.clientName},\n\nYour subscription will renew in 7 days.\n\n${d.subscriptionUrl ? `Manage your subscription here:\n${d.subscriptionUrl}\n\n` : ""}Thanks,\nThe PureTask Team`,
    },
  },
} as const;

/**
 * Render channel payloads for a given notification.
 * The sender decides which channels to actually send (based on user prefs + availability).
 */
export function renderNotification(
  type: NotificationType,
  data: TemplateData,
  channels?: Channel[]
): RenderedNotification {
  const spec = TEMPLATES[type];
  if (!spec) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  const d = withDefaults(data);
  const useChannels = channels?.length ? channels : spec.channels;

  const out: RenderedNotification = {};
  const primaryUrl = spec.primaryActionKey
    ? (d[spec.primaryActionKey] as string | undefined)
    : undefined;

  if (useChannels.includes("email") && spec.email) {
    assertRequired(spec, "email", d);
    out.email = {
      subject: spec.email.subject(d),
      text: spec.email.text(d),
      primaryActionUrl: primaryUrl,
    };
  }

  if (useChannels.includes("sms") && spec.sms) {
    assertRequired(spec, "sms", d);
    out.sms = {
      text: spec.sms.text(d),
      primaryActionUrl: primaryUrl,
    };
  }

  if (useChannels.includes("push") && spec.push) {
    assertRequired(spec, "push", d);
    out.push = {
      title: spec.push.title(d),
      body: spec.push.body(d),
      url: primaryUrl,
    };
  }

  return out;
}

// Template version for tracking changes
const TEMPLATE_VERSION = "2025-01-15";

// Backwards-compatible helpers (deprecated - use renderNotification instead)
/**
 * @deprecated Use renderNotification() instead. This helper accepts data for safety.
 */
export function getEmailSubject(type: NotificationType, data: TemplateData = {}): string {
  const spec = TEMPLATES[type];
  if (!spec?.email) return "PureTask Update";
  return spec.email.subject(withDefaults(data));
}

/**
 * @deprecated Use renderNotification() instead.
 */
export function getEmailBody(type: NotificationType, data: Record<string, unknown>): string {
  const spec = TEMPLATES[type];
  if (!spec?.email) return `You have a new update from PureTask regarding ${type}.`;
  return spec.email.text(withDefaults(data as TemplateData));
}

/**
 * @deprecated Use renderNotification() instead.
 */
export function getSmsBody(type: NotificationType, data: Record<string, unknown>): string {
  const spec = TEMPLATES[type];
  if (!spec?.sms)
    return `PureTask: Update for job ${(data.jobId as string)?.slice(0, 8) || "job"}. Check the app for details.`;
  return spec.sms.text(withDefaults(data as TemplateData));
}

/**
 * @deprecated Use renderNotification() instead. This helper accepts data for safety.
 */
export function getPushTitle(type: NotificationType, data: TemplateData = {}): string {
  const spec = TEMPLATES[type];
  if (!spec?.push) return "PureTask Update";
  return spec.push.title(withDefaults(data));
}

/**
 * @deprecated Use renderNotification() instead.
 */
export function getPushBody(type: NotificationType, data: Record<string, unknown>): string {
  const spec = TEMPLATES[type];
  if (!spec?.push) return `Update for job ${(data.jobId as string)?.slice(0, 8) || ""}`;
  return spec.push.body(withDefaults(data as TemplateData));
}

// Export template version for logging
export { TEMPLATE_VERSION };
