import { existsSync } from "node:fs";
import { join } from "node:path";

export type Level = "ok" | "warn" | "fail";

export interface Check {
  name: string;
  level: Level;
  detail: string;
  /** What the user or agent should do next; set when level is not "ok". */
  fix?: string;
}

export interface DoctorInput {
  nodeVersion: string;
  /** Absolute path to `server/dist/index.js`. */
  distEntry: string;
  dataDir: string;
  token: { kind: string; expiresAt: number } | undefined;
  now: number;
}

/** Pure setup check: reports what is missing without printing any secret. */
export function runChecks(input: DoctorInput, exists: (p: string) => boolean = existsSync): Check[] {
  const checks: Check[] = [];

  const major = Number(input.nodeVersion.replace(/^v/, "").split(".")[0]);
  checks.push(
    major >= 20
      ? { name: "Node version", level: "ok", detail: input.nodeVersion }
      : {
          name: "Node version",
          level: "fail",
          detail: `${input.nodeVersion} (need 20 or newer)`,
          fix: "Install Node 20+ and re-run `npm install && npm run build` in server/.",
        },
  );

  checks.push(
    exists(input.distEntry)
      ? { name: "Build output", level: "ok", detail: input.distEntry }
      : {
          name: "Build output",
          level: "fail",
          detail: `${input.distEntry} not found`,
          fix: "Run `npm install && npm run build` in server/.",
        },
  );

  const voice = join(input.dataDir, "voice.md");
  if (!exists(input.dataDir)) {
    checks.push({
      name: "Data directory",
      level: "fail",
      detail: `${input.dataDir} does not exist`,
      fix: "Copy the repo's templates/ folder to this path.",
    });
  } else if (!exists(voice)) {
    checks.push({
      name: "Data directory",
      level: "warn",
      detail: `${input.dataDir} exists but voice.md is missing`,
      fix: "Copy the repo's templates/ contents into it (do not overwrite existing files).",
    });
  } else {
    checks.push({ name: "Data directory", level: "ok", detail: input.dataDir });
  }

  if (!input.token) {
    checks.push({
      name: "LinkedIn token",
      level: "fail",
      detail: "no token stored",
      fix: "Run `npm run login` in server/ (the user completes the browser login).",
    });
  } else if (input.token.expiresAt <= input.now) {
    checks.push({
      name: "LinkedIn token",
      level: "fail",
      detail: `expired (stored in ${input.token.kind})`,
      fix: "Run `npm run login` in server/ to re-authenticate.",
    });
  } else {
    const days = Math.floor((input.token.expiresAt - input.now) / 86_400_000);
    checks.push({
      name: "LinkedIn token",
      level: days < 7 ? "warn" : "ok",
      detail: `valid for ${days} more day(s) (stored in ${input.token.kind})`,
      ...(days < 7 ? { fix: "Run `npm run login` soon to refresh it." } : {}),
    });
  }

  return checks;
}

const MARK: Record<Level, string> = { ok: "[ok]  ", warn: "[warn]", fail: "[FAIL]" };

export function formatChecks(checks: Check[]): string {
  const lines = checks.flatMap((c) => [
    `${MARK[c.level]} ${c.name}: ${c.detail}`,
    ...(c.fix ? [`       -> ${c.fix}`] : []),
  ]);
  const failed = checks.filter((c) => c.level === "fail").length;
  lines.push(failed ? `\n${failed} problem(s) found. Fix them in order, then re-run \`npm run doctor\`.` : "\nSetup looks good.");
  return lines.join("\n");
}
