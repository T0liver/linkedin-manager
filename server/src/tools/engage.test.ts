import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { comment, react, type EngagementMode } from "./engage.js";
import { LinkedInApiError, LinkedInClient, type EngagementClient } from "../linkedin/client.js";
import { parsePostUrn } from "../linkedin/urn.js";
import { appendLog, readLog } from "../postlog.js";
import { createServer } from "../server.js";
import type { StoredToken, TokenStore } from "../tokenstore.js";

let dir: string;
const now = () => new Date("2026-10-26T12:00:00Z");
const POST = "https://www.linkedin.com/feed/update/urn:li:activity:7000000000000000001/";
const URN = "urn:li:activity:7000000000000000001";

function mockClient(fail?: LinkedInApiError) {
  const commentFn = vi.fn(async () => {
    if (fail) throw fail;
    return { id: "123" };
  });
  const reactFn = vi.fn(async () => {
    if (fail) throw fail;
  });
  return { client: { comment: commentFn, react: reactFn } as EngagementClient, commentFn, reactFn };
}

const deps = (mode: EngagementMode, client?: EngagementClient) => ({ dir, now, mode, client });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "la-engage-"));
});

describe("parsePostUrn", () => {
  it.each([
    [POST, URN],
    ["urn:li:share:42", "urn:li:share:42"],
    ["https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A99?utm=x", "urn:li:ugcPost:99"],
    ["https://www.linkedin.com/posts/jane-doe_ai-agents-activity-7123456789-AbCd?utm_source=share", "urn:li:activity:7123456789"],
  ])("%s", (input, urn) => expect(parsePostUrn(input)).toBe(urn));

  it("returns undefined for short links and junk", () => {
    expect(parsePostUrn("https://lnkd.in/abc123")).toBeUndefined();
    expect(parsePostUrn("great post")).toBeUndefined();
  });
});

describe("draft-only mode (default)", () => {
  it("defaults to draft-only without config and previews without confirm", async () => {
    const { client, commentFn } = mockClient();
    const res = await comment({ postUrn: POST, text: "Useful point on eval sets." }, { dir, now, client });
    expect(res).toMatchObject({ status: "preview", mode: "draft-only", preview: { text: "Useful point on eval sets.", link: POST } });
    expect(commentFn).not.toHaveBeenCalled();
  });

  it("returns text and link on confirm, never calls LinkedIn, logs nothing", async () => {
    const { client, commentFn, reactFn } = mockClient();
    const c = await comment({ postUrn: POST, text: "Useful point.", confirm: true }, deps("draft-only", client));
    expect(c).toMatchObject({ status: "draft-only", mode: "draft-only", text: "Useful point.", link: POST });
    if (c.status === "draft-only") expect(c.message).toMatch(/manually/);
    const r = await react({ postUrn: POST, type: "INTEREST", confirm: true }, deps("draft-only", client));
    expect(r).toMatchObject({ status: "draft-only", text: 'React with "Insightful" (INTEREST)', link: POST });
    expect(commentFn).not.toHaveBeenCalled();
    expect(reactFn).not.toHaveBeenCalled();
    expect(readLog(dir).entries).toHaveLength(0);
  });

  it("gate: needs confirm=true exactly, checks duplicates, but not the cap", async () => {
    expect((await react({ postUrn: POST, type: "LIKE", confirm: "yes" as any }, deps("draft-only"))).status).toBe("preview");
    for (let i = 0; i < 3; i++) appendLog(dir, { action: "create_post", text: `post ${i}` }, now());
    expect((await comment({ postUrn: POST, text: "New thought", confirm: true }, deps("draft-only"))).status).toBe("draft-only");
    expect((await comment({ postUrn: POST, text: "post 1", confirm: true }, deps("draft-only"))).status).toBe("rejected");
  });

  it("reads engagementMode from config.json", async () => {
    writeFileSync(join(dir, "config.json"), JSON.stringify({ engagementMode: "api" }));
    const { client, reactFn } = mockClient();
    expect((await react({ postUrn: POST, type: "LIKE", confirm: true }, { dir, now, client })).status).toBe("done");
    expect(reactFn).toHaveBeenCalledOnce();
  });

  it("rejects an unparseable post link and asks for the real URL", async () => {
    const res = await comment({ postUrn: "https://lnkd.in/x", text: "x", confirm: true }, deps("draft-only"));
    expect(res.status).toBe("rejected");
    if (res.status === "rejected") expect(res.reason).toMatch(/Copy link to post/);
  });
});

