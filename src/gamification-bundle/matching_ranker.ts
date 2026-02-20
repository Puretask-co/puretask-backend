import config from "../config/config.json";
import { RewardEffectsService } from "./reward_effects_service";

type CleanerCandidate = {
  cleaner_id: string;
  base_score: number;
  is_available: boolean;
  has_addons: boolean;
};

type RankedCleaner = CleanerCandidate & {
  final_score: number;
  applied: {
    visibility_multiplier: number;
    addon_job_multiplier: number;
    early_exposure_minutes: number;
  };
};

export class MatchingRanker {
  private effects = new RewardEffectsService();

  async rank(opts: { region_id: string; candidates: CleanerCandidate[] }): Promise<RankedCleaner[]> {
    const out: RankedCleaner[] = [];

    for (const c of opts.candidates) {
      const eff = await this.effects.getEffectiveEffects({ cleaner_id: c.cleaner_id, region_id: opts.region_id });

      let score = c.base_score * eff.visibility_multiplier;
      if (c.has_addons) score *= eff.addon_job_multiplier;

      out.push({
        ...c,
        final_score: score,
        applied: {
          visibility_multiplier: eff.visibility_multiplier,
          addon_job_multiplier: c.has_addons ? eff.addon_job_multiplier : 1.0,
          early_exposure_minutes: eff.early_exposure_minutes
        }
      });
    }

    out.sort((a, b) => b.final_score - a.final_score);
    return out;
  }

  async applyEarlyExposureBoost(params: {
    region_id: string;
    cleaner_id: string;
    request_age_minutes: number;
    base_score: number;
  }): Promise<number> {
    const eff = await this.effects.getEffectiveEffects({ cleaner_id: params.cleaner_id, region_id: params.region_id });
    if (eff.paused) return params.base_score;

    if (params.request_age_minutes <= eff.early_exposure_minutes) {
      const bump = (config as any).early_exposure_bump_multiplier ?? 1.08;
      return params.base_score * bump;
    }
    return params.base_score;
  }
}
