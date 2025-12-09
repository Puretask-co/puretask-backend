"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
function authMiddleware(req, res, next) {
    const role = req.header("x-user-role") || null;
    const id = req.header("x-user-id") || null;
    if (!role || !id) {
        return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing auth headers" } });
    }
    if (!["client", "cleaner", "admin"].includes(role)) {
        return res.status(403).json({ error: { code: "INVALID_ROLE", message: "Invalid role" } });
    }
    req.user = { id, role };
    next();
}
