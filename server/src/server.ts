import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whoami } from "./tools/whoami.js";
import { createPost } from "./tools/createPost.js";
import { listPosts } from "./tools/listPosts.js";
import { comment, react, type EngageDeps } from "./tools/engage.js";
import { LinkedInClient, REACTION_TYPES, type EngagementClient, type PostClient, type ReactionType } from "./linkedin/client.js";
import { openTokenStore, type TokenStore } from "./tokenstore.js";

export interface ServerOptions {
  store?: TokenStore;
  client?: PostClient;
  engagementClient?: EngagementClient;
  dryRun?: boolean;
  dir?: string;
}

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

export function createServer(opts: ServerOptions = {}): McpServer {
  const server = new McpServer({ name: "linkedin-mcp", version: "0.1.0" });
  let store = opts.store;

  server.registerTool(
    "whoami",
    { description: "Report the authenticated LinkedIn identity (name and member URN), or how to log in." },
    async () => {
      store ??= await openTokenStore();
      return text(await whoami(store));
    },
  );

  server.registerTool(
    "create_post",
    {
      description:
        "Publish a text post (optional image). Without confirm=true it only returns a preview: show it to the user and call again with confirm=true only after they approve this exact post. Enforces a daily cap and duplicate check. Never retried on failure; the draft is saved locally.",
      inputSchema: {
        text: z.string().min(1).max(3000),
        visibility: z.enum(["public", "connections"]).default("connections"),
        imagePath: z.string().optional().describe("Absolute path to a png, jpg or gif."),
        confirm: z.boolean().optional(),
      },
    },
    async (input) => {
      let client = opts.client;
      if (!client && !opts.dryRun) {
        store ??= await openTokenStore();
        client = new LinkedInClient(store);
      }
      return text(await createPost(input, { client, dryRun: opts.dryRun, dir: opts.dir }));
    },
  );

  const engageDeps = async (): Promise<EngageDeps> => {
    let client = opts.engagementClient;
    if (!client && !opts.dryRun) {
      store ??= await openTokenStore();
      client = new LinkedInClient(store);
    }
    return { client, dryRun: opts.dryRun, dir: opts.dir };
  };
  const postUrnSchema = z
    .string()
    .min(1)
    .describe('One post: its "Copy link to post" URL or a urn:li:activity|share|ugcPost URN.');

  server.registerTool(
    "comment",
    {
      description:
        "Comment on one LinkedIn post. Without confirm=true it only returns a preview: show it and call again with confirm=true only after the user approves this exact comment. One comment per call and per confirmation. LinkedIn's API currently refuses comments for this app, so by default the confirmed result is draft-only: text and link the user posts manually. Never write generic filler.",
      inputSchema: { postUrn: postUrnSchema, text: z.string().min(1).max(1250), confirm: z.boolean().optional() },
    },
    async (input) => text(await comment(input, await engageDeps())),
  );

  server.registerTool(
    "react",
    {
      description: `React to one LinkedIn post. Types: ${Object.entries(REACTION_TYPES)
        .map(([k, v]) => `${k} (${v})`)
        .join(", ")}. Without confirm=true it only returns a preview; call again with confirm=true only after the user approves. One reaction per call and per confirmation. LinkedIn's API currently refuses reactions for this app, so by default the confirmed result is draft-only: the user reacts manually via the link.`,
      inputSchema: {
        postUrn: postUrnSchema,
        type: z.enum(Object.keys(REACTION_TYPES) as [ReactionType, ...ReactionType[]]),
        confirm: z.boolean().optional(),
      },
    },
    async (input) => text(await react(input, await engageDeps())),
  );

  server.registerTool(
    "list_posts",
    {
      description: "List posts and actions recorded in the local post-log.md (newest first). Local only; does not call LinkedIn.",
      inputSchema: { limit: z.number().int().min(1).max(100).default(20) },
    },
    async ({ limit }) => text(listPosts(limit, opts.dir)),
  );

  return server;
}
