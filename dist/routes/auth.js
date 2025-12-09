"use strict";
// src/routes/auth.ts
// Authentication routes: register, login, me, password management
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../lib/auth");
const security_1 = require("../lib/security");
const authService_1 = require("../services/authService");
const logger_1 = require("../lib/logger");
const authRouter = (0, express_1.Router)();
// Apply stricter rate limiting to all auth routes
authRouter.use(security_1.authRateLimiter);
// ============================================
// Validation Schemas
// ============================================
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters"),
    role: zod_1.z.enum(["client", "cleaner"]).optional(), // admin cannot self-register
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email("Invalid email format"),
    password: zod_1.z.string().min(1, "Password is required"),
});
const updatePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string().min(8, "New password must be at least 8 characters"),
});
const updateClientProfileSchema = zod_1.z.object({
    default_address: zod_1.z.string().optional(),
});
const updateCleanerProfileSchema = zod_1.z.object({
    tier: zod_1.z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
    hourly_rate_credits: zod_1.z.number().positive().optional(),
});
// ============================================
// Routes
// ============================================
/**
 * POST /auth/register
 * Register a new user (client or cleaner)
 * Returns JWT token and user info
 */
authRouter.post("/register", async (req, res) => {
    try {
        const parsed = registerSchema.parse(req.body);
        const user = await (0, authService_1.registerUser)({
            email: parsed.email,
            password: parsed.password,
            role: parsed.role,
        });
        const token = (0, auth_1.signAuthToken)({
            id: user.id,
            role: user.role,
        });
        res.status(201).json({
            token,
            user: (0, authService_1.sanitizeUser)(user),
        });
    }
    catch (err) {
        const error = err;
        // Handle Zod validation errors
        if (error.issues) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
            });
        }
        // Handle known errors
        const status = error.statusCode ?? 500;
        res.status(status).json({
            error: { code: error.code ?? "REGISTER_FAILED", message: error.message },
        });
    }
});
/**
 * POST /auth/login
 * Authenticate user and return JWT token
 */
authRouter.post("/login", async (req, res) => {
    try {
        const parsed = loginSchema.parse(req.body);
        const user = await (0, authService_1.loginUser)(parsed.email, parsed.password);
        const token = (0, auth_1.signAuthToken)({
            id: user.id,
            role: user.role,
        });
        res.json({
            token,
            user: (0, authService_1.sanitizeUser)(user),
        });
    }
    catch (err) {
        const error = err;
        if (error.issues) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
            });
        }
        const status = error.statusCode ?? 500;
        res.status(status).json({
            error: { code: error.code ?? "LOGIN_FAILED", message: error.message },
        });
    }
});
/**
 * GET /auth/me
 * Get current authenticated user info
 */
authRouter.get("/me", (0, auth_1.auth)(), async (req, res) => {
    try {
        const userId = req.user.id;
        const data = await (0, authService_1.getUserWithProfile)(userId);
        if (!data) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "User not found" },
            });
        }
        res.json({
            user: (0, authService_1.sanitizeUser)(data.user),
            profile: data.clientProfile ?? data.cleanerProfile ?? null,
        });
    }
    catch (err) {
        logger_1.logger.error("get_me_failed", { error: err.message, userId: req.user?.id });
        res.status(500).json({
            error: { code: "FETCH_FAILED", message: "Failed to fetch user" },
        });
    }
});
/**
 * PUT /auth/password
 * Update current user's password
 */
authRouter.put("/password", (0, auth_1.auth)(), async (req, res) => {
    try {
        const parsed = updatePasswordSchema.parse(req.body);
        await (0, authService_1.updatePassword)(req.user.id, parsed.currentPassword, parsed.newPassword);
        res.json({ success: true, message: "Password updated successfully" });
    }
    catch (err) {
        const error = err;
        if (error.issues) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
            });
        }
        const status = error.statusCode ?? 500;
        res.status(status).json({
            error: { code: error.code ?? "UPDATE_FAILED", message: error.message },
        });
    }
});
/**
 * PUT /auth/profile
 * Update current user's profile (client or cleaner specific)
 */
authRouter.put("/profile", (0, auth_1.auth)(), async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        let profile;
        if (role === "client") {
            const parsed = updateClientProfileSchema.parse(req.body);
            profile = await (0, authService_1.updateClientProfile)(userId, parsed);
        }
        else if (role === "cleaner") {
            const parsed = updateCleanerProfileSchema.parse(req.body);
            profile = await (0, authService_1.updateCleanerProfile)(userId, parsed);
        }
        else {
            return res.status(400).json({
                error: { code: "NO_PROFILE", message: "Admin users do not have profiles" },
            });
        }
        res.json({ profile });
    }
    catch (err) {
        const error = err;
        if (error.issues) {
            return res.status(400).json({
                error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
            });
        }
        const status = error.statusCode ?? 500;
        res.status(status).json({
            error: { code: error.code ?? "UPDATE_FAILED", message: error.message },
        });
    }
});
/**
 * POST /auth/refresh
 * Refresh JWT token (extends expiration)
 */
authRouter.post("/refresh", (0, auth_1.auth)(), async (req, res) => {
    try {
        const user = await (0, authService_1.getUserById)(req.user.id);
        if (!user) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "User not found" },
            });
        }
        const token = (0, auth_1.signAuthToken)({
            id: user.id,
            role: user.role,
        });
        res.json({ token });
    }
    catch (err) {
        logger_1.logger.error("token_refresh_failed", { error: err.message });
        res.status(500).json({
            error: { code: "REFRESH_FAILED", message: "Failed to refresh token" },
        });
    }
});
exports.default = authRouter;
