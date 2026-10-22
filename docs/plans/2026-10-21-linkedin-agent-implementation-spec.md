# LinkedIn Agent: Implementation Spec

Companion to `2026-10-21-linkedin-agent-design.md`. Read the design first; this file turns it into stories for an implementing agent.

## Rules for the implementing agent

- Work **one story at a time**, in order. Do not start a story before the previous one's acceptance criteria pass.
- Stay inside the story's scope. Anything out of scope goes into `docs/followups.md` as a one-line note.
- Language: TypeScript (Node 20+, ESM), `@modelcontextprotocol/sdk`, `vitest` for tests, `zod` for input schemas.
- Safety invariants (never weaken): no LinkedIn write without `confirm=true` enforced in `gate.ts`; daily write cap; duplicate check; no credentials in the repo, logs or chat output.
- User data lives in `~/.linkedin-agent/` (override with env `LINKEDIN_AGENT_HOME` for tests). Never write user data into the repo.
- Commit after each story with a message `story N: <title>`. Run `npm test` and `npm run build` before committing.
- Stories marked **user input needed** must stop and ask the user at the marked point. Do not invent credentials, redirect URIs or API behavior.
- Do not use browser automation or scrape LinkedIn. Official API only.

## Story 1: Repo scaffold

**Goal:** A buildable repo with an MCP server that starts and answers a stub tool.

**Tasks**
- Create the layout from the design doc: `AGENTS.md`, `CLAUDE.md` (one line pointing to AGENTS.md), `skills/`, `server/`, `templates/`, `docs/`.
- `server/`: `package.json`, `tsconfig.json`, `src/index.ts` (stdio MCP server), `src/tools/whoami.ts` returning a stub `{ authenticated: false }`.
- `AGENTS.md`: purpose, safety rules, skill index (list planned skills as "planned"), where user data lives.
- Scripts: `build`, `test`, `dev`. `.gitignore` covers `node_modules`, `dist`, `.env`.
- `README.md`: one paragraph and "see INSTALL.md (coming in story 7)".

**Acceptance**
- `npm run build` succeeds from `server/`.
- Starting the server over stdio and listing tools returns `whoami` (verify with a small test using the SDK client).
- `git log` shows the story-1 commit.

## Story 2: Safety gate (`gate.ts`)

**Goal:** Server-side enforcement that every write is confirmed, capped and de-duplicated.

**Tasks**
- `src/gate.ts` exporting `checkWrite({ action, text, confirm })` returning `{ allowed: true }` or `{ allowed: false, reason, preview? }`.
- Rules: `confirm !== true` returns a preview and is not allowed; more than N writes in the current local day (default 3, configurable in `~/.linkedin-agent/config.json`) is rejected; a text matching an entry in `post-log.md` (normalized: lowercase, collapsed whitespace) is rejected.
- `src/postlog.ts`: append and read `post-log.md` (timestamp, action, URL or id, text hash).
- Pure and testable: inject clock and data dir.

**Acceptance (vitest)**
- Write without confirm is rejected and returns a preview.
- Write with confirm passes when under the cap and not a duplicate.
- The (N+1)th write on the same day is rejected; the next day it passes (fake clock).
- Duplicate text (case/whitespace variants) is rejected.
- Missing or corrupt `post-log.md` does not crash; treat as empty and report a warning.

## Story 3: Auth (OAuth 2.0 + keychain)

**Goal:** One-time login, token stored securely, `whoami` returns real data.

**User input needed:** the user must create a LinkedIn developer app with the "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect" products, and provide the client ID and secret via env vars or an interactive prompt. The agent must not ask for these in chat output logs or write them to the repo.

**Tasks**
- `src/auth.ts`: authorization-code flow with a temporary localhost callback server, PKCE if supported, scopes `openid profile w_member_social`.
- Token storage in the OS keychain (use `keytar` or a maintained equivalent; fall back to a `0600` file in `~/.linkedin-agent/` with a warning).
- CLI entry `npm run login` and `npm run logout`.
- `whoami` calls the userinfo endpoint and returns name and member URN; on missing or expired token returns `{ authenticated: false, hint: "run npm run login" }`.
- Token expiry tracked; expired returns "re-auth needed" with the exact command.

**Acceptance**
- Unit tests with a mocked HTTP layer cover token exchange, storage, expiry and logout.
- Manual: after `npm run login`, `whoami` returns the user's name. (User performs the browser login.)
- Grep of the repo and test output shows no secrets.

## Story 4: `create_post`

**Goal:** Publish a text post (optional image) through the gate, dry-run first.

**Tasks**
- `src/linkedin/client.ts`: thin API client with injectable `fetch`, handling 401 (re-auth hint) and 429 (stop, report, no retry).
- `create_post({ text, visibility, imagePath?, confirm })`: calls `checkWrite`; without confirm returns the preview; with confirm posts, logs to `post-log.md`, returns the post URL.
- On API failure save the draft to `~/.linkedin-agent/drafts/<timestamp>.md` and report where.
- `--dry-run` / env `LINKEDIN_AGENT_DRY_RUN=1` logs the would-be request and never calls LinkedIn.
- `list_posts` tool: returns entries from `post-log.md` (local only; no API read).

**Acceptance**
- Tests with a mocked client: preview without confirm, success path logs and returns URL, failure path saves a draft, 429 does not retry.
- Dry-run never invokes `fetch`.
- **User input needed for live check:** user approves one real test post with `connections` visibility; agent reports the URL and the user deletes it manually.

