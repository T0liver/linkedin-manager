import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import type { TokenStore, StoredToken } from "./tokenstore.js";

export const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
export const SCOPES = "openid profile w_member_social";
export const DEFAULT_PORT = 8765;
export const LOGIN_COMMAND = "npm run login";

export type Fetch = typeof fetch;

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

export function redirectUri(port: number): string {
  return `http://localhost:${port}/callback`;
}

export function buildAuthUrl(clientId: string, port: number, state: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri(port));
  u.searchParams.set("state", state);
  u.searchParams.set("scope", SCOPES);
  return u.toString();
}

export async function exchangeCode(
  code: string,
  creds: Credentials,
  port: number,
  fetchFn: Fetch,
  now: () => number = Date.now,
): Promise<StoredToken> {
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(port),
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed (HTTP ${res.status}).`);
  const body: any = await res.json();
  if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
    throw new Error("Token exchange returned an unexpected response.");
  }
  return { accessToken: body.access_token, expiresAt: now() + body.expires_in * 1000, scope: body.scope };
}

/** Starts a one-shot localhost server and resolves with the authorization code. */
export function waitForCallback(port: number, expectedState: string, timeoutMs = 5 * 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let server: Server;
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for the browser login."));
    }, timeoutMs);
    server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const ok = !error && !!code && url.searchParams.get("state") === expectedState;
      res.writeHead(ok ? 200 : 400, { "content-type": "text/plain" });
      res.end(ok ? "Login complete. You can close this tab." : "Login failed. Return to the terminal.");
      clearTimeout(timer);
      server.close();
      if (ok) resolve(code!);
      else reject(new Error(error ? `LinkedIn returned an error: ${error}` : "Invalid callback (state mismatch)."));
    });
    server.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function login(opts: {
  creds: Credentials;
  port: number;
  store: TokenStore;
  fetchFn?: Fetch;
  openUrl: (url: string) => void;
  now?: () => number;
}): Promise<void> {
  const state = randomBytes(16).toString("hex");
  const pending = waitForCallback(opts.port, state);
  pending.catch(() => {}); // surfaced via the await below
  opts.openUrl(buildAuthUrl(opts.creds.clientId, opts.port, state));
  const code = await pending;
  const token = await exchangeCode(code, opts.creds, opts.port, opts.fetchFn ?? fetch, opts.now);
  opts.store.set(token);
}

export function logout(store: TokenStore): void {
  store.delete();
}

export type WhoAmI =
  | { authenticated: true; name: string; memberUrn: string }
  | { authenticated: false; hint: string; reauthNeeded?: boolean };

const hint = `run ${LOGIN_COMMAND}`;

export async function whoami(
  store: TokenStore,
  fetchFn: Fetch = fetch,
  now: () => number = Date.now,
): Promise<WhoAmI> {
  const token = store.get();
  if (!token) return { authenticated: false, hint };
  if (token.expiresAt <= now()) {
    return { authenticated: false, reauthNeeded: true, hint: `token expired; re-auth needed: ${hint}` };
  }
  let res: Response;
  try {
    res = await fetchFn(USERINFO_URL, { headers: { authorization: `Bearer ${token.accessToken}` } });
  } catch {
    return { authenticated: false, hint: "could not reach LinkedIn; check the network and retry" };
  }
  if (res.status === 401) {
    return { authenticated: false, reauthNeeded: true, hint: `token rejected; re-auth needed: ${hint}` };
  }
  if (!res.ok) return { authenticated: false, hint: `LinkedIn userinfo failed (HTTP ${res.status})` };
  const info: any = await res.json();
  return { authenticated: true, name: info.name ?? "", memberUrn: `urn:li:person:${info.sub}` };
}
