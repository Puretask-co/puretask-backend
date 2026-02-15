// src/routes/admin/levelTuning.ts
// Admin endpoints for gamification config: goals, levels, rewards, level copy

import { Router, Response } from "express";
import {
  requireAuth,
  requireAdmin,
  AuthedRequest,
  authedHandler,
} from "../../middleware/authCanonical";
import {
  getGoals,
  getGoalsForLevel,
  getLevels,
  getLevel,
  getRewards,
  getReward,
  getLevelCopy,
  getLevelCopyForLevel,
  clearConfigCache,
} from "../../config/cleanerLevels";
import { query } from "../../db/client";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /admin/level-tuning/goals
 * List all goals from config (optionally filtered by level)
 */
router.get(
  "/goals",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const level = req.query.level ? parseInt(String(req.query.level), 10) : undefined;
    const goals = level ? getGoalsForLevel(level) : getGoals();
    res.json({ goals });
  })
);

/**
 * GET /admin/level-tuning/levels
 * List all level definitions
 */
router.get(
  "/levels",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const levels = getLevels();
    res.json({ levels });
  })
);

/**
 * GET /admin/level-tuning/levels/:level
 * Get single level definition
 */
router.get(
  "/levels/:level",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const level = parseInt(req.params.level, 10);
    if (isNaN(level) || level < 1 || level > 10) {
      return res.status(400).json({ error: "Invalid level (1-10)" });
    }
    const def = getLevel(level);
    if (!def) {
      return res.status(404).json({ error: "Level not found" });
    }
    res.json(def);
  })
);

/**
 * GET /admin/level-tuning/rewards
 * List all reward definitions
 */
router.get(
  "/rewards",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const rewards = getRewards();
    res.json({ rewards });
  })
);

/**
 * GET /admin/level-tuning/rewards/:id
 * Get single reward definition
 */
router.get(
  "/rewards/:id",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const def = getReward(req.params.id);
    if (!def) {
      return res.status(404).json({ error: "Reward not found" });
    }
    res.json(def);
  })
);

/**
 * GET /admin/level-tuning/level-copy
 * Get in-app copy for levels (cleaner-facing)
 */
router.get(
  "/level-copy",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const copy = getLevelCopy();
    res.json(copy);
  })
);

/**
 * GET /admin/level-tuning/level-copy/:level
 * Get copy for a specific level
 */
router.get(
  "/level-copy/:level",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const level = parseInt(req.params.level, 10);
    if (isNaN(level) || level < 1 || level > 10) {
      return res.status(400).json({ error: "Invalid level (1-10)" });
    }
    const copy = getLevelCopyForLevel(level);
    if (!copy) {
      return res.status(404).json({ error: "Level copy not found" });
    }
    res.json(copy);
  })
);

/**
 * GET /admin/level-tuning/overview
 * Summary: distribution, active rewards count, etc.
 */
router.get(
  "/overview",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const [distRow, activeBoostsRow] = await Promise.all([
      query<{ level: number; count: string }>(
        `SELECT current_level as level, COUNT(*)::text as count
         FROM cleaner_level_progress
         GROUP BY current_level
         ORDER BY level`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM cleaner_active_boosts WHERE is_active = true AND expires_at > NOW()`
      ),
    ]);

    const distribution: Record<number, number> = {};
    for (const row of distRow.rows) {
      distribution[row.level] = parseInt(row.count, 10);
    }

    const activeBoosts = parseInt(activeBoostsRow.rows[0]?.count || "0", 10);

    res.json({
      levels: getLevels(),
      distribution,
      activeBoosts,
      goalsCount: getGoals().length,
      rewardsCount: getRewards().length,
    });
  })
);

/**
 * POST /admin/level-tuning/clear-cache
 * Clear in-memory config cache (reload on next request)
 */
router.post(
  "/clear-cache",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    clearConfigCache();
    res.json({ ok: true, message: "Config cache cleared" });
  })
);

export default router;
