import path from "path";

export function isAllowedPath(requestedPath: string, allowPrefixes: string[], allowedExtensions: string[]): boolean {
  const normalized = path.normalize(requestedPath).replace(/\\/g, "/");
  const hasAllowedPrefix = allowPrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix.replace(/\\+/g, "/")}`));
  const ext = path.extname(normalized).toLowerCase();
  return hasAllowedPrefix && allowedExtensions.includes(ext);
}

export function resolveWithinRepo(relPath: string): string {
  return path.join(process.cwd(), relPath);
}

