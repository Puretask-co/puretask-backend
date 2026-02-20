import { Router } from "express";
import { RewardGrantService } from "../services/reward_grant_service";
import { withClient } from "../db/client";

export const rewardsRouter = Router();
const rewards = new RewardGrantService();

/**
 * List open choice eligibilities for cleaner
 */
rewardsRouter.get("/cleaners/:id/rewards/choices", async (req, res) => {
  const cleaner_id = req.params.id;
  const rows = await withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT id, choice_group_id, source_goal_id, earned_at, expires_at
       FROM gamification_choice_eligibilities
       WHERE cleaner_id=$1 AND status='open'
       ORDER BY earned_at DESC`,
      [cleaner_id]
    );
    return rows;
  });
  res.json({ ok:true, choices: rows });
});

/**
 * Select a reward for a choice eligibility.
 * Body: { eligibility_id, reward_id }
 */
rewardsRouter.post("/cleaners/:id/rewards/choices/select", async (req, res) => {
  try {
    const cleaner_id = req.params.id;
    const { eligibility_id, reward_id } = req.body ?? {};
    if (!eligibility_id || !reward_id) return res.status(400).json({ ok:false, error:"eligibility_id and reward_id required" });

    await rewards.selectChoiceReward(cleaner_id, String(eligibility_id), String(reward_id));
    res.json({ ok:true });
  } catch (e:any) {
    res.status(400).json({ ok:false, error: e.message ?? String(e) });
  }
});
