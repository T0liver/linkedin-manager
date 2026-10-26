#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { isDryRun } from "./tools/createPost.js";

const dryRun = isDryRun();
if (dryRun) console.error("linkedin-mcp: dry-run mode; LinkedIn will not be called.");

await createServer({ dryRun }).connect(new StdioServerTransport());
