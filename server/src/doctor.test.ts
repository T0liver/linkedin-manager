import { describe, expect, it } from "vitest";
import { formatChecks, runChecks, type DoctorInput } from "./doctor.js";

const NOW = Date.UTC(2026, 9, 26);
const good: DoctorInput = {
  nodeVersion: "v22.1.0",
  distEntry: "/r/server/dist/index.js",
  dataDir: "/home/u/.linkedin-agent",
  token: { kind: "keychain", expiresAt: NOW + 30 * 86_400_000 },
  now: NOW,
};
const all = () => true;
const none = () => false;

describe("doctor", () => {
  it("passes on a healthy setup", () => {
    const checks = runChecks(good, all);
    expect(checks.every((c) => c.level === "ok")).toBe(true);
    expect(formatChecks(checks)).toContain("Setup looks good");
  });

  it("reports every problem on a broken setup with a fix for each", () => {
    const checks = runChecks({ ...good, nodeVersion: "v18.0.0", token: undefined }, none);
    expect(checks.filter((c) => c.level === "fail")).toHaveLength(4);
    expect(checks.every((c) => c.fix)).toBe(true);
    const out = formatChecks(checks);
    expect(out).toContain("npm run build");
    expect(out).toContain("npm run login");
    expect(out).toContain("4 problem(s)");
  });

  it("flags an expired token and a near-expiry token", () => {
    expect(runChecks({ ...good, token: { kind: "file", expiresAt: NOW - 1 } }, all)[3].level).toBe("fail");
    expect(runChecks({ ...good, token: { kind: "file", expiresAt: NOW + 86_400_000 } }, all)[3].level).toBe("warn");
  });

  it("warns when voice.md is missing from an existing data dir", () => {
    const exists = (p: string) => !p.endsWith("voice.md");
    expect(runChecks(good, exists)[2].level).toBe("warn");
  });

  it("never prints token material", () => {
    const out = formatChecks(runChecks({ ...good, token: { kind: "keychain", expiresAt: NOW + 9e9, accessToken: "SECRET" } as any }, all));
    expect(out).not.toContain("SECRET");
  });
});
