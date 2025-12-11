"use strict";
// src/state/jobStateMachine.ts
// Job lifecycle state machine matching 001_init.sql schema exactly
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventPermissions = exports.allowedTransitions = void 0;
exports.getNextStatus = getNextStatus;
exports.canTransition = canTransition;
exports.getValidEvents = getValidEvents;
exports.isTerminalStatus = isTerminalStatus;
exports.canActorTriggerEvent = canActorTriggerEvent;
exports.validateTransition = validateTransition;
/**
 * State machine transitions matching PureTask business logic
 * Based on 001_init.sql job_status enum:
 * - requested
 * - accepted
 * - on_my_way
 * - in_progress
 * - awaiting_approval
 * - completed
 * - disputed
 * - cancelled
 */
exports.allowedTransitions = {
    // Initial state: client has requested a job
    requested: {
        job_accepted: "accepted",
        job_cancelled: "cancelled",
    },
    // Cleaner has accepted the job
    accepted: {
        cleaner_on_my_way: "on_my_way",
        job_started: "in_progress", // allow direct start if no on_my_way step
        job_cancelled: "cancelled",
    },
    // Cleaner is en route to the job location
    on_my_way: {
        job_started: "in_progress",
        job_cancelled: "cancelled",
    },
    // Job is actively being worked on
    in_progress: {
        job_completed: "awaiting_approval",
        job_cancelled: "cancelled",
    },
    // Cleaner marked complete, waiting for client approval
    awaiting_approval: {
        client_approved: "completed",
        client_disputed: "disputed",
    },
    // Job successfully completed and approved
    completed: {
    // Terminal state - no more transitions
    },
    // Client disputed the job
    disputed: {
        dispute_resolved_refund: "cancelled", // Full refund, job cancelled
        dispute_resolved_no_refund: "completed", // Dispute closed, cleaner paid
        job_cancelled: "cancelled", // Admin cancellation
    },
    // Job was cancelled
    cancelled: {
    // Terminal state - no more transitions
    },
};
/**
 * Get next status from current status and event
 * Throws if transition is invalid
 */
function getNextStatus(current, event) {
    const mapping = exports.allowedTransitions[current] ?? {};
    const next = mapping[event];
    if (!next) {
        throw new Error(`Invalid transition: cannot apply "${event}" when status is "${current}"`);
    }
    return next;
}
/**
 * Check if a transition is allowed
 */
function canTransition(current, event) {
    try {
        getNextStatus(current, event);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get all valid events for a given status
 */
function getValidEvents(current) {
    const mapping = exports.allowedTransitions[current] ?? {};
    return Object.keys(mapping);
}
/**
 * Check if status is terminal (no more transitions possible)
 */
function isTerminalStatus(status) {
    const validEvents = getValidEvents(status);
    return validEvents.length === 0;
}
/**
 * Role-based event permissions
 * Defines which roles can trigger which events
 */
exports.eventPermissions = {
    job_created: ["client", "admin", "system"],
    job_accepted: ["cleaner"],
    cleaner_on_my_way: ["cleaner"],
    job_started: ["cleaner"],
    job_completed: ["cleaner"],
    client_approved: ["client"],
    client_disputed: ["client"],
    dispute_resolved_refund: ["admin"],
    dispute_resolved_no_refund: ["admin"],
    job_cancelled: ["client", "admin", "system"],
};
/**
 * Check if an actor can trigger an event
 */
function canActorTriggerEvent(actorType, event) {
    const allowed = exports.eventPermissions[event] ?? [];
    return allowed.includes(actorType);
}
/**
 * Validate a transition with role check
 */
function validateTransition(opts) {
    // Check role permission
    if (!canActorTriggerEvent(opts.actorType, opts.event)) {
        return {
            valid: false,
            error: `Actor type "${opts.actorType}" cannot trigger event "${opts.event}"`,
        };
    }
    // Check state machine
    try {
        const nextStatus = getNextStatus(opts.currentStatus, opts.event);
        return { valid: true, nextStatus };
    }
    catch (err) {
        return {
            valid: false,
            error: err instanceof Error ? err.message : "Invalid state machine transition",
        };
    }
}
