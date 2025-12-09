"use strict";
// src/tests/integration/stateMachine.test.ts
// Integration tests for job state machine
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const jobStateMachine_1 = require("../../state/jobStateMachine");
(0, vitest_1.describe)("Job State Machine Tests", () => {
    (0, vitest_1.describe)("getNextStatus", () => {
        (0, vitest_1.it)("should transition from created to request on job_requested", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)("created", "job_requested")).toBe("request");
        });
        (0, vitest_1.it)("should transition from request to accepted on job_accepted", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)("request", "job_accepted")).toBe("accepted");
        });
        (0, vitest_1.it)("should transition from accepted to en_route on cleaner_en_route", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)("accepted", "cleaner_en_route")).toBe("en_route");
        });
        (0, vitest_1.it)("should transition from en_route to in_progress on job_started", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)("en_route", "job_started")).toBe("in_progress");
        });
        (0, vitest_1.it)("should transition from in_progress to awaiting_client on job_completed", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)("in_progress", "job_completed")).toBe("awaiting_client");
        });
        (0, vitest_1.it)("should transition from awaiting_client to approved on client_approved", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)("awaiting_client", "client_approved")).toBe("approved");
        });
        (0, vitest_1.it)("should transition from awaiting_client to disputed on client_disputed", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)("awaiting_client", "client_disputed")).toBe("disputed");
        });
        (0, vitest_1.it)("should transition from disputed to approved on dispute_resolved", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)("disputed", "dispute_resolved")).toBe("approved");
        });
        (0, vitest_1.it)("should allow cancellation from non-terminal states", () => {
            const cancellableStatuses = [
                "created",
                "request",
                "accepted",
                "en_route",
                "in_progress",
            ];
            for (const status of cancellableStatuses) {
                (0, vitest_1.expect)((0, jobStateMachine_1.getNextStatus)(status, "job_cancelled")).toBe("cancelled");
            }
        });
        (0, vitest_1.it)("should throw error for invalid transitions", () => {
            (0, vitest_1.expect)(() => (0, jobStateMachine_1.getNextStatus)("approved", "job_cancelled")).toThrow();
            (0, vitest_1.expect)(() => (0, jobStateMachine_1.getNextStatus)("cancelled", "job_started")).toThrow();
            (0, vitest_1.expect)(() => (0, jobStateMachine_1.getNextStatus)("created", "job_completed")).toThrow();
        });
    });
    (0, vitest_1.describe)("canTransition", () => {
        (0, vitest_1.it)("should return true for valid transitions", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.canTransition)("created", "job_requested")).toBe(true);
            (0, vitest_1.expect)((0, jobStateMachine_1.canTransition)("request", "job_accepted")).toBe(true);
            (0, vitest_1.expect)((0, jobStateMachine_1.canTransition)("in_progress", "job_completed")).toBe(true);
        });
        (0, vitest_1.it)("should return false for invalid transitions", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.canTransition)("created", "job_completed")).toBe(false);
            (0, vitest_1.expect)((0, jobStateMachine_1.canTransition)("approved", "job_started")).toBe(false);
            (0, vitest_1.expect)((0, jobStateMachine_1.canTransition)("cancelled", "job_accepted")).toBe(false);
        });
    });
    (0, vitest_1.describe)("getValidEvents", () => {
        (0, vitest_1.it)("should return valid events for created status", () => {
            const events = (0, jobStateMachine_1.getValidEvents)("created");
            (0, vitest_1.expect)(events).toContain("job_requested");
            (0, vitest_1.expect)(events).toContain("job_cancelled");
            (0, vitest_1.expect)(events).not.toContain("job_completed");
        });
        (0, vitest_1.it)("should return valid events for awaiting_client status", () => {
            const events = (0, jobStateMachine_1.getValidEvents)("awaiting_client");
            (0, vitest_1.expect)(events).toContain("client_approved");
            (0, vitest_1.expect)(events).toContain("client_disputed");
            (0, vitest_1.expect)(events).not.toContain("job_cancelled");
        });
        (0, vitest_1.it)("should return empty array for terminal statuses", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.getValidEvents)("approved")).toEqual([]);
            (0, vitest_1.expect)((0, jobStateMachine_1.getValidEvents)("cancelled")).toEqual([]);
        });
    });
    (0, vitest_1.describe)("isTerminalStatus", () => {
        (0, vitest_1.it)("should return true for terminal statuses", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.isTerminalStatus)("approved")).toBe(true);
            (0, vitest_1.expect)((0, jobStateMachine_1.isTerminalStatus)("cancelled")).toBe(true);
        });
        (0, vitest_1.it)("should return false for non-terminal statuses", () => {
            (0, vitest_1.expect)((0, jobStateMachine_1.isTerminalStatus)("created")).toBe(false);
            (0, vitest_1.expect)((0, jobStateMachine_1.isTerminalStatus)("request")).toBe(false);
            (0, vitest_1.expect)((0, jobStateMachine_1.isTerminalStatus)("in_progress")).toBe(false);
            (0, vitest_1.expect)((0, jobStateMachine_1.isTerminalStatus)("disputed")).toBe(false);
        });
    });
    (0, vitest_1.describe)("Full lifecycle validation", () => {
        (0, vitest_1.it)("should allow complete happy path", () => {
            let status = "created";
            status = (0, jobStateMachine_1.getNextStatus)(status, "job_requested");
            (0, vitest_1.expect)(status).toBe("request");
            status = (0, jobStateMachine_1.getNextStatus)(status, "job_accepted");
            (0, vitest_1.expect)(status).toBe("accepted");
            status = (0, jobStateMachine_1.getNextStatus)(status, "cleaner_en_route");
            (0, vitest_1.expect)(status).toBe("en_route");
            status = (0, jobStateMachine_1.getNextStatus)(status, "job_started");
            (0, vitest_1.expect)(status).toBe("in_progress");
            status = (0, jobStateMachine_1.getNextStatus)(status, "job_completed");
            (0, vitest_1.expect)(status).toBe("awaiting_client");
            status = (0, jobStateMachine_1.getNextStatus)(status, "client_approved");
            (0, vitest_1.expect)(status).toBe("approved");
            (0, vitest_1.expect)((0, jobStateMachine_1.isTerminalStatus)(status)).toBe(true);
        });
        (0, vitest_1.it)("should allow dispute flow", () => {
            let status = "awaiting_client";
            status = (0, jobStateMachine_1.getNextStatus)(status, "client_disputed");
            (0, vitest_1.expect)(status).toBe("disputed");
            status = (0, jobStateMachine_1.getNextStatus)(status, "dispute_resolved");
            (0, vitest_1.expect)(status).toBe("approved");
            (0, vitest_1.expect)((0, jobStateMachine_1.isTerminalStatus)(status)).toBe(true);
        });
    });
});
