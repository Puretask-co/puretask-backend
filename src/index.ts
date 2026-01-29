// src/index.ts
// Main application entry point

import express from "express";
import helmet from "helmet";
import cors from "cors";
import * as Sentry from "@sentry/node";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { initRedis, closeRedis } from "./lib/redis";
import { authMiddlewareAttachUser } from "./lib/auth";
import {
  generalRateLimiter,
  endpointRateLimiter,
  additionalSecurityHeaders,
  sanitizeBody,
} from "./lib/security";
import { requestContextMiddleware, enrichRequestContext } from "./middleware/requestContext";
import { redactHeaders } from "./lib/logRedaction";

// Import routes
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import authEnhancedRouter from "./routes/authEnhanced"; // New enhanced auth routes
import jobsRouter from "./routes/jobs";
import adminRouter from "./routes/admin/index"; // V4 FEATURE: Comprehensive admin dashboard
import stripeRouter from "./routes/stripe";
import eventsRouter from "./routes/events";
import paymentsRouter from "./routes/payments";
import creditsRouter from "./routes/credits";
import messagesRouter from "./routes/messages";
// V4 FEATURE — ENABLED (analytics dashboards)
import analyticsRouter from "./routes/analytics";
import cleanerRouter from "./routes/cleaner";
import cleanerOnboardingRouter from "./routes/cleanerOnboarding";
import onboardingReminderRouter from "./routes/onboardingReminders";
import adminIdVerificationsRouter from "./routes/adminIdVerifications";
import searchRouter from "./routes/search"; // Search/browse cleaners
import searchGlobalRouter from "./routes/search"; // Global search and autocomplete
import cleanerAIRouter from "./routes/cleaner-ai-settings"; // V4 FEATURE: AI Assistant Settings for Cleaners
import cleanerAIAdvancedRouter from "./routes/cleaner-ai-advanced"; // V4 FEATURE: Advanced AI features (export, preview, etc.)
import gamificationRouter from "./routes/gamification"; // V4 FEATURE: Gamification & Onboarding
import messageHistoryRouter from "./routes/message-history"; // V4 FEATURE: Message History & Saved Messages
import trackingRouter from "./routes/tracking";
// V3 FEATURE — ENABLED (subscriptions)
import premiumRouter from "./routes/premium";
// V4 FEATURE — ENABLED (manager dashboard)
import managerRouter from "./routes/manager";
// V2 FEATURE — ENABLED
import v2Router from "./routes/v2";
import assignmentRouter from "./routes/assignment";
import alertsRouter from "./routes/alerts";
import cleanerPortalRouter from "./routes/cleanerPortal";
import clientInvoicesRouter from "./routes/clientInvoices";
import clientRouter from "./routes/client";
import clientEnhancedRouter from "./routes/clientEnhanced";
import cleanerEnhancedRouter from "./routes/cleanerEnhanced";
import adminEnhancedRouter from "./routes/adminEnhanced";
import statusRouter from "./routes/status";
import pricingRouter from "./routes/pricing";
import holidaysRouter from "./routes/holidays";
import notificationsRouter from "./routes/notifications";
// V4 FEATURE — AI ASSISTANT (communication automation & scheduling)
import aiRouter from "./routes/ai";
import userDataRouter from "./routes/userData";

// ============================================
// Initialize Sentry (Error Tracking) - Must be before Express app
// ============================================
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Performance Monitoring
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0, // 10% in prod, 100% in dev
  });
  logger.info("sentry_initialized", { environment: env.NODE_ENV });
} else {
  logger.warn("sentry_not_configured", { message: "SENTRY_DSN not set, error tracking disabled" });
}

// Create Express app
const app = express();

// ============================================
// Trust Proxy (for rate limiting behind LB)
// ============================================
app.set("trust proxy", 1);

// ============================================
// Security Middleware
// ============================================

