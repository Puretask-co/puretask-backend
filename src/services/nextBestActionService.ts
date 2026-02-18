/**
 * Next Best Action Service (Step 16)
 * Ranks incomplete goals by fastest path to reward; includes reward preview and optional season boosts.
 */

import { getRuntimeConfigLoader } from "./runtimeConfigLoader";
import { BadgeService } from "./badgeService";
import { SeasonService } from "./seasonService";
import { query } from "../db/client";

type AnyJson = Record<string, unknown>;

export interface NextBestAction {
  goal_id: string;
  level: number;
  goal_type: "core" | "stretch" | "maintenance";
  title: string;
  description: string;
  metric_key: string;
  target: number;
  current: number;
  remaining: number;
  percent_complete: number;
  reward_preview: Array<{
    reward_id: string;
    kind: string;
    label: string;
    duration_days?: number | null;
    amount_cents?: number | null;
    uses?: number | null;
  }>;
  earnings_impact_hint?: string | null;
  season_boosts?: Array<{ season_id: string; metric_key: string; multiplier: number }>;
}

export class NextBestActionService {
  private badgeService = new BadgeService();
  private seasonService = new SeasonService();

  async getNextBestActions(params: {
    cleaner_id: string;
    region_id?: string | null;
    limit?: number;
  }): Promise<{ paused: boolean; pause_reasons: string[]; actions: NextBestAction[] }> {
    const { cleaner_id, region_id = null, limit = 3 } = params;
    const cappedLimit = Math.min(Number(limit), 10);

    const pause = await this.getPauseStatus(cleaner_id);
    if (pause.paused) {
      return { paused: true, pause_reasons: pause.pause_reasons, actions: [] };
    }

    const loader = getRuntimeConfigLoader();
    const bundle = await loader.getBundle(region_id);
    const goalsRaw = Array.isArray(bundle.goals)
      ? bundle.goals
      : ((bundle.goals as { goals?: unknown[] })?.goals ?? []);
    const rewardsRaw = Array.isArray(bundle.rewards)
      ? bundle.rewards
      : ((bundle.rewards as { rewards?: unknown[] })?.rewards ?? []);

    const goals = (goalsRaw as AnyJson[]).filter((g) => g && g.id);
    const rewards = rewardsRaw as AnyJson[] as AnyJson[];
    const rewardsById = new Map<string, AnyJson>();
    for (const r of rewards) rewardsById.set(String(r.id), r);

    const metricSnapshot = await this.badgeService.buildMetricSnapshot(cleaner_id);
    const seasons = await this.seasonService.getActiveSeasons({ region_id, at: new Date() });
    const { snapshot: multipliedSnapshot, applied: seasonBoosts } =
      this.seasonService.applyMultipliers({
        metric_snapshot: metricSnapshot as Record<string, unknown>,
        seasons,
      });

    const completedGoalIds = await this.getCompletedGoalIds(cleaner_id);

    const levelRow = await query<{ current_level: number }>(
      `SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1`,
      [cleaner_id]
    );
    const currentLevel = levelRow.rows[0]?.current_level ?? 1;

    const candidates = goals
      .filter((g) => !completedGoalIds.has(String(g.id)))
      .filter((g) => Number(g.level) === currentLevel)
      .filter((g) => ["core", "stretch", "maintenance"].includes(String(g.type ?? "core")))
      .map((g) => this.toAction(g, rewardsById, multipliedSnapshot as AnyJson, seasonBoosts));

    const ranked = candidates.sort((a, b) => {
      const typeWeight = (t: string) => (t === "core" ? 0 : t === "stretch" ? 1 : 2);
      const tw = typeWeight(a.goal_type) - typeWeight(b.goal_type);
      if (tw !== 0) return tw;
      if (a.remaining !== b.remaining) return a.remaining - b.remaining;
      if (a.level !== b.level) return b.level - a.level;
      const cashVal = (x: NextBestAction) =>
        x.reward_preview.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);
      return cashVal(b) - cashVal(a);
    });

