// src/lib/logger.ts
// Centralized JSON logger for PureTask backend

export type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  msg: string;
  time: string;
  [key: string]: any;
}

function log(level: LogLevel, msg: string, meta?: Record<string, any>): void {
  const entry: LogEntry = {
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

export const logger = {
  info: (msg: string, meta?: Record<string, any>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, any>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, any>) => log("error", msg, meta),
  debug: (msg: string, meta?: Record<string, any>) => log("debug", msg, meta),
};

