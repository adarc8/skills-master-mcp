#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { AxiosError } from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import { unlink, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { homedir } from "os";

import {
  ResponseFormat,
  type Skill,
  type KeywordSearchResponse,
  type AISearchResponse,
  type SearchInput,
  type AISearchInput,
  type ReadSkillInput,
  type InstallSkillInput,
  type RemoveSkillInput,
  SearchInputSchema,
  AISearchInputSchema,
  ReadSkillInputSchema,
  InstallSkillInputSchema,
  RemoveSkillInputSchema,
  proxySearch,
  fetchSkillContent,
  fetchDirectoryListing,
  handleApiError,
  formatSkillsMarkdown,
  formatSkillsJson,
  buildInstallCommand,
} from "./utils.js";

const execAsync = promisify(exec);

const server = new McpServer({
  name: "skills-master-mcp",
  version: "1.0.0",
});

// Tool 1: search
server.registerTool(
  "search",
  {
    title: "Search Skills",
    description: `Search SkillsMP marketplace for AI coding skills by keywords.

Parameters:
- query: Search terms (e.g., "fastapi", "react testing")
- page: Page number (default: 1)
- limit: Results per page (default: 20, max: 100)
- sort_by: "stars" (default) or "recent"

Returns skills with name, description, author, stars, and GitHub URL.`,
    inputSchema: SearchInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params: SearchInput) => {
    try {
      const data = await proxySearch<KeywordSearchResponse>("search", {
        q: params.query,
        page: params.page,
        limit: params.limit,
        sortBy: params.sort_by,
      });

      const skills = data.data?.skills || [];
      const total = data.data?.pagination?.total;

      if (!skills.length) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No skills found matching '${params.query}'. Try different keywords.`,
            },
          ],
        };
      }

      const output = {
        query: params.query,
        page: params.page,
        limit: params.limit,
        count: skills.length,
        total,
        has_more:
          total !== undefined ? total > params.page * params.limit : undefined,
        skills: skills.map((s) => ({
          name: s.name,
          description: s.description,
          stars: s.stars,
          author: s.author,
          skillUrl: s.skillUrl,
          githubUrl: s.githubUrl,
        })),
      };

      let textContent: string;
      if (params.response_format === ResponseFormat.MARKDOWN) {
        textContent = formatSkillsMarkdown(skills, params.query, total);
      } else {
        textContent = formatSkillsJson(
          skills,
          params.query,
          params.page,
          params.limit,
          total
        );
      }

      return {
        content: [{ type: "text" as const, text: textContent }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: handleApiError(error) }],
      };
    }
  }
);

// Tool 2: ai_search
server.registerTool(
  "ai_search",
  {
    title: "AI Search Skills",
    description: `Semantic search for skills using natural language queries. Powered by AI to understand intent.

Use this when keywords aren't enough - describe what you want to accomplish.

Parameters:
- query: Natural language query (e.g., "How to build REST APIs with authentication")

Examples: "tools for web scraping", "help with React testing", "automate deployments"`,
    inputSchema: AISearchInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params: AISearchInput) => {
    try {
      const data = await proxySearch<AISearchResponse>("ai-search", {
        q: params.query,
      });

      const skills = (data.data?.data || [])
        .map((item) => item.skill)
        .filter((skill): skill is Skill => skill !== undefined);

      if (!skills.length) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No skills found for '${params.query}'. Try rephrasing your query.`,
            },
          ],
        };
      }

      const output = {
        query: params.query,
        count: skills.length,
        skills: skills.map((s) => ({
          name: s.name,
          description: s.description,
          stars: s.stars,
          author: s.author,
          skillUrl: s.skillUrl,
          githubUrl: s.githubUrl,
        })),
      };

      let textContent: string;
      if (params.response_format === ResponseFormat.MARKDOWN) {
        textContent = formatSkillsMarkdown(skills, params.query);
      } else {
        textContent = formatSkillsJson(skills, params.query);
      }

      return {
        content: [{ type: "text" as const, text: textContent }],
        structuredContent: output,
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: handleApiError(error) }],
      };
    }
  }
);

