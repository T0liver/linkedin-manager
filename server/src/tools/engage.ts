import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkWrite } from "../gate.js";
import { dataDir } from "../paths.js";
import { appendLog } from "../postlog.js";
import { LinkedInApiError, postUrl, REACTION_TYPES, type EngagementClient, type ReactionType } from "../linkedin/client.js";
import { parsePostUrn } from "../linkedin/urn.js";

/**
 * "draft-only" (default): LinkedIn's API refuses comments and reactions for Share on LinkedIn apps
 * (see docs/api-findings.md), so the tools hand the user text and link and the user acts manually.
 * "api": only for an app with w_member_social_feed; set `engagementMode: "api"` in config.json.
 */
export type EngagementMode = "draft-only" | "api";

export interface EngageDeps {
  /** Only used in api mode, and never in dry-run. */
  client?: EngagementClient;
  dir?: string;
  now?: () => Date;
  dryRun?: boolean;
  /** Overrides config.json (tests). */
  mode?: EngagementMode;
}

export interface CommentInput {
  postUrn: string;
  text: string;
  confirm?: boolean;
}

export interface ReactInput {
  postUrn: string;
  type: ReactionType;
  confirm?: boolean;
}

export type EngageResult =
  | { status: "preview"; mode: EngagementMode; message: string; preview: Record<string, string>; warnings: string[] }
  | { status: "rejected"; reason: string; warnings: string[] }
  | { status: "draft-only"; mode: "draft-only"; text: string; link: string; message: string; warnings: string[] }
  | { status: "done"; mode: "api"; action: string; link: string; id?: string; warnings: string[] }
  | { status: "dry-run"; wouldRequest: Record<string, unknown>; warnings: string[] }
  | { status: "failed"; error: string; hint?: string; retried: false; text: string; link: string; warnings: string[] };

const MANUAL =
  "LinkedIn's API does not allow this for this app. Nothing was posted: the user must open the link and do it manually.";

export function engagementMode(dir: string, warnings: string[]): EngagementMode {
  const file = join(dir, "config.json");
  if (!existsSync(file)) return "draft-only";
  try {
    const mode = JSON.parse(readFileSync(file, "utf8")).engagementMode;
    if (mode === undefined || mode === "draft-only") return "draft-only";
    if (mode === "api") return "api";
    warnings.push('config.json: invalid engagementMode; using "draft-only"');
  } catch {
    warnings.push('config.json unreadable; using engagementMode "draft-only"');
  }
  return "draft-only";
}

interface Action {
  name: "comment" | "react";
  /** What the user sees and does by hand in draft-only mode. */
  manualText: string;
  /** What the duplicate check hashes. */
  gateText: string;
  preview: Record<string, string>;
  request: Record<string, unknown>;
  send: (client: EngagementClient) => Promise<{ id?: string } | void>;
}

/** One action per call and per confirmation; the inputs have no batch form. */
async function run(rawPost: string, build: (postUrn: string) => Action, confirm: boolean | undefined, deps: EngageDeps): Promise<EngageResult> {
  const dir = deps.dir ?? dataDir();
  const now = deps.now ?? (() => new Date());
  const warnings: string[] = [];

  const postUrn = parsePostUrn(rawPost);
  if (!postUrn) {
    return {
      status: "rejected",
      reason: `Could not read a post id from "${rawPost}". Ask the user for the post's "Copy link to post" URL (linkedin.com/feed/update/... or linkedin.com/posts/...).`,
      warnings,
    };
  }
  const action = build(postUrn);
  const link = postUrl(postUrn);
  const mode = deps.mode ?? engagementMode(dir, warnings);

  const gate = checkWrite({ action: action.name, text: action.gateText, confirm, draftOnly: mode === "draft-only" }, { dir, now });
  warnings.push(...gate.warnings);
  if (!gate.allowed) {
    if (gate.preview !== undefined) {
      const note = mode === "draft-only" ? " Draft-only mode: confirming returns the text and link; the user acts on LinkedIn." : "";
      return { status: "preview", mode, message: gate.reason + note, preview: { ...action.preview, link }, warnings };
    }
    return { status: "rejected", reason: gate.reason, warnings };
  }

  const draftOnly = (message: string): EngageResult => ({ status: "draft-only", mode: "draft-only", text: action.manualText, link, message, warnings });
  if (mode === "draft-only") return draftOnly(MANUAL);

  if (deps.dryRun) {
    return { status: "dry-run", wouldRequest: { ...action.request, note: "dry-run: LinkedIn was not called and nothing was logged" }, warnings };
  }
  if (!deps.client) throw new Error(`${action.name} requires a client in api mode unless dryRun is set`);

  try {
    const res = await action.send(deps.client);
    const id = res?.id;
    try {
      appendLog(dir, { action: action.name, ref: id ?? link, text: action.gateText }, now());
    } catch (err) {
      warnings.push(`${action.name} succeeded but could not be logged (${(err as Error).message}); cap and duplicate check will not see it`);
    }
    return { status: "done", mode: "api", action: action.name, link, id, warnings };
  } catch (err) {
    const e = err instanceof LinkedInApiError ? err : new LinkedInApiError("api_error", (err as Error).message);
    if (e.kind === "forbidden") {
      return draftOnly(`${MANUAL} (LinkedIn returned 403; set engagementMode to "draft-only" in config.json.)`);
    }
    return { status: "failed", error: e.message, hint: e.hint, retried: false, text: action.manualText, link, warnings };
  }
}

export function comment(input: CommentInput, deps: EngageDeps = {}): Promise<EngageResult> {
  return run(
    input.postUrn,
    (postUrn) => ({
      name: "comment",
      manualText: input.text,
      gateText: input.text,
      preview: { action: "comment", postUrn, text: input.text },
      request: { endpoint: `POST /rest/socialActions/${postUrn}/comments`, object: postUrn, message: { text: input.text } },
      send: (c) => c.comment(postUrn, input.text),
    }),
    input.confirm,
    deps,
  );
}

export function react(input: ReactInput, deps: EngageDeps = {}): Promise<EngageResult> {
  const label = REACTION_TYPES[input.type];
  return run(
    input.postUrn,
    (postUrn) => ({
      name: "react",
      manualText: `React with "${label}" (${input.type})`,
      // One reaction per post: any second reaction on the same post counts as a duplicate.
      gateText: `react ${postUrn}`,
      preview: { action: "react", postUrn, type: input.type, label },
      request: { endpoint: "POST /rest/reactions?actor=<you>", root: postUrn, reactionType: input.type },
      send: (c) => c.react(postUrn, input.type),
    }),
    input.confirm,
    deps,
  );
}
