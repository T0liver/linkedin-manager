import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendLog, logPath, readLog } from "./postlog.js";

describe("postlog", () => {
  it("round-trips entries and stores a hash, not the text", () => {
    const dir = mkdtempSync(join(tmpdir(), "li-log-"));
    try {
      appendLog(dir, { action: "create_post", ref: "https://x/1", text: "secret body" }, new Date(2026, 9, 22));
      appendLog(dir, { action: "comment", text: "another" });
      const { entries, warnings } = readLog(dir);
      expect(warnings).toEqual([]);
      expect(entries).toHaveLength(2);
      expect(entries[0].ref).toBe("https://x/1");
      expect(entries[1].ref).toBe("-");
      expect(readFileSync(logPath(dir), "utf8")).not.toContain("secret body");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
