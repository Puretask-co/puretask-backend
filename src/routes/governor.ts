/**
 * Governor routes (Step 18) — runtime read of governor state.
 * Used by ranking/reward layers. No auth required (internal service reads).
 */

import { Router, Request, Response } from "express";
import { MarketplaceGovernorService } from "../services/marketplaceGovernorService";

const router = Router();
const governorService = new MarketplaceGovernorService();

/**
 * GET /governor/state?region_id=xxx
 * Returns current governor state for the region (visibility_multiplier, early_exposure_minutes, etc.)
 */
router.get("/state", async (req: Request, res: Response) => {
  const regionId = (req.query.region_id as string) ?? "__global__";
  const state = await governorService.getGovernorState(regionId);
  res.json({ ok: true, state: state ?? null });
});

export default router;
