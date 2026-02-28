import { makeGrant, shouldGrant } from "../lib/gamification/reward_granter";
import { RewardDefinition, RewardGrant } from "../lib/gamification/types";

const tempReward: RewardDefinition = {
  id: "r1",
  kind: "visibility_boost",
  name: "Temp",
  params: { duration_days: 7, multiplier: 1.1 },
  stacking_rule: "extend_duration"
};

describe("reward_granter", () => {
  test("grant creates ends_at", () => {
    const g = makeGrant({ cleaner_id:"c1", reward: tempReward, source_type:"goal", source_id:"goal1", granted_at: new Date("2026-01-01T00:00:00Z")});
    expect(g.ends_at).toBeTruthy();
  });

  test("extend_duration extends ends_at when active", () => {
    const existing: RewardGrant = {
      grant_id: "g1",
      cleaner_id: "c1",
      reward_id: "r1",
      granted_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-01-08T00:00:00Z",
      uses_remaining: null,
      source: { source_type:"goal", source_id:"goal1" }
    };

    const decision = shouldGrant(tempReward, existing, new Date("2026-01-02T00:00:00Z"));
    expect(decision.action).toBe("extend");
    expect(decision.newEndsAt?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});
