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
  CENTS_PER_CREDIT: process.env.CENTS_PER_CREDIT ? Number(process.env.CENTS_PER_CREDIT) : 100,

  // Surcharge for non-credit (direct card) payments
  // e.g. 5 = 5%, 10 = 10% - applied on top of base price for job_charge payments
  NON_CREDIT_SURCHARGE_PERCENT: process.env.NON_CREDIT_SURCHARGE_PERCENT 
    ? Number(process.env.NON_CREDIT_SURCHARGE_PERCENT) 
    : 10,

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
};

// Alias for backwards compatibility
export const config = env;
