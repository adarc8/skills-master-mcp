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

A *Plug & Play* [MCP](https://modelcontextprotocol.io) server that connects your AI coding agent to the [SkillsMP](https://skillsmp.com) marketplace - 8,000+ community-made skills.

You can search for skills, easily install them (to `~/.claude/skills/`) or read them directly into your agent's context (without installing).  
**No API key needed.  
One command to set up.**

The key idea is to help lazy people like me to use skills more often, and save time and tokens for our dear agents.

---

## Example

Here’s a real use case: converting a Markdown file to PDF.  
You can either have the agent learn how to do it via web search, or simply import the skill.  
Super efficient and fast.

```
You:      "I need to convert README.md to a PDF"

Agent:    searches SkillsMP for "markdown to pdf"
          → finds a skill for it
          → reads the SKILL.md content from GitHub
          → now has the full instructions in context

Agent:    "I found a skill for this. It uses Puppeteer to render
           the markdown and save it as PDF. Let me do that now."

          ...converts your file using the skill's instructions.

You:      ":))))"
```

The skill was never installed to your `~/.claude/skills`  
The agent just read it, learned the approach, and executed it.  
One-shot use.


If you want a skill permanently, you can install it too:

```
You:      "Install that markdown-to-pdf skill for Claude Code"

Agent:    runs install_skill
          → skill is now saved to .claude/skills/
          → available in every future conversation
```

---

## Quick Start

**No API key  
No `.env`  
No configuration  
Just install and run**

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



---

## Tools

| Tool | Input | Output |
|------|-------|--------|
| `search` | keywords (e.g., `"react testing"`) | List of matching skills with name, author, stars, links |
| `ai_search` | plain English (e.g., `"how to build REST APIs"`) | Semantically relevant skills ranked by relevance |
| `read_skill` | GitHub owner + repo + path | The skill's full SKILL.md content, loaded into agent context |
| `install_skill` | GitHub source + skill names + target agents | Skill permanently saved to agent's skills directory |
| `remove_skill` | skill names | Deletes the skill files from agent's skills directory |

<details>
<summary>Full parameter reference</summary>

### `search`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Search terms |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max: 100) |
| `sort_by` | string | `"stars"` | `"stars"` or `"recent"` |
| `response_format` | string | `"markdown"` | `"markdown"` or `"json"` |

### `ai_search`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | *required* | Natural language query |
| `response_format` | string | `"markdown"` | `"markdown"` or `"json"` |

### `read_skill`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `owner` | string | *required* | GitHub user/org |
| `repo` | string | *required* | Repository name |
| `path` | string | — | Path to skill folder |
| `branch` | string | `"main"` | Git branch |

### `install_skill`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `source` | string | *required* | GitHub `owner/repo` or full URL |
| `skills` | string | *required* | Skill names (comma-separated) |
| `agents` | string | *required* | Target agents (comma-separated) |
| `global` | boolean | `false` | Install globally (user-level) |

### `remove_skill`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skills` | string | *required* | Skill names to remove (comma-separated) |
| `agent` | string | `"claude-code"` | Target agent |
| `global` | boolean | `false` | Remove from global scope |

</details>

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
- [skills CLI](https://www.npmjs.com/package/skills)
- [MCP Specification](https://modelcontextprotocol.io)

---

## License

MIT
