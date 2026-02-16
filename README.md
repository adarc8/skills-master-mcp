<h1 align="center">skills-master-mcp</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/skills-master-mcp"><img src="https://img.shields.io/npm/v/skills-master-mcp?color=blue&label=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/skills-master-mcp"><img src="https://img.shields.io/npm/dm/skills-master-mcp?color=green" alt="npm downloads" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-yellow" alt="License: MIT" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node.js" /></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple" alt="MCP Compatible" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &nbsp;&bull;&nbsp;
  <a href="#example">Example</a> &nbsp;&bull;&nbsp;
  <a href="#tools">Tools</a> &nbsp;&bull;&nbsp;
  <a href="#how-it-works">Architecture</a> &nbsp;&bull;&nbsp;
  <a href="#supported-agents">Agents</a>
</p>

---

## What is this?

An [MCP](https://modelcontextprotocol.io) server that connects your AI coding agent to the [SkillsMP](https://skillsmp.com) marketplace — 8,000+ community-made skills.

You can search for skills, read them directly into your agent's context, install them permanently, or remove them. No API key needed. One command to set up.

The key idea: you don't always need to _install_ a skill. You can just **read** it and your agent gets the instructions on the spot.

---

## Quick Start

### Claude Code

```bash
claude mcp add skills-master -- npx skills-master-mcp
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "skills-master": {
      "command": "npx",
      "args": ["skills-master-mcp"]
    }
  }
}
```

### Any MCP-Compatible Client

```bash
npx skills-master-mcp
```

No API key. No `.env`. No configuration.

---

## Example

Here's a real use case. You need to convert a markdown file to PDF but your agent doesn't know how. Instead of figuring it out yourself, just ask:

```
You:      "I need to convert README.md to a PDF"

Agent:    searches SkillsMP for "markdown to pdf"
          → finds a skill for it
          → reads the SKILL.md content from GitHub
          → now has the full instructions in context

Agent:    "I found a skill for this. It uses Puppeteer to render
           the markdown and save it as PDF. Let me do that now."

          ...converts your file using the skill's instructions.

You:      "Thanks"
```

The skill was never installed to your machine. The agent just read it, learned the approach, and executed it. One-shot use.

If you want a skill permanently, you can install it too:

```
You:      "Install that markdown-to-pdf skill for Claude Code"

Agent:    runs install_skill
          → skill is now saved to .claude/commands/
          → available in every future conversation
```

---

## Tools

### `search`

Keyword search across the SkillsMP marketplace.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Search terms (e.g., `"react testing"`) |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max: 100) |
| `sort_by` | string | `"stars"` | `"stars"` or `"recent"` |
| `response_format` | string | `"markdown"` | `"markdown"` or `"json"` |

### `ai_search`

Semantic search. Describe what you need in plain English and it finds relevant skills.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Natural language query (e.g., `"tools for building REST APIs"`) |
| `response_format` | string | `"markdown"` | `"markdown"` or `"json"` |

### `read_skill`

Fetches a skill's `SKILL.md` from GitHub and loads it into the agent's context. No installation needed — the agent can use it immediately.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `owner` | string | *required* | GitHub user/org (e.g., `"anthropics"`) |
| `repo` | string | *required* | Repository name |
| `path` | string | — | Path to skill folder |
| `branch` | string | `"main"` | Git branch |

### `install_skill`

Permanently installs skills to your agent using [add-skill](https://www.npmjs.com/package/add-skill).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | string | *required* | GitHub `owner/repo` or full URL |
| `skills` | string | *required* | Skill names (comma-separated) |
| `agents` | string | *required* | Target agents (comma-separated) |
| `global` | boolean | `false` | Install globally (user-level) |

### `remove_skill`

Deletes installed skill files from your agent's commands directory.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skills` | string | *required* | Skill names to remove (comma-separated) |
| `agent` | string | `"claude-code"` | Target agent |
| `global` | boolean | `false` | Remove from global scope |

---

## Supported Agents

| Agent | Install | Remove |
|-------|---------|--------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Yes | Yes |
| [Cursor](https://cursor.sh) | Yes | Yes |
| [Codex](https://openai.com/index/codex/) | Yes | — |
| [OpenCode](https://opencode.ai) | Yes | — |
| [GitHub Copilot](https://github.com/features/copilot) | Yes | — |
| [Roo](https://roocode.com) | Yes | — |
| [Antigravity](https://antigravity.dev) | Yes | — |

---

## How It Works

```
Your AI Agent
    │
    ▼
skills-master-mcp (local, via npx)
    ├── search / ai_search ──▶ Proxy Backend ──▶ SkillsMP API
    ├── read_skill ──────────▶ GitHub (direct)
    ├── install_skill ───────▶ npx add-skill
    └── remove_skill ────────▶ Local file deletion
```

Search requests go through a proxy backend so you don't need an API key. Everything else is direct.

---

## Configuration

Nothing to configure. Optional env vars for advanced use:

| Variable | Default | Description |
|----------|---------|-------------|
| `SKILLS_MASTER_BACKEND_URL` | Production URL | Override backend endpoint |
| `TRANSPORT` | `stdio` | `stdio` or `http` |
| `PORT` | `3000` | HTTP port (when `TRANSPORT=http`) |

---

## Links

- [SkillsMP Marketplace](https://skillsmp.com)
- [npm Package](https://www.npmjs.com/package/skills-master-mcp)
- [add-skill CLI](https://www.npmjs.com/package/add-skill)
- [MCP Specification](https://modelcontextprotocol.io)

---

## License

MIT
