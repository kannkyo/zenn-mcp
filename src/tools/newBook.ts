import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  validateZennProject,
  runZennCommand,
  buildNewBookArgs,
  formatZennResult,
  errorResult,
  ZennCliError,
  type ToolResult,
  type NewBookOptions,
} from "../zennCli.js";

export async function zennNewBookHandler(
  args: { projectDir: string } & NewBookOptions
): Promise<ToolResult> {
  try {
    validateZennProject(args.projectDir);
  } catch (err) {
    if (err instanceof ZennCliError) return errorResult(err.message);
    throw err;
  }
  const cliArgs = buildNewBookArgs(args);
  const result = await runZennCommand(args.projectDir, cliArgs);
  return formatZennResult(result);
}

export function registerZennNewBook(server: McpServer): void {
  server.tool(
    "zenn_new_book",
    "Create a new Zenn book in the given project directory (runs `npx zenn new:book`).",
    {
      projectDir: z
        .string()
        .describe("Absolute path to an existing Zenn project directory"),
      slug: z
        .string()
        .optional()
        .describe("Book slug (12-50 chars, used as the directory name)"),
    },
    zennNewBookHandler
  );
}
