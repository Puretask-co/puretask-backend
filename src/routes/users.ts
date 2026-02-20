// src/routes/users.ts
// Frontend-expected /users/me routes (profile, avatar, password, delete)

import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import { validateBody } from "../lib/validation";
import {
  getUserWithProfile,
  updateClientProfile,
  updateCleanerProfile,
  updatePassword,
} from "../services/authService";
import { updateUser, deleteUser } from "../services/userManagementService";
import { query } from "../db/client";
import { logger } from "../lib/logger";

const usersRouter = Router();
usersRouter.use(requireAuth);

const updateMeSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  default_address: z.string().optional(),
  hourly_rate_credits: z.number().positive().optional(),
  tier: z.string().optional(),
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** GET /users/me — current user profile (alias for GET /auth/me) */
usersRouter.get(
  "/me",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const user = await getUserWithProfile(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
      }
      const { password_hash, ...safe } = user as any;
      res.json(safe);
    } catch (error) {
      logger.error("get_me_failed", { error: (error as Error).message });
      res.status(500).json({ error: { code: "GET_ME_FAILED", message: (error as Error).message } });
    }
  })
);

/** PATCH /users/me — update current user (frontend expected path) */
usersRouter.patch(
  "/me",
  validateBody(updateMeSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const role = req.user!.role;
      const body = req.body as Record<string, unknown>;
      const update: Record<string, unknown> = {};
      if (body.email != null) update.email = body.email;
      if (body.phone != null) update.phone = body.phone;
      if (role === "client" && body.default_address != null) update.defaultAddress = body.default_address;
      if (role === "cleaner") {
        if (body.hourly_rate_credits != null) update.hourlyRateCredits = body.hourly_rate_credits;
        if (body.tier != null) update.tier = body.tier;
      }
      const user = await updateUser(userId, update as any);
      const { password_hash, ...safe } = user as any;
      res.json(safe);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("update_me_failed", { error: err.message });
      res.status(err.statusCode || 500).json({
        error: { code: "UPDATE_ME_FAILED", message: err.message },
      });
    }
  })
);

/** POST /users/me/change-password — frontend expected path */
usersRouter.post(
  "/me/change-password",
  validateBody(changePasswordSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      await updatePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
      res.json({ success: true, message: "Password updated" });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 400).json({
        error: { code: "CHANGE_PASSWORD_FAILED", message: err.message },
      });
    }
  })
);

/** POST /users/me/avatar — stub: frontend may upload elsewhere (e.g. /client/profile/photo); return 200 with message */
usersRouter.post(
  "/me/avatar",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    res.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Use POST /client/profile/photo or cleaner profile upload for avatar",
      },
    });
  })
);

/** DELETE /users/me/avatar — clear avatar URL for current user */
usersRouter.delete(
  "/me/avatar",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      await query(
        `UPDATE cleaner_profiles SET avatar_url = NULL, updated_at = NOW() WHERE user_id = $1`,
        [req.user!.id]
      );
      await query(
        `UPDATE client_profiles SET avatar_url = NULL, updated_at = NOW() WHERE user_id = $1`,
        [req.user!.id]
      );
      res.json({ success: true, message: "Avatar removed" });
    } catch (error) {
      logger.error("delete_avatar_failed", { error: (error as Error).message });
      res.status(500).json({ error: { code: "DELETE_AVATAR_FAILED", message: (error as Error).message } });
    }
  })
);

/** POST /users/me/delete — soft delete account (frontend expected path) */
usersRouter.post(
  "/me/delete",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      await deleteUser(req.user!.id, false);
      res.json({ success: true, message: "Account deletion requested" });
    } catch (error) {
      logger.error("delete_me_failed", { error: (error as Error).message });
      res.status(500).json({ error: { code: "DELETE_ME_FAILED", message: (error as Error).message } });
    }
  })
);

export default usersRouter;
