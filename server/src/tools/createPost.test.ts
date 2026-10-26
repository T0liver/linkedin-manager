import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPost } from "./createPost.js";
import { listPosts } from "./listPosts.js";
import { LinkedInApiError, LinkedInClient, type PostClient } from "../linkedin/client.js";
import { readLog } from "../postlog.js";
import type { StoredToken, TokenStore } from "../tokenstore.js";

let dir: string;
const now = () => new Date("2026-10-26T12:00:00Z");
const URL_ = "https://www.linkedin.com/feed/update/urn:li:share:1/";

function mockClient(impl?: PostClient["createPost"]) {
  const createPostFn = vi.fn(impl ?? (async () => ({ urn: "urn:li:share:1", url: URL_ })));
  return { client: { createPost: createPostFn } as PostClient, createPostFn };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "la-post-"));
});

describe("createPost tool", () => {
  it("returns a preview without confirm and does not call the client", async () => {
    const { client, createPostFn } = mockClient();
    const res = await createPost({ text: "Hello", visibility: "connections" }, { client, dir, now });
    expect(res).toMatchObject({ status: "preview", preview: { text: "Hello", visibility: "connections" } });
    expect(createPostFn).not.toHaveBeenCalled();
    expect(readLog(dir).entries).toHaveLength(0);
  });

  it("posts with confirm, logs it and returns the URL", async () => {
    const { client, createPostFn } = mockClient();
    const res = await createPost({ text: "Hello", visibility: "connections", confirm: true }, { client, dir, now });
    expect(res).toMatchObject({ status: "posted", url: URL_ });
    expect(createPostFn).toHaveBeenCalledOnce();
    const { entries } = readLog(dir);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: "create_post", ref: URL_ });
    expect(listPosts(10, dir).posts[0].ref).toBe(URL_);
  });

  it("rejects a duplicate after a successful post", async () => {
    const { client, createPostFn } = mockClient();
    await createPost({ text: "Hello", visibility: "connections", confirm: true }, { client, dir, now });
    const res = await createPost({ text: "  HELLO ", visibility: "connections", confirm: true }, { client, dir, now });
    expect(res).toMatchObject({ status: "rejected" });
    expect(createPostFn).toHaveBeenCalledOnce();
  });

  it("saves a draft on API failure, does not log, and does not retry", async () => {
    const { client, createPostFn } = mockClient(async () => {
      throw new LinkedInApiError("api_error", "LinkedIn request failed (HTTP 500).", undefined, 500);
    });
    const res = await createPost({ text: "My draft", visibility: "public", confirm: true }, { client, dir, now });
    expect(res).toMatchObject({ status: "failed", retried: false });
    expect(createPostFn).toHaveBeenCalledOnce();
    const files = readdirSync(join(dir, "drafts"));
    expect(files).toHaveLength(1);
    expect(readFileSync(join(dir, "drafts", files[0]), "utf8")).toContain("My draft");
    expect(readLog(dir).entries).toHaveLength(0);
    // The failed attempt neither counted toward the cap nor blocks a retry as a duplicate.
    const retry = await createPost({ text: "My draft", visibility: "public", confirm: true }, { client: mockClient().client, dir, now });
    expect(retry.status).toBe("posted");
  });

  it("dry-run never calls the client and does not log", async () => {
    const { client, createPostFn } = mockClient();
    const res = await createPost({ text: "Hello", visibility: "connections", confirm: true }, { client, dir, now, dryRun: true });
    expect(res.status).toBe("dry-run");
    expect(createPostFn).not.toHaveBeenCalled();
    expect(readLog(dir).entries).toHaveLength(0);
  });

  it("rejects a missing image file before anything else", async () => {
    const { client } = mockClient();
    const res = await createPost({ text: "x", visibility: "connections", imagePath: join(dir, "nope.png"), confirm: true }, { client, dir, now });
    expect(res.status).toBe("rejected");
  });
});

describe("LinkedInClient", () => {
  const store: TokenStore = {
    kind: "file",
    get: () => ({ accessToken: "SECRET-TOKEN", expiresAt: Date.parse("2027-01-01") }) as StoredToken,
    set() {},
    delete() {},
  };
  const clock = () => Date.parse("2026-10-26T12:00:00Z");
  const userinfo = () => new Response(JSON.stringify({ sub: "abc", name: "A B" }));

  it("creates a text post and builds the URL from x-restli-id", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(userinfo())
      .mockResolvedValueOnce(new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:99" } }));
    const res = await new LinkedInClient(store, fetchFn as any, clock).createPost({ text: "hi", visibility: "connections" });
    expect(res).toEqual({ urn: "urn:li:share:99", url: "https://www.linkedin.com/feed/update/urn:li:share:99/" });
    const [url, init] = fetchFn.mock.calls[1];
    expect(url).toBe("https://api.linkedin.com/rest/posts");
    expect(JSON.parse(init.body)).toMatchObject({ author: "urn:li:person:abc", commentary: "hi", visibility: "CONNECTIONS", lifecycleState: "PUBLISHED" });
  });

  it("uploads an image then references it", async () => {
    const img = join(dir, "a.png");
    writeFileSync(img, Buffer.from([1, 2, 3]));
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(userinfo())
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: { uploadUrl: "https://upload.example/x", image: "urn:li:image:7" } })))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:5" } }));
    await new LinkedInClient(store, fetchFn as any, clock).createPost({ text: "hi", visibility: "public", imagePath: img });
    expect(JSON.parse(fetchFn.mock.calls[3][1].body).content).toEqual({ media: { id: "urn:li:image:7" } });
  });

  it("maps 429 to rate_limited and makes exactly one post attempt", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(userinfo())
      .mockResolvedValue(new Response(null, { status: 429 }));
    await expect(new LinkedInClient(store, fetchFn as any, clock).createPost({ text: "hi", visibility: "public" }))
      .rejects.toMatchObject({ kind: "rate_limited" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("maps 401 to a re-auth hint without leaking the token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const err: any = await new LinkedInClient(store, fetchFn as any, clock).createPost({ text: "hi", visibility: "public" }).catch((e) => e);
    expect(err).toMatchObject({ kind: "unauthorized" });
    expect(err.hint).toContain("npm run login");
    expect(JSON.stringify(err) + err.message).not.toContain("SECRET-TOKEN");
  });

  it("does not call fetch when logged out", async () => {
    const fetchFn = vi.fn();
    const empty: TokenStore = { ...store, get: () => undefined };
    await expect(new LinkedInClient(empty, fetchFn as any, clock).createPost({ text: "hi", visibility: "public" }))
      .rejects.toMatchObject({ kind: "unauthorized" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("dry-run end to end", () => {
  it("never invokes fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await createPost({ text: "Hello", visibility: "connections", confirm: true }, { dir, now, dryRun: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(existsSync(join(dir, "post-log.md"))).toBe(false);
    fetchSpy.mockRestore();
  });
});
