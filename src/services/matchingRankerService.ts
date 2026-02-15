/**
 * PureTask Gamification — Matching Ranker (Step 9)
 * Applies reward effects (visibility, add-on multipliers, early exposure) to cleaner ranking.
 * Principles: boosts are relative; customer always chooses; only among eligible cleaners.
 */

import { RewardEffectsService } from "./rewardEffectsService";

export type CleanerCandidate = {
  cleaner_id: string;
  base_score: number;
  distance_meters?: number;
  is_available: boolean;
  has_addons: boolean;
};

export type RankedCleaner = CleanerCandidate & {
  final_score: number;
  applied: {
    visibility_multiplier: number;
    addon_job_multiplier: number;
    early_exposure_minutes: number;
    early_exposure_addon_minutes: number;
  };
};

const EARLY_EXPOSURE_BUMP = 1.08;

/**
 * MatchingRanker — applies reward effects to candidate ordering
 */
export class MatchingRankerService {
  private effects = new RewardEffectsService();

  async rank(opts: {
    region_id: string;
    candidates: CleanerCandidate[];
    request_age_minutes?: number;
    /** When the job request includes add-ons; enables addon multipliers and addon early exposure */
    request_has_addons?: boolean;
  }): Promise<RankedCleaner[]> {
    const out: RankedCleaner[] = [];
    const requestAge = opts.request_age_minutes ?? 0;
    const requestHasAddons = opts.request_has_addons ?? opts.candidates.some((c) => c.has_addons);

    for (const c of opts.candidates) {
      const eff = await this.effects.getEffectiveEffects({
        cleaner_id: c.cleaner_id,
        region_id: opts.region_id,
      });

      let score = c.base_score * eff.visibility_multiplier;
      if (requestHasAddons) {
        score *= eff.addon_job_multiplier;
      }
      const effectiveEarlyMins = requestHasAddons
        ? eff.early_exposure_minutes + eff.early_exposure_addon_minutes
        : eff.early_exposure_minutes;
      if (requestAge <= effectiveEarlyMins && effectiveEarlyMins > 0) {
        score *= EARLY_EXPOSURE_BUMP;
      }

      out.push({
        ...c,
        final_score: score,
        applied: {
          visibility_multiplier: eff.visibility_multiplier,
          addon_job_multiplier: requestHasAddons ? eff.addon_job_multiplier : 1.0,
          early_exposure_minutes: eff.early_exposure_minutes,
          early_exposure_addon_minutes: eff.early_exposure_addon_minutes,
        },
      });
    }

    out.sort((a, b) => b.final_score - a.final_score);
    return out;
  }

  /**
   * Apply early exposure bump only (e.g. when request is fresh)
   */
  async applyEarlyExposureBoost(params: {
    region_id: string;
    cleaner_id: string;
    request_age_minutes: number;
    base_score: number;
  }): Promise<number> {
    const eff = await this.effects.getEffectiveEffects({
      cleaner_id: params.cleaner_id,
      region_id: params.region_id,
    });
    if (eff.paused) return params.base_score;
    if (
      params.request_age_minutes <= eff.early_exposure_minutes &&
      eff.early_exposure_minutes > 0
    ) {
      return params.base_score * EARLY_EXPOSURE_BUMP;
    }
    return params.base_score;
  }
}
