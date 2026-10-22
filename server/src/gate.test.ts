import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkWrite } from "./gate.js";
import { appendLog, logPath } from "./postlog.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "li-gate-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const day1 = new Date(2026, 9, 22, 10, 0, 0);
const day2 = new Date(2026, 9, 23, 10, 0, 0);
const check = (text: string, confirm: boolean | undefined, now = day1) =>
  checkWrite({ action: "create_post", text, confirm }, { dir, now: () => now });

describe("checkWrite", () => {
  it("rejects without confirm and returns a preview", () => {
    for (const confirm of [undefined, false]) {
      const r = check("hello", confirm);
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.preview).toBe("hello");
    }
  });

  it("does not treat truthy non-true values as confirmation", () => {
    const r = checkWrite({ action: "create_post", text: "x", confirm: "yes" as any }, { dir, now: () => day1 });
    expect(r.allowed).toBe(false);
  });

  it("allows a confirmed, non-duplicate write under the cap", () => {
    expect(check("hello", true).allowed).toBe(true);
  });

  it("rejects the (N+1)th write on the same day and allows it the next day", () => {
    for (let i = 0; i < 3; i++) appendLog(dir, { action: "create_post", text: `post ${i}` }, day1);
    const blocked = check("post 3", true);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.reason).toMatch(/cap/i);
    expect(check("post 3", true, day2).allowed).toBe(true);
  });

  it("honours dailyCap from config.json", () => {
    writeFileSync(join(dir, "config.json"), JSON.stringify({ dailyCap: 1 }));
    appendLog(dir, { action: "create_post", text: "a" }, day1);
    expect(check("b", true).allowed).toBe(false);
  });

  it("falls back to the default cap on bad config and warns", () => {
    writeFileSync(join(dir, "config.json"), "{nope");
    const r = check("a", true);
    expect(r.allowed).toBe(true);
    expect(r.warnings.join()).toMatch(/config\.json/);
  });

  it("rejects duplicates despite case and whitespace differences", () => {
    appendLog(dir, { action: "create_post", text: "Hello   World" }, day1);
    const r = check("  hello\nworld ", true, day2);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toMatch(/duplicate/i);
  });

  it("treats a missing post-log.md as empty and warns", () => {
    const r = check("a", true);
    expect(r.allowed).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("treats a corrupt post-log.md as empty and warns", () => {
    writeFileSync(logPath(dir), "- garbage\n- not | enough\n\u0000\u0001 binary");
    const r = check("a", true);
    expect(r.allowed).toBe(true);
    expect(r.warnings.join()).toMatch(/corrupt/);
  });

  it("keeps valid entries when some lines are corrupt", () => {
    appendLog(dir, { action: "create_post", text: "dup" }, day1);
    writeFileSync(logPath(dir), "- junk\n", { flag: "a" });
    expect(check("dup", true, day2).allowed).toBe(false);
  });
});
