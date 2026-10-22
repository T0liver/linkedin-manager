import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { whoami } from "./tools/whoami.js";

export function createServer(): McpServer {
  const server = new McpServer({ name: "linkedin-mcp", version: "0.1.0" });

  server.registerTool(
    "whoami",
    { description: "Report the authenticated LinkedIn identity (stub until auth is implemented)." },
    async () => ({ content: [{ type: "text", text: JSON.stringify(whoami()) }] }),
  );

  return server;
}
