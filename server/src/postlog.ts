import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface LogEntry {
  timestamp: string; // ISO 8601
  action: string;
  ref: string; // URL or id; "-" when none
  hash: string;
}

export interface ReadResult {
  entries: LogEntry[];
  warnings: string[];
}

const HEADER = "# Post log\n\n<!-- timestamp | action | url-or-id | text hash -->\n\n";

export function logPath(dir: string): string {
  return join(dir, "post-log.md");
}

/** Lowercase and collapse whitespace so trivial variants count as duplicates. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function hashText(text: string): string {
  return createHash("sha256").update(normalizeText(text)).digest("hex");
}

export function readLog(dir: string): ReadResult {
  const file = logPath(dir);
  if (!existsSync(file)) {
    return { entries: [], warnings: ["post-log.md not found; treating as empty"] };
  }
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    return { entries: [], warnings: [`post-log.md unreadable (${(err as Error).message}); treating as empty`] };
  }
  const entries: LogEntry[] = [];
  let corrupt = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("- ")) continue;
    const parts = line.slice(2).split(" | ");
    const [timestamp, action, ref, hash] = parts.map((p) => p.trim());
    if (parts.length !== 4 || Number.isNaN(Date.parse(timestamp)) || !/^[0-9a-f]{64}$/.test(hash)) {
      corrupt++;
      continue;
    }
    entries.push({ timestamp, action, ref, hash });
  }
  const warnings = corrupt ? [`post-log.md: ignored ${corrupt} corrupt line(s)`] : [];
  return { entries, warnings };
}

export function appendLog(
  dir: string,
  entry: { action: string; ref?: string; text: string },
  now: Date = new Date(),
): LogEntry {
  mkdirSync(dir, { recursive: true });
  const file = logPath(dir);
  const clean = (s: string) => s.replace(/[\r\n|]+/g, " ").trim();
  const logged: LogEntry = {
    timestamp: now.toISOString(),
    action: clean(entry.action),
    ref: clean(entry.ref ?? "") || "-",
    hash: hashText(entry.text),
  };
  const line = `- ${logged.timestamp} | ${logged.action} | ${logged.ref} | ${logged.hash}\n`;
  appendFileSync(file, existsSync(file) ? line : HEADER + line, "utf8");
  return logged;
}