    return { paused: false, pause_reasons: [], actions: ranked.slice(0, cappedLimit) };
  }

  private toAction(
    goal: AnyJson,
    rewardsById: Map<string, AnyJson>,
    snapshot: AnyJson,
    seasonBoosts: Array<{ season_id: string; metric_key: string; multiplier: number }>
  ): NextBestAction {
    const metricKey = String(goal.metric ?? goal.metric_key ?? "");
    const target = Number(goal.target ?? 0);
    const current = Number(snapshot[metricKey] ?? 0);
    const remaining = Math.max(target - current, 0);
    const percent =
      target > 0 ? Math.min((current / target) * 100, 100) : remaining === 0 ? 100 : 0;

    const rewardIds = (goal.reward_ids as string[]) ?? [];
    const reward_preview = rewardIds.map((rid) => {
      const r = rewardsById.get(rid) ?? {};
      const kind = String(r.kind ?? "unknown");
      return {
        reward_id: rid,
        kind,
        label: this.rewardLabel(r),
        duration_days:
          typeof (r.params as AnyJson)?.duration_days === "number"
            ? ((r.params as AnyJson).duration_days as number)
            : null,
        amount_cents: this.rewardAmountCents(r),
        uses:
          typeof (r.params as AnyJson)?.uses === "number"
            ? ((r.params as AnyJson).uses as number)
            : null,
      };
    });

    const boostsForMetric = seasonBoosts
      .filter((x) => String(x.metric_key) === metricKey)
      .map((x) => ({ season_id: x.season_id, metric_key: x.metric_key, multiplier: x.multiplier }));

    return {
      goal_id: String(goal.id),
      level: Number(goal.level ?? 1),
      goal_type: String(goal.type ?? "core") as NextBestAction["goal_type"],
      title: String(goal.title ?? goal.name ?? "Goal"),
      description: String(goal.description ?? ""),
      metric_key: metricKey,
      target,
      current,
      remaining,
      percent_complete: Math.round(percent * 10) / 10,
      reward_preview,
      earnings_impact_hint: this.earningsHint(metricKey, reward_preview),
      season_boosts: boostsForMetric.length > 0 ? boostsForMetric : undefined,
    };
  }

  private rewardLabel(r: AnyJson): string {
    const kind = String(r.kind ?? "");
    const params = (r.params ?? {}) as AnyJson;

    if (kind === "cash_bonus") {
      const usd = Number(params.amount_usd ?? 0);
      const cents = Number(params.amount_cents ?? 0);
      const amount = cents > 0 ? cents / 100 : usd;
      return amount > 0 ? `$${amount.toFixed(0)} cash bonus` : "Cash bonus";
    }
    if (kind === "visibility_boost" || kind === "visibility_multiplier") {
      const m = Number(params.multiplier ?? 1.0);
      const d = params.duration_days
        ? ` for ${params.duration_days} days`
        : params.duration_hours
          ? ` for ${params.duration_hours}h`
          : "";
      return `Visibility boost x${m}${d}`;
    }
    if (kind === "exposure_window" || kind === "early_exposure_minutes") {
      const mins = Number(params.minutes ?? 0);
      const d = params.duration_days ? ` for ${params.duration_days} days` : "";
      return `Early exposure +${mins} min${d}`;
    }
    if (kind.includes("fee") || kind === "platform_fee_discount_percent") {
      const p = Number(params.percent ?? 0);
      const d = params.duration_days ? ` for ${params.duration_days} days` : "";
      return `Platform fee -${p}%${d}`;
    }
    if (kind.includes("instant_payout") || kind.includes("waiver")) {
      const uses = Number(params.uses ?? 1);
      return `Instant payout fee waived (${uses} uses)`;
    }
    return String((r.name ?? r.label ?? kind) || "Reward");
  }

  private rewardAmountCents(r: AnyJson): number | null {
    const params = (r.params ?? {}) as AnyJson;
    const cents = Number(params.amount_cents ?? 0);
    if (cents > 0) return cents;
    const usd = Number(params.amount_usd ?? 0);
    return usd > 0 ? Math.round(usd * 100) : null;
  }

  private earningsHint(
    metricKey: string,
    preview: NextBestAction["reward_preview"]
  ): string | null {
    const hasVisibility = preview.some(
      (p) => p.kind.includes("visibility") || p.kind.includes("exposure")
    );
    const hasFeeDiscount = preview.some((p) => p.kind.includes("fee"));
    const hasCash = preview.some((p) => p.kind === "cash_bonus");

    if (hasCash) return "Immediate cash bonus once earned.";
    if (hasVisibility) return "More exposure can increase bookings (not guaranteed).";
    if (hasFeeDiscount) return "Lower platform fees increase your take-home pay.";
    if (metricKey.includes("addons")) return "Add-ons usually increase job earnings.";
    return null;
  }

  private async getPauseStatus(
    cleaner_id: string
  ): Promise<{ paused: boolean; pause_reasons: string[] }> {
    try {
      const r = await query<{
        maintenance_paused: boolean;
        maintenance_paused_reason: string | null;
      }>(
        `SELECT maintenance_paused, maintenance_paused_reason
         FROM cleaner_level_progress WHERE cleaner_id = $1`,
        [cleaner_id]
      );
      const row = r.rows[0];
      if (!row) return { paused: false, pause_reasons: [] };
      const reasons =
        row.maintenance_paused_reason
          ?.split(";")
          .map((s) => s.trim())
          .filter(Boolean) ?? [];
      return { paused: Boolean(row.maintenance_paused), pause_reasons: reasons };
    } catch {
      return { paused: false, pause_reasons: [] };
    }
  }

  private async getCompletedGoalIds(cleaner_id: string): Promise<Set<string>> {
    try {
      const r = await query<{ goal_id: string }>(
        `SELECT goal_id FROM cleaner_goal_progress WHERE cleaner_id = $1 AND completed = true`,
        [cleaner_id]
      );
      return new Set(r.rows.map((row) => row.goal_id));
    } catch {
      return new Set();
    }
  }
}
