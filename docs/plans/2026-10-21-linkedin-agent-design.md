# LinkedIn Agent: Design

Date: 2026-10-21

## Goal

A portable agent that helps manage a personal LinkedIn presence: build and improve the profile and portfolio, draft and publish posts from manually triggered ideas, and react or comment on other posts. It must work in any agent harness (Claude Code, Codex, Cursor, OpenCode) and be installable by pointing an agent at the GitHub repo.

## Decisions

- **LinkedIn access:** official API only. Profile edits are draft-only (the API doesn't support them); the user pastes the text in. Browser automation is excluded because it violates LinkedIn's ToS and risks account restriction.
- **Interface:** a local MCP server plus portable markdown instructions. The host harness is the LLM, so there is no provider abstraction and no LLM API keys.
- **Automation:** none in v1. Everything is manually triggered.
- **Safety:** nothing is published without explicit confirmation, enforced in the server.

## Architecture

```
User -> any harness (reads AGENTS.md + skills/, calls MCP tools)
          -> linkedin-mcp (local, stdio)
               - auth: OAuth 2.0 once, token in OS keychain
               - tools: create_post, comment, react, list_posts, whoami
               - gate: confirm / daily cap / duplicate check
               - local files: voice.md, profile/*.md, drafts/, post-log.md
```

User data lives in `~/.linkedin-agent/`, outside the repo, so updating the repo never touches personal content.

## Profile and portfolio workflow (draft-only)

`profile/` holds one markdown file per section (headline, about, experience/<role>, featured, skills). Each has the **current** text and a **proposed** version.

Skills:
1. `profile-audit`: ranked list of fixes based on the files and `voice.md`.
2. `profile-rewrite <section>`: writes a proposed version; asks for missing facts instead of inventing metrics.
3. `portfolio-build`: proposes 3-5 Featured items from GitHub repos, talks and writing the user points to.
4. `profile-record <section>`: the user reports what they actually pasted; saved as `current`. The agent notes how the edit differs from its draft and offers to update `voice.md`.
5. `profile-diff`: shows changes since the last recorded version and keeps a changelog.

Each rewrite ends with a copy-ready block and the LinkedIn UI path to paste it into.

Out of scope: scraping profiles, auto-sync.

## Posting and engagement workflow

Posting:
1. User gives an idea.
2. `post-draft` asks at most 1-2 clarifying questions and writes 2-3 variants in the user's voice.
3. User picks or edits.
4. `create_post(..., confirm=false)` returns a preview.
5. On approval, `create_post(..., confirm=true)` publishes; the post and URL are logged in `post-log.md`.

Engagement (`engage`): user pastes a post URL (and text if it can't be fetched). The agent proposes a reaction type and optional comment, previews it, and acts only after confirmation. One action per confirmation.

API caveats:
- Posting works with `w_member_social`.
- Reactions and comments may be restricted for personal apps; `engage` then falls back to draft-only (text and link supplied, user clicks).
- Reading other people's posts is limited, so pasting is the reliable path.
- `create_post` accepts an optional image path.

Safety rules in the tools:
- Writes require `confirm=true`, enforced server-side.
- Daily write cap (default 3) and duplicate check against `post-log.md`.
- No generic filler comments ("Great post!").

## Repo layout

```
linkedin-agent/
  AGENTS.md          entry point for Codex/Cursor/OpenCode; rules + skill index
  CLAUDE.md          points to AGENTS.md
  skills/            profile-audit, profile-rewrite, portfolio-build,
                     profile-record, profile-diff, post-draft, engage
  server/            MCP server (TypeScript, stdio)
    src/tools/       create_post, comment, react, list_posts, whoami
    src/auth.ts      OAuth 2.0 + keychain storage
    src/gate.ts      confirm / cap / duplicate enforcement
  templates/         voice.md, profile/*.md starters
  INSTALL.md         written for an agent to follow
  docs/
```

## Install

The user tells any harness to install the GitHub repo. The agent follows `INSTALL.md`:
1. Clone, `npm install && npm run build`.
2. Register the MCP server in that harness's config (snippet per tool).
3. Copy `templates/` to `~/.linkedin-agent/`.
4. Guide the user through creating a LinkedIn developer app (Share on LinkedIn product) and the one-time OAuth login; the user performs the credential steps.
5. Verify with `whoami`.

## Error handling

- Token expiry (~60 days): tool returns "re-auth needed" with the exact command.
- 429 or daily cap: stop and report; never auto-retry a write.
- Reactions/comments rejected by API: switch `engage` to draft-only and say so.
- Failed publish: draft kept in `drafts/`.

## Testing

- Unit tests for `gate.ts`: write without confirm rejected, cap enforced, duplicates caught.
- Mocked LinkedIn client and a `--dry-run` mode.
- One manual end-to-end check: a test post with connections-only visibility.
- Skills are markdown; example transcripts in `docs/` document expected behavior.

## Deferred (post-v1)

Scheduling and reminders, post analytics, LinkedIn data-export importer for profile files.
