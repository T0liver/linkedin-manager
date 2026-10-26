# Install (written for an agent)

Follow these steps in order. Steps marked **USER** need the user to act; do not ask them to paste secrets into chat and never write credentials to the repo or to any log.

Repo: `https://github.com/T0liver/linkedin-manager` (SSH: `git@github.com:T0liver/linkedin-manager.git`).

## 1. Prerequisites

Check `node -v` is 20 or newer and `git` is available. If not, tell the user what to install and stop.

## 2. Clone and build

```bash
git clone https://github.com/T0liver/linkedin-manager.git
cd linkedin-manager/server
npm install
npm run build
```

Note the absolute path of `server/dist/index.js`; call it `<DIST>` below (use forward slashes or an absolute path with no `~`).

## 3. Copy the templates

User data lives in `~/.linkedin-agent/` (override with `LINKEDIN_AGENT_HOME`), never in the repo. Copy without overwriting existing files:

```bash
mkdir -p ~/.linkedin-agent
cp -rn ../templates/. ~/.linkedin-agent/
```

PowerShell: `New-Item -ItemType Directory -Force $HOME\.linkedin-agent; Copy-Item ..\templates\* $HOME\.linkedin-agent -Recurse` (existing files are overwritten there; skip if the folder already has content).

## 4. Register the MCP server

Pick the snippet for the harness you are running in. Replace `<DIST>`. Snippets checked against each tool's docs on 2026-10-26; if a command fails, check the tool's current MCP docs.

**Claude Code** (docs: code.claude.com/docs/en/mcp)

```bash
claude mcp add --transport stdio linkedin -- node <DIST>
```

Add `--scope user` to make it available in every project. Also copy or symlink `skills/*` into `.claude/skills/` (project) or `~/.claude/skills/` (user).

**Codex** (`~/.codex/config.toml`, or `codex mcp add linkedin -- node <DIST>`; run `codex mcp add --help` if the syntax differs on your version)

```toml
[mcp_servers.linkedin]
command = "node"
args = ["<DIST>"]
```

**Cursor** (`.cursor/mcp.json` in the project, or `~/.cursor/mcp.json` globally)

```json
{
  "mcpServers": {
    "linkedin": { "type": "stdio", "command": "node", "args": ["<DIST>"] }
  }
}
```

**OpenCode** (`opencode.json` in the project or the global OpenCode config)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "linkedin": { "type": "local", "command": ["node", "<DIST>"], "enabled": true }
  }
}
```

Codex, Cursor and OpenCode have no skill loader: read `AGENTS.md` at the repo root, then open the matching `skills/<name>/SKILL.md` when the user's request fits.

Optional: set `LINKEDIN_AGENT_DRY_RUN=1` in the server's environment (or add `--dry-run` to the args) to log would-be requests and never call LinkedIn.

Restart or reload the harness so it picks up the server.

## 5. LinkedIn developer app (**USER**)

Walk the user through this; they do it in their browser.

1. Go to https://www.linkedin.com/developers/apps and create an app (a LinkedIn Page is required to associate it with).
2. On the app's **Products** tab, request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
3. On the **Auth** tab, add the redirect URL `http://localhost:8765/callback` (the login command prints the exact URI it uses; set `LINKEDIN_REDIRECT_PORT` to change the port and register that one instead).
4. Keep the **Client ID** and **Client Secret** handy.

## 6. Log in (**USER**)

Ask the user to run this in their own terminal (not via the agent) from `server/`:

```bash
npm run login
```

It prompts for the client ID and secret (secret input is hidden) or reads `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`, opens the browser, and stores the token in the OS keychain (falling back to a `0600` file in `~/.linkedin-agent/` with a warning). Tokens last about 60 days; re-run the command when `whoami` says re-auth is needed. `npm run logout` removes the stored token.

## 7. Check and verify

```bash
cd linkedin-manager/server
npm run doctor
```

It checks the Node version, build output, data directory and token, and prints what is missing and the command to fix it. Fix each `[FAIL]` and re-run until it is clean.

Then call the `whoami` MCP tool. Success returns the user's name and member URN. `{ authenticated: false, hint: ... }` means step 6 is not done or the token expired.

## 8. Read the rules

Read `AGENTS.md`. Nothing is published, commented or reacted without the user's explicit confirmation, and the server enforces `confirm=true`, a daily write cap and a duplicate check. Profile edits are draft-only.

Optional first live check: with the user's approval, publish one test post with `connections` visibility, report the URL, and let the user delete it by hand.