describe("api mode", () => {
  it("previews without confirm and does not call the client", async () => {
    const { client, commentFn, reactFn } = mockClient();
    expect((await comment({ postUrn: POST, text: "x" }, deps("api", client))).status).toBe("preview");
    expect((await react({ postUrn: POST, type: "LIKE", confirm: false }, deps("api", client))).status).toBe("preview");
    expect(commentFn).not.toHaveBeenCalled();
    expect(reactFn).not.toHaveBeenCalled();
  });

  it("comments once on confirm and logs it", async () => {
    const { client, commentFn } = mockClient();
    const res = await comment({ postUrn: POST, text: "Specific reply", confirm: true }, deps("api", client));
    expect(res).toMatchObject({ status: "done", mode: "api", action: "comment", id: "123", link: POST });
    expect(commentFn).toHaveBeenCalledExactlyOnceWith(URN, "Specific reply");
    expect(readLog(dir).entries[0]).toMatchObject({ action: "comment", ref: "123" });
  });

  it("gate: duplicate comment text and a second reaction on the same post are rejected", async () => {
    const { client, commentFn, reactFn } = mockClient();
    await comment({ postUrn: POST, text: "Specific reply", confirm: true }, deps("api", client));
    expect((await comment({ postUrn: "urn:li:share:5", text: " specific  REPLY", confirm: true }, deps("api", client))).status).toBe("rejected");
    await react({ postUrn: POST, type: "LIKE", confirm: true }, deps("api", client));
    expect((await react({ postUrn: URN, type: "PRAISE", confirm: true }, deps("api", client))).status).toBe("rejected");
    expect(commentFn).toHaveBeenCalledOnce();
    expect(reactFn).toHaveBeenCalledOnce();
  });

  it("gate: daily cap applies", async () => {
    for (let i = 0; i < 3; i++) appendLog(dir, { action: "create_post", text: `post ${i}` }, now());
    const { client, reactFn } = mockClient();
    const res = await react({ postUrn: POST, type: "LIKE", confirm: true }, deps("api", client));
    expect(res.status).toBe("rejected");
    if (res.status === "rejected") expect(res.reason).toMatch(/cap/);
    expect(reactFn).not.toHaveBeenCalled();
  });

  it("falls back to draft-only on 403 and logs nothing", async () => {
    const { client } = mockClient(new LinkedInApiError("forbidden", "no", undefined, 403));
    const res = await comment({ postUrn: POST, text: "Specific reply", confirm: true }, deps("api", client));
    expect(res).toMatchObject({ status: "draft-only", text: "Specific reply", link: POST });
    expect(readLog(dir).entries).toHaveLength(0);
  });

  it("does not retry on 429", async () => {
    const { client, reactFn } = mockClient(new LinkedInApiError("rate_limited", "429", "wait", 429));
    const res = await react({ postUrn: POST, type: "LIKE", confirm: true }, deps("api", client));
    expect(res).toMatchObject({ status: "failed", retried: false, link: POST });
    expect(reactFn).toHaveBeenCalledOnce();
  });

  it("dry-run never calls the client", async () => {
    const { client, commentFn } = mockClient();
    const res = await comment({ postUrn: POST, text: "x", confirm: true }, { ...deps("api", client), dryRun: true });
    expect(res.status).toBe("dry-run");
    expect(commentFn).not.toHaveBeenCalled();
  });
});

describe("LinkedInClient engagement requests", () => {
  const store: TokenStore = {
    kind: "file",
    get: () => ({ accessToken: "SECRET-TOKEN", expiresAt: Date.parse("2027-01-01") }) as StoredToken,
    set() {},
    delete() {},
  };
  const clock = () => Date.parse("2026-10-26T12:00:00Z");

  function fetchMock(status: number) {
    return vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("userinfo")
        ? new Response(JSON.stringify({ sub: "abc" }), { status: 200 })
        : new Response("{}", { status, headers: { "x-restli-id": "777" } }),
    );
  }

  it("sends the documented comment and reaction requests", async () => {
    const f = fetchMock(201);
    const c = new LinkedInClient(store, f as any, clock);
    expect(await c.comment(URN, "hi")).toEqual({ id: "777" });
    await c.react(URN, "INTEREST");
    const [, [cUrl, cInit], , [rUrl, rInit]] = f.mock.calls;
    expect(cUrl).toBe(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(URN)}/comments`);
    expect(JSON.parse(cInit!.body as string)).toEqual({ actor: "urn:li:person:abc", object: URN, message: { text: "hi" } });
    expect(rUrl).toBe(`https://api.linkedin.com/rest/reactions?actor=${encodeURIComponent("urn:li:person:abc")}`);
    expect(JSON.parse(rInit!.body as string)).toEqual({ root: URN, reactionType: "INTEREST" });
  });

  it("maps 403 to forbidden", async () => {
    const c = new LinkedInClient(store, fetchMock(403) as any, clock);
    await expect(c.react(URN, "LIKE")).rejects.toMatchObject({ kind: "forbidden" });
  });
});

describe("MCP tool schemas", () => {
  it("take exactly one post and one action per call (no batch parameter)", async () => {
    const server = createServer({ dir, engagementClient: mockClient().client });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
      const { tools } = await client.listTools();
      const props = (name: string) => tools.find((t) => t.name === name)!.inputSchema.properties as Record<string, any>;
      expect(Object.keys(props("comment")).sort()).toEqual(["confirm", "postUrn", "text"]);
      expect(Object.keys(props("react")).sort()).toEqual(["confirm", "postUrn", "type"]);
      expect(props("comment").postUrn.type).toBe("string");
      expect(props("react").type.enum).toEqual(["LIKE", "PRAISE", "EMPATHY", "INTEREST", "APPRECIATION", "ENTERTAINMENT"]);
      const res: any = await client.callTool({ name: "react", arguments: { postUrn: [POST, POST], type: "LIKE", confirm: true } });
      expect(res.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});
