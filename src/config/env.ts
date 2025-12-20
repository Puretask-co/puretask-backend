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

  // Auth
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "30d",
  BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS ? Number(process.env.BCRYPT_SALT_ROUNDS) : 10,

  // V1 HARDENING: Production Guard Flags (kill switches)
  BOOKINGS_ENABLED: process.env.BOOKINGS_ENABLED !== "false", // Default: enabled
  PAYOUTS_ENABLED: process.env.PAYOUTS_ENABLED === "true",
  CREDITS_ENABLED: process.env.CREDITS_ENABLED !== "false", // Default: enabled
  REFUNDS_ENABLED: process.env.REFUNDS_ENABLED !== "false", // Default: enabled
  WORKERS_ENABLED: process.env.WORKERS_ENABLED !== "false", // Default: enabled
  
  // Payouts
  PAYOUT_CURRENCY: process.env.PAYOUT_CURRENCY || "usd",
  // Credit system: 10 credits = $1 USD (per policy)
  CENTS_PER_CREDIT: process.env.CENTS_PER_CREDIT ? Number(process.env.CENTS_PER_CREDIT) : 10,

  // Platform fee and cleaner payout configuration (per Terms of Service)
  PLATFORM_FEE_PERCENT: process.env.PLATFORM_FEE_PERCENT ? Number(process.env.PLATFORM_FEE_PERCENT) : 15,
  // Cleaner payout percentages by tier (cleaners receive 80-85% of booking amount)
  CLEANER_PAYOUT_PERCENT_BRONZE: process.env.CLEANER_PAYOUT_PERCENT_BRONZE ? Number(process.env.CLEANER_PAYOUT_PERCENT_BRONZE) : 80,
  CLEANER_PAYOUT_PERCENT_SILVER: process.env.CLEANER_PAYOUT_PERCENT_SILVER ? Number(process.env.CLEANER_PAYOUT_PERCENT_SILVER) : 82,
  CLEANER_PAYOUT_PERCENT_GOLD: process.env.CLEANER_PAYOUT_PERCENT_GOLD ? Number(process.env.CLEANER_PAYOUT_PERCENT_GOLD) : 84,
  CLEANER_PAYOUT_PERCENT_PLATINUM: process.env.CLEANER_PAYOUT_PERCENT_PLATINUM ? Number(process.env.CLEANER_PAYOUT_PERCENT_PLATINUM) : 85,

  // Operational defaults (optional)
  GPS_CHECKIN_RADIUS_METERS: process.env.GPS_CHECKIN_RADIUS_METERS ? Number(process.env.GPS_CHECKIN_RADIUS_METERS) : 250,
  MIN_PHOTOS_TOTAL: process.env.MIN_PHOTOS_TOTAL ? Number(process.env.MIN_PHOTOS_TOTAL) : 3,
  MIN_BEFORE_PHOTOS: process.env.MIN_BEFORE_PHOTOS ? Number(process.env.MIN_BEFORE_PHOTOS) : 2,
  MIN_AFTER_PHOTOS: process.env.MIN_AFTER_PHOTOS ? Number(process.env.MIN_AFTER_PHOTOS) : 2,
  PHOTO_RETENTION_DAYS: process.env.PHOTO_RETENTION_DAYS ? Number(process.env.PHOTO_RETENTION_DAYS) : 90,
  DISPUTE_WINDOW_HOURS: process.env.DISPUTE_WINDOW_HOURS ? Number(process.env.DISPUTE_WINDOW_HOURS) : 48,
  CLEANER_NOSHOW_BONUS_CREDITS: process.env.CLEANER_NOSHOW_BONUS_CREDITS ? Number(process.env.CLEANER_NOSHOW_BONUS_CREDITS) : 50,
  NON_CREDIT_SURCHARGE_PERCENT: process.env.NON_CREDIT_SURCHARGE_PERCENT
    ? Number(process.env.NON_CREDIT_SURCHARGE_PERCENT)
    : 10,
  MIN_LEAD_TIME_HOURS: process.env.MIN_LEAD_TIME_HOURS ? Number(process.env.MIN_LEAD_TIME_HOURS) : 2,
  SUBSCRIPTION_DEFAULT_CREDITS: process.env.SUBSCRIPTION_DEFAULT_CREDITS
    ? Number(process.env.SUBSCRIPTION_DEFAULT_CREDITS)
    : 100,
  CANCELLATION_LOCK_HOURS: process.env.CANCELLATION_LOCK_HOURS
    ? Number(process.env.CANCELLATION_LOCK_HOURS)
    : 1,

  // Integrations (optional but recommended)
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || "",
  APP_URL: process.env.APP_URL || "http://localhost:3000",
  STORAGE_URL: process.env.STORAGE_URL || "https://storage.puretask.com",

  // Notifications - SendGrid (Email)
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || "no-reply@puretask.com",

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

  // AI Features
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",
};

// V1 HARDENING: Boot-time validation
function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check Stripe mode consistency
  if (env.STRIPE_SECRET_KEY) {
    const isTestMode = env.STRIPE_SECRET_KEY.startsWith("sk_test_");
    const isLiveMode = env.STRIPE_SECRET_KEY.startsWith("sk_live_");
    
    if (!isTestMode && !isLiveMode) {
      errors.push("STRIPE_SECRET_KEY must start with 'sk_test_' or 'sk_live_'");
    }
    
    // Production safety: warn if test mode in production
    if (env.NODE_ENV === "production" && isTestMode) {
      warnings.push("⚠️  WARNING: Using Stripe test key in production! This will not process real payments.");
    }
    
    // Development safety: warn if live mode in development
    if (env.NODE_ENV === "development" && isLiveMode) {
      warnings.push("⚠️  WARNING: Using Stripe live key in development! This will process real payments.");
    }
  }

      // Check database URL format
      if (!env.DATABASE_URL.includes("postgres://") && !env.DATABASE_URL.includes("postgresql://")) {
        errors.push("DATABASE_URL must be a valid PostgreSQL connection string");
      }
      
      // Check for SSL mode (required for Neon and most cloud databases)
      if (!env.DATABASE_URL.includes("sslmode=")) {
        warnings.push("⚠️  WARNING: DATABASE_URL missing sslmode parameter. Neon and most cloud databases require SSL. Add ?sslmode=require to your connection string.");
      } else if (!env.DATABASE_URL.includes("sslmode=require") && !env.DATABASE_URL.includes("sslmode=prefer")) {
        warnings.push("⚠️  WARNING: DATABASE_URL sslmode is not 'require' or 'prefer'. For production, use ?sslmode=require");
      }

  // Check JWT secret strength in production
  if (env.NODE_ENV === "production" && env.JWT_SECRET.length < 32) {
    warnings.push("⚠️  WARNING: JWT_SECRET should be at least 32 characters in production");
  }

  // Check guard flags in production
  if (env.NODE_ENV === "production") {
    if (!env.BOOKINGS_ENABLED) {
      warnings.push("⚠️  INFO: Bookings are DISABLED in production");
    }
    if (!env.PAYOUTS_ENABLED) {
      warnings.push("⚠️  INFO: Payouts are DISABLED in production");
    }
    if (!env.CREDITS_ENABLED) {
      warnings.push("⚠️  INFO: Credits are DISABLED in production");
    }
    if (!env.WORKERS_ENABLED) {
      warnings.push("⚠️  INFO: Workers are DISABLED in production");
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn("\n" + "=".repeat(60));
    console.warn("ENVIRONMENT WARNINGS:");
    warnings.forEach((w) => console.warn(w));
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
