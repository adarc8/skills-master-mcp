# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is an MCP (Model Context Protocol) server that connects AI agents to the SkillsMP marketplace (8,000+ community skills). Users can search, read, install, and remove skills without needing an API key.

**Key insight:** Skills are just markdown files. The `read_skill` tool fetches them from GitHub and loads them into the agent's context for one-off use, without permanent installation.

## Architecture

```
src/
  ├── index.ts    # MCP server + 5 tool registrations
  └── utils.ts    # Types, schemas, proxy client, GitHub client, formatting
```

**Two-tier architecture:**

1. **MCP Server (this repo)** — runs locally via `npx skills-master-mcp`
   - 5 tools: `search`, `ai_search`, `read_skill`, `install_skill`, `remove_skill`
   - No API key required on client side

2. **Vercel Backend** — `https://skills-master-backend.vercel.app`
   - Proxies search requests to SkillsMP API
   - Holds the API key so users don't need one

**Tool flow:**
- `search` / `ai_search` → Vercel backend → SkillsMP API
- `read_skill` → GitHub raw content (direct)
- `install_skill` → `npx add-skill` CLI
- `remove_skill` → deletes files from `.claude/skills/`

## Development Commands

Build:
```bash
npm run build
```

Watch mode (rebuilds on save):
```bash
npm run dev
```

Clean build artifacts:
```bash
npm run clean
```

Run locally:
```bash
npm start
# or
node dist/index.js
```

## Publishing Updates

**CRITICAL:** After code changes, always publish to npm so users get the update:

```bash
npm version patch    # or minor/major
npm publish --access public
git push --tags
```

The version bump creates a git tag automatically. Push it after publishing.

**Authentication:** The `.npmrc` file contains the NPM authentication token that bypasses 2FA. This file is gitignored and should never be committed. The token is also stored in `.env` for reference.

## Key Implementation Details

### Agent Skill Paths

Skills install to different directories per agent:
- **Claude Code**: `.claude/skills/` (project) or `~/.claude/skills/` (global)
- **Cursor**: `.cursor/rules/` (project) or `~/.cursor/rules/` (global)

**Installation Scope (REQUIRED):**
Both `install_skill` and `remove_skill` tools now require the `global` parameter to be explicitly set:
- `global: false` → Project-level: `./.claude/skills/` (only available in current project)
- `global: true` → User-level: `~/.claude/skills/` (available across all projects)

This forces Claude to prompt the user for their preference rather than defaulting to project-level installation.

The `install_skill` tool delegates to `npx add-skill`, which handles installation. The `remove_skill` tool deletes files directly from these paths.

### Backend URL Override

Default backend: `https://skills-master-backend.vercel.app`

Override via environment variable:
```bash
SKILLS_MASTER_BACKEND_URL=http://localhost:3000 npx skills-master-mcp
```

### Transport Modes

- **stdio** (default): JSON-RPC over stdin/stdout — used by Claude Code, Cursor, etc.
- **http**: Optional Express server for HTTP-based MCP clients

Set via `TRANSPORT=http` and `PORT=3000` environment variables.

### GitHub Skill Fetching

The `read_skill` tool tries multiple filename variations:
1. `skill.md`
2. `SKILL.md`
3. `Skill.md`

Falls back to directory listing if no skill file is found.

## Git Commit Messages

Never include "Co-Authored-By: Claude" lines in commit messages.

## Testing the MCP Locally

1. Build: `npm run build`
2. Add to Claude Code:
   ```bash
   claude mcp add skills-master-local -- node /absolute/path/to/dist/index.js
   ```
3. Restart Claude Code
4. Test tools via conversation

For production testing, use the published npm package:
```bash
claude mcp add skills-master -- npx skills-master-mcp
```
