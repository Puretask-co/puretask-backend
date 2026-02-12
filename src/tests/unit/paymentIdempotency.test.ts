import { describe, it, expect, beforeEach } from "@jest/globals";
import { jest } from "@jest/globals";
import { isObjectAlreadyProcessed, markObjectProcessed } from "../../services/paymentService";
import { query } from "../../db/client";

jest.mock("../../db/client", () => {
  const processed = new Set<string>();
  return {
    query: jest.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT object_id")) {
        const key = `${params[0]}|${params[1]}`;
        return { rows: processed.has(key) ? [{ object_id: params[0] }] : [] };
      }
      if (sql.includes("INSERT INTO stripe_object_processed")) {
        const key = `${params[0]}|${params[1]}`; // object_id, object_type
        processed.add(key);
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
});

describe("stripe object idempotency helpers", () => {
  it("marks and detects processed objects", async () => {
    const id = "pi_123";
    const type = "payment_intent";
    expect(await isObjectAlreadyProcessed(id, type)).toBe(false);
    await markObjectProcessed(id, type);
    expect(await isObjectAlreadyProcessed(id, type)).toBe(true);
  });
});

