// src/index.ts
// Main application entry point

import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { authMiddlewareAttachUser } from "./lib/auth";
import {
  generalRateLimiter,
  endpointRateLimiter,
  additionalSecurityHeaders,
  sanitizeBody,
} from "./lib/security";
import { requestContextMiddleware, enrichRequestContext } from "./middleware/requestContext";

// Import routes
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import jobsRouter from "./routes/jobs";
import adminRouter from "./routes/admin";
import stripeRouter from "./routes/stripe";
import eventsRouter from "./routes/events";
import paymentsRouter from "./routes/payments";
import creditsRouter from "./routes/credits";
import messagesRouter from "./routes/messages";
// V2 FEATURE — DISABLED FOR NOW (advanced KPIs)
// import analyticsRouter from "./routes/analytics";
import cleanerRouter from "./routes/cleaner";
import trackingRouter from "./routes/tracking";
// V2 FEATURE — DISABLED FOR NOW (goals/boosts/subscriptions)
// import premiumRouter from "./routes/premium";
// V2 FEATURE — DISABLED FOR NOW (manager/advanced dashboards)
// import managerRouter from "./routes/manager";
// V2 FEATURE — DISABLED FOR NOW (next-gen APIs)
// import v2Router from "./routes/v2";
import assignmentRouter from "./routes/assignment";
import alertsRouter from "./routes/alerts";
import cleanerPortalRouter from "./routes/cleanerPortal";
import clientInvoicesRouter from "./routes/clientInvoices";
import statusRouter from "./routes/status";

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
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginEmbedderPolicy: false,
}));

// Additional security headers
app.use(additionalSecurityHeaders);

// Request context for tracing (generates request ID)
app.use(requestContextMiddleware);

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
// Use fine-grained endpoint rate limiter (falls back to general limiter)
app.use(endpointRateLimiter());

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
    });
  });

  next();
});

// ============================================
// Routes
// ============================================
app.use("/health", healthRouter);
app.use("/status", statusRouter);  // Operational status dashboard
app.use("/auth", authRouter);
app.use("/jobs", jobsRouter);
app.use("/assignment", assignmentRouter);
app.use("/admin", adminRouter);
app.use("/stripe", stripeRouter);
app.use("/payments", paymentsRouter);
app.use("/credits", creditsRouter);
app.use("/messages", messagesRouter);
// V2 FEATURE — DISABLED FOR NOW (advanced KPIs)
// app.use("/analytics", analyticsRouter);
app.use("/cleaner", cleanerRouter);
app.use("/cleaner", cleanerPortalRouter); // Cleaner portal: my clients + invoicing
app.use("/client", clientInvoicesRouter); // Client invoice management
app.use("/tracking", trackingRouter);   // Job live tracking
// V2 FEATURE — DISABLED FOR NOW (goals/boosts/subscriptions)
// app.use("/premium", premiumRouter);     // Boosts, subscriptions, referrals
// V2 FEATURE — DISABLED FOR NOW (manager/advanced dashboards)
// app.use("/manager", managerRouter);     // Manager dashboard
// V2 FEATURE — DISABLED FOR NOW (next-gen APIs)
// app.use("/v2", v2Router);               // V2 features: properties, teams, calendar, AI
app.use("/alerts", alertsRouter);
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
  
  server = app.listen(PORT, () => {
    logger.info("server_started", {
      port: PORT,
      env: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
    console.log(`🚀 PureTask Backend running on port ${PORT}`);
  });

  // ============================================
  // Graceful Shutdown
  // ============================================
  const gracefulShutdown = async (signal: string) => {
    logger.info("shutdown_initiated", { signal });

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
