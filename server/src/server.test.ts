import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));

describe("stdio server", () => {
  it.skipIf(!existsSync(entry))("lists and calls whoami", async () => {
    const client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }));
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toContain("whoami");
      const res: any = await client.callTool({ name: "whoami", arguments: {} });
      expect(JSON.parse(res.content[0].text)).toEqual({ authenticated: false });
    } finally {
      await client.close();
    }
  }, 15000);
});
