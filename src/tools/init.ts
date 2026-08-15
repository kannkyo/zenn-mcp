import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  validateProjectDir,
  runZennCommand,
  formatZennResult,
  errorResult,
  ZennCliError,
  type ToolResult,
} from "../zennCli.js";

export async function zennInitHandler(args: {
  projectDir: string;
}): Promise<ToolResult> {
  try {
    validateProjectDir(args.projectDir);
  } catch (err) {
    if (err instanceof ZennCliError) return errorResult(err.message);
    throw err;
  }
  const result = await runZennCommand(args.projectDir, ["init"]);
  return formatZennResult(result);
}

export function registerZennInit(server: McpServer): void {
  server.tool(
    "zenn_init",
    "Initialize a new Zenn project in the given directory (runs `npx zenn init`).",
    {
      projectDir: z
        .string()
        .describe("Absolute path to the directory to initialize as a Zenn project"),
    },
    zennInitHandler
  );
}
