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

Each skill is plain markdown in `skills/<name>/SKILL.md`. Read the file when its trigger applies.

- `profile-audit` ([skills/profile-audit/SKILL.md](skills/profile-audit/SKILL.md)): ranked list of profile fixes.
- `profile-rewrite` ([skills/profile-rewrite/SKILL.md](skills/profile-rewrite/SKILL.md)): proposed text for a profile section.
- `portfolio-build` ([skills/portfolio-build/SKILL.md](skills/portfolio-build/SKILL.md)): propose Featured items.
- `profile-record` ([skills/profile-record/SKILL.md](skills/profile-record/SKILL.md)): record what the user actually pasted.
- `profile-diff` ([skills/profile-diff/SKILL.md](skills/profile-diff/SKILL.md)): changes since the last recorded version.
- `post-draft` ([skills/post-draft/SKILL.md](skills/post-draft/SKILL.md)): draft post variants from an idea, publish on confirmation.
- `engage` ([skills/engage/SKILL.md](skills/engage/SKILL.md)): propose a reaction or comment on a post (draft-only by default).

How each harness loads them:

- Claude Code: copy or symlink `skills/*` into `.claude/skills/` (project) or `~/.claude/skills/` (user).
- Codex, Cursor, OpenCode and others: read this file, then open the matching `SKILL.md` when the user's request fits.

Examples of expected behavior are in `docs/examples/`. Starter files for the user's data are in `templates/` (copy to `~/.linkedin-agent/`).

## User data

Lives in `~/.linkedin-agent/` (override with `LINKEDIN_AGENT_HOME`), never in the repo.
