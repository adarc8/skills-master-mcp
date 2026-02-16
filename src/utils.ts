import { z } from "zod";
import axios, { AxiosError } from "axios";

// Constants
export const BACKEND_URL =
  process.env.SKILLS_MASTER_BACKEND_URL ||
  "https://skills-master-backend.vercel.app";
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const SKILL_FILE_NAMES = ["skill.md", "SKILL.md", "Skill.md"];

// Enums
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export enum SortBy {
  STARS = "stars",
  RECENT = "recent",
}

export enum Agent {
  CLAUDE_CODE = "claude-code",
  OPENCODE = "opencode",
  CODEX = "codex",
  CURSOR = "cursor",
  ANTIGRAVITY = "antigravity",
  GITHUB_COPILOT = "github-copilot",
  ROO = "roo",
}

// Types
export interface Skill {
  id?: string;
  name?: string;
  description?: string;
  stars?: number;
  author?: string;
  skillUrl?: string;
  githubUrl?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface KeywordSearchResponse {
  success?: boolean;
  data?: {
    skills?: Skill[];
    pagination?: {
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
      hasNext?: boolean;
      hasPrev?: boolean;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export interface AISearchResult {
  file_id?: string;
  filename?: string;
  score?: number;
  skill?: Skill;
}

export interface AISearchResponse {
  success?: boolean;
  data?: {
    object?: string;
    search_query?: string;
    data?: AISearchResult[];
  };
  error?: {
    code?: string;
    message?: string;
  };
}

// Zod Schemas
export const SearchInputSchema = z
  .object({
    query: z
      .string()
      .min(1, "Query is required")
      .max(200, "Query must not exceed 200 characters")
      .describe(
        "Search query for skills (e.g., 'SEO', 'web scraper', 'data analysis')"
      ),
    page: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe("Page number for pagination"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(DEFAULT_LIMIT)
      .describe(
        `Items per page (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`
      ),
    sort_by: z
      .nativeEnum(SortBy)
      .default(SortBy.STARS)
      .describe("Sort results by: 'stars' (default) or 'recent'"),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe(
        "Output format: 'markdown' for human-readable or 'json' for machine-readable"
      ),
  })
  .strict();

export const AISearchInputSchema = z
  .object({
    query: z
      .string()
      .min(1, "Query is required")
      .max(500, "Query must not exceed 500 characters")
      .describe(
        "Natural language query for AI semantic search (e.g., 'How to create a web scraper', 'tools for SEO optimization')"
      ),
    response_format: z
      .nativeEnum(ResponseFormat)
      .default(ResponseFormat.MARKDOWN)
      .describe(
        "Output format: 'markdown' for human-readable or 'json' for machine-readable"
      ),
  })
  .strict();

export const ReadSkillInputSchema = z
  .object({
    owner: z
      .string()
      .min(1)
      .describe("GitHub repository owner (e.g., 'davila7')"),
    repo: z
      .string()
      .min(1)
      .describe("GitHub repository name (e.g., 'claude-code-templates')"),
    path: z
      .string()
      .optional()
      .describe(
        "Path to skill within repo (e.g., 'cli-tool/components/skills/development/senior-prompt-engineer'). If not provided, lists available skills."
      ),
    branch: z
      .string()
      .default("main")
      .describe("Git branch (default: 'main')"),
  })
  .strict();

export const InstallSkillInputSchema = z
  .object({
    source: z
      .string()
      .min(1)
      .describe(
        "GitHub shorthand 'owner/repo' (e.g., 'davila7/claude-code-templates'), full GitHub URL, or local path"
      ),
    skills: z
      .union([z.array(z.string()), z.string()])
      .transform((val) => {
        if (!val) return [];
        if (typeof val === "string") return val.split(",").map((s) => s.trim());
        return val;
      })
      .describe(
        "Skill names to install (comma-separated: 'skill1,skill2' or array). REQUIRED."
      ),
    agents: z
      .union([z.array(z.string()), z.string()])
      .transform((val) => {
        if (!val) return [];
        if (typeof val === "string") return val.split(",").map((s) => s.trim());
        return val;
      })
      .describe(
        "Target agents (comma-separated: 'claude-code,cursor'). Valid: opencode, claude-code, codex, cursor, antigravity, github-copilot, roo. REQUIRED."
      ),
    global: z
      .union([z.boolean(), z.string()])
      .default(false)
      .transform((val) => val === true || val === "true")
      .describe(
        "Install globally (user-level) instead of project-level (default: false)"
      ),
  })
  .strict();

export const RemoveSkillInputSchema = z
  .object({
    skills: z
      .union([z.array(z.string()), z.string()])
      .transform((val) => {
        if (!val) return [];
        if (typeof val === "string") return val.split(",").map((s) => s.trim());
        return val;
      })
      .describe(
        "Skill names to remove (comma-separated: 'skill1,skill2' or array). REQUIRED."
      ),
    agent: z
      .nativeEnum(Agent)
      .default(Agent.CLAUDE_CODE)
      .describe("Agent whose skills to remove (default: 'claude-code')"),
    global: z
      .union([z.boolean(), z.string()])
      .default(false)
      .transform((val) => val === true || val === "true")
      .describe(
        "Remove from global (user-level) instead of project-level (default: false)"
      ),
  })
  .strict();

// Inferred types
export type SearchInput = z.infer<typeof SearchInputSchema>;
export type AISearchInput = z.infer<typeof AISearchInputSchema>;
export type ReadSkillInput = z.infer<typeof ReadSkillInputSchema>;
export type InstallSkillInput = z.infer<typeof InstallSkillInputSchema>;
export type RemoveSkillInput = z.infer<typeof RemoveSkillInputSchema>;

// Proxy client — calls our Vercel backend (no API key needed on MCP side)
export async function proxySearch<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>
): Promise<T> {
  const filteredParams: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      filteredParams[key] = value;
    }
  }

  const response = await axios.get<T>(`${BACKEND_URL}/api/${endpoint}`, {
    params: filteredParams,
    headers: { Accept: "application/json" },
    timeout: 30000,
  });

  return response.data;
}

// GitHub client
export async function fetchSkillContent(
  owner: string,
  repo: string,
  path: string | undefined,
  branch: string
): Promise<string> {
  const basePath = path || "";

  for (const fileName of SKILL_FILE_NAMES) {
    const skillPath = basePath ? `${basePath}/${fileName}` : fileName;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${skillPath}`;

    try {
      const response = await axios.get(rawUrl, {
        timeout: 30000,
        headers: { Accept: "text/plain" },
      });
      return response.data;
    } catch {
      continue;
    }
  }

  throw new AxiosError(
    "Skill file not found",
    "404",
    undefined,
    undefined,
    {
      status: 404,
      statusText: "Not Found",
      headers: {},
      config: {} as never,
      data: {},
    }
  );
}

export async function fetchDirectoryListing(
  owner: string,
  repo: string,
  path: string | undefined,
  branch: string
): Promise<{ name: string; type: string; path: string }[]> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path || ""}?ref=${branch}`;
  const response = await axios.get(apiUrl, {
    timeout: 30000,
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  const items = response.data;
  if (!Array.isArray(items)) {
    throw new Error("Path is not a directory");
  }

  return items.map((item: { name: string; type: string; path: string }) => ({
    name: item.name,
    type: item.type,
    path: item.path,
  }));
}

// Formatting
export function formatSkillsMarkdown(
  skills: Skill[],
  query: string,
  total?: number
): string {
  const lines: string[] = [`# Skills Search Results: '${query}'`, ""];

  if (total !== undefined) {
    lines.push(`Found ${total} skills (showing ${skills.length})`);
  } else {
    lines.push(`Found ${skills.length} skills`);
  }
  lines.push("");

  for (const skill of skills) {
    const name = skill.name || "Unknown";
    const description = skill.description || "No description";
    const stars = skill.stars || 0;
    const author = skill.author || "Unknown";
    const skillUrl = skill.skillUrl || "";
    const githubUrl = skill.githubUrl || "";

    lines.push(`## ${name}`);
    if (stars) {
      lines.push(`Stars: ${stars} | By: ${author}`);
    } else {
      lines.push(`By: ${author}`);
    }
    lines.push("");
    lines.push(description);
    if (skillUrl) {
      lines.push(`\nView Skill: ${skillUrl}`);
    }
    if (githubUrl) {
      lines.push(`GitHub: ${githubUrl}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function formatSkillsJson(
  skills: Skill[],
  query: string,
  page: number = 1,
  limit: number = DEFAULT_LIMIT,
  total?: number
): string {
  const response: Record<string, unknown> = {
    query,
    page,
    limit,
    count: skills.length,
    skills,
  };

  if (total !== undefined) {
    response.total = total;
    response.has_more = total > page * limit;
  }

  let result = JSON.stringify(response, null, 2);

  if (result.length > CHARACTER_LIMIT) {
    const half = Math.max(1, Math.floor(skills.length / 2));
    response.skills = skills.slice(0, half);
    response.truncated = true;
    response.truncation_message = `Response truncated from ${skills.length} to ${half} items. Use 'page' parameter to see more results.`;
    result = JSON.stringify(response, null, 2);
  }

  return result;
}

// Error handling
export function handleApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as
        | { error?: { code?: string; message?: string }; message?: string }
        | undefined;
      const errorMsg =
        data?.error?.message || data?.message;

      if (status === 400) {
        return `Error: Bad request - ${errorMsg || "Check your query parameters."}`;
      }
      if (status === 429) {
        return "Error: Rate limit exceeded. Please wait before making more requests.";
      }
      if (status === 500) {
        return "Error: Server error. Please try again later.";
      }
      return `Error: Request failed (${status}) - ${errorMsg || "Unknown error"}`;
    }
    if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. Please try again.";
    }
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return "Error: Cannot connect to the backend. Check your network connection.";
    }
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: Unexpected error - ${String(error)}`;
}

// Command building utility for install
export function buildInstallCommand(params: {
  source: string;
  skills: string[];
  agents: string[];
  global: boolean;
}): string {
  let cmd = `npx skills add "${params.source}"`;
  cmd += ` -s ${params.skills.map((s) => `"${s}"`).join(" ")}`;
  cmd += ` -a ${params.agents.join(" ")}`;
  cmd += " -y";
  if (params.global) {
    cmd += " -g";
  }
  return cmd;
}
