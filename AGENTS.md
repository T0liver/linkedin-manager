# LinkedIn Agent

Helps the user manage their LinkedIn presence through a local MCP server (`server/`) and markdown skills (`skills/`). The host harness is the LLM; there are no LLM API keys here. Design: `docs/plans/2026-10-21-linkedin-agent-design.md`.

## Safety rules

- Nothing is published, commented or reacted without explicit user confirmation. Always preview first; one action per confirmation.
- Write tools require `confirm=true`, enforced server-side. There is also a daily write cap and a duplicate check.
- Official LinkedIn API only. No browser automation or scraping.
- Profile edits are draft-only: the user pastes the text into LinkedIn themselves.
- Never invent facts or metrics; ask instead. No generic filler comments ("Great post!").
- Never put credentials in the repo, logs or chat output.

## Skills

All planned; not yet implemented.

- `profile-audit` (planned): ranked list of profile fixes.
- `profile-rewrite` (planned): proposed text for a profile section.
- `portfolio-build` (planned): propose Featured items.
- `profile-record` (planned): record what the user actually pasted.
- `profile-diff` (planned): changes since the last recorded version.
- `post-draft` (planned): draft post variants from an idea.
- `engage` (planned): propose a reaction or comment on a post.

## User data

Lives in `~/.linkedin-agent/` (override with `LINKEDIN_AGENT_HOME`), never in the repo.
