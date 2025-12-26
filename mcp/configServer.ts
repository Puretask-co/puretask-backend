import express from "express";
import { requireAuth } from "./shared/auth";
import { rateLimit } from "./shared/rateLimit";
import { logRequest } from "./shared/logger";

type EnvVarMeta = { name: string; required: boolean; description: string; sensitive: boolean };
type FlagMeta = { name: string; description: string };
type TemplateMeta = { key: string; envVar: string; channel: "email" | "sms" };

const app = express();
const PORT = Number(process.env.MCP_CONFIG_PORT || 7094);

const REQUIRED_ENV_VARS: EnvVarMeta[] = [
  { name: "DATABASE_URL", required: true, description: "PostgreSQL connection string", sensitive: true },
  { name: "JWT_SECRET", required: true, description: "JWT signing secret", sensitive: true },
  { name: "STRIPE_SECRET_KEY", required: true, description: "Stripe secret key", sensitive: true },
  { name: "STRIPE_WEBHOOK_SECRET", required: true, description: "Stripe webhook secret", sensitive: true },
  { name: "N8N_WEBHOOK_SECRET", required: true, description: "Shared secret for n8n ingress", sensitive: true },
];

const OPTIONAL_ENV_VARS: EnvVarMeta[] = [
  { name: "NODE_ENV", required: false, description: "Runtime environment", sensitive: false },
  { name: "PORT", required: false, description: "HTTP port", sensitive: false },
  { name: "JWT_EXPIRES_IN", required: false, description: "JWT expiry window", sensitive: false },
  { name: "BCRYPT_SALT_ROUNDS", required: false, description: "Password hashing cost factor", sensitive: false },
  { name: "BOOKINGS_ENABLED", required: false, description: "Kill switch for bookings", sensitive: false },
  { name: "PAYOUTS_ENABLED", required: false, description: "Kill switch for payouts", sensitive: false },
  { name: "CREDITS_ENABLED", required: false, description: "Kill switch for credits", sensitive: false },
  { name: "REFUNDS_ENABLED", required: false, description: "Kill switch for refunds", sensitive: false },
  { name: "WORKERS_ENABLED", required: false, description: "Kill switch for workers", sensitive: false },
  { name: "PAYOUT_CURRENCY", required: false, description: "Payout currency code", sensitive: false },
  { name: "CENTS_PER_CREDIT", required: false, description: "Credits-to-cents ratio", sensitive: false },
  { name: "PLATFORM_FEE_PERCENT", required: false, description: "Platform fee percent", sensitive: false },
  { name: "CLEANER_PAYOUT_PERCENT_BRONZE", required: false, description: "Cleaner payout percent (bronze)", sensitive: false },
  { name: "CLEANER_PAYOUT_PERCENT_SILVER", required: false, description: "Cleaner payout percent (silver)", sensitive: false },
  { name: "CLEANER_PAYOUT_PERCENT_GOLD", required: false, description: "Cleaner payout percent (gold)", sensitive: false },
  { name: "CLEANER_PAYOUT_PERCENT_PLATINUM", required: false, description: "Cleaner payout percent (platinum)", sensitive: false },
  { name: "GPS_CHECKIN_RADIUS_METERS", required: false, description: "Geo check-in radius", sensitive: false },
  { name: "MIN_PHOTOS_TOTAL", required: false, description: "Minimum photos total", sensitive: false },
  { name: "MIN_BEFORE_PHOTOS", required: false, description: "Minimum before photos", sensitive: false },
  { name: "MIN_AFTER_PHOTOS", required: false, description: "Minimum after photos", sensitive: false },
  { name: "PHOTO_RETENTION_DAYS", required: false, description: "Photo retention days", sensitive: false },
  { name: "DISPUTE_WINDOW_HOURS", required: false, description: "Dispute window hours", sensitive: false },
  { name: "CLEANER_NOSHOW_BONUS_CREDITS", required: false, description: "Bonus credits for cleaner no-show recovery", sensitive: false },
  { name: "NON_CREDIT_SURCHARGE_PERCENT", required: false, description: "Surcharge percent when not using credits", sensitive: false },
  { name: "MIN_LEAD_TIME_HOURS", required: false, description: "Minimum lead time for jobs", sensitive: false },
  { name: "SUBSCRIPTION_DEFAULT_CREDITS", required: false, description: "Default credits for subscriptions", sensitive: false },
  { name: "CANCELLATION_LOCK_HOURS", required: false, description: "Cancellation lock period", sensitive: false },
  { name: "N8N_WEBHOOK_URL", required: false, description: "Event forwarding webhook for n8n", sensitive: true },
  { name: "APP_URL", required: false, description: "Frontend base URL", sensitive: false },
  { name: "STORAGE_URL", required: false, description: "Storage base URL", sensitive: false },
  { name: "SENDGRID_API_KEY", required: false, description: "SendGrid API key", sensitive: true },
  { name: "SENDGRID_FROM_EMAIL", required: false, description: "From email address", sensitive: false },
  { name: "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED", required: false, description: "SendGrid template ID: client job booked", sensitive: true },
  { name: "SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED", required: false, description: "SendGrid template ID: client job accepted", sensitive: true },
  { name: "SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY", required: false, description: "SendGrid template ID: cleaner on my way", sensitive: true },
  { name: "SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED", required: false, description: "SendGrid template ID: client job completed", sensitive: true },
  { name: "SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED", required: false, description: "SendGrid template ID: cleaner job approved", sensitive: true },
  { name: "SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED", required: false, description: "SendGrid template ID: cleaner job disputed", sensitive: true },
  { name: "SENDGRID_TEMPLATE_USER_JOB_CANCELLED", required: false, description: "SendGrid template ID: job cancelled", sensitive: true },
  { name: "SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE", required: false, description: "SendGrid template ID: credit purchase", sensitive: true },
  { name: "SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT", required: false, description: "SendGrid template ID: payout sent", sensitive: true },
  { name: "SENDGRID_TEMPLATE_USER_WELCOME", required: false, description: "SendGrid template ID: welcome email", sensitive: true },
  { name: "SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION", required: false, description: "SendGrid template ID: email verification", sensitive: true },
  { name: "SENDGRID_TEMPLATE_USER_PASSWORD_RESET", required: false, description: "SendGrid template ID: password reset", sensitive: true },
  { name: "SMS_TEMPLATE_EMERGENCY", required: false, description: "Twilio template ID: emergency SMS", sensitive: true },
  { name: "SMS_TEMPLATE_JOB_REMINDER", required: false, description: "Twilio template ID: job reminder SMS", sensitive: true },
  { name: "TWILIO_ACCOUNT_SID", required: false, description: "Twilio account SID", sensitive: true },
  { name: "TWILIO_AUTH_TOKEN", required: false, description: "Twilio auth token", sensitive: true },
  { name: "TWILIO_FROM_NUMBER", required: false, description: "Twilio from number", sensitive: false },
  { name: "ONESIGNAL_APP_ID", required: false, description: "OneSignal app ID", sensitive: false },
  { name: "ONESIGNAL_API_KEY", required: false, description: "OneSignal API key", sensitive: true },
  { name: "ALERT_SLACK_WEBHOOK_URL", required: false, description: "Slack webhook for alerts", sensitive: true },
  { name: "ALERT_EMAIL_TO", required: false, description: "Alert recipient email", sensitive: false },
  { name: "ALERT_EMAIL_FROM", required: false, description: "Alert sender email", sensitive: false },
  { name: "GOOGLE_CLIENT_ID", required: false, description: "Google OAuth client ID", sensitive: false },
  { name: "GOOGLE_CLIENT_SECRET", required: false, description: "Google OAuth client secret", sensitive: true },
  { name: "GOOGLE_REDIRECT_URI", required: false, description: "Google OAuth redirect URI", sensitive: false },
  { name: "OPENAI_API_KEY", required: false, description: "OpenAI API key", sensitive: true },
  { name: "OPENAI_MODEL", required: false, description: "OpenAI model name", sensitive: false },
  { name: "USE_EVENT_BASED_NOTIFICATIONS", required: false, description: "Feature flag for event-based notifications", sensitive: false },
];

