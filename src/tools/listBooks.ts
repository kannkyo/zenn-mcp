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

export async function zennListBooksHandler(args: {
  projectDir: string;
}): Promise<ToolResult> {
  try {
    validateZennProject(args.projectDir);
  } catch (err) {
    if (err instanceof ZennCliError) return errorResult(err.message);
    throw err;
  }
  const result = await runZennCommand(args.projectDir, ["list:books"]);
  return formatZennResult(result);
}

export function registerZennListBooks(server: McpServer): void {
  server.tool(
    "zenn_list_books",
    "List Zenn books in the given project directory (runs `npx zenn list:books`).",
    {
      projectDir: z
        .string()
        .describe("Absolute path to an existing Zenn project directory"),
    },
    zennListBooksHandler
  );
}
