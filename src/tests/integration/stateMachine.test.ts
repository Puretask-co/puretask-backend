// src/tests/integration/stateMachine.test.ts
// Integration tests for job state machine

import { describe, it, expect } from "vitest";
import {
  getNextStatus,
  canTransition,
  getValidEvents,
  isTerminalStatus,
  JobStatus,
  JobEventType,
} from "../../state/jobStateMachine";

describe("Job State Machine Tests", () => {
  describe("getNextStatus", () => {
    it("should transition from created to request on job_requested", () => {
      expect(getNextStatus("created", "job_requested")).toBe("request");
    });

    it("should transition from request to accepted on job_accepted", () => {
      expect(getNextStatus("request", "job_accepted")).toBe("accepted");
    });

    it("should transition from accepted to en_route on cleaner_en_route", () => {
      expect(getNextStatus("accepted", "cleaner_en_route")).toBe("en_route");
    });

    it("should transition from en_route to in_progress on job_started", () => {
      expect(getNextStatus("en_route", "job_started")).toBe("in_progress");
    });

    it("should transition from in_progress to awaiting_client on job_completed", () => {
      expect(getNextStatus("in_progress", "job_completed")).toBe("awaiting_client");
    });

    it("should transition from awaiting_client to approved on client_approved", () => {
      expect(getNextStatus("awaiting_client", "client_approved")).toBe("approved");
    });

    it("should transition from awaiting_client to disputed on client_disputed", () => {
      expect(getNextStatus("awaiting_client", "client_disputed")).toBe("disputed");
    });

    it("should transition from disputed to approved on dispute_resolved", () => {
      expect(getNextStatus("disputed", "dispute_resolved")).toBe("approved");
    });

    it("should allow cancellation from non-terminal states", () => {
      const cancellableStatuses: JobStatus[] = [
        "created",
        "request",
        "accepted",
        "en_route",
        "in_progress",
      ];

      for (const status of cancellableStatuses) {
        expect(getNextStatus(status, "job_cancelled")).toBe("cancelled");
      }
    });

    it("should throw error for invalid transitions", () => {
      expect(() => getNextStatus("approved", "job_cancelled")).toThrow();
      expect(() => getNextStatus("cancelled", "job_started")).toThrow();
      expect(() => getNextStatus("created", "job_completed")).toThrow();
    });
  });

  describe("canTransition", () => {
    it("should return true for valid transitions", () => {
      expect(canTransition("created", "job_requested")).toBe(true);
      expect(canTransition("request", "job_accepted")).toBe(true);
      expect(canTransition("in_progress", "job_completed")).toBe(true);
    });

    it("should return false for invalid transitions", () => {
      expect(canTransition("created", "job_completed")).toBe(false);
      expect(canTransition("approved", "job_started")).toBe(false);
      expect(canTransition("cancelled", "job_accepted")).toBe(false);
    });
  });

  describe("getValidEvents", () => {
    it("should return valid events for created status", () => {
      const events = getValidEvents("created");
      expect(events).toContain("job_requested");
      expect(events).toContain("job_cancelled");
      expect(events).not.toContain("job_completed");
    });

    it("should return valid events for awaiting_client status", () => {
      const events = getValidEvents("awaiting_client");
      expect(events).toContain("client_approved");
      expect(events).toContain("client_disputed");
      expect(events).not.toContain("job_cancelled");
    });

    it("should return empty array for terminal statuses", () => {
      expect(getValidEvents("approved")).toEqual([]);
      expect(getValidEvents("cancelled")).toEqual([]);
    });
  });

  describe("isTerminalStatus", () => {
    it("should return true for terminal statuses", () => {
      expect(isTerminalStatus("approved")).toBe(true);
      expect(isTerminalStatus("cancelled")).toBe(true);
    });

    it("should return false for non-terminal statuses", () => {
      expect(isTerminalStatus("created")).toBe(false);
      expect(isTerminalStatus("request")).toBe(false);
      expect(isTerminalStatus("in_progress")).toBe(false);
      expect(isTerminalStatus("disputed")).toBe(false);
    });
  });

  describe("Full lifecycle validation", () => {
    it("should allow complete happy path", () => {
      let status: JobStatus = "created";

      status = getNextStatus(status, "job_requested");
      expect(status).toBe("request");

      status = getNextStatus(status, "job_accepted");
      expect(status).toBe("accepted");

      status = getNextStatus(status, "cleaner_en_route");
      expect(status).toBe("en_route");

      status = getNextStatus(status, "job_started");
      expect(status).toBe("in_progress");

      status = getNextStatus(status, "job_completed");
      expect(status).toBe("awaiting_client");

      status = getNextStatus(status, "client_approved");
      expect(status).toBe("approved");

      expect(isTerminalStatus(status)).toBe(true);
    });

    it("should allow dispute flow", () => {
      let status: JobStatus = "awaiting_client";

      status = getNextStatus(status, "client_disputed");
      expect(status).toBe("disputed");

      status = getNextStatus(status, "dispute_resolved");
      expect(status).toBe("approved");

      expect(isTerminalStatus(status)).toBe(true);
    });
  });
});

