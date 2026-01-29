// src/routes/auth.ts
// Authentication routes: register, login, me, password management

import { Router, Response } from "express";
import { z } from "zod";
import { auth, signAuthToken, UserRole } from "../lib/auth";
import { authRateLimiter } from "../lib/security";
import { productionAuthRateLimiter } from "../lib/rateLimitRedis";
import { env } from "../config/env";
import {
  registerUser,
  loginUser,
  getUserById,
  getUserWithProfile,
  updatePassword,
  updateClientProfile,
  updateCleanerProfile,
  sanitizeUser,
} from "../services/authService";
import { logger } from "../lib/logger";

const authRouter = Router();

// Apply stricter rate limiting to all auth routes
// Use Redis-based limiter in production if enabled
if (env.USE_REDIS_RATE_LIMITING && env.REDIS_URL) {
  authRouter.use(productionAuthRateLimiter);
} else {
  authRouter.use(authRateLimiter);
}

// ============================================
// Validation Schemas
// ============================================

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["client", "cleaner"]).optional(), // admin cannot self-register
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

const updateClientProfileSchema = z.object({
  default_address: z.string().optional(),
});

const updateCleanerProfileSchema = z.object({
  tier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
  hourly_rate_credits: z.number().positive().optional(),
});

// ============================================
// Routes
// ============================================

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Register a new client or cleaner account. Returns JWT token and user info.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: securePassword123
 *               role:
 *                 type: string
 *                 enum: [client, cleaner]
 *                 description: User role (defaults to client if not specified)
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 */
authRouter.post("/register", async (req, res: Response) => {
  try {
    const parsed = registerSchema.parse(req.body);

    const user = await registerUser({
      email: parsed.email,
      password: parsed.password,
      role: parsed.role,
    });

    const token = signAuthToken({
      id: user.id,
      role: user.role as UserRole,
    });

    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    const error = err as Error & { issues?: unknown; statusCode?: number; code?: string };

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
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password. Returns JWT token and user info.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: securePassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 */
authRouter.post("/login", async (req, res: Response) => {
  try {
    const parsed = loginSchema.parse(req.body);

    const user = await loginUser(parsed.email, parsed.password);
    const token = signAuthToken({
      id: user.id,
      role: user.role as UserRole,
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    const error = err as Error & { issues?: unknown; statusCode?: number; code?: string };

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
authRouter.get("/me", auth(), async (req, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = await getUserWithProfile(userId);

    if (!data) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    res.json({
      user: sanitizeUser(data.user),
      profile: data.clientProfile ?? data.cleanerProfile ?? null,
    });
  } catch (err) {
    logger.error("get_me_failed", { error: (err as Error).message, userId: req.user?.id });
    res.status(500).json({
      error: { code: "FETCH_FAILED", message: "Failed to fetch user" },
    });
  }
});

/**
 * PUT /auth/password
 * Update current user's password
 */
authRouter.put("/password", auth(), async (req, res: Response) => {
  try {
    const parsed = updatePasswordSchema.parse(req.body);

    await updatePassword(req.user!.id, parsed.currentPassword, parsed.newPassword);

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    const error = err as Error & { issues?: unknown; statusCode?: number; code?: string };

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
authRouter.put("/profile", auth(), async (req, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let profile;

    if (role === "client") {
      const parsed = updateClientProfileSchema.parse(req.body);
      profile = await updateClientProfile(userId, parsed);
    } else if (role === "cleaner") {
      const parsed = updateCleanerProfileSchema.parse(req.body);
      profile = await updateCleanerProfile(userId, parsed);
    } else {
      return res.status(400).json({
        error: { code: "NO_PROFILE", message: "Admin users do not have profiles" },
      });
    }

    res.json({ profile });
  } catch (err) {
    const error = err as Error & { issues?: unknown; statusCode?: number; code?: string };

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
authRouter.post("/refresh", auth(), async (req, res: Response) => {
  try {
    const user = await getUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    const token = signAuthToken({
      id: user.id,
      role: user.role as UserRole,
    });

    res.json({ token });
  } catch (err) {
    logger.error("token_refresh_failed", { error: (err as Error).message });
    res.status(500).json({
      error: { code: "REFRESH_FAILED", message: "Failed to refresh token" },
    });
  }
});

export default authRouter;
