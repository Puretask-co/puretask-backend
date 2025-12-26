import fs from "fs";

export function tailFile(filePath: string, maxLines: number, maxBytes: number): string {
  if (!fs.existsSync(filePath)) {
    return "";
  }
  const stat = fs.statSync(filePath);
  const readBytes = Math.min(stat.size, maxBytes);
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(readBytes);
  fs.readSync(fd, buffer, 0, readBytes, Math.max(0, stat.size - readBytes));
  fs.closeSync(fd);
  const content = buffer.toString("utf8");
  const lines = content.split(/\r?\n/);
  return lines.slice(-maxLines).join("\n");
}

