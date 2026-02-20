import { Router } from "express";
import { RewardEffectsService } from "../services/reward_effects_service";

export const effectsRouter = Router();
const service = new RewardEffectsService();

effectsRouter.get("/cleaners/:id/rewards/effects", async (req, res) => {
  const cleaner_id = req.params.id;
  const region_id = String(req.query.region_id ?? "");
  const effects = await service.getEffectiveEffects({ cleaner_id, region_id: region_id || null });
  res.json({ ok: true, effects });
});
