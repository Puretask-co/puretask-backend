"use strict";
// src/lib/logger.ts
// Centralized JSON logger for PureTask backend
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
function log(level, msg, meta) {
    const entry = {
        level,
        msg,
        time: new Date().toISOString(),
        ...meta,
    };
    const output = JSON.stringify(entry);
    // Use appropriate console method based on level
    switch (level) {
        case "error":
            console.error(output);
            break;
        case "warn":
            console.warn(output);
            break;
        case "debug":
            if (process.env.NODE_ENV !== "production") {
                console.debug(output);
            }
            break;
        case "info":
        default:
            console.log(output);
            break;
    }
}
exports.logger = {
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
    debug: (msg, meta) => log("debug", msg, meta),
};
