import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkWrite } from "../gate.js";
import { dataDir } from "../paths.js";
import { appendLog } from "../postlog.js";
import { LinkedInApiError, visibilityValue, type PostClient, type Visibility } from "../linkedin/client.js";

export interface CreatePostInput {
  text: string;
  visibility: Visibility;
  imagePath?: string;
  confirm?: boolean;
}

export interface CreatePostDeps {
  /** Not needed (and never used) in dry-run. */
  client?: PostClient;
  dir?: string;
  now?: () => Date;
  dryRun?: boolean;
}

export type CreatePostResult =
  | { status: "preview"; message: string; preview: { text: string; visibility: Visibility; imagePath?: string }; warnings: string[] }
  | { status: "rejected"; reason: string; warnings: string[] }
  | { status: "posted"; url: string; urn: string; warnings: string[] }
  | { status: "dry-run"; wouldRequest: Record<string, unknown>; warnings: string[] }
  | { status: "failed"; error: string; hint?: string; retried: false; draftPath?: string; warnings: string[] };

export function isDryRun(argv: string[] = process.argv, env: NodeJS.ProcessEnv = process.env): boolean {
  return argv.includes("--dry-run") || env.LINKEDIN_AGENT_DRY_RUN === "1";
}

function saveDraft(dir: string, input: CreatePostInput, now: Date, reason: string): string | undefined {
  try {
    const drafts = join(dir, "drafts");
    mkdirSync(drafts, { recursive: true });
    const path = join(drafts, `${now.toISOString().replace(/[:.]/g, "-")}.md`);
    const meta = [`visibility: ${input.visibility}`, input.imagePath ? `image: ${input.imagePath}` : "", `failed: ${reason}`]
      .filter(Boolean)
      .join("\n");
    writeFileSync(path, `${meta}\n\n---\n\n${input.text}\n`, "utf8");
    return path;
  } catch {
    return undefined;
  }
}

export async function createPost(input: CreatePostInput, deps: CreatePostDeps = {}): Promise<CreatePostResult> {
  const dir = deps.dir ?? dataDir();
  const now = deps.now ?? (() => new Date());
  const warnings: string[] = [];

  if (input.imagePath && !existsSync(input.imagePath)) {
    return { status: "rejected", reason: `Image file not found: ${input.imagePath}`, warnings };
  }

  const gate = checkWrite({ action: "create_post", text: input.text, confirm: input.confirm }, { dir, now });
  warnings.push(...gate.warnings);
  if (!gate.allowed) {
    if (gate.preview !== undefined) {
      return {
        status: "preview",
        message: gate.reason,
        preview: { text: input.text, visibility: input.visibility, imagePath: input.imagePath },
        warnings,
      };
    }
    return { status: "rejected", reason: gate.reason, warnings };
  }

  if (deps.dryRun) {
    return {
      status: "dry-run",
      wouldRequest: {
        endpoint: "POST /rest/posts",
        commentary: input.text,
        visibility: visibilityValue(input.visibility),
        image: input.imagePath ?? null,
        note: "dry-run: LinkedIn was not called and nothing was logged",
      },
      warnings,
    };
  }

  if (!deps.client) throw new Error("createPost requires a client unless dryRun is set");

  try {
    const { url, urn } = await deps.client.createPost({
      text: input.text,
      visibility: input.visibility,
      imagePath: input.imagePath,
    });
    try {
      appendLog(dir, { action: "create_post", ref: url, text: input.text }, now());
    } catch (err) {
      warnings.push(`post published but could not be logged (${(err as Error).message}); cap and duplicate check will not see it`);
    }
    return { status: "posted", url, urn, warnings };
  } catch (err) {
    const e = err instanceof LinkedInApiError ? err : new LinkedInApiError("api_error", (err as Error).message);
    // Failed writes are not logged, so they neither count toward the cap nor block a retry as a duplicate.
    const draftPath = saveDraft(dir, input, now(), e.message);
    return { status: "failed", error: e.message, hint: e.hint, retried: false, draftPath, warnings };
  }
}
