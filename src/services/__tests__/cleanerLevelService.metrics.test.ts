/**
 * Gamification metrics compliance tests.
 * Maps to SPEC_REQUIREMENTS_MATRIX.md — every rule must have a passing test.
 */

import {
  isOnTime,
  isShortNotice,
  isMeaningfulMessage,
  isPhotoWithinJobWindow,
  GOOD_FAITH_DECLINE_LIMIT_PER_7_DAYS,
} from "../../lib/gamificationMetrics";

describe("Gamification Metrics — Spec Compliance", () => {
  describe("On-time definition (4.4)", () => {
    it("clock-in between -15 and +15 minutes counts as on-time", () => {
      const scheduled = new Date("2025-02-02T10:00:00Z");
      expect(isOnTime(new Date("2025-02-02T09:45:00Z"), scheduled)).toBe(true); // 15 min early
      expect(isOnTime(new Date("2025-02-02T10:00:00Z"), scheduled)).toBe(true); // exactly
      expect(isOnTime(new Date("2025-02-02T10:15:00Z"), scheduled)).toBe(true); // 15 min late
    });

    it("clock-in outside ±15 min does NOT count as on-time", () => {
      const scheduled = new Date("2025-02-02T10:00:00Z");
      expect(isOnTime(new Date("2025-02-02T09:44:59Z"), scheduled)).toBe(false); // 16 min early
      expect(isOnTime(new Date("2025-02-02T10:15:01Z"), scheduled)).toBe(false); // 16 min late
    });
  });

  describe("Short notice good-faith (5F)", () => {
    it("job start < 18h from request qualifies as short notice", () => {
      const requestAt = new Date("2025-02-02T08:00:00Z");
      const startAt = new Date("2025-02-02T20:00:00Z"); // 12h later
      expect(isShortNotice(requestAt, startAt)).toBe(true);
    });

    it("job start ≥ 18h from request does NOT qualify", () => {
      const requestAt = new Date("2025-02-02T08:00:00Z");
      const startAt = new Date("2025-02-03T03:00:00Z"); // 19h later
      expect(isShortNotice(requestAt, startAt)).toBe(false);
    });
  });

  describe("Meaningful message (4.2)", () => {
    it("message with ≥25 chars qualifies", () => {
      expect(isMeaningfulMessage("Hi! I'm on my way. See you soon!")).toBe(true);
      expect(isMeaningfulMessage("a".repeat(25))).toBe(true);
    });

    it("message with <25 chars does NOT qualify (unless template or reply)", () => {
      expect(isMeaningfulMessage("ok")).toBe(false);
      expect(isMeaningfulMessage("hi")).toBe(false);
      expect(isMeaningfulMessage("a".repeat(24))).toBe(false);
    });
  });

  describe("Photo timestamp window (4.3)", () => {
    it("photo created between clock-in and clock-out qualifies", () => {
      const clockIn = new Date("2025-02-02T10:00:00Z");
      const clockOut = new Date("2025-02-02T12:00:00Z");
      const photoAt = new Date("2025-02-02T11:00:00Z");
      expect(isPhotoWithinJobWindow(photoAt, clockIn, clockOut)).toBe(true);
    });

    it("photo before clock-in or after clock-out does NOT qualify", () => {
      const clockIn = new Date("2025-02-02T10:00:00Z");
      const clockOut = new Date("2025-02-02T12:00:00Z");
      expect(isPhotoWithinJobWindow(new Date("2025-02-02T09:59:00Z"), clockIn, clockOut)).toBe(false);
      expect(isPhotoWithinJobWindow(new Date("2025-02-02T12:01:00Z"), clockIn, clockOut)).toBe(false);
    });
  });

  describe("Good-faith decline limit (5)", () => {
    it("limit is 6 per 7 days", () => {
      expect(GOOD_FAITH_DECLINE_LIMIT_PER_7_DAYS).toBe(6);
    });
  });
});
