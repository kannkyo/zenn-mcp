import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  validateZennProject,
  runZennCommand,
  formatZennResult,
  errorResult,
  ZennCliError,
  type ToolResult,
} from "../zennCli.js";

export async function zennListArticlesHandler(args: {
  projectDir: string;
}): Promise<ToolResult> {
  try {
    validateZennProject(args.projectDir);
  } catch (err) {
    if (err instanceof ZennCliError) return errorResult(err.message);
    throw err;
  }
  const result = await runZennCommand(args.projectDir, ["list:articles"]);
  return formatZennResult(result);
}

export function registerZennListArticles(server: McpServer): void {
  server.tool(
    "zenn_list_articles",
    "List Zenn articles in the given project directory (runs `npx zenn list:articles`).",
    {
      projectDir: z
        .string()
        .describe("Absolute path to an existing Zenn project directory"),
    },
    zennListArticlesHandler
  );
}
