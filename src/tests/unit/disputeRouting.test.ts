import { describe, it, expect } from "@jest/globals";
import { routeDisputeSchema } from "../../routes/admin";

describe("dispute routing schema", () => {
  it("accepts allowed queues", () => {
    expect(() => routeDisputeSchema.parse({ routeTo: "ops" })).not.toThrow();
    expect(() => routeDisputeSchema.parse({ routeTo: "finance" })).not.toThrow();
    expect(() => routeDisputeSchema.parse({ routeTo: "trust_safety" })).not.toThrow();
    expect(() => routeDisputeSchema.parse({ routeTo: "support" })).not.toThrow();
  });

  it("rejects unknown queues", () => {
    expect(() => routeDisputeSchema.parse({ routeTo: "bad" as any })).toThrow();
  });
});

