import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

describe("stdio server", () => {
  it.skipIf(!existsSync(entry))("lists and calls whoami", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env: { ...process.env as Record<string, string>, LINKEDIN_AGENT_HOME: mkdtempSync(join(tmpdir(), "la-")), LINKEDIN_AGENT_NO_KEYCHAIN: "1" } }));
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toContain("whoami");
      const res: any = await client.callTool({ name: "whoami", arguments: {} });
      expect(JSON.parse(res.content[0].text)).toMatchObject({ authenticated: false, hint: "run npm run login" });
    } finally {
      await client.close();
    }
  }, 15000);
});
