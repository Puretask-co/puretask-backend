import { Request, Response, NextFunction } from "express";

const TOKEN_ENV = "MCP_TOKEN";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const configuredToken = process.env[TOKEN_ENV];
  if (!configuredToken) {
    res.status(500).json({ error: `${TOKEN_ENV} is not set` });
    return;
  }
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }
  const provided = header.slice("bearer ".length);
  if (provided !== configuredToken) {
    res.status(403).json({ error: "invalid token" });
    return;
  }
  next();
}

