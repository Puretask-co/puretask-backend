"use strict";
// src/lib/auth.ts
// Authentication helpers: password hashing, JWT signing/verification, middleware
// Includes n8n HMAC signature verification
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signAuthToken = signAuthToken;
exports.verifyAuthToken = verifyAuthToken;
exports.authMiddlewareAttachUser = authMiddlewareAttachUser;
exports.auth = auth;
exports.adminOnly = adminOnly;
exports.verifyN8nSignature = verifyN8nSignature;
exports.computeN8nSignature = computeN8nSignature;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
// ============================================
// Password Hashing
// ============================================
/**
 * Hash a plaintext password
 */
async function hashPassword(plain) {
    return bcryptjs_1.default.hash(plain, env_1.env.BCRYPT_SALT_ROUNDS);
}
/**
 * Verify a plaintext password against a hash
 */
async function verifyPassword(plain, hash) {
    return bcryptjs_1.default.compare(plain, hash);
}
// ============================================
// JWT Token Management
// ============================================
/**
 * Sign a JWT token for an authenticated user
 */
function signAuthToken(user) {
    return jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, env_1.env.JWT_SECRET, { expiresIn: env_1.env.JWT_EXPIRES_IN });
}
/**
 * Verify and decode a JWT token
 */
function verifyAuthToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    return { id: decoded.id, role: decoded.role };
}
// ============================================
// JWT Middleware
// ============================================
/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return null;
    }
    return header.slice("Bearer ".length);
}
/**
 * Attach user to request if valid JWT is present (but don't enforce auth)
 * Use this for routes where auth is optional
 */
function authMiddlewareAttachUser(req, _res, next) {
    const token = extractBearerToken(req);
    if (token) {
        try {
            req.user = verifyAuthToken(token);
        }
        catch {
            // Ignore invalid token - user stays undefined
        }
    }
    next();
}
/**
 * Enforce authentication, optionally requiring a specific role
 * Use this for protected routes
 */
function auth(requiredRole) {
    return (req, res, next) => {
        const token = extractBearerToken(req);
        if (!token) {
            res.status(401).json({
                error: { code: "UNAUTHENTICATED", message: "Missing auth token" },
            });
            return;
        }
        try {
            const decoded = verifyAuthToken(token);
            req.user = decoded;
            // Check role if required (admin can access everything)
            if (requiredRole && decoded.role !== requiredRole && decoded.role !== "admin") {
                res.status(403).json({
                    error: { code: "FORBIDDEN", message: `Requires ${requiredRole} role` },
                });
                return;
            }
            next();
        }
        catch {
            res.status(401).json({
                error: { code: "INVALID_TOKEN", message: "Invalid or expired auth token" },
            });
        }
    };
}
/**
 * Require admin role
 */
function adminOnly(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
        res.status(401).json({
            error: { code: "UNAUTHENTICATED", message: "Missing auth token" },
        });
        return;
    }
    try {
        const decoded = verifyAuthToken(token);
        req.user = decoded;
        if (decoded.role !== "admin") {
            res.status(403).json({
                error: { code: "FORBIDDEN", message: "Admin access required" },
            });
            return;
        }
        next();
    }
    catch {
        res.status(401).json({
            error: { code: "INVALID_TOKEN", message: "Invalid or expired auth token" },
        });
    }
}
// ============================================
// n8n HMAC Signature Verification
// ============================================
/**
 * Verify that this request came from n8n using an HMAC signature.
 *
 * Signature scheme:
 * - Shared secret: N8N_WEBHOOK_SECRET
 * - Header: x-n8n-signature
 * - Algorithm: HMAC-SHA256 over JSON.stringify(req.body)
 * - signature = hex(HMAC_SHA256(secret, JSON.stringify(body)))
 *
 * In n8n, compute the same signature and set the header:
 * ```javascript
 * const crypto = require('crypto');
 * const secret = 'your_N8N_WEBHOOK_SECRET';
 * const body = JSON.stringify($json);
 * const hmac = crypto.createHmac('sha256', secret);
 * hmac.update(body, 'utf8');
 * const signature = hmac.digest('hex');
 * // Set header: x-n8n-signature = signature
 * ```
 */
function verifyN8nSignature(req, res, next) {
    const secret = env_1.env.N8N_WEBHOOK_SECRET;
    // If secret not configured
    if (!secret) {
        if (env_1.env.NODE_ENV === "production") {
            // Fail closed in production
            res.status(500).json({
                error: { code: "CONFIG_ERROR", message: "n8n webhook secret not configured" },
            });
            return;
        }
        // In dev, allow through for local testing
        next();
        return;
    }
    // Get signature from header
    const headerSig = req.headers["x-n8n-signature"];
    if (!headerSig || typeof headerSig !== "string") {
        res.status(401).json({
            error: { code: "MISSING_SIGNATURE", message: "Missing x-n8n-signature header" },
        });
        return;
    }
    // Compute expected signature
    const bodyString = JSON.stringify(req.body ?? {});
    const hmac = crypto_1.default.createHmac("sha256", secret);
    hmac.update(bodyString, "utf8");
    const expectedSig = hmac.digest("hex");
    // Use timing-safe comparison to prevent timing attacks
    let valid = false;
    try {
        valid =
            headerSig.length === expectedSig.length &&
                crypto_1.default.timingSafeEqual(Buffer.from(headerSig), Buffer.from(expectedSig));
    }
    catch {
        // If lengths differ, timingSafeEqual throws
        valid = false;
    }
    if (!valid) {
        res.status(401).json({
            error: { code: "INVALID_SIGNATURE", message: "Invalid n8n signature" },
        });
        return;
    }
    next();
}
/**
 * Compute n8n signature for testing
 */
function computeN8nSignature(body) {
    const bodyString = JSON.stringify(body ?? {});
    const hmac = crypto_1.default.createHmac("sha256", env_1.env.N8N_WEBHOOK_SECRET);
    hmac.update(bodyString, "utf8");
    return hmac.digest("hex");
}
