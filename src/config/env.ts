// src/config/env.ts
// Environment variable configuration with validation

import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  // Required
  DATABASE_URL: requireEnv("DATABASE_URL"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  STRIPE_SECRET_KEY: requireEnv("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: requireEnv("STRIPE_WEBHOOK_SECRET"),
  N8N_WEBHOOK_SECRET: requireEnv("N8N_WEBHOOK_SECRET"),

  // Core runtime
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT ? Number(process.env.PORT) : 4000,
  // Local dev default is 3001 (matches puretask-frontend `next dev -p 3001`)
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3001",

  // Auth
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "30d",
  BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS ? Number(process.env.BCRYPT_SALT_ROUNDS) : 10,

  // V1 HARDENING: Production Guard Flags (kill switches)
  BOOKINGS_ENABLED: process.env.BOOKINGS_ENABLED !== "false", // Default: enabled
  PAYOUTS_ENABLED: process.env.PAYOUTS_ENABLED === "true",
  CREDITS_ENABLED: process.env.CREDITS_ENABLED !== "false", // Default: enabled
  REFUNDS_ENABLED: process.env.REFUNDS_ENABLED !== "false", // Default: enabled
  WORKERS_ENABLED: process.env.WORKERS_ENABLED !== "false", // Default: enabled
  /** Section 6: When true, crons enqueue to durable_jobs only; durable job worker does the work. */
  CRONS_ENQUEUE_ONLY: process.env.CRONS_ENQUEUE_ONLY === "true",

  // Payouts
  PAYOUT_CURRENCY: process.env.PAYOUT_CURRENCY || "usd",
  // Credit system: 10 credits = $1 USD (per policy)
  CENTS_PER_CREDIT: process.env.CENTS_PER_CREDIT ? Number(process.env.CENTS_PER_CREDIT) : 10,

  // Platform fee and cleaner payout configuration (per Terms of Service)
  PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT
    ? Number(process.env.PLATFORM_FEE_PERCENT)
    : 15,
  // Cleaner payout percentages by tier (cleaners receive 80-85% of booking amount)
  CLEANER_PAYOUT_PERCENT_BRONZE: process.env.CLEANER_PAYOUT_PERCENT_BRONZE
    ? Number(process.env.CLEANER_PAYOUT_PERCENT_BRONZE)
    : 80,
  CLEANER_PAYOUT_PERCENT_SILVER: process.env.CLEANER_PAYOUT_PERCENT_SILVER
    ? Number(process.env.CLEANER_PAYOUT_PERCENT_SILVER)
    : 82,
  CLEANER_PAYOUT_PERCENT_GOLD: process.env.CLEANER_PAYOUT_PERCENT_GOLD
    ? Number(process.env.CLEANER_PAYOUT_PERCENT_GOLD)
    : 84,
  CLEANER_PAYOUT_PERCENT_PLATINUM: process.env.CLEANER_PAYOUT_PERCENT_PLATINUM
    ? Number(process.env.CLEANER_PAYOUT_PERCENT_PLATINUM)
    : 85,

  // Operational defaults (optional)
  GPS_CHECKIN_RADIUS_METERS: process.env.GPS_CHECKIN_RADIUS_METERS
    ? Number(process.env.GPS_CHECKIN_RADIUS_METERS)
    : 250,
  ON_TIME_EARLY_MINUTES: process.env.ON_TIME_EARLY_MINUTES
    ? Number(process.env.ON_TIME_EARLY_MINUTES)
    : 15,
  ON_TIME_LATE_MINUTES: process.env.ON_TIME_LATE_MINUTES
    ? Number(process.env.ON_TIME_LATE_MINUTES)
    : 15,
  GOOD_FAITH_SHORT_NOTICE_HOURS: process.env.GOOD_FAITH_SHORT_NOTICE_HOURS
    ? Number(process.env.GOOD_FAITH_SHORT_NOTICE_HOURS)
    : 18,
  MIN_PHOTOS_TOTAL: process.env.MIN_PHOTOS_TOTAL ? Number(process.env.MIN_PHOTOS_TOTAL) : 3,
  MIN_BEFORE_PHOTOS: process.env.MIN_BEFORE_PHOTOS ? Number(process.env.MIN_BEFORE_PHOTOS) : 2,
  MIN_AFTER_PHOTOS: process.env.MIN_AFTER_PHOTOS ? Number(process.env.MIN_AFTER_PHOTOS) : 2,
  PHOTO_RETENTION_DAYS: process.env.PHOTO_RETENTION_DAYS
    ? Number(process.env.PHOTO_RETENTION_DAYS)
    : 90,
  DISPUTE_WINDOW_HOURS: process.env.DISPUTE_WINDOW_HOURS
    ? Number(process.env.DISPUTE_WINDOW_HOURS)
    : 48,
  CLEANER_NOSHOW_BONUS_CREDITS: process.env.CLEANER_NOSHOW_BONUS_CREDITS
    ? Number(process.env.CLEANER_NOSHOW_BONUS_CREDITS)
    : 50,
  NON_CREDIT_SURCHARGE_PERCENT: process.env.NON_CREDIT_SURCHARGE_PERCENT
    ? Number(process.env.NON_CREDIT_SURCHARGE_PERCENT)
    : 10,
  MIN_LEAD_TIME_HOURS: process.env.MIN_LEAD_TIME_HOURS
    ? Number(process.env.MIN_LEAD_TIME_HOURS)
    : 2,
  SUBSCRIPTION_DEFAULT_CREDITS: process.env.SUBSCRIPTION_DEFAULT_CREDITS
    ? Number(process.env.SUBSCRIPTION_DEFAULT_CREDITS)
    : 100,
  CANCELLATION_LOCK_HOURS: process.env.CANCELLATION_LOCK_HOURS
    ? Number(process.env.CANCELLATION_LOCK_HOURS)
    : 1,

  // Integrations (optional but recommended)
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || "",
  N8N_BASE_URL: process.env.N8N_BASE_URL || "", // e.g. https://puretask.app.n8n.cloud/api/v1
  N8N_MCP_SERVER_URL: process.env.N8N_MCP_SERVER_URL || "",
  N8N_API_KEY: process.env.N8N_API_KEY || "",
  APP_URL: process.env.APP_URL || "http://localhost:3000",
  STORAGE_URL: process.env.STORAGE_URL || "https://storage.puretask.com",

  // Monitoring (optional)
  SENTRY_DSN: process.env.SENTRY_DSN || "",

  // Redis (for rate limiting in production)
  REDIS_URL: process.env.REDIS_URL || "",
  USE_REDIS_RATE_LIMITING: process.env.USE_REDIS_RATE_LIMITING === "true",

  // Feature flags
  USE_EVENT_BASED_NOTIFICATIONS: process.env.USE_EVENT_BASED_NOTIFICATIONS !== "false", // Default: true if n8n is configured

  // Notifications - SendGrid (Email)
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "no-reply@puretask.com",

  // Email Template IDs (from SendGrid - see docs/email-registry.md)
  SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED: process.env.SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED || "",
  SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED: process.env.SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED || "",
  SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY:
    process.env.SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY || "",
  SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED: process.env.SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED || "",
  SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED: process.env.SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED || "",
  SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED: process.env.SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED || "",
  SENDGRID_TEMPLATE_USER_JOB_CANCELLED: process.env.SENDGRID_TEMPLATE_USER_JOB_CANCELLED || "",
  SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE:
    process.env.SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE || "",
  SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT: process.env.SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT || "",
  SENDGRID_TEMPLATE_USER_WELCOME: process.env.SENDGRID_TEMPLATE_USER_WELCOME || "",
  SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION:
    process.env.SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION || "",
  SENDGRID_TEMPLATE_USER_PASSWORD_RESET: process.env.SENDGRID_TEMPLATE_USER_PASSWORD_RESET || "",

  // SMS Template IDs (Twilio)
  SMS_TEMPLATE_EMERGENCY: process.env.SMS_TEMPLATE_EMERGENCY || "",
  SMS_TEMPLATE_JOB_REMINDER: process.env.SMS_TEMPLATE_JOB_REMINDER || "",

  // Notifications - Twilio (SMS)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || "",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || "",

  // Notifications - OneSignal (Push)
  ONESIGNAL_APP_ID: process.env.ONESIGNAL_APP_ID || "",
  ONESIGNAL_API_KEY: process.env.ONESIGNAL_API_KEY || "",

  // Alerting
  ALERT_SLACK_WEBHOOK_URL: process.env.ALERT_SLACK_WEBHOOK_URL || "",
  ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO || "",
  ALERT_EMAIL_FROM: process.env.ALERT_EMAIL_FROM || "alerts@puretask.com",

  // V2 Features - Optional
  // Google Calendar Integration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "",

  // OAuth Authentication
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || "",
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET || "",
  FACEBOOK_REDIRECT_URI: process.env.FACEBOOK_REDIRECT_URI || "",

  // AI Features
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",
};

// V1 HARDENING: Boot-time validation
function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isTest =
    env.NODE_ENV === "test" ||
    process.env.RUNNING_TESTS === "true" ||
    typeof process.env.VITEST_WORKER_ID !== "undefined";

  // Check Stripe mode consistency
  if (env.STRIPE_SECRET_KEY) {
    const isTestMode = env.STRIPE_SECRET_KEY.startsWith("sk_test_");
    const isLiveMode = env.STRIPE_SECRET_KEY.startsWith("sk_live_");

    if (!isTestMode && !isLiveMode) {
      errors.push("STRIPE_SECRET_KEY must start with 'sk_test_' or 'sk_live_'");
    }

    // Production safety: warn if test mode in production
    if (env.NODE_ENV === "production" && isTestMode) {
      warnings.push("Using Stripe test key in production — real payments will not process.");
    }

    // Development safety: warn if live mode in development
    if (env.NODE_ENV === "development" && isLiveMode) {
      warnings.push("Using Stripe live key in development — this will process real payments.");
    }
  }

  // Check database URL format
  if (!env.DATABASE_URL.includes("postgres://") && !env.DATABASE_URL.includes("postgresql://")) {
    errors.push("DATABASE_URL must be a valid PostgreSQL connection string");
  }

  // Check for SSL mode (required for Neon and most cloud databases)
  const hasSslMode = env.DATABASE_URL.includes("sslmode=");
  const hasRequireOrPrefer =
    env.DATABASE_URL.includes("sslmode=require") || env.DATABASE_URL.includes("sslmode=prefer");
  if (!hasSslMode) {
    warnings.push(
      "DATABASE_URL missing sslmode. Add ?sslmode=require (Neon and cloud DBs require SSL)."
    );
  } else if (!hasRequireOrPrefer) {
    warnings.push("DATABASE_URL sslmode should be 'require' or 'prefer'. Use ?sslmode=require in production.");
  }

  // Check JWT secret strength in production
  if (env.NODE_ENV === "production" && env.JWT_SECRET.length < 32) {
    warnings.push("JWT_SECRET should be at least 32 characters in production.");
  }

  // Production: Sentry recommended for error visibility
  if (env.NODE_ENV === "production" && !env.SENTRY_DSN) {
    warnings.push(
      "SENTRY_DSN not set — production errors will not be captured. Set in Railway for error tracking."
    );
  }

  // Production: single SSL reminder (avoid duplicate with generic sslmode check above)
  if (env.NODE_ENV === "production" && !env.DATABASE_URL.includes("sslmode=require")) {
    warnings.push("Production DATABASE_URL should include ?sslmode=require for encrypted connections.");
  }

  // CRONS_ENQUEUE_ONLY: durable job worker must run separately (skip in test to reduce noise)
  if (!isTest && env.CRONS_ENQUEUE_ONLY && env.WORKERS_ENABLED) {
    warnings.push(
      "CRONS_ENQUEUE_ONLY=true — run worker:durable-jobs or worker:durable-jobs:loop as a separate process."
    );
  }

  // Check guard flags in production
  if (env.NODE_ENV === "production") {
    if (!env.BOOKINGS_ENABLED) warnings.push("Bookings are DISABLED in production.");
    if (!env.PAYOUTS_ENABLED) warnings.push("Payouts are DISABLED in production.");
    if (!env.CREDITS_ENABLED) warnings.push("Credits are DISABLED in production.");
    if (!env.WORKERS_ENABLED) warnings.push("Workers are DISABLED in production.");
  }

  // Log warnings (skip banner in test to keep output clean)
  if (warnings.length > 0 && !isTest) {
    console.warn("\n" + "=".repeat(60));
    console.warn("ENVIRONMENT WARNINGS:");
    warnings.forEach((w) => console.warn("⚠️  " + w));
    console.warn("=".repeat(60) + "\n");
  }

  // Throw on errors
  if (errors.length > 0) {
    console.error("\n" + "=".repeat(60));
    console.error("ENVIRONMENT VALIDATION FAILED:");
    errors.forEach((e) => console.error(`❌ ${e}`));
    console.error("=".repeat(60) + "\n");
    throw new Error(`Environment validation failed: ${errors.join(", ")}`);
  }
}

// Run validation on module load
validateEnvironment();

// Alias for backwards compatibility
export const config = env;
