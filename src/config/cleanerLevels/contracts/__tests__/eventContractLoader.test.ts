/**
 * Unit tests for event contract loader and validation.
 * See eventContractLoader.ts and docs/active/BUNDLE_SWITCH_GAP_ANALYSIS.md.
 */

import { describe, it, expect } from "vitest";
import {
  getAllowedEventTypes,
  isAllowedEventType,
  validateEventForContract,
} from "../eventContractLoader";

describe("eventContractLoader", () => {
  describe("getAllowedEventTypes", () => {
    it("returns non-empty array of event_type strings", () => {
      const allowed = getAllowedEventTypes();
      expect(Array.isArray(allowed)).toBe(true);
      expect(allowed.length).toBeGreaterThan(0);
      expect(allowed.every((s) => typeof s === "string")).toBe(true);
    });

    it("includes engagement.session_started and engagement.meaningful_action", () => {
      const allowed = getAllowedEventTypes();
      expect(allowed).toContain("engagement.session_started");
      expect(allowed).toContain("engagement.meaningful_action");
    });
  });

  describe("isAllowedEventType", () => {
    it("returns true for contract event types", () => {
      expect(isAllowedEventType("engagement.session_started")).toBe(true);
      expect(isAllowedEventType("engagement.meaningful_action")).toBe(true);
    });

    it("returns false for unknown event types", () => {
      expect(isAllowedEventType("unknown.event")).toBe(false);
      expect(isAllowedEventType("")).toBe(false);
    });
  });

  describe("validateEventForContract", () => {
    it("returns valid for allowed event_type and valid source", () => {
      const result = validateEventForContract({
        event_type: "engagement.session_started",
        source: "mobile",
      });
      expect(result.valid).toBe(true);
    });

    it("returns valid when source is omitted", () => {
      const result = validateEventForContract({
        event_type: "engagement.session_started",
      });
      expect(result.valid).toBe(true);
    });

    it("returns valid for source web, server, admin, system", () => {
      for (const source of ["web", "server", "admin", "system"] as const) {
        const result = validateEventForContract({
          event_type: "engagement.session_started",
          source,
        });
        expect(result.valid).toBe(true);
      }
    });

    it("returns invalid when event_type is not in contract", () => {
      const result = validateEventForContract({
        event_type: "unknown.event.type",
        source: "mobile",
      });
      expect(result.valid).toBe(false);
      expect("errors" in result && result.errors.length).toBeGreaterThan(0);
      expect("errors" in result && result.errors[0]).toContain("unknown.event.type");
    });

    it("returns invalid when source is not in allowlist", () => {
      const result = validateEventForContract({
        event_type: "engagement.session_started",
        source: "invalid_source",
      });
      expect(result.valid).toBe(false);
      expect("errors" in result && result.errors.some((e) => e.includes("source"))).toBe(true);
    });

    it("returns invalid when event_type is missing or not a string", () => {
      const r1 = validateEventForContract({ event_type: "" });
      expect(r1.valid).toBe(false);
      expect("errors" in r1 && r1.errors.some((e) => e.includes("event_type"))).toBe(true);

      const r2 = validateEventForContract({ event_type: (123 as unknown) as string });
      expect(r2.valid).toBe(false);
    });
  });
});
