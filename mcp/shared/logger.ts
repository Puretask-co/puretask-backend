import fs from "fs";
import path from "path";

export function logRequest(server: string, payload: Record<string, unknown>): void {
  try {
    const dir = path.join(process.cwd(), "mcp", "logs");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const line = JSON.stringify({ ts: new Date().toISOString(), server, ...payload }) + "\n";
    fs.appendFileSync(path.join(dir, `${server}.log`), line, "utf8");
  } catch {
    // logging must never crash the server
  }
}

