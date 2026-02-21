/**
 * Support gamification debug routes (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * GET/POST /admin/support/cleaner/:cleanerId/gamification*
 */

import { Router, Response } from "express";
import { requireAuth, requireAdmin, AuthedRequest, authedHandler } from "../../middleware/authCanonical";
import * as supportGamification from "../../services/supportGamificationService";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

function getActorId(req: AuthedRequest): string {
  return req.user!.id;
}

router.get(
  "/cleaner/:cleanerId/gamification",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const cleanerId = req.params.cleanerId;
    const view = await supportGamification.getSupportGamificationView(cleanerId);
    if (!view) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Cleaner not found" } });
    res.json(view);
  })
);

router.post(
  "/cleaner/:cleanerId/gamification/recompute",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const cleanerId = req.params.cleanerId;
    const view = await supportGamification.recomputeAndReturn(cleanerId);
    if (!view) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Cleaner not found" } });
    res.json(view);
  })
);

router.post(
  "/cleaner/:cleanerId/gamification/grant-reward",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const cleanerId = req.params.cleanerId;
    const body = (req.body ?? {}) as { reward_id?: string; reason?: string; duration_days?: number };
    if (!body.reward_id)
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "reward_id required" } });
    const view = await supportGamification.grantRewardManually({
      cleanerId,
      rewardId: body.reward_id,
      reason: body.reason,
      durationDays: body.duration_days,
      adminId: getActorId(req),
    });
    if (!view) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Cleaner or reward not found" } });
    res.json(view);
  })
);

router.post(
  "/cleaner/:cleanerId/gamification/remove-reward",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const cleanerId = req.params.cleanerId;
    const body = (req.body ?? {}) as { reward_id?: string; reason?: string };
    if (!body.reward_id)
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "reward_id required" } });
    const view = await supportGamification.removeRewardManually({
      cleanerId,
      rewardId: body.reward_id,
      reason: body.reason,
      adminId: getActorId(req),
    });
    if (!view) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Cleaner not found" } });
    res.json(view);
  })
);

export default router;
