// src/routes/authRefactored.ts
// EXAMPLE: Refactored auth routes using standardized error handling and validation
// This demonstrates the improved patterns - migrate other routes to follow this style

import { Router } from "express";
import { z } from "zod";
import { auth, signAuthToken, UserRole } from "../lib/auth";
import { asyncHandler, Errors } from "../lib/errors";
import { validateBody } from "../lib/validation";
import { authRateLimiter } from "../lib/security";
import {
  registerUser,
  loginUser,
  getUserWithProfile,
  updatePassword,
  sanitizeUser,
} from "../services/authService";
import { logger } from "../lib/logger";

const router = Router();

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

// ============================================
// Validation Schemas
// ============================================

const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["client", "cleaner"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// ============================================
// Routes - Refactored with Best Practices
// ============================================

/**
 * POST /auth/register
 * Register a new user (client or cleaner)
 * 
 * ✅ Uses validateBody middleware for automatic validation
 * ✅ Uses asyncHandler for automatic error handling
 * ✅ Clean, readable code with no try/catch needed
 */
router.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, role } = req.body;

    const user = await registerUser({ email, password, role });

    const token = signAuthToken({
      id: user.id,
      role: user.role as UserRole,
    });

    logger.info("user_registered", {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  })
);

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 * 
 * ✅ Validation handled by middleware
 * ✅ Errors automatically caught and formatted
 */
router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await loginUser(email, password);

    const token = signAuthToken({
      id: user.id,
      role: user.role as UserRole,
    });

    logger.info("user_logged_in", {
      userId: user.id,
      email: user.email,
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  })
);

/**
 * GET /auth/me
 * Get current authenticated user info
 * 
 * ✅ Auth handled by middleware
 * ✅ Standardized error responses using Errors factory
 */
router.get(
  "/me",
  auth(),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const data = await getUserWithProfile(userId);

    if (!data) {
      throw Errors.notFound("User", userId);
    }

    res.json({
      user: sanitizeUser(data.user),
      profile: data.clientProfile ?? data.cleanerProfile,
    });
  })
);

/**
 * POST /auth/change-password
 * Change user password
 * 
 * ✅ Complete example with validation, auth, and error handling
 */
router.post(
  "/change-password",
  auth(),
  validateBody(updatePasswordSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    await updatePassword(userId, currentPassword, newPassword);

    logger.info("password_changed", { userId });

    res.json({
      message: "Password updated successfully",
    });
  })
);

export default router;

/**
 * MIGRATION GUIDE:
 * 
 * Old pattern (lots of boilerplate):
 * ```
 * router.post('/endpoint', async (req, res) => {
 *   try {
 *     const parsed = schema.parse(req.body);
 *     // ... logic ...
 *     res.json(result);
 *   } catch (err) {
 *     const error = err as Error & { issues?: unknown; statusCode?: number };
 *     if (error.issues) {
 *       return res.status(400).json({
 *         error: { code: "VALIDATION_ERROR", message: "...", details: error.issues },
 *       });
 *     }
 *     const status = error.statusCode ?? 500;
 *     res.status(status).json({
 *       error: { code: error.code ?? "ERROR", message: error.message },
 *     });
 *   }
 * });
 * ```
 * 
 * New pattern (clean and concise):
 * ```
 * router.post('/endpoint',
 *   validateBody(schema),
 *   asyncHandler(async (req, res) => {
 *     // ... logic ...
 *     res.json(result);
 *   })
 * );
 * ```
 * 
 * Benefits:
 * - 50% less code
 * - Consistent error responses
 * - No repetitive try/catch blocks
 * - Automatic error logging with context
 * - Type-safe validated request body
 */

