"use strict";
// src/index.ts
// Main application entry point
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const env_1 = require("./config/env");
const logger_1 = require("./lib/logger");
const auth_1 = require("./lib/auth");
const security_1 = require("./lib/security");
// Import routes
const health_1 = __importDefault(require("./routes/health"));
const auth_2 = __importDefault(require("./routes/auth"));
const jobs_1 = __importDefault(require("./routes/jobs"));
const admin_1 = __importDefault(require("./routes/admin"));
const stripe_1 = __importDefault(require("./routes/stripe"));
const events_1 = __importDefault(require("./routes/events"));
const payments_1 = __importDefault(require("./routes/payments"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const cleaner_1 = __importDefault(require("./routes/cleaner"));
const tracking_1 = __importDefault(require("./routes/tracking"));
const premium_1 = __importDefault(require("./routes/premium"));
const manager_1 = __importDefault(require("./routes/manager"));
const v2_1 = __importDefault(require("./routes/v2"));
// Create Express app
const app = (0, express_1.default)();
// ============================================
// Trust Proxy (for rate limiting behind LB)
// ============================================
app.set("trust proxy", 1);
// ============================================
// Security Middleware
// ============================================
// Helmet for secure headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
}));
// Additional security headers
app.use(security_1.additionalSecurityHeaders);
// CORS configuration
app.use((0, cors_1.default)({
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
}));
// ============================================
// Body Parsing (with special handling for Stripe)
// ============================================
app.use((req, res, next) => {
    if (req.path === "/stripe/webhook") {
        // Stripe needs raw body for signature verification
        express_1.default.raw({ type: "application/json", limit: "500kb" })(req, res, next);
    }
    else {
        // Standard JSON parsing with size limit
        express_1.default.json({ limit: "1mb" })(req, res, next);
    }
});
// Sanitize request body
app.use(security_1.sanitizeBody);
// ============================================
// Rate Limiting
// ============================================
// Use fine-grained endpoint rate limiter (falls back to general limiter)
app.use((0, security_1.endpointRateLimiter)());
// ============================================
// Authentication
// ============================================
// Attach user to request if valid JWT present (doesn't enforce auth)
app.use(auth_1.authMiddlewareAttachUser);
// ============================================
// Request Logging
// ============================================
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        logger_1.logger.info("request", {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            userId: req.user?.id ?? null,
            ip: req.ip,
        });
    });
    next();
});
// ============================================
// Routes
// ============================================
app.use("/health", health_1.default);
app.use("/auth", auth_2.default);
app.use("/jobs", jobs_1.default);
app.use("/admin", admin_1.default);
app.use("/stripe", stripe_1.default);
app.use("/payments", payments_1.default);
app.use("/analytics", analytics_1.default);
app.use("/cleaner", cleaner_1.default);
app.use("/tracking", tracking_1.default); // Job live tracking
app.use("/premium", premium_1.default); // Boosts, subscriptions, referrals
app.use("/manager", manager_1.default); // Manager dashboard
app.use("/v2", v2_1.default); // V2 features: properties, teams, calendar, AI
app.use(events_1.default); // Mounts /events and /n8n/events
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
app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || "INTERNAL_ERROR";
    logger_1.logger.error("unhandled_error", {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
    });
    // Don't leak error details in production
    const message = env_1.env.NODE_ENV === "production" && statusCode === 500
        ? "Internal server error"
        : err.message;
    res.status(statusCode).json({
        error: { code, message },
    });
});
// ============================================
// Server Startup
// ============================================
const PORT = env_1.env.PORT;
const server = app.listen(PORT, () => {
    logger_1.logger.info("server_started", {
        port: PORT,
        env: env_1.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
    console.log(`🚀 PureTask Backend running on port ${PORT}`);
});
// ============================================
// Graceful Shutdown
// ============================================
async function gracefulShutdown(signal) {
    logger_1.logger.info("shutdown_initiated", { signal });
    server.close(() => {
        logger_1.logger.info("server_closed");
        process.exit(0);
    });
    // Force close after 30 seconds
    setTimeout(() => {
        logger_1.logger.error("forced_shutdown", { reason: "timeout" });
        process.exit(1);
    }, 30000);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
// Export for testing
exports.default = app;
