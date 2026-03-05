import { compare, progressRatio } from "../lib/gamification/goal_evaluator";

describe("goal_evaluator.compare", () => {
  test("numeric >=", () => {
    expect(compare(5, ">=", 3)).toBe(true);
    expect(compare(2, ">=", 3)).toBe(false);
  });

  test("object split counts all keys >=", () => {
    expect(compare({basic:10, deep:10}, ">=", {basic:10, deep:5})).toBe(true);
    expect(compare({basic:9, deep:10}, ">=", {basic:10, deep:5})).toBe(false);
  });

  test("boolean equality", () => {
    expect(compare(true, "==", true)).toBe(true);
    expect(compare(false, "==", true)).toBe(false);
  });
});

describe("goal_evaluator.progressRatio", () => {
  test("numeric ratio caps at 1", () => {
    expect(progressRatio(5, ">=", 10)).toBeCloseTo(0.5);
    expect(progressRatio(15, ">=", 10)).toBe(1);
  });

  test("object split ratio averages keys", () => {
    const r = progressRatio({basic:5, deep:10}, ">=", {basic:10, deep:10}); // 0.5 and 1 => 0.75
    expect(r).toBeCloseTo(0.75);
  });
});