// Helmet for secure headers
app.use(helmet({
  contentSecurityPolicy: false, // We handle CSP manually for API
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// Enhanced security headers (includes CSP)
import { securityHeaders } from "./middleware/security";
app.use(securityHeaders);

// Additional security headers
app.use(additionalSecurityHeaders);

// Request context for tracing (generates request ID)
app.use(requestContextMiddleware);

// Store requestId in response locals for error handler
app.use((req, res, next) => {
  res.locals.requestId = req.requestId;
  (res as any).requestId = req.requestId;
  next();
});

// CORS configuration
app.use(
  cors({
    origin: [
      "https://app.puretask.com",
      "https://admin.puretask.com",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-n8n-signature"],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);

// ============================================
// Body Parsing (with special handling for Stripe)
// ============================================
app.use((req, res, next) => {
  if (req.path === "/stripe/webhook") {
    // Stripe needs raw body for signature verification
    express.raw({ type: "application/json", limit: "500kb" })(req, res, next);
  } else {
    // Standard JSON parsing with size limit
    express.json({ limit: "1mb" })(req, res, next);
  }
});

// Sanitize request body
app.use(sanitizeBody);

// ============================================
// Rate Limiting
// ============================================
// Use Redis-based rate limiting in production if enabled, otherwise use in-memory
if (env.USE_REDIS_RATE_LIMITING && env.REDIS_URL) {
  const { productionGeneralRateLimiter } = require("./lib/rateLimitRedis");
  app.use(productionGeneralRateLimiter);
  logger.info("rate_limiting_redis_enabled");
} else {
  // Use fine-grained endpoint rate limiter (falls back to general limiter)
  app.use(endpointRateLimiter());
  logger.info("rate_limiting_memory_enabled");
}

// ============================================
// Authentication
// ============================================
// Attach user to request if valid JWT present (doesn't enforce auth)
app.use(authMiddlewareAttachUser);

// ============================================
// Request Logging
// ============================================
app.use((req, res, next) => {
  const start = Date.now();

  // Enrich context with user info if available
  if (req.user) {
    enrichRequestContext(req);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("http_request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      userId: req.user?.id ?? null,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      requestId: req.requestId,
      correlationId: req.correlationId,
      // Headers are redacted automatically by logger
    });
  });

  next();
});

// ============================================
// API Documentation (Swagger/OpenAPI)
// ============================================
if (env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const swaggerUi = require('swagger-ui-express');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { swaggerSpec } = require('./config/swagger');
    
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'PureTask API Documentation',
    }));
    
    logger.info('swagger_ui_enabled', { path: '/api-docs' });
  } catch (error) {
    logger.warn('swagger_ui_failed', { error: (error as Error).message });
  }
}

// ============================================
// Routes
// ============================================
app.use("/health", healthRouter);
app.use("/status", statusRouter);  // Operational status dashboard
app.use("/auth", authRouter); // Basic auth routes (register, login, etc.)
app.use("/auth", authEnhancedRouter); // Enhanced auth routes (2FA, OAuth, sessions, etc.)
app.use("/jobs", jobsRouter);
app.use("/assignment", assignmentRouter);
app.use("/admin", adminRouter);
app.use("/admin", adminEnhancedRouter); // Enhanced admin routes (real-time, insights, etc.)
app.use("/stripe", stripeRouter);
app.use("/payments", paymentsRouter);
app.use("/credits", creditsRouter);
app.use("/messages", messagesRouter);
// V4 FEATURE — ENABLED (analytics dashboards)
app.use("/analytics", analyticsRouter);
app.use("/search", searchRouter); // Search/browse cleaners + global search/autocomplete
app.use("/cleaner", cleanerRouter);
app.use("/cleaner/onboarding", cleanerOnboardingRouter); // Enhanced 10-step onboarding
app.use("/admin/onboarding-reminders", onboardingReminderRouter); // Onboarding reminder management
app.use("/admin/id-verifications", adminIdVerificationsRouter); // Admin ID verification dashboard
app.use("/cleaner/ai/advanced", cleanerAIAdvancedRouter); // V4 FEATURE: Advanced AI features
app.use("/cleaner/ai", cleanerAIRouter); // V4 FEATURE: AI Assistant Settings for Cleaners
app.use("/cleaner", messageHistoryRouter); // V4 FEATURE: Message History & Saved Messages
app.use("/cleaner", gamificationRouter); // V4 FEATURE: Gamification & Onboarding
app.use("/cleaner", cleanerPortalRouter); // Cleaner portal: my clients + invoicing
app.use("/cleaner", cleanerEnhancedRouter); // Enhanced cleaner routes (analytics, goals, etc.)
app.use("/client", clientInvoicesRouter); // Client invoice management
app.use("/client", clientRouter); // Client routes (favorites, addresses, payment methods, recurring bookings, reviews)
app.use("/client", clientEnhancedRouter); // Enhanced client routes (insights, drafts, etc.)
app.use("/tracking", trackingRouter);   // Job live tracking
// V3 FEATURE — ENABLED (subscriptions)
app.use("/premium", premiumRouter);     // Boosts, subscriptions, referrals
// V4 FEATURE — ENABLED (manager dashboard)
app.use("/manager", managerRouter);     // Manager dashboard
// V2 FEATURE — ENABLED
app.use("/v2", v2Router);               // V2 features: properties, teams, calendar, AI
app.use("/pricing", pricingRouter);     // V3 feature: tier-aware pricing
app.use("/holidays", holidaysRouter);   // Federal holiday source of truth
app.use("/notifications", notificationsRouter);
app.use("/alerts", alertsRouter);
// V4 FEATURE — ENABLED (AI Assistant)
app.use("/ai", aiRouter);               // AI communication automation & scheduling
app.use("/user", userDataRouter);       // GDPR compliance: data export, deletion, consent
app.use(eventsRouter); // Mounts /events and /n8n/events

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// ============================================
// Sentry Integration
// ============================================
// Note: Sentry v10+ automatically instruments Express
// No manual request/tracing handlers needed - Sentry.init() handles it

// ============================================
// Global Error Handler
// ============================================
app.use(
  (
    err: Error & { statusCode?: number; code?: string },
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";

    // Send to Sentry if configured
    if (env.SENTRY_DSN && statusCode >= 500) {
      Sentry.captureException(err, {
        tags: {
          path: req.path,
          method: req.method,
          statusCode,
          errorCode: code,
        },
        user: req.user ? { id: req.user.id } : undefined,
        extra: {
          requestId: req.requestId,
        },
      });
    }

    logger.error("unhandled_error", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
    });

    // Don't leak error details in production
    const message =
      env.NODE_ENV === "production" && statusCode === 500
        ? "Internal server error"
        : err.message;

    res.status(statusCode).json({
      error: { code, message },
    });
  }
);

