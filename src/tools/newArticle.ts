import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  validateZennProject,
  runZennCommand,
  buildNewArticleArgs,
  formatZennResult,
  errorResult,
  ZennCliError,
  type ToolResult,
  type NewArticleOptions,
} from "../zennCli.js";

export async function zennNewArticleHandler(
  args: { projectDir: string } & NewArticleOptions
): Promise<ToolResult> {
  try {
    validateZennProject(args.projectDir);
  } catch (err) {
    if (err instanceof ZennCliError) return errorResult(err.message);
    throw err;
  }
  const cliArgs = buildNewArticleArgs(args);
  const result = await runZennCommand(args.projectDir, cliArgs);
  return formatZennResult(result);
}

export function registerZennNewArticle(server: McpServer): void {
  server.tool(
    "zenn_new_article",
    "Create a new Zenn article in the given project directory (runs `npx zenn new:article`).",
    {
      projectDir: z
        .string()
        .describe("Absolute path to an existing Zenn project directory"),
      slug: z
        .string()
        .optional()
        .describe("Article slug (12-50 chars, used as the filename)"),
      title: z.string().optional().describe("Article title"),
      type: z
        .enum(["tech", "idea"])
        .optional()
        .describe("Article type: tech or idea"),
      emoji: z.string().optional().describe("Emoji used as the article icon"),
      published: z
        .boolean()
        .optional()
        .describe("Whether to mark the article as published"),
    },
    zennNewArticleHandler
  );
}
