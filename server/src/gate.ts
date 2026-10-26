import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths.js";
import { hashText, readLog } from "./postlog.js";

export const DEFAULT_DAILY_CAP = 3;

export interface GateInput {
  action: string;
  text: string;
  confirm?: boolean;
  /** Draft-only actions publish nothing, so the daily cap does not apply; confirmation and the duplicate check still do. */
  draftOnly?: boolean;
}

export type GateResult =
  | { allowed: true; warnings: string[] }
  | { allowed: false; reason: string; preview?: string; warnings: string[] };

export interface GateDeps {
  now?: () => Date;
  dir?: string;
}

function readCap(dir: string, warnings: string[]): number {
  const file = join(dir, "config.json");
  if (!existsSync(file)) return DEFAULT_DAILY_CAP;
  try {
    const cap = JSON.parse(readFileSync(file, "utf8")).dailyCap;
    if (cap === undefined) return DEFAULT_DAILY_CAP;
    if (Number.isInteger(cap) && cap >= 0) return cap;
    warnings.push(`config.json: invalid dailyCap; using ${DEFAULT_DAILY_CAP}`);
  } catch {
    warnings.push(`config.json unreadable; using dailyCap ${DEFAULT_DAILY_CAP}`);
  }
  return DEFAULT_DAILY_CAP;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Server-side enforcement for every LinkedIn write. Order: confirmation,
 * daily cap, duplicate text. Only `confirm === true` counts as confirmed.
 */
export function checkWrite(input: GateInput, deps: GateDeps = {}): GateResult {
  const now = (deps.now ?? (() => new Date()))();
  const dir = deps.dir ?? dataDir();
  const warnings: string[] = [];

  if (input.confirm !== true) {
    return {
      allowed: false,
      reason:
        "Confirmation required: show this preview to the user and call again with confirm=true only after they approve.",
      preview: input.text,
      warnings,
    };
  }

  const log = readLog(dir);
  warnings.push(...log.warnings);
  const cap = readCap(dir, warnings);

  const today = log.entries.filter((e) => sameLocalDay(new Date(e.timestamp), now)).length;
  if (!input.draftOnly && today >= cap) {
    return {
      allowed: false,
      reason: `Daily write cap reached (${today}/${cap}). Try again tomorrow or raise dailyCap in config.json.`,
      warnings,
    };
  }

  const hash = hashText(input.text);
  if (log.entries.some((e) => e.hash === hash)) {
    return { allowed: false, reason: "Duplicate: identical text was already used (see post-log.md).", warnings };
  }

  return { allowed: true, warnings };
}