// ============================================
// Server Startup
// ============================================
// Only start server if not in test mode
// Tests import the app but don't need the server running
const isTestMode = process.env.RUNNING_TESTS === 'true' ||
                   process.env.NODE_ENV === 'test' || 
                   process.env.VITEST === 'true' ||
                   typeof process.env.VITEST_WORKER_ID !== 'undefined';

let server: ReturnType<typeof app.listen> | null = null;

if (!isTestMode) {
  const PORT = env.PORT;
  
  // Initialize Redis for rate limiting
  initRedis().catch((err) => {
    logger.warn("redis_init_skipped", {
      error: err.message,
      fallback: "Using in-memory rate limiting",
    });
  });
  
  // Bind to 0.0.0.0 for Railway/Docker compatibility
  server = app.listen(PORT, "0.0.0.0", () => {
    logger.info("server_started", {
      port: PORT,
      host: "0.0.0.0",
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
    console.log(`🚀 PureTask Backend running on 0.0.0.0:${PORT}`);
  });

  // ============================================
  // Graceful Shutdown
  // ============================================
  const gracefulShutdown = async (signal: string) => {
    logger.info("shutdown_initiated", { signal });

    // Close Redis connection
    await closeRedis();

    if (server) {
      server.close(() => {
        logger.info("server_closed");
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error("forced_shutdown", { reason: "timeout" });
        process.exit(1);
      }, 30000);
    } else {
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

// Export for testing
export default app;
