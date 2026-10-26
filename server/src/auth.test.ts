import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import {
  buildAuthUrl, exchangeCode, login, logout, whoami, redirectUri, TOKEN_URL, USERINFO_URL,
} from "./auth.js";
import { FileTokenStore, KeychainTokenStore, type StoredToken } from "./tokenstore.js";

const creds = { clientId: "test-id", clientSecret: "test-secret" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const tmp = () => mkdtempSync(join(tmpdir(), "la-auth-"));

describe("token exchange", () => {
  it("posts the code and computes expiry", async () => {
    const fetchFn = vi.fn(async () => json({ access_token: "tok", expires_in: 100, scope: "openid" }));
    const t = await exchangeCode("abc", creds, 8765, fetchFn as any, () => 1000);
    expect(t).toEqual({ accessToken: "tok", expiresAt: 101_000, scope: "openid" });
    const [url, init]: any = fetchFn.mock.calls[0];
    expect(url).toBe(TOKEN_URL);
    const body = new URLSearchParams(init.body);
    expect(body.get("code")).toBe("abc");
    expect(body.get("redirect_uri")).toBe(redirectUri(8765));
  });
  it("fails without leaking the secret", async () => {
    const f = async () => json({}, 400);
    await expect(exchangeCode("x", creds, 8765, f as any)).rejects.toThrow(/HTTP 400/);
    await expect(exchangeCode("x", creds, 8765, f as any)).rejects.not.toThrow(/test-secret/);
  });
  it("auth URL carries scopes and state", () => {
    const u = new URL(buildAuthUrl("cid", 8765, "st"));
    expect(u.searchParams.get("scope")).toBe("openid profile w_member_social");
    expect(u.searchParams.get("state")).toBe("st");
  });
});

describe("login flow", () => {
  const callback = (port: number, query: string) =>
    new Promise<void>((resolve) => {
      request({ host: "127.0.0.1", port, path: `/callback?${query}` }, (r) => (r.resume(), r.on("end", resolve))).end();
    });

  it("stores the token after a matching callback", async () => {
    const store = new FileTokenStore(tmp());
    const fetchFn = async () => json({ access_token: "tok", expires_in: 60 });
    await login({
      creds, port: 18765, store, fetchFn: fetchFn as any, now: () => 0,
      openUrl: (url) => {
        const state = new URL(url).searchParams.get("state")!;
        setTimeout(() => void callback(18765, `code=c1&state=${state}`), 50);
      },
    });
    expect(store.get()).toEqual({ accessToken: "tok", expiresAt: 60_000, scope: undefined });
  });
  it("rejects a state mismatch and stores nothing", async () => {
    const store = new FileTokenStore(tmp());
    const p = login({
      creds, port: 18766, store, fetchFn: vi.fn() as any,
      openUrl: () => void setTimeout(() => void callback(18766, "code=c1&state=wrong"), 50),
    });
    await expect(p).rejects.toThrow(/state/);
    expect(store.get()).toBeUndefined();
  });
});

describe("storage", () => {
  const token: StoredToken = { accessToken: "tok", expiresAt: 5 };
  it("file store round-trips, uses 0600 and deletes", () => {
    const dir = tmp();
    const s = new FileTokenStore(dir);
    s.set(token);
    expect(s.get()).toEqual(token);
    if (process.platform !== "win32") expect(statSync(join(dir, "token.json")).mode & 0o777).toBe(0o600);
    logout(s);
    expect(s.get()).toBeUndefined();
    expect(existsSync(join(dir, "token.json"))).toBe(false);
  });
  it("corrupt file is treated as missing", async () => {
    const dir = tmp();
    const s = new FileTokenStore(dir);
    (await import("node:fs")).writeFileSync(join(dir, "token.json"), "{nope");
    expect(s.get()).toBeUndefined();
  });
  it("keychain store round-trips and deletes", () => {
    let v: string | null = null;
    const s = new KeychainTokenStore({
      getPassword: () => v, setPassword: (x) => void (v = x), deletePassword: () => ((v = null), true),
    });
    s.set(token);
    expect(s.get()).toEqual(token);
    logout(s);
    expect(s.get()).toBeUndefined();
  });
});

describe("whoami", () => {
  const store = (t?: StoredToken) => {
    const s = new FileTokenStore(tmp());
    if (t) s.set(t);
    return s;
  };
  it("no token -> login hint", async () => {
    expect(await whoami(store())).toEqual({ authenticated: false, hint: "run npm run login" });
  });
  it("expired token -> re-auth with exact command, no network call", async () => {
    const f = vi.fn();
    const r: any = await whoami(store({ accessToken: "t", expiresAt: 10 }), f as any, () => 20);
    expect(r.reauthNeeded).toBe(true);
    expect(r.hint).toContain("npm run login");
    expect(f).not.toHaveBeenCalled();
  });
  it("valid token -> name and URN", async () => {
    const f = vi.fn(async () => json({ sub: "abc123", name: "Ada Lovelace" }));
    const r = await whoami(store({ accessToken: "t", expiresAt: 100 }), f as any, () => 1);
    expect(r).toEqual({ authenticated: true, name: "Ada Lovelace", memberUrn: "urn:li:person:abc123" });
    expect((f.mock.calls[0] as any)[0]).toBe(USERINFO_URL);
  });
  it("401 -> re-auth needed", async () => {
    const f = async () => json({}, 401);
    const r: any = await whoami(store({ accessToken: "t", expiresAt: 100 }), f as any, () => 1);
    expect(r.reauthNeeded).toBe(true);
  });
});
