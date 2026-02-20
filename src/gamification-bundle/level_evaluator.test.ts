import { evaluateLevels } from "../src/level_evaluator";
import { InMemoryMetricProvider } from "../src/in_memory_metric_provider";
import { GoalDefinition, LevelDefinition } from "../src/types";

const levels: LevelDefinition[] = [
  { level: 1, name: "L1", requirements: { core_require_all: true, stretch_required_count: 1, maintenance_require_all: true } },
  { level: 2, name: "L2", requirements: { core_require_all: true, stretch_required_count: 1, maintenance_require_all: true } },
  { level: 3, name: "L3", requirements: { core_require_all: true, stretch_required_count: 1, maintenance_require_all: true } }
];

const goals: GoalDefinition[] = [
  // L1 core
  { id:"l1c1", level:1, type:"core", title:"", description:"", metric:"m1", operator:">=", target:1 },
  { id:"l1c2", level:1, type:"core", title:"", description:"", metric:"m2", operator:">=", target:1 },
  // L1 stretch
  { id:"l1s1", level:1, type:"stretch", title:"", description:"", metric:"m3", operator:">=", target:1 },
  // L1 maintenance
  { id:"l1m1", level:1, type:"maintenance", title:"", description:"", metric:"m4", operator:"==", target:0 },

  // L2 core
  { id:"l2c1", level:2, type:"core", title:"", description:"", metric:"m5", operator:">=", target:1 },
  // L2 stretch
  { id:"l2s1", level:2, type:"stretch", title:"", description:"", metric:"m6", operator:">=", target:1 },
];

describe("level_evaluator", () => {
  test("eligible_for_level increases when core+stretch met", async () => {
    const provider = new InMemoryMetricProvider({
      m1: 1, m2: 1, m3: 1, m4: 0,
      m5: 1, m6: 1
    });

    const res = await evaluateLevels({
      cleaner_id: "c1",
      current_level: 1,
      provider,
      level_definitions: levels,
      goals
    });

    expect(res.eligible_for_level).toBe(2);
    expect(res.paused).toBe(false);
  });

  test("pause when maintenance fails at current level", async () => {
    const provider = new InMemoryMetricProvider({
      m1: 1, m2: 1, m3: 1, m4: 1 // fails maintenance (expects 0)
    });

    const res = await evaluateLevels({
      cleaner_id: "c1",
      current_level: 1,
      provider,
      level_definitions: levels,
      goals
    });

    expect(res.paused).toBe(true);
    expect(res.maintenance_failed_ids).toContain("l1m1");
  });
});
