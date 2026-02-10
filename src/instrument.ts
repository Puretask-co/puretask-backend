// src/instrument.ts
// Sentry initialization - MUST be the ONLY place Sentry.init() is called
// This file must be required FIRST, before any other imports in index.ts
// 
// Why this file exists:
// - Sentry must be initialized exactly once, as early as possible
// - This allows Sentry to properly instrument Express, HTTP, and database calls
// - If initialized multiple times or too late: errors don't get captured, performance traces break

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { env } from "./config/env";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN, // Use env var (set in Railway or .env)
    environment: env.NODE_ENV || "development",

    integrations: [nodeProfilingIntegration()],

    enableLogs: true,

    // ✅ Production-safe defaults (change anytime)
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0, // 10% in prod, 100% in dev
    profileSessionSampleRate: env.NODE_ENV === "production" ? 0.05 : 1.0, // 5% in prod, 100% in dev
    profileLifecycle: "trace",

    // ⚠️ Turned OFF in prod - don't send customer addresses, cleaner names, etc.
    sendDefaultPii: false,
  });
}

// Export Sentry for use in other files (but NEVER call Sentry.init() again!)
export { Sentry };
