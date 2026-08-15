import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

export class ZennCliError extends Error {}

export function validateProjectDir(projectDir: string): void {
  if (!existsSync(projectDir)) {
    throw new ZennCliError(`projectDir does not exist: ${projectDir}`);
  }
}

export function validateZennProject(projectDir: string): void {
  validateProjectDir(projectDir);
  const hasArticles = existsSync(join(projectDir, "articles"));
  const hasPackageJson = existsSync(join(projectDir, "package.json"));
  if (!hasArticles && !hasPackageJson) {
    throw new ZennCliError(
      `projectDir is not a Zenn project (no articles/ or package.json found): ${projectDir}`
    );
  }
}

export interface RunZennResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function runZennCommand(
  projectDir: string,
  args: string[]
): Promise<RunZennResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["zenn", ...args], { cwd: projectDir });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      reject(new ZennCliError(`Failed to spawn npx: ${err.message}`));
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? -1 });
    });
  });
}

export interface NewArticleOptions {
  slug?: string;
  title?: string;
  type?: "tech" | "idea";
  emoji?: string;
  published?: boolean;
}

export function buildNewArticleArgs(options: NewArticleOptions): string[] {
  const args = ["new:article"];
  if (options.slug) args.push("--slug", options.slug);
  if (options.title) args.push("--title", options.title);
  if (options.type) args.push("--type", options.type);
  if (options.emoji) args.push("--emoji", options.emoji);
  if (options.published) args.push("--published");
  return args;
}

export interface NewBookOptions {
  slug?: string;
}

export function buildNewBookArgs(options: NewBookOptions): string[] {
  const args = ["new:book"];
  if (options.slug) args.push("--slug", options.slug);
  return args;
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export function formatZennResult(result: RunZennResult): ToolResult {
  if (result.exitCode !== 0) {
    return {
      content: [
        {
          type: "text",
          text:
            result.stderr ||
            result.stdout ||
            `zenn command exited with code ${result.exitCode}`,
        },
      ],
      isError: true,
    };
  }
  return {
    content: [{ type: "text", text: result.stdout || "(no output)" }],
  };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
