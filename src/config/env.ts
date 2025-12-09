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
  // Core
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT ? Number(process.env.PORT) : 4000,
  DATABASE_URL: requireEnv("DATABASE_URL"),

  // Auth
  JWT_SECRET: requireEnv("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "30d",
  BCRYPT_SALT_ROUNDS: process.env.BCRYPT_SALT_ROUNDS ? Number(process.env.BCRYPT_SALT_ROUNDS) : 10,

  // Stripe
  STRIPE_SECRET_KEY: requireEnv("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: requireEnv("STRIPE_WEBHOOK_SECRET"),

  // Payouts
  PAYOUTS_ENABLED: process.env.PAYOUTS_ENABLED === "true",
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

  // GPS check-in radius (per policy: 250 meters)
  GPS_CHECKIN_RADIUS_METERS: process.env.GPS_CHECKIN_RADIUS_METERS ? Number(process.env.GPS_CHECKIN_RADIUS_METERS) : 250,

  // Photo requirements (per policy: minimum 3 total)
  MIN_PHOTOS_TOTAL: process.env.MIN_PHOTOS_TOTAL ? Number(process.env.MIN_PHOTOS_TOTAL) : 3,
  MIN_BEFORE_PHOTOS: process.env.MIN_BEFORE_PHOTOS ? Number(process.env.MIN_BEFORE_PHOTOS) : 2,
  MIN_AFTER_PHOTOS: process.env.MIN_AFTER_PHOTOS ? Number(process.env.MIN_AFTER_PHOTOS) : 2,

  // Photo retention (per policy: 90 days)
  PHOTO_RETENTION_DAYS: process.env.PHOTO_RETENTION_DAYS ? Number(process.env.PHOTO_RETENTION_DAYS) : 90,

  // Dispute window (per policy: 48 hours)
  DISPUTE_WINDOW_HOURS: process.env.DISPUTE_WINDOW_HOURS ? Number(process.env.DISPUTE_WINDOW_HOURS) : 48,

  // No-show compensation for clients (per policy)
  CLEANER_NOSHOW_BONUS_CREDITS: process.env.CLEANER_NOSHOW_BONUS_CREDITS ? Number(process.env.CLEANER_NOSHOW_BONUS_CREDITS) : 50,

  // Surcharge for non-credit (direct card) payments
  // e.g. 5 = 5%, 10 = 10% - applied on top of base price for job_charge payments
  NON_CREDIT_SURCHARGE_PERCENT: process.env.NON_CREDIT_SURCHARGE_PERCENT 
    ? Number(process.env.NON_CREDIT_SURCHARGE_PERCENT) 
    : 10,

  // Lead time before start (hours)
  MIN_LEAD_TIME_HOURS: process.env.MIN_LEAD_TIME_HOURS ? Number(process.env.MIN_LEAD_TIME_HOURS) : 2,

  // Subscription credits fallback (if invoice metadata missing)
  SUBSCRIPTION_DEFAULT_CREDITS: process.env.SUBSCRIPTION_DEFAULT_CREDITS
    ? Number(process.env.SUBSCRIPTION_DEFAULT_CREDITS)
    : 100,

  // Cancellation lock window (hours before start where cancellation is disallowed unless emergency)
  CANCELLATION_LOCK_HOURS: process.env.CANCELLATION_LOCK_HOURS
    ? Number(process.env.CANCELLATION_LOCK_HOURS)
    : 1,

  // n8n Integration
  N8N_WEBHOOK_SECRET: requireEnv("N8N_WEBHOOK_SECRET"),
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || "",

  // App URLs
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
};

// Alias for backwards compatibility
export const config = env;