const FEATURE_FLAGS: FlagMeta[] = [
  { name: "USE_EVENT_BASED_NOTIFICATIONS", description: "Route notifications through event/n8n pipeline" },
  { name: "BOOKINGS_ENABLED", description: "Enable bookings" },
  { name: "PAYOUTS_ENABLED", description: "Enable payouts" },
  { name: "CREDITS_ENABLED", description: "Enable credits system" },
  { name: "REFUNDS_ENABLED", description: "Enable refunds" },
  { name: "WORKERS_ENABLED", description: "Enable background workers" },
];

const TEMPLATE_KEYS: TemplateMeta[] = [
  { key: "client.job_booked", envVar: "SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED", channel: "email" },
  { key: "client.job_accepted", envVar: "SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED", channel: "email" },
  { key: "client.cleaner_on_my_way", envVar: "SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY", channel: "email" },
  { key: "client.job_completed", envVar: "SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED", channel: "email" },
  { key: "cleaner.job_approved", envVar: "SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED", channel: "email" },
  { key: "cleaner.job_disputed", envVar: "SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED", channel: "email" },
  { key: "user.job_cancelled", envVar: "SENDGRID_TEMPLATE_USER_JOB_CANCELLED", channel: "email" },
  { key: "client.credit_purchase", envVar: "SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE", channel: "email" },
  { key: "cleaner.payout_sent", envVar: "SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT", channel: "email" },
  { key: "user.welcome", envVar: "SENDGRID_TEMPLATE_USER_WELCOME", channel: "email" },
  { key: "user.email_verification", envVar: "SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION", channel: "email" },
  { key: "user.password_reset", envVar: "SENDGRID_TEMPLATE_USER_PASSWORD_RESET", channel: "email" },
  { key: "sms.emergency", envVar: "SMS_TEMPLATE_EMERGENCY", channel: "sms" },
  { key: "sms.job_reminder", envVar: "SMS_TEMPLATE_JOB_REMINDER", channel: "sms" },
];

const EVENT_NAMES = [
  "job.booked",
  "job.accepted",
  "job.cancelled",
  "job.completed",
  "job.approved",
  "job.disputed",
  "job.started",
  "cleaner.on_my_way",
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "payout.sent",
  "payout.failed",
  "user.registered",
  "user.verified",
  "user.tier_changed",
  "communication.email",
  "communication.sms",
];

app.use(express.json({ limit: "32kb" }));
app.use(requireAuth);
app.use(rateLimit({ limit: 10, windowMs: 60 * 60 * 1000, scope: "config" }));

app.get("/env-vars", (_req, res) => {
  logRequest("config", { path: "/env-vars" });
  res.json({ required: REQUIRED_ENV_VARS, optional: OPTIONAL_ENV_VARS });
});

app.get("/feature-flags", (_req, res) => {
  logRequest("config", { path: "/feature-flags" });
  res.json({ flags: FEATURE_FLAGS });
});

app.get("/events", (_req, res) => {
  logRequest("config", { path: "/events" });
  res.json({ events: EVENT_NAMES });
});

app.get("/templates", (_req, res) => {
  logRequest("config", { path: "/templates" });
  res.json({ templates: TEMPLATE_KEYS });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MCP Config server listening on http://localhost:${PORT}`);
});

