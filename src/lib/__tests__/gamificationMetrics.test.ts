/**
 * Unit tests for gamificationMetrics pure functions.
 */

import {
  isOnTime,
  isShortNotice,
  isMeaningfulMessage,
  isPhotoWithinJobWindow,
} from "../gamificationMetrics";

describe("gamificationMetrics", () => {
  describe("isOnTime", () => {
    const scheduled = new Date("2025-02-02T10:00:00Z");

    it("accepts clock-in 15 min early", () => {
      expect(isOnTime(new Date("2025-02-02T09:45:00Z"), scheduled)).toBe(true);
    });
    it("accepts clock-in exactly on time", () => {
      expect(isOnTime(new Date("2025-02-02T10:00:00Z"), scheduled)).toBe(true);
    });
    it("accepts clock-in 15 min late", () => {
      expect(isOnTime(new Date("2025-02-02T10:15:00Z"), scheduled)).toBe(true);
    });
    it("rejects clock-in 16 min early", () => {
      expect(isOnTime(new Date("2025-02-02T09:44:00Z"), scheduled)).toBe(false);
    });
    it("rejects clock-in 16 min late", () => {
      expect(isOnTime(new Date("2025-02-02T10:16:00Z"), scheduled)).toBe(false);
    });
    it("uses custom early/late when provided", () => {
      expect(isOnTime(new Date("2025-02-02T09:50:00Z"), scheduled, 10, 10)).toBe(true);
      expect(isOnTime(new Date("2025-02-02T10:20:00Z"), scheduled, 10, 10)).toBe(false);
    });
  });

  describe("isShortNotice", () => {
    it("returns true when < 18h", () => {
      const req = new Date("2025-02-02T00:00:00Z");
      const start = new Date("2025-02-02T12:00:00Z");
      expect(isShortNotice(req, start)).toBe(true);
    });
    it("returns false when >= 18h", () => {
      const req = new Date("2025-02-02T00:00:00Z");
      const start = new Date("2025-02-02T18:00:00Z");
      expect(isShortNotice(req, start)).toBe(false);
    });
    it("uses custom threshold when provided", () => {
      const req = new Date("2025-02-02T00:00:00Z");
      const start = new Date("2025-02-02T04:00:00Z");
      expect(isShortNotice(req, start, 3)).toBe(false); // 4h >= 3h
      expect(isShortNotice(req, start, 5)).toBe(true); // 4h < 5h
    });
  });

  describe("isMeaningfulMessage", () => {
    it("25+ chars is meaningful", () => {
      expect(isMeaningfulMessage("Hello! I am on my way to your place.")).toBe(true);
      expect(isMeaningfulMessage("x".repeat(25))).toBe(true);
    });
    it("under 25 chars is not meaningful", () => {
      expect(isMeaningfulMessage("ok")).toBe(false);
      expect(isMeaningfulMessage("x".repeat(24))).toBe(false);
    });
    it("trims whitespace", () => {
      expect(isMeaningfulMessage("  " + "x".repeat(25) + "  ")).toBe(true);
    });
  });

  describe("isPhotoWithinJobWindow", () => {
    const clockIn = new Date("2025-02-02T10:00:00Z");
    const clockOut = new Date("2025-02-02T12:00:00Z");

    it("photo during job window is valid", () => {
      expect(isPhotoWithinJobWindow(new Date("2025-02-02T11:00:00Z"), clockIn, clockOut)).toBe(true);
    });
    it("photo at clock-in is valid", () => {
      expect(isPhotoWithinJobWindow(clockIn, clockIn, clockOut)).toBe(true);
    });
    it("photo at clock-out is valid", () => {
      expect(isPhotoWithinJobWindow(clockOut, clockIn, clockOut)).toBe(true);
    });
    it("photo before clock-in is invalid", () => {
      expect(isPhotoWithinJobWindow(new Date("2025-02-02T09:59:00Z"), clockIn, clockOut)).toBe(false);
    });
    it("photo after clock-out is invalid", () => {
      expect(isPhotoWithinJobWindow(new Date("2025-02-02T12:01:00Z"), clockIn, clockOut)).toBe(false);
    });
  });
});
