# LinkedIn Agent

A portable agent that helps manage a personal LinkedIn presence: improve the profile and portfolio (draft-only), draft and publish posts from ideas you trigger, and react or comment on other posts. It runs as a local MCP server plus markdown skills, works in any agent harness (Claude Code, Codex, Cursor, OpenCode), and uses the official LinkedIn API only. The host harness is the LLM; there are no LLM API keys.

## What it does

- **Profile and portfolio:** audit, rewrite, Featured proposals, and change tracking. LinkedIn's API can't edit profiles, so these are draft-only: you paste the text in yourself.
- **Posts:** `post-draft` turns an idea into 2-3 variants; `create_post` publishes the one you approve.
- **Engagement:** `engage` proposes a reaction or comment. If the API doesn't allow it for your app, it hands you the text and link to post manually.
- Tools: `whoami`, `create_post`, `comment`, `react`, `list_posts`. Skills are in `skills/`.

## Safety model

- Nothing is published without explicit confirmation: write tools require `confirm=true`, enforced in the server, and each action needs its own confirmation.
- Daily write cap (default 3, configurable in `~/.linkedin-agent/config.json`) and a duplicate check against `post-log.md`.
- Official API only: no browser automation or scraping.
- A failed publish keeps your draft in `~/.linkedin-agent/drafts/`; a 429 stops with no retry.
- Credentials never go in the repo, logs or chat; the token lives in the OS keychain.
- User data lives in `~/.linkedin-agent/`, outside the repo.

## Quick start

Tell your agent: "Install https://github.com/T0liver/linkedin-manager by following INSTALL.md". It will clone, build, register the MCP server and guide you through creating a LinkedIn developer app and running `npm run login` yourself. Verify any time with `npm run doctor` in `server/`, and the `whoami` tool.

Design: `docs/plans/2026-10-21-linkedin-agent-design.md`. Agent rules and skill index: `AGENTS.md`.