// Tool 3: read_skill
server.registerTool(
  "read_skill",
  {
    title: "Read Skill Content",
    description: `Read skill file content (SKILL.md) from a GitHub repository. Use to preview a skill before installing.

Parameters:
- owner: GitHub username/org (e.g., "anthropics")
- repo: Repository name (e.g., "claude-code")
- path: Path to skill folder (e.g., "plugins/frontend-design/skills/frontend-design")
- branch: Git branch (default: "main")

If path has no skill.md, returns directory listing.`,
    inputSchema: ReadSkillInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params: ReadSkillInput) => {
    try {
      const content = await fetchSkillContent(
        params.owner,
        params.repo,
        params.path,
        params.branch
      );

      return {
        content: [{ type: "text" as const, text: content }],
        structuredContent: {
          owner: params.owner,
          repo: params.repo,
          path: params.path,
          branch: params.branch,
          content,
        },
      };
    } catch (error) {
      // If skill file not found, try directory listing
      if (error instanceof AxiosError && error.response?.status === 404) {
        try {
          const listing = await fetchDirectoryListing(
            params.owner,
            params.repo,
            params.path,
            params.branch
          );

          return {
            content: [
              {
                type: "text" as const,
                text: `Directory listing for ${params.owner}/${params.repo}/${params.path || ""}:\n\n${JSON.stringify(listing, null, 2)}`,
              },
            ],
            structuredContent: {
              owner: params.owner,
              repo: params.repo,
              path: params.path,
              branch: params.branch,
              type: "directory",
              items: listing,
            },
          };
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Path '${params.path}' not found in ${params.owner}/${params.repo}`,
              },
            ],
          };
        }
      }
      return {
        content: [{ type: "text" as const, text: handleApiError(error) }],
      };
    }
  }
);

// Tool 4: install_skill
server.registerTool(
  "install_skill",
  {
    title: "Install Skill",
    description: `Install skills from GitHub to AI coding agents.

Parameters:
- source: GitHub "owner/repo" (e.g., "anthropics/claude-code") [REQUIRED]
- skills: Skill names, comma-separated (e.g., "frontend-design,backend-dev") [REQUIRED]
- agents: Target agents, comma-separated [REQUIRED]
  Valid: claude-code, cursor, codex, opencode, antigravity, github-copilot, roo
- global: Install user-level instead of project-level (default: false)

Example: source="anthropics/claude-code", skills="frontend-design", agents="claude-code"`,
    inputSchema: InstallSkillInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  async (params: InstallSkillInput) => {
    try {
      if (!params.skills || params.skills.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: 'skills' parameter is required. Specify skill names to install (comma-separated).",
            },
          ],
        };
      }
      if (!params.agents || params.agents.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: 'agents' parameter is required. Specify target agents (e.g., 'claude-code', 'cursor').",
            },
          ],
        };
      }

      const cmd = buildInstallCommand(params);
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });
      const output = stdout || stderr || "Skill installed successfully.";

      return {
        content: [{ type: "text" as const, text: output }],
        structuredContent: {
          success: true,
          command: cmd,
          source: params.source,
          skills: params.skills,
          agents: params.agents,
          global: params.global,
          output,
        },
      };
    } catch (error) {
      if (error instanceof Error && "stdout" in error) {
        const execError = error as {
          stdout?: string;
          stderr?: string;
          message: string;
        };
        const output =
          execError.stdout || execError.stderr || execError.message;
        return {
          content: [
            {
              type: "text" as const,
              text: `Installation failed: ${output}`,
            },
          ],
          structuredContent: {
            success: false,
            source: params.source,
            error: output,
          },
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Tool 5: remove_skill
// Agent skill paths mapping
const AGENT_SKILL_PATHS: Record<
  string,
  { project: (cwd: string) => string; global: () => string }
> = {
  "claude-code": {
    project: (cwd: string) => join(cwd, ".claude", "skills"),
    global: () => join(homedir(), ".claude", "skills"),
  },
  cursor: {
    project: (cwd: string) => join(cwd, ".cursor", "rules"),
    global: () => join(homedir(), ".cursor", "rules"),
  },
};

server.registerTool(
  "remove_skill",
  {
    title: "Remove Skill",
    description: `Remove installed skills from an AI coding agent.

Parameters:
- skills: Skill names to remove (comma-separated: 'skill1,skill2'). REQUIRED.
- agent: Agent to remove from (default: 'claude-code')
  Valid: claude-code, cursor, codex, opencode, antigravity, github-copilot, roo
- global: Remove from global (user-level) instead of project-level (default: false)

Removes the skill's .md file from the agent's commands/rules directory.`,
    inputSchema: RemoveSkillInputSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (params: RemoveSkillInput) => {
    try {
      if (!params.skills || params.skills.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: 'skills' parameter is required. Specify skill names to remove.",
            },
          ],
        };
      }

      const agentPaths = AGENT_SKILL_PATHS[params.agent];
      if (!agentPaths) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Removal not supported for agent '${params.agent}'. Supported agents: ${Object.keys(AGENT_SKILL_PATHS).join(", ")}`,
            },
          ],
        };
      }

      const baseDir = params.global
        ? agentPaths.global()
        : agentPaths.project(process.cwd());

      const removed: string[] = [];
      const notFound: string[] = [];

      for (const skillName of params.skills) {
        const filePath = join(baseDir, `${skillName}.md`);
        try {
          await access(filePath, constants.F_OK);
          await unlink(filePath);
          removed.push(filePath);
        } catch {
          notFound.push(skillName);
        }
      }

      const lines: string[] = [];
      if (removed.length > 0) {
        lines.push(`Removed ${removed.length} skill(s):`);
        for (const path of removed) {
          lines.push(`  - ${path}`);
        }
      }
      if (notFound.length > 0) {
        lines.push(`Not found (${notFound.length}):`);
        for (const name of notFound) {
          lines.push(`  - ${name} (looked in ${baseDir})`);
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        structuredContent: {
          removed,
          notFound,
          agent: params.agent,
          global: params.global,
          baseDir,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Transport
async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("skills-master-mcp running via stdio");
}

async function runHttp(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  app.listen(port, () => {
    console.error(
      `skills-master-mcp running on http://localhost:${port}/mcp`
    );
  });
}

const transportMode = process.env.TRANSPORT || "stdio";

if (transportMode === "http") {
  runHttp().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