## Story 5: `comment` and `react`

**Goal:** Engagement tools with an honest fallback when the API disallows them.

**User input needed:** this story depends on what the user's app is permitted to do. The agent must probe (documented endpoints, dry-run first) and report findings before building the fallback.

**Tasks**
- Research the current official API for reactions and comments for member-owned apps; record findings in `docs/api-findings.md` with links and the date.
- Implement `comment({ postUrn, text, confirm })` and `react({ postUrn, type, confirm })` through the gate when permitted.
- If not permitted, the tools return `{ mode: "draft-only", text, link }` and clearly say the user must act manually. No scraping or unofficial endpoints.
- Reaction types: LIKE, PRAISE (Celebrate), EMPATHY (Support), INTEREST (Insightful), APPRECIATION, ENTERTAINMENT. Verify against current docs before hard-coding.
- Parse a pasted post URL into a URN where possible; otherwise ask the user.

**Acceptance**
- `docs/api-findings.md` exists and states what is and isn't possible.
- Tests cover both modes (allowed and draft-only) and gate enforcement on each.
- Each action requires its own confirmation (no batch parameter).

## Story 6: Skills and templates

**Goal:** The portable workflows as plain markdown, usable from any harness.

**Tasks**
- Skills in `skills/<name>/SKILL.md` (frontmatter `name`, `description`): `post-draft`, `engage`, `profile-audit`, `profile-rewrite`, `portfolio-build`, `profile-record`, `profile-diff`. Content follows the design doc workflows exactly.
- Hard rules inside the skills: ask at most 1-2 clarifying questions; never invent metrics or facts; no generic filler comments; always preview before any write tool call; end profile rewrites with a copy-ready block and the LinkedIn UI path.
- `templates/`: `voice.md` (tone, do and don't, examples), `profile/headline.md`, `about.md`, `experience/example-role.md`, `featured.md`, `skills.md`, each with `current` and `proposed` sections.
- Update `AGENTS.md` skill index (no longer "planned") with one line per skill and how each harness should load it (Claude Code: copy or symlink to `.claude/skills`; others: read via AGENTS.md).
- `docs/examples/`: one example transcript per skill showing expected behavior.

**Acceptance**
- Every skill has valid frontmatter and references only tools that exist in the server.
- A review pass confirms each skill contains its hard rules.
- Example transcripts exist for `post-draft`, `engage` and `profile-rewrite` at minimum.

## Story 7: `INSTALL.md` and end-to-end check

**Goal:** An agent can install the project from the GitHub URL on a clean machine.

**User input needed:** the GitHub repo URL and the final live check.

**Tasks**
- `INSTALL.md`, written as imperative steps for an agent: clone, build, copy templates to `~/.linkedin-agent/`, register the MCP server (snippets for Claude Code, Codex, Cursor, OpenCode), guide the user through the developer app and `npm run login` (user does the credential steps), verify with `whoami`.
- Snippets must use each tool's current documented config format; verify against current docs and note the date.
- `scripts/doctor` (or `npm run doctor`): checks Node version, build output, data dir, token presence, and prints what is missing.
- Final README: what it does, safety model, quick start.

**Acceptance**
- A fresh agent session (different harness if possible) follows only `INSTALL.md` and reaches a working `whoami` without extra help; note any gaps and fix the doc.
- `npm run doctor` output is clear on a broken setup.

## Run table

| # | Story | Autonomous? | Suggested model | Why |
|---|-------|-------------|-----------------|-----|
| 1 | Repo scaffold | Yes | Haiku 5.5 | Mechanical setup, low risk |
| 2 | Safety gate | Yes | Sonnet 5.5 | Core safety logic and tests; no need for the top tier |
| 3 | Auth | Partly: stops for developer app and browser login | Sonnet 5.5 | Security-sensitive but well-documented flow |
| 4 | `create_post` | Partly: stops for the live test post | Sonnet 5.5 | Standard API work with mocks |
| 5 | `comment` / `react` | No: needs findings review | Opus 5.5 | Ambiguous API research and judgment calls |
| 6 | Skills and templates | Yes | Sonnet 5.5 | Writing quality matters; no complex code |
| 7 | `INSTALL.md` + e2e | Partly: needs repo URL and fresh-harness test | Sonnet 5.5 | Documentation and verification |

### How to start an implementing agent

Create the repo folder first (for example `C:\Users\taschner\linkedin-agent`, `git init`) and copy the two files from `docs/plans/` into its `docs/plans/`. Open a session in that folder with the model from the table, then paste:

**Stories 1-2 (fully autonomous):**
```
Read docs/plans/2026-10-21-linkedin-agent-design.md and docs/plans/2026-10-21-linkedin-agent-implementation-spec.md. Implement Story 1 and then Story 2 from the spec, following its rules. Commit after each story. Stop after Story 2 and report what you did and any follow-ups.
```
Use Haiku 5.5 for Story 1, then switch to Sonnet 5.5 for Story 2 (or run the pair on Sonnet 5.5 for simplicity).

**Story 3 onward (one story per session or prompt):**
```
Read the design and implementation spec in docs/plans/. Implement Story N from the spec only. Stop at every "user input needed" point and ask me. Commit when its acceptance criteria pass, then report.
```
Replace `N` with the story number. For Story 6 you can say "Stories 6" autonomously, since it needs no user input. Review the diff between stories.
