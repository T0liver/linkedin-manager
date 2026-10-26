import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { LOGIN_COMMAND, USERINFO_URL, type Fetch } from "../auth.js";
import type { TokenStore } from "../tokenstore.js";

export const API_BASE = "https://api.linkedin.com/rest";
/**
 * Versioned Posts API header (YYYYMM). Versions are supported for ~1 year, then rejected with HTTP 426.
 * Latest per learn.microsoft.com/en-us/linkedin/marketing/versioning on 2026-10-26.
 */
export const API_VERSION = "202610";

export type Visibility = "public" | "connections";

export interface PostRequest {
  text: string;
  visibility: Visibility;
  imagePath?: string;
}

export interface PostResult {
  urn: string;
  url: string;
}

/** What `create_post` needs from LinkedIn; tests substitute a mock. */
export interface PostClient {
  createPost(req: PostRequest): Promise<PostResult>;
}

/** Verified against the Reactions API docs on 2026-10-26 (see docs/api-findings.md). MAYBE is deprecated. */
export const REACTION_TYPES = {
  LIKE: "Like",
  PRAISE: "Celebrate",
  EMPATHY: "Love",
  INTEREST: "Insightful",
  APPRECIATION: "Support",
  ENTERTAINMENT: "Funny",
} as const;

export type ReactionType = keyof typeof REACTION_TYPES;

/** What `comment` and `react` need from LinkedIn; tests substitute a mock. */
export interface EngagementClient {
  comment(postUrn: string, text: string): Promise<{ id?: string }>;
  react(postUrn: string, type: ReactionType): Promise<void>;
}

export type ApiErrorKind = "unauthorized" | "forbidden" | "rate_limited" | "api_error" | "network";

export class LinkedInApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly hint?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LinkedInApiError";
  }
}

const IMAGE_TYPES = new Set([".png", ".jpg", ".jpeg", ".gif"]);

export function postUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

export function visibilityValue(v: Visibility): "PUBLIC" | "CONNECTIONS" {
  return v === "public" ? "PUBLIC" : "CONNECTIONS";
}

export class LinkedInClient implements PostClient, EngagementClient {
  constructor(
    private store: TokenStore,
    private fetchFn: Fetch = fetch,
    private now: () => number = Date.now,
  ) {}

  private token(): string {
    const t = this.store.get();
    if (!t) throw new LinkedInApiError("unauthorized", "Not logged in.", `run ${LOGIN_COMMAND}`);
    if (t.expiresAt <= this.now()) {
      throw new LinkedInApiError("unauthorized", "Token expired.", `re-auth needed: ${LOGIN_COMMAND}`);
    }
    return t.accessToken;
  }

  /** One request, no retries. Maps 401 and 429 to typed errors. */
  private async send(url: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchFn(url, init);
    } catch {
      throw new LinkedInApiError("network", "Could not reach LinkedIn.", "check the network and retry");
    }
    if (res.status === 401) {
      throw new LinkedInApiError("unauthorized", "LinkedIn rejected the token (HTTP 401).", `re-auth needed: ${LOGIN_COMMAND}`, 401);
    }
    if (res.status === 403) {
      throw new LinkedInApiError("forbidden", "LinkedIn refused: this app lacks the permission (HTTP 403).", undefined, 403);
    }
    if (res.status === 429) {
      throw new LinkedInApiError("rate_limited", "LinkedIn rate limit hit (HTTP 429).", "stopped without retrying; wait before trying again", 429);
    }
    if (!res.ok) {
      throw new LinkedInApiError("api_error", `LinkedIn request failed (HTTP ${res.status}).`, undefined, res.status);
    }
    return res;
  }

  private headers(token: string, json = true): Record<string, string> {
    return {
      authorization: `Bearer ${token}`,
      "linkedin-version": API_VERSION,
      "x-restli-protocol-version": "2.0.0",
      ...(json ? { "content-type": "application/json" } : {}),
    };
  }

  private async authorUrn(token: string): Promise<string> {
    const res = await this.send(USERINFO_URL, { headers: { authorization: `Bearer ${token}` } });
    const info: any = await res.json();
    if (typeof info.sub !== "string") throw new LinkedInApiError("api_error", "userinfo returned no member id.");
    return `urn:li:person:${info.sub}`;
  }

  private async uploadImage(token: string, owner: string, path: string): Promise<string> {
    if (!IMAGE_TYPES.has(extname(path).toLowerCase())) {
      throw new LinkedInApiError("api_error", "Unsupported image type (use png, jpg or gif).");
    }
    let data: Buffer;
    try {
      data = readFileSync(path);
    } catch {
      throw new LinkedInApiError("api_error", `Cannot read image file: ${path}`);
    }
    const init = await this.send(`${API_BASE}/images?action=initializeUpload`, {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    });
    const { value }: any = await init.json();
    if (typeof value?.uploadUrl !== "string" || typeof value?.image !== "string") {
      throw new LinkedInApiError("api_error", "Image upload init returned an unexpected response.");
    }
    await this.send(value.uploadUrl, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: new Uint8Array(data) });
    return value.image;
  }

  async createPost(req: PostRequest): Promise<PostResult> {
    const token = this.token();
    const author = await this.authorUrn(token);
    const image = req.imagePath ? await this.uploadImage(token, author, req.imagePath) : undefined;
    const res = await this.send(`${API_BASE}/posts`, {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({
        author,
        commentary: req.text,
        visibility: visibilityValue(req.visibility),
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        ...(image ? { content: { media: { id: image } } } : {}),
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    const urn = res.headers.get("x-restli-id");
    if (!urn) throw new LinkedInApiError("api_error", "LinkedIn created the post but returned no id.");
    return { urn, url: postUrl(urn) };
  }

  /** Needs w_member_social_feed (Community Management API); Share on LinkedIn apps get 403. */
  async comment(postUrn: string, text: string): Promise<{ id?: string }> {
    const token = this.token();
    const actor = await this.authorUrn(token);
    const res = await this.send(`${API_BASE}/socialActions/${encodeURIComponent(postUrn)}/comments`, {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({ actor, object: postUrn, message: { text } }),
    });
    return { id: res.headers.get("x-restli-id") ?? undefined };
  }

  /** Needs w_member_social_feed (Community Management API); Share on LinkedIn apps get 403. */
  async react(postUrn: string, type: ReactionType): Promise<void> {
    const token = this.token();
    const actor = await this.authorUrn(token);
    await this.send(`${API_BASE}/reactions?actor=${encodeURIComponent(actor)}`, {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({ root: postUrn, reactionType: type }),
    });
  }
}
