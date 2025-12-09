"use strict";
// src/lib/validation.ts
// Zod validation middleware for Express routes
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
exports.validateParams = validateParams;
/**
 * Middleware to validate request body against a Zod schema
 * On validation failure, returns 400 with error details
 */
function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Request body validation failed",
                    details: result.error.errors,
                },
            });
        }
        // Replace req.body with validated and parsed data
        req.body = result.data;
        next();
    };
}
/**
 * Middleware to validate request query parameters against a Zod schema
 */
function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Query parameters validation failed",
                    details: result.error.errors,
                },
            });
        }
        req.query = result.data;
        next();
    };
}
/**
 * Middleware to validate request params against a Zod schema
 */
function validateParams(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_ERROR",
                    message: "URL parameters validation failed",
                    details: result.error.errors,
                },
            });
        }
        req.params = result.data;
        next();
    };
}
