// src/index.ts
// Main application entry point

// ============================================
// CRITICAL: Initialize Sentry FIRST, before ANY other imports
// This allows Sentry to properly instrument Express, HTTP, and database calls
// ============================================
require("./instrument");

// Now safe to import everything else
import express from "express";
import helmet from "helmet";
import cors from "cors";
import * as Sentry from "@sentry/node"; // Import for use in error handler, NOT for init
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
import governorRouter from "./routes/governor"; // Step 18: Marketplace Health Governor (runtime state)
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
// Sentry is already initialized in instrument.ts (required at top of file)
// DO NOT call Sentry.init() here - it's already done!
// ============================================
if (env.SENTRY_DSN) {
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
  if (req.path === "/stripe/webhook" || req.path === "/api/v1/stripe/webhook") {
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
// Request Logging & Metrics
// ============================================
app.use((req, res, next) => {
  const start = Date.now();

  // Enrich context with user info if available
  if (req.user) {
    enrichRequestContext(req);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    // Log request
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

    // Record metrics (skip health/status endpoints to reduce noise)
    if (!req.path.startsWith("/health") && !req.path.startsWith("/status")) {
      const { metrics } = require("./lib/metrics");
      metrics.apiRequest(req.method, req.path, res.statusCode, duration);
      
      // Record error metrics for 4xx/5xx responses
      if (res.statusCode >= 400) {
        const errorCode = res.statusCode >= 500 ? "5xx" : "4xx";
        metrics.errorOccurred(errorCode, req.path);
      }
    }
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
// Routes (Section 7: /api/v1 prefix for versioning)
// ============================================
const apiRouter = express.Router();
apiRouter.use("/health", healthRouter);
apiRouter.use("/status", statusRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/auth", authEnhancedRouter);
apiRouter.use("/jobs", jobsRouter);
apiRouter.use("/assignment", assignmentRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/admin", adminEnhancedRouter);
apiRouter.use("/stripe", stripeRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/credits", creditsRouter);
apiRouter.use("/messages", messagesRouter);
apiRouter.use("/analytics", analyticsRouter);
apiRouter.use("/search", searchRouter);
apiRouter.use("/cleaner", cleanerRouter);
apiRouter.use("/cleaner/onboarding", cleanerOnboardingRouter);
apiRouter.use("/admin/onboarding-reminders", onboardingReminderRouter);
apiRouter.use("/admin/id-verifications", adminIdVerificationsRouter);
apiRouter.use("/cleaner/ai/advanced", cleanerAIAdvancedRouter);
apiRouter.use("/cleaner/ai", cleanerAIRouter);
apiRouter.use("/cleaner", messageHistoryRouter);
apiRouter.use("/cleaner", gamificationRouter);
apiRouter.use("/governor", governorRouter);
apiRouter.use("/cleaner", cleanerPortalRouter);
apiRouter.use("/cleaner", cleanerEnhancedRouter);
apiRouter.use("/client", clientInvoicesRouter);
apiRouter.use("/client", clientRouter);
apiRouter.use("/client", clientEnhancedRouter);
apiRouter.use("/tracking", trackingRouter);
apiRouter.use("/premium", premiumRouter);
apiRouter.use("/manager", managerRouter);
apiRouter.use("/v2", v2Router);
apiRouter.use("/pricing", pricingRouter);
apiRouter.use("/holidays", holidaysRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/alerts", alertsRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/user", userDataRouter);
apiRouter.use(eventsRouter);

// Mount at root (backward compat) and /api/v1 (Section 7)
app.use("/", apiRouter);
app.use("/api/v1", apiRouter);

// ============================================
// 404 Handler
// ============================================
app.use((req, res) => {
  const requestId = (req as any).requestId ?? (res.locals as any)?.requestId;
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
      ...(requestId ? { requestId } : {}),
    },
  });
});

// ============================================
// Sentry Express Error Handler
// ============================================
// Register Sentry's Express error handler AFTER all routes
// This captures unhandled errors and attaches Sentry event ID to response (res.sentry)
if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ============================================
// Global Error Handler (runs after Sentry handler)
// ============================================
// Note: Sentry already captured the error above, so we just log and respond
app.use(
  (
    err: Error & { statusCode?: number; code?: string },
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";

    // Record error metrics
    const { metrics } = require("./lib/metrics");
    metrics.errorOccurred(code, req.path);

    // Note: Sentry already captured the error via setupExpressErrorHandler above
    // We don't need to call Sentry.captureException() again to avoid double-capture

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

    const requestId = (req as any).requestId ?? (res.locals as any)?.requestId;
    res.status(statusCode).json({
      error: { code, message, ...(requestId ? { requestId } : {}) },
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
