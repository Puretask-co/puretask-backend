// src/tests/integration/stateMachine.test.ts
// Comprehensive integration tests for job state machine
// Tests all transitions, permissions, and edge cases

import { describe, it, expect } from "vitest";
import {
  getNextStatus,
  canTransition,
  getValidEvents,
  isTerminalStatus,
  canActorTriggerEvent,
  validateTransition,
  JobStatus,
  JobEventType,
  ActorType,
} from "../../state/jobStateMachine";

describe("Job State Machine Tests", () => {
  describe("getNextStatus", () => {
    describe("Happy path transitions", () => {
      it("should transition from requested to accepted on job_accepted", () => {
        expect(getNextStatus("requested", "job_accepted")).toBe("accepted");
      });

      it("should transition from accepted to on_my_way on cleaner_on_my_way", () => {
        expect(getNextStatus("accepted", "cleaner_on_my_way")).toBe("on_my_way");
      });

      it("should transition from on_my_way to in_progress on job_started", () => {
        expect(getNextStatus("on_my_way", "job_started")).toBe("in_progress");
      });

      it("should transition from in_progress to awaiting_approval on job_completed", () => {
        expect(getNextStatus("in_progress", "job_completed")).toBe("awaiting_approval");
      });

      it("should transition from awaiting_approval to completed on client_approved", () => {
        expect(getNextStatus("awaiting_approval", "client_approved")).toBe("completed");
      });
    });

    describe("Alternative path: direct start from accepted", () => {
      it("should allow direct transition from accepted to in_progress (skipping on_my_way)", () => {
        expect(getNextStatus("accepted", "job_started")).toBe("in_progress");
      });
    });

    describe("Dispute flow", () => {
      it("should transition from awaiting_approval to disputed on client_disputed", () => {
        expect(getNextStatus("awaiting_approval", "client_disputed")).toBe("disputed");
      });

      it("should transition from disputed to cancelled on dispute_resolved_refund", () => {
        expect(getNextStatus("disputed", "dispute_resolved_refund")).toBe("cancelled");
      });

      it("should transition from disputed to completed on dispute_resolved_no_refund", () => {
        expect(getNextStatus("disputed", "dispute_resolved_no_refund")).toBe("completed");
      });

      it("should allow cancellation from disputed state", () => {
        expect(getNextStatus("disputed", "job_cancelled")).toBe("cancelled");
      });
    });

    describe("Cancellation flow", () => {
      it("should allow cancellation from requested state", () => {
        expect(getNextStatus("requested", "job_cancelled")).toBe("cancelled");
      });

      it("should allow cancellation from accepted state", () => {
        expect(getNextStatus("accepted", "job_cancelled")).toBe("cancelled");
      });

      it("should allow cancellation from on_my_way state", () => {
        expect(getNextStatus("on_my_way", "job_cancelled")).toBe("cancelled");
      });

      it("should allow cancellation from in_progress state", () => {
        expect(getNextStatus("in_progress", "job_cancelled")).toBe("cancelled");
      });

      it("should NOT allow cancellation from awaiting_approval state", () => {
        expect(() => getNextStatus("awaiting_approval", "job_cancelled")).toThrow();
      });
    });

    describe("Invalid transitions", () => {
      it("should throw error for invalid transition from completed", () => {
        expect(() => getNextStatus("completed", "job_cancelled")).toThrow(
          'Invalid transition: cannot apply "job_cancelled" when status is "completed"'
        );
      });

      it("should throw error for invalid transition from cancelled", () => {
        expect(() => getNextStatus("cancelled", "job_started")).toThrow(
          'Invalid transition: cannot apply "job_started" when status is "cancelled"'
        );
      });

      it("should throw error for invalid transition from requested", () => {
        expect(() => getNextStatus("requested", "job_completed")).toThrow(
          'Invalid transition: cannot apply "job_completed" when status is "requested"'
        );
      });

      it("should throw error for non-existent state", () => {
        // TypeScript should prevent this, but test runtime behavior
        expect(() => getNextStatus("invalid_state" as JobStatus, "job_accepted")).toThrow();
      });
    });
  });

  describe("canTransition", () => {
    it("should return true for valid transitions", () => {
      expect(canTransition("requested", "job_accepted")).toBe(true);
      expect(canTransition("accepted", "cleaner_on_my_way")).toBe(true);
      expect(canTransition("accepted", "job_started")).toBe(true); // Direct start
      expect(canTransition("in_progress", "job_completed")).toBe(true);
    });

    it("should return false for invalid transitions", () => {
      expect(canTransition("requested", "job_completed")).toBe(false);
      expect(canTransition("completed", "job_started")).toBe(false);
      expect(canTransition("cancelled", "job_accepted")).toBe(false);
      expect(canTransition("awaiting_approval", "job_cancelled")).toBe(false);
    });

    it("should return false for terminal states", () => {
      expect(canTransition("completed", "job_accepted")).toBe(false);
      expect(canTransition("cancelled", "job_started")).toBe(false);
    });
  });

  describe("getValidEvents", () => {
    it("should return valid events for requested status", () => {
      const events = getValidEvents("requested");
      expect(events).toContain("job_accepted");
      expect(events).toContain("job_cancelled");
      expect(events).not.toContain("job_completed");
      expect(events).not.toContain("client_approved");
      expect(events.length).toBe(2);
    });

    it("should return valid events for accepted status", () => {
      const events = getValidEvents("accepted");
      expect(events).toContain("cleaner_on_my_way");
      expect(events).toContain("job_started"); // Direct start allowed
      expect(events).toContain("job_cancelled");
      expect(events.length).toBe(3);
    });

    it("should return valid events for on_my_way status", () => {
      const events = getValidEvents("on_my_way");
      expect(events).toContain("job_started");
      expect(events).toContain("job_cancelled");
      expect(events.length).toBe(2);
    });

    it("should return valid events for in_progress status", () => {
      const events = getValidEvents("in_progress");
      expect(events).toContain("job_completed");
      expect(events).toContain("job_cancelled");
      expect(events.length).toBe(2);
    });

    it("should return valid events for awaiting_approval status", () => {
      const events = getValidEvents("awaiting_approval");
      expect(events).toContain("client_approved");
      expect(events).toContain("client_disputed");
      expect(events).not.toContain("job_cancelled");
      expect(events.length).toBe(2);
    });

    it("should return valid events for disputed status", () => {
      const events = getValidEvents("disputed");
      expect(events).toContain("dispute_resolved_refund");
      expect(events).toContain("dispute_resolved_no_refund");
      expect(events).toContain("job_cancelled");
      expect(events.length).toBe(3);
    });

    it("should return empty array for terminal statuses", () => {
      expect(getValidEvents("completed")).toEqual([]);
      expect(getValidEvents("cancelled")).toEqual([]);
    });
  });

  describe("isTerminalStatus", () => {
    it("should return true for terminal statuses", () => {
      expect(isTerminalStatus("completed")).toBe(true);
      expect(isTerminalStatus("cancelled")).toBe(true);
    });

    it("should return false for non-terminal statuses", () => {
      expect(isTerminalStatus("requested")).toBe(false);
      expect(isTerminalStatus("accepted")).toBe(false);
      expect(isTerminalStatus("on_my_way")).toBe(false);
      expect(isTerminalStatus("in_progress")).toBe(false);
      expect(isTerminalStatus("awaiting_approval")).toBe(false);
      expect(isTerminalStatus("disputed")).toBe(false);
    });
  });

  describe("canActorTriggerEvent - Role-based permissions", () => {
    describe("Client permissions", () => {
      it("should allow client to trigger job_created", () => {
        expect(canActorTriggerEvent("client", "job_created")).toBe(true);
      });

      it("should allow client to trigger client_approved", () => {
        expect(canActorTriggerEvent("client", "client_approved")).toBe(true);
      });

      it("should allow client to trigger client_disputed", () => {
        expect(canActorTriggerEvent("client", "client_disputed")).toBe(true);
      });

      it("should allow client to trigger job_cancelled", () => {
        expect(canActorTriggerEvent("client", "job_cancelled")).toBe(true);
      });

      it("should NOT allow client to trigger cleaner events", () => {
        expect(canActorTriggerEvent("client", "job_accepted")).toBe(false);
        expect(canActorTriggerEvent("client", "cleaner_on_my_way")).toBe(false);
        expect(canActorTriggerEvent("client", "job_started")).toBe(false);
        expect(canActorTriggerEvent("client", "job_completed")).toBe(false);
      });

      it("should NOT allow client to trigger admin events", () => {
        expect(canActorTriggerEvent("client", "dispute_resolved_refund")).toBe(false);
        expect(canActorTriggerEvent("client", "dispute_resolved_no_refund")).toBe(false);
      });
    });

    describe("Cleaner permissions", () => {
      it("should allow cleaner to trigger job_accepted", () => {
        expect(canActorTriggerEvent("cleaner", "job_accepted")).toBe(true);
      });

      it("should allow cleaner to trigger cleaner_on_my_way", () => {
        expect(canActorTriggerEvent("cleaner", "cleaner_on_my_way")).toBe(true);
      });

      it("should allow cleaner to trigger job_started", () => {
        expect(canActorTriggerEvent("cleaner", "job_started")).toBe(true);
      });

      it("should allow cleaner to trigger job_completed", () => {
        expect(canActorTriggerEvent("cleaner", "job_completed")).toBe(true);
      });

      it("should NOT allow cleaner to trigger client events", () => {
        expect(canActorTriggerEvent("cleaner", "client_approved")).toBe(false);
        expect(canActorTriggerEvent("cleaner", "client_disputed")).toBe(false);
      });

      it("should NOT allow cleaner to trigger admin events", () => {
        expect(canActorTriggerEvent("cleaner", "dispute_resolved_refund")).toBe(false);
        expect(canActorTriggerEvent("cleaner", "dispute_resolved_no_refund")).toBe(false);
      });
    });

    describe("Admin permissions", () => {
      it("should allow admin to trigger job_created", () => {
        expect(canActorTriggerEvent("admin", "job_created")).toBe(true);
      });

      it("should allow admin to trigger dispute resolution events", () => {
        expect(canActorTriggerEvent("admin", "dispute_resolved_refund")).toBe(true);
        expect(canActorTriggerEvent("admin", "dispute_resolved_no_refund")).toBe(true);
      });

      it("should allow admin to trigger job_cancelled", () => {
        expect(canActorTriggerEvent("admin", "job_cancelled")).toBe(true);
      });

      it("should NOT allow admin to trigger cleaner-specific events", () => {
        expect(canActorTriggerEvent("admin", "job_accepted")).toBe(false);
        expect(canActorTriggerEvent("admin", "cleaner_on_my_way")).toBe(false);
        expect(canActorTriggerEvent("admin", "job_started")).toBe(false);
        expect(canActorTriggerEvent("admin", "job_completed")).toBe(false);
      });

      it("should NOT allow admin to trigger client-specific events", () => {
        expect(canActorTriggerEvent("admin", "client_approved")).toBe(false);
        expect(canActorTriggerEvent("admin", "client_disputed")).toBe(false);
      });
    });

    describe("System permissions", () => {
      it("should allow system to trigger job_created", () => {
        expect(canActorTriggerEvent("system", "job_created")).toBe(true);
      });

      it("should allow system to trigger job_cancelled", () => {
        expect(canActorTriggerEvent("system", "job_cancelled")).toBe(true);
      });
    });
  });

  describe("validateTransition - Combined state and permission validation", () => {
    describe("Valid transitions", () => {
      it("should validate client-approved transition", () => {
        const result = validateTransition({
          currentStatus: "awaiting_approval",
          event: "client_approved",
          actorType: "client",
        });
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.nextStatus).toBe("completed");
        }
      });

      it("should validate cleaner job_accepted transition", () => {
        const result = validateTransition({
          currentStatus: "requested",
          event: "job_accepted",
          actorType: "cleaner",
        });
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.nextStatus).toBe("accepted");
        }
      });

      it("should validate direct start from accepted", () => {
        const result = validateTransition({
          currentStatus: "accepted",
          event: "job_started",
          actorType: "cleaner",
        });
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.nextStatus).toBe("in_progress");
        }
      });
    });

    describe("Invalid transitions - wrong actor", () => {
      it("should reject client trying to accept job", () => {
        const result = validateTransition({
          currentStatus: "requested",
          event: "job_accepted",
          actorType: "client",
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain("cannot trigger");
        }
      });

      it("should reject cleaner trying to approve job", () => {
        const result = validateTransition({
          currentStatus: "awaiting_approval",
          event: "client_approved",
          actorType: "cleaner",
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain("cannot trigger");
        }
      });

      it("should reject client trying to resolve dispute", () => {
        const result = validateTransition({
          currentStatus: "disputed",
          event: "dispute_resolved_refund",
          actorType: "client",
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain("cannot trigger");
        }
      });
    });

    describe("Invalid transitions - wrong state", () => {
      it("should reject transition from completed state", () => {
        const result = validateTransition({
          currentStatus: "completed",
          event: "job_cancelled",
          actorType: "admin",
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain("Invalid transition");
        }
      });

      it("should reject transition from cancelled state", () => {
        const result = validateTransition({
          currentStatus: "cancelled",
          event: "job_started",
          actorType: "cleaner",
        });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toContain("Invalid transition");
        }
      });
    });
  });

  describe("Full lifecycle validation", () => {
    it("should allow complete happy path with on_my_way", () => {
      let status: JobStatus = "requested";

      status = getNextStatus(status, "job_accepted");
      expect(status).toBe("accepted");

      status = getNextStatus(status, "cleaner_on_my_way");
      expect(status).toBe("on_my_way");

      status = getNextStatus(status, "job_started");
      expect(status).toBe("in_progress");

      status = getNextStatus(status, "job_completed");
      expect(status).toBe("awaiting_approval");

      status = getNextStatus(status, "client_approved");
      expect(status).toBe("completed");

      expect(isTerminalStatus(status)).toBe(true);
    });

    it("should allow complete happy path without on_my_way (direct start)", () => {
      let status: JobStatus = "requested";

      status = getNextStatus(status, "job_accepted");
      expect(status).toBe("accepted");

      // Skip on_my_way, go directly to in_progress
      status = getNextStatus(status, "job_started");
      expect(status).toBe("in_progress");

      status = getNextStatus(status, "job_completed");
      expect(status).toBe("awaiting_approval");

      status = getNextStatus(status, "client_approved");
      expect(status).toBe("completed");

      expect(isTerminalStatus(status)).toBe(true);
    });

    it("should allow dispute flow with refund", () => {
      let status: JobStatus = "awaiting_approval";

      status = getNextStatus(status, "client_disputed");
      expect(status).toBe("disputed");

      status = getNextStatus(status, "dispute_resolved_refund");
      expect(status).toBe("cancelled");

      expect(isTerminalStatus(status)).toBe(true);
    });

    it("should allow dispute flow without refund", () => {
      let status: JobStatus = "awaiting_approval";

      status = getNextStatus(status, "client_disputed");
      expect(status).toBe("disputed");

      status = getNextStatus(status, "dispute_resolved_no_refund");
      expect(status).toBe("completed");

      expect(isTerminalStatus(status)).toBe(true);
    });

    it("should allow cancellation at various stages", () => {
      // Cancel from requested
      expect(getNextStatus("requested", "job_cancelled")).toBe("cancelled");

      // Cancel from accepted
      expect(getNextStatus("accepted", "job_cancelled")).toBe("cancelled");

      // Cancel from on_my_way
      expect(getNextStatus("on_my_way", "job_cancelled")).toBe("cancelled");

      // Cancel from in_progress
      expect(getNextStatus("in_progress", "job_cancelled")).toBe("cancelled");
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should handle all valid states", () => {
      const validStates: JobStatus[] = [
        "requested",
        "accepted",
        "on_my_way",
        "in_progress",
        "awaiting_approval",
        "completed",
        "disputed",
        "cancelled",
      ];

      for (const state of validStates) {
        // Should not throw when getting valid events
        expect(() => getValidEvents(state)).not.toThrow();
        // Should not throw when checking if terminal
        expect(() => isTerminalStatus(state)).not.toThrow();
      }
    });

    it("should have consistent terminal state detection", () => {
      const terminalStates: JobStatus[] = ["completed", "cancelled"];
      const nonTerminalStates: JobStatus[] = [
        "requested",
        "accepted",
        "on_my_way",
        "in_progress",
        "awaiting_approval",
        "disputed",
      ];

      for (const state of terminalStates) {
        expect(isTerminalStatus(state)).toBe(true);
        expect(getValidEvents(state).length).toBe(0);
      }

      for (const state of nonTerminalStates) {
        expect(isTerminalStatus(state)).toBe(false);
        expect(getValidEvents(state).length).toBeGreaterThan(0);
      }
    });
  });
});
