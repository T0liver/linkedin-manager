import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { whoami } from "./tools/whoami.js";
import { openTokenStore, type TokenStore } from "./tokenstore.js";

export function createServer(store?: TokenStore): McpServer {
  const server = new McpServer({ name: "linkedin-mcp", version: "0.1.0" });
  let opened = store;

  server.registerTool(
    "whoami",
    { description: "Report the authenticated LinkedIn identity (name and member URN), or how to log in." },
    async () => {
      opened ??= await openTokenStore();
      return { content: [{ type: "text", text: JSON.stringify(await whoami(opened)) }] };
    },
  );

  return server;
}
