// src/routes/referral.ts
// Referral: POST /referral/send (invite by email), GET /referral/me (code + stats)

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { requireAuth, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import { getUserReferralCode, getUserReferralStats } from "../services/referralService";
import { logger } from "../lib/logger";
import { env } from "../config/env";

const referralRouter = Router();
referralRouter.use(requireAuth);

const sendSchema = z.object({
  email: z.string().email(),
});

/** POST /referral/send — send referral invite to email (sender from auth) */
referralRouter.post(
  "/send",
  validateBody(sendSchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { email } = req.body;
      let code = await getUserReferralCode(userId);
      if (!code) {
        const { generateReferralCode } = await import("../services/referralService");
        code = await generateReferralCode(userId);
      }
      const referralCode = code?.code ?? null;
      if (!referralCode) {
        return res.status(500).json({
          error: { code: "REFERRAL_CODE_FAILED", message: "Could not get or create referral code" },
        });
      }
      const appUrl = env.APP_URL || env.FRONTEND_URL || "https://app.puretask.com";
      const inviteUrl = `${appUrl}/signup?ref=${encodeURIComponent(referralCode)}`;
      if (env.SENDGRID_API_KEY) {
        const sendEmail = (await import("../services/notifications/providers/emailProvider")).sendEmail;
        await sendEmail({
          to: email,
          subject: "You're invited to PureTask",
          html: `You've been invited to try PureTask. Sign up with this link: <a href="${inviteUrl}">${inviteUrl}</a>`,
          text: `You've been invited to try PureTask. Sign up here: ${inviteUrl}`,
        });
      }
      logger.info("referral_send", { userId, to: email, code: referralCode });
      res.status(201).json({ ok: true, sent: true });
    } catch (e) {
      logger.error("referral_send_failed", { error: (e as Error).message, userId: req.user?.id });
      res.status(500).json({
        error: { code: "REFERRAL_SEND_FAILED", message: (e as Error).message },
      });
    }
  })
);

/** GET /referral/me — current user's referral code and stats */
referralRouter.get(
  "/me",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const stats = await getUserReferralStats(req.user!.id);
      res.json({
        code: stats.code,
        totalReferrals: stats.totalReferrals,
        pendingReferrals: stats.pendingReferrals,
        qualifiedReferrals: stats.qualifiedReferrals,
        totalEarned: stats.totalEarned,
      });
    } catch (e) {
      logger.error("referral_me_failed", { error: (e as Error).message, userId: req.user?.id });
      res.status(500).json({
        error: { code: "REFERRAL_ME_FAILED", message: (e as Error).message },
      });
    }
  })
);

export default referralRouter;
