# zenn-cli MCPサーバー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** zenn-cli（`npx zenn ...`）のコマンド群をMCPツールとしてラップするstdio MCPサーバーを実装する。

**Architecture:** TypeScript製のstdio MCPサーバー。`@modelcontextprotocol/sdk` でツールを公開し、各ツールは `child_process.spawn` で `npx zenn <command>` を呼び出す薄いラッパー。対象のZennプロジェクトディレクトリは各ツール呼び出し時の `projectDir` 引数で指定する。`preview` はスコープ外。

**Tech Stack:** TypeScript 7.0.2, Node.js（ESM）, `@modelcontextprotocol/sdk` ^1.30.0, `zod` ^4.4.3, `vitest` ^4.1.10, `tsx` ^4.23.12（開発実行用）

**Spec:** `docs/superpowers/specs/2026-08-15-zenn-cli-mcp-design.md`

## Global Constraints

- パッケージ名: `zenn-mcp`、binコマンド名: `zenn-mcp`
- モジュール形式: ESM（`"type": "module"`）
- 対象zenn-cliコマンドは `init`, `new:article`, `new:book`, `list:articles`, `list:books` の5つのみ。`preview` は実装しない。
- 記事・本のデータはこのリポジトリに置かない。全ツールは呼び出し元が渡す `projectDir`（絶対パス想定）を操作対象とする。
- `list:*` 系コマンドの出力は構造化パースせず、テキストのままMCPツール結果として返す。
- `npx zenn` の実行が非0終了した場合は `isError: true` としてstderrを返す。spawn自体が失敗した場合（npx未インストール等）もエラーとして返す。
- テストは vitest。`node:child_process` の `spawn` はモック化し、実ネットワーク・実npx呼び出しはTask 9の統合テストのみで行う。

---

### Task 1: プロジェクトScaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts`（ビルド確認用の最小スタブ）

**Interfaces:**
- Produces: `npm run build`（tscでdist/へ出力）, `npm test`（vitest run）, `npm run typecheck`（tsc --noEmit）が実行できる状態

- [ ] **Step 1: package.jsonを作成する**

```json
{
  "name": "zenn-mcp",
  "version": "0.1.0",
  "description": "MCP server that wraps the Zenn CLI (npx zenn) for use by MCP clients",
  "license": "MIT",
  "type": "module",
  "bin": {
    "zenn-mcp": "./dist/index.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.30.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^26.2.0",
    "tsx": "^4.23.12",
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: tsconfig.jsonを作成する**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src"]
}
```

- [ ] **Step 3: vitest.config.tsを作成する**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: .gitignoreを作成する**

```
node_modules/
dist/
*.log
```

- [ ] **Step 5: 最小スタブのsrc/index.tsを作成する**

```typescript
console.log("zenn-mcp scaffold");
```

- [ ] **Step 6: 依存関係をインストールする**

Run: `npm install`
Expected: `node_modules/` が生成され、エラーなく終了する

- [ ] **Step 7: ビルドと型チェックを確認する**

Run: `npm run build && npm run typecheck`
Expected: `dist/index.js` が生成され、エラーなく終了する

- [ ] **Step 8: コミット**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/index.ts
git commit -m "chore: scaffold zenn-mcp TypeScript project"
```

---

### Task 2: zennCli.ts — npx zenn 呼び出しの共通ラッパー

**Files:**
- Create: `src/zennCli.ts`
- Test: `test/zennCli.test.ts`

**Interfaces:**
- Consumes: なし（このタスクが最初の実装ユニット）
- Produces（後続タスクが利用する厳密なシグネチャ）:
  - `class ZennCliError extends Error {}`
  - `function validateProjectDir(projectDir: string): void`（存在しなければ `ZennCliError` を投げる）
  - `function validateZennProject(projectDir: string): void`（`validateProjectDir` に加え、`articles/` または `package.json` のどちらも無ければ `ZennCliError` を投げる）
  - `interface RunZennResult { stdout: string; stderr: string; exitCode: number }`
  - `function runZennCommand(projectDir: string, args: string[]): Promise<RunZennResult>`（`spawn("npx", ["zenn", ...args], { cwd: projectDir })` を実行。spawnの`error`イベントは`ZennCliError`でreject）
  - `interface NewArticleOptions { slug?: string; title?: string; type?: "tech" | "idea"; emoji?: string; published?: boolean }`
  - `function buildNewArticleArgs(options: NewArticleOptions): string[]`
  - `interface NewBookOptions { slug?: string }`
  - `function buildNewBookArgs(options: NewBookOptions): string[]`
  - `interface ToolResult { content: { type: "text"; text: string }[]; isError?: boolean }`
  - `function formatZennResult(result: RunZennResult): ToolResult`（`exitCode !== 0` なら `isError: true` でstderr優先）
  - `function errorResult(message: string): ToolResult`（`isError: true` 固定）

- [ ] **Step 1: 失敗するテストを書く（validateProjectDir / validateZennProject）**

`test/zennCli.test.ts` を作成:

```typescript
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ZennCliError,
  validateProjectDir,
  validateZennProject,
} from "../src/zennCli";

describe("validateProjectDir", () => {
  it("throws ZennCliError when the directory does not exist", () => {
    expect(() => validateProjectDir("/nonexistent/path/zenn-mcp-test")).toThrow(
      ZennCliError
    );
  });

  it("does not throw when the directory exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      expect(() => validateProjectDir(dir)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("validateZennProject", () => {
  it("throws ZennCliError when neither articles/ nor package.json exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      expect(() => validateZennProject(dir)).toThrow(ZennCliError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not throw when articles/ exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      mkdirSync(join(dir, "articles"));
      expect(() => validateZennProject(dir)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not throw when package.json exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      writeFileSync(join(dir, "package.json"), "{}");
      expect(() => validateZennProject(dir)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run test/zennCli.test.ts`
Expected: FAIL（`src/zennCli.ts` が存在しない、または対象関数が未定義）

- [ ] **Step 3: validateProjectDir / validateZennProjectを実装する**

`src/zennCli.ts` を作成（このステップでは以下の一部のみ記述）:

```typescript
import { existsSync } from "node:fs";
import { join } from "node:path";

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
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `npx vitest run test/zennCli.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 5: runZennCommandの失敗するテストを追記する**

`test/zennCli.test.ts` に追記:

```typescript
import { EventEmitter } from "node:events";
import { vi, beforeEach, afterEach } from "vitest";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { runZennCommand } from "../src/zennCli";

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe("runZennCommand", () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("resolves with stdout and exitCode 0 on success", async () => {
    const mockChild = createMockChild();
    vi.mocked(spawn).mockReturnValue(mockChild as never);

    const promise = runZennCommand("/tmp/project", ["list:articles"]);
    mockChild.stdout.emit("data", Buffer.from("article1\n"));
    mockChild.emit("close", 0);

    await expect(promise).resolves.toEqual({
      stdout: "article1\n",
      stderr: "",
      exitCode: 0,
    });
    expect(spawn).toHaveBeenCalledWith("npx", ["zenn", "list:articles"], {
      cwd: "/tmp/project",
    });
  });

  it("resolves with stderr and non-zero exitCode on failure", async () => {
    const mockChild = createMockChild();
    vi.mocked(spawn).mockReturnValue(mockChild as never);

    const promise = runZennCommand("/tmp/project", ["init"]);
    mockChild.stderr.emit("data", Buffer.from("boom"));
    mockChild.emit("close", 1);

    await expect(promise).resolves.toEqual({
      stdout: "",
      stderr: "boom",
      exitCode: 1,
    });
  });

  it("rejects with ZennCliError when spawn emits error", async () => {
    const mockChild = createMockChild();
    vi.mocked(spawn).mockReturnValue(mockChild as never);

    const promise = runZennCommand("/tmp/project", ["init"]);
    mockChild.emit("error", new Error("ENOENT"));

    await expect(promise).rejects.toThrow("Failed to spawn npx: ENOENT");
  });
});
```

- [ ] **Step 6: テストを実行して失敗を確認する**

Run: `npx vitest run test/zennCli.test.ts`
Expected: FAIL（`runZennCommand` が未定義）

- [ ] **Step 7: runZennCommandを実装する**

`src/zennCli.ts` に追記:

```typescript
import { spawn } from "node:child_process";

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
```

- [ ] **Step 8: テストを実行して通ることを確認する**

Run: `npx vitest run test/zennCli.test.ts`
Expected: PASS（8 tests）

- [ ] **Step 9: buildNewArticleArgs / buildNewBookArgs / formatZennResult / errorResultの失敗するテストを追記する**

`test/zennCli.test.ts` に追記:

```typescript
import {
  buildNewArticleArgs,
  buildNewBookArgs,
  formatZennResult,
  errorResult,
} from "../src/zennCli";

describe("buildNewArticleArgs", () => {
  it("returns only the base command when no options are given", () => {
    expect(buildNewArticleArgs({})).toEqual(["new:article"]);
  });

  it("includes all provided options in order", () => {
    expect(
      buildNewArticleArgs({
        slug: "my-slug",
        title: "My Title",
        type: "tech",
        emoji: "😸",
        published: true,
      })
    ).toEqual([
      "new:article",
      "--slug",
      "my-slug",
      "--title",
      "My Title",
      "--type",
      "tech",
      "--emoji",
      "😸",
      "--published",
    ]);
  });

  it("omits --published when published is false", () => {
    expect(buildNewArticleArgs({ published: false })).toEqual(["new:article"]);
  });
});

describe("buildNewBookArgs", () => {
  it("returns only the base command when no slug is given", () => {
    expect(buildNewBookArgs({})).toEqual(["new:book"]);
  });

  it("includes --slug when given", () => {
    expect(buildNewBookArgs({ slug: "my-book" })).toEqual([
      "new:book",
      "--slug",
      "my-book",
    ]);
  });
});

describe("formatZennResult", () => {
  it("returns non-error content with stdout on exitCode 0", () => {
    expect(
      formatZennResult({ stdout: "ok\n", stderr: "", exitCode: 0 })
    ).toEqual({ content: [{ type: "text", text: "ok\n" }] });
  });

  it("returns placeholder text when stdout is empty on success", () => {
    expect(
      formatZennResult({ stdout: "", stderr: "", exitCode: 0 })
    ).toEqual({ content: [{ type: "text", text: "(no output)" }] });
  });

  it("returns isError true with stderr on non-zero exitCode", () => {
    expect(
      formatZennResult({ stdout: "", stderr: "boom", exitCode: 1 })
    ).toEqual({ content: [{ type: "text", text: "boom" }], isError: true });
  });

  it("falls back to stdout when stderr is empty on failure", () => {
    expect(
      formatZennResult({ stdout: "partial", stderr: "", exitCode: 1 })
    ).toEqual({
      content: [{ type: "text", text: "partial" }],
      isError: true,
    });
  });
});

describe("errorResult", () => {
  it("wraps a message as an error content result", () => {
    expect(errorResult("bad input")).toEqual({
      content: [{ type: "text", text: "bad input" }],
      isError: true,
    });
  });
});
```

- [ ] **Step 10: テストを実行して失敗を確認する**

Run: `npx vitest run test/zennCli.test.ts`
Expected: FAIL（対象関数が未定義）

- [ ] **Step 11: buildNewArticleArgs / buildNewBookArgs / formatZennResult / errorResultを実装する**

`src/zennCli.ts` に追記:

```typescript
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
```

- [ ] **Step 12: テストを実行して通ることを確認する**

Run: `npx vitest run test/zennCli.test.ts`
Expected: PASS（全17テスト）

- [ ] **Step 13: コミット**

```bash
git add src/zennCli.ts test/zennCli.test.ts
git commit -m "feat: add npx zenn command wrapper (zennCli.ts)"
```

---

### Task 3: zenn_init ツール

**Files:**
- Create: `src/tools/init.ts`
- Test: `test/tools/init.test.ts`

**Interfaces:**
- Consumes: `src/zennCli.ts` の `validateProjectDir`, `runZennCommand`, `formatZennResult`, `errorResult`, `ZennCliError`, `ToolResult`
- Produces:
  - `async function zennInitHandler(args: { projectDir: string }): Promise<ToolResult>`
  - `function registerZennInit(server: McpServer): void`（ツール名 `"zenn_init"` で登録）

- [ ] **Step 1: 失敗するテストを書く**

`test/tools/init.test.ts` を作成:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { zennInitHandler } from "../../src/tools/init";

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe("zennInitHandler", () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("returns an error result when projectDir does not exist", async () => {
    const result = await zennInitHandler({
      projectDir: "/nonexistent/zenn-mcp-init-test",
    });
    expect(result.isError).toBe(true);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("runs `npx zenn init` in projectDir and returns stdout on success", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      const mockChild = createMockChild();
      vi.mocked(spawn).mockReturnValue(mockChild as never);

      const promise = zennInitHandler({ projectDir: dir });
      mockChild.stdout.emit("data", Buffer.from("initialized\n"));
      mockChild.emit("close", 0);

      const result = await promise;
      expect(result).toEqual({
        content: [{ type: "text", text: "initialized\n" }],
      });
      expect(spawn).toHaveBeenCalledWith("npx", ["zenn", "init"], {
        cwd: dir,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run test/tools/init.test.ts`
Expected: FAIL（`src/tools/init.ts` が存在しない）

- [ ] **Step 3: src/tools/init.tsを実装する**

```typescript
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
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `npx vitest run test/tools/init.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: コミット**

```bash
git add src/tools/init.ts test/tools/init.test.ts
git commit -m "feat: add zenn_init MCP tool"
```

---

### Task 4: zenn_new_article ツール

**Files:**
- Create: `src/tools/newArticle.ts`
- Test: `test/tools/newArticle.test.ts`

**Interfaces:**
- Consumes: `src/zennCli.ts` の `validateZennProject`, `runZennCommand`, `buildNewArticleArgs`, `formatZennResult`, `errorResult`, `ZennCliError`, `ToolResult`, `NewArticleOptions`
- Produces:
  - `async function zennNewArticleHandler(args: { projectDir: string } & NewArticleOptions): Promise<ToolResult>`
  - `function registerZennNewArticle(server: McpServer): void`（ツール名 `"zenn_new_article"`）

- [ ] **Step 1: 失敗するテストを書く**

`test/tools/newArticle.test.ts` を作成:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { zennNewArticleHandler } from "../../src/tools/newArticle";

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe("zennNewArticleHandler", () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("returns an error result when projectDir is not a Zenn project", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      const result = await zennNewArticleHandler({ projectDir: dir });
      expect(result.isError).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs `npx zenn new:article` with given options in projectDir", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    mkdirSync(join(dir, "articles"));
    try {
      const mockChild = createMockChild();
      vi.mocked(spawn).mockReturnValue(mockChild as never);

      const promise = zennNewArticleHandler({
        projectDir: dir,
        slug: "my-slug",
        title: "My Title",
        type: "tech",
      });
      mockChild.stdout.emit("data", Buffer.from("created\n"));
      mockChild.emit("close", 0);

      const result = await promise;
      expect(result).toEqual({
        content: [{ type: "text", text: "created\n" }],
      });
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        [
          "zenn",
          "new:article",
          "--slug",
          "my-slug",
          "--title",
          "My Title",
          "--type",
          "tech",
        ],
        { cwd: dir }
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run test/tools/newArticle.test.ts`
Expected: FAIL（`src/tools/newArticle.ts` が存在しない）

- [ ] **Step 3: src/tools/newArticle.tsを実装する**

```typescript
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
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `npx vitest run test/tools/newArticle.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: コミット**

```bash
git add src/tools/newArticle.ts test/tools/newArticle.test.ts
git commit -m "feat: add zenn_new_article MCP tool"
```

---

### Task 5: zenn_new_book ツール

**Files:**
- Create: `src/tools/newBook.ts`
- Test: `test/tools/newBook.test.ts`

**Interfaces:**
- Consumes: `src/zennCli.ts` の `validateZennProject`, `runZennCommand`, `buildNewBookArgs`, `formatZennResult`, `errorResult`, `ZennCliError`, `ToolResult`, `NewBookOptions`
- Produces:
  - `async function zennNewBookHandler(args: { projectDir: string } & NewBookOptions): Promise<ToolResult>`
  - `function registerZennNewBook(server: McpServer): void`（ツール名 `"zenn_new_book"`）

- [ ] **Step 1: 失敗するテストを書く**

`test/tools/newBook.test.ts` を作成:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { zennNewBookHandler } from "../../src/tools/newBook";

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe("zennNewBookHandler", () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("returns an error result when projectDir is not a Zenn project", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      const result = await zennNewBookHandler({ projectDir: dir });
      expect(result.isError).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs `npx zenn new:book` with given slug in projectDir", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    mkdirSync(join(dir, "books"));
    writeFileSync(join(dir, "package.json"), "{}");
    try {
      const mockChild = createMockChild();
      vi.mocked(spawn).mockReturnValue(mockChild as never);

      const promise = zennNewBookHandler({
        projectDir: dir,
        slug: "my-book",
      });
      mockChild.stdout.emit("data", Buffer.from("created\n"));
      mockChild.emit("close", 0);

      const result = await promise;
      expect(result).toEqual({
        content: [{ type: "text", text: "created\n" }],
      });
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["zenn", "new:book", "--slug", "my-book"],
        { cwd: dir }
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

`validateZennProject` は `articles/` または `package.json` の存在で判定するため、`books/` だけでは通らない。上記の通り `package.json` も作成しておく。

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run test/tools/newBook.test.ts`
Expected: FAIL（`src/tools/newBook.ts` が存在しない）

- [ ] **Step 3: src/tools/newBook.tsを実装する**

```typescript
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
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `npx vitest run test/tools/newBook.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: コミット**

```bash
git add src/tools/newBook.ts test/tools/newBook.test.ts
git commit -m "feat: add zenn_new_book MCP tool"
```

---

### Task 6: zenn_list_articles ツール

**Files:**
- Create: `src/tools/listArticles.ts`
- Test: `test/tools/listArticles.test.ts`

**Interfaces:**
- Consumes: `src/zennCli.ts` の `validateZennProject`, `runZennCommand`, `formatZennResult`, `errorResult`, `ZennCliError`, `ToolResult`
- Produces:
  - `async function zennListArticlesHandler(args: { projectDir: string }): Promise<ToolResult>`
  - `function registerZennListArticles(server: McpServer): void`（ツール名 `"zenn_list_articles"`）

- [ ] **Step 1: 失敗するテストを書く**

`test/tools/listArticles.test.ts` を作成:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { zennListArticlesHandler } from "../../src/tools/listArticles";

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe("zennListArticlesHandler", () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("returns an error result when projectDir is not a Zenn project", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      const result = await zennListArticlesHandler({ projectDir: dir });
      expect(result.isError).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs `npx zenn list:articles` in projectDir and returns stdout", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    mkdirSync(join(dir, "articles"));
    try {
      const mockChild = createMockChild();
      vi.mocked(spawn).mockReturnValue(mockChild as never);

      const promise = zennListArticlesHandler({ projectDir: dir });
      mockChild.stdout.emit("data", Buffer.from("slug1\nslug2\n"));
      mockChild.emit("close", 0);

      const result = await promise;
      expect(result).toEqual({
        content: [{ type: "text", text: "slug1\nslug2\n" }],
      });
      expect(spawn).toHaveBeenCalledWith("npx", ["zenn", "list:articles"], {
        cwd: dir,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run test/tools/listArticles.test.ts`
Expected: FAIL（`src/tools/listArticles.ts` が存在しない）

- [ ] **Step 3: src/tools/listArticles.tsを実装する**

```typescript
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
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `npx vitest run test/tools/listArticles.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: コミット**

```bash
git add src/tools/listArticles.ts test/tools/listArticles.test.ts
git commit -m "feat: add zenn_list_articles MCP tool"
```

---

### Task 7: zenn_list_books ツール

**Files:**
- Create: `src/tools/listBooks.ts`
- Test: `test/tools/listBooks.test.ts`

**Interfaces:**
- Consumes: `src/zennCli.ts` の `validateZennProject`, `runZennCommand`, `formatZennResult`, `errorResult`, `ZennCliError`, `ToolResult`
- Produces:
  - `async function zennListBooksHandler(args: { projectDir: string }): Promise<ToolResult>`
  - `function registerZennListBooks(server: McpServer): void`（ツール名 `"zenn_list_books"`）

- [ ] **Step 1: 失敗するテストを書く**

`test/tools/listBooks.test.ts` を作成:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";
import { zennListBooksHandler } from "../../src/tools/listBooks";

function createMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe("zennListBooksHandler", () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("returns an error result when projectDir is not a Zenn project", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    try {
      const result = await zennListBooksHandler({ projectDir: dir });
      expect(result.isError).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs `npx zenn list:books` in projectDir and returns stdout", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-"));
    mkdirSync(join(dir, "articles"));
    try {
      const mockChild = createMockChild();
      vi.mocked(spawn).mockReturnValue(mockChild as never);

      const promise = zennListBooksHandler({ projectDir: dir });
      mockChild.stdout.emit("data", Buffer.from("book1\n"));
      mockChild.emit("close", 0);

      const result = await promise;
      expect(result).toEqual({
        content: [{ type: "text", text: "book1\n" }],
      });
      expect(spawn).toHaveBeenCalledWith("npx", ["zenn", "list:books"], {
        cwd: dir,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run test/tools/listBooks.test.ts`
Expected: FAIL（`src/tools/listBooks.ts` が存在しない）

- [ ] **Step 3: src/tools/listBooks.tsを実装する**

```typescript
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
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `npx vitest run test/tools/listBooks.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 5: コミット**

```bash
git add src/tools/listBooks.ts test/tools/listBooks.test.ts
git commit -m "feat: add zenn_list_books MCP tool"
```

---

### Task 8: index.ts — サーバー起動とツール登録

**Files:**
- Modify: `src/index.ts`（Task 1のスタブを置き換え）
- Create: `README.md`

**Interfaces:**
- Consumes: `registerZennInit`, `registerZennNewArticle`, `registerZennNewBook`, `registerZennListArticles`, `registerZennListBooks`（各 `src/tools/*.ts` から）
- Produces: `zenn-mcp` バイナリ実行時にstdio MCPサーバーとして起動し、5ツールを公開する

- [ ] **Step 1: src/index.tsを実装する**

Task 1のスタブ内容を全て置き換える:

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerZennInit } from "./tools/init.js";
import { registerZennNewArticle } from "./tools/newArticle.js";
import { registerZennNewBook } from "./tools/newBook.js";
import { registerZennListArticles } from "./tools/listArticles.js";
import { registerZennListBooks } from "./tools/listBooks.js";

const server = new McpServer({
  name: "zenn-mcp",
  version: "0.1.0",
});

registerZennInit(server);
registerZennNewArticle(server);
registerZennNewBook(server);
registerZennListArticles(server);
registerZennListBooks(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: ビルドが通ることを確認する**

Run: `npm run build && npm run typecheck`
Expected: エラーなく `dist/index.js` が生成される

- [ ] **Step 3: 全ユニットテストが通ることを確認する**

Run: `npm test`
Expected: PASS（Task 2〜7の全テストが成功する）

- [ ] **Step 4: サーバーがstdioで起動しinitialize要求に応答することを手動確認する**

Run:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-test","version":"0.0.0"}}}' | node dist/index.js
```
Expected: `"result"` を含むJSON-RPCレスポンスが標準出力に1行出力される（プロセスは`tools/list`を待つため終了しないので、Ctrl+Cで止めてよい）

- [ ] **Step 5: README.mdを作成する**

```markdown
# zenn-mcp

[Zenn CLI](https://zenn.dev/zenn/articles/install-zenn-cli) の主要コマンドをMCP（Model Context Protocol）ツールとしてラップするstdio MCPサーバーです。

## 提供ツール

| ツール名 | 対応するzenn-cliコマンド | 引数 |
|---|---|---|
| `zenn_init` | `npx zenn init` | `projectDir` |
| `zenn_new_article` | `npx zenn new:article` | `projectDir`, `slug?`, `title?`, `type?`(`tech`\|`idea`), `emoji?`, `published?` |
| `zenn_new_book` | `npx zenn new:book` | `projectDir`, `slug?` |
| `zenn_list_articles` | `npx zenn list:articles` | `projectDir` |
| `zenn_list_books` | `npx zenn list:books` | `projectDir` |

`projectDir` は操作対象のZennプロジェクトの絶対パスです。このサーバー自体は記事・本のデータを持たず、呼び出し元が指定した任意のディレクトリを操作します。`zenn preview`（ローカルプレビューサーバー）はスコープ外です。

## セットアップ

```bash
npm install
npm run build
```

## MCPクライアントへの登録例

```json
{
  "mcpServers": {
    "zenn-mcp": {
      "command": "node",
      "args": ["/path/to/zenn-mcp/dist/index.js"]
    }
  }
}
```

## 開発

```bash
npm run dev        # tsxで直接起動
npm test           # vitest
npm run typecheck  # tsc --noEmit
```
```

- [ ] **Step 6: コミット**

```bash
git add src/index.ts README.md
git commit -m "feat: wire up zenn-mcp stdio server and register all tools"
```

---

### Task 9: 統合テスト（実npx zenn呼び出し）

**Files:**
- Create: `test/integration/zennCli.integration.test.ts`

**Interfaces:**
- Consumes: `src/zennCli.ts` の `runZennCommand`（モックなしで実際に `npx zenn` を実行する）

- [ ] **Step 1: 実npxを使う統合テストを書く**

`test/integration/zennCli.integration.test.ts` を作成:

```typescript
import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runZennCommand } from "../../src/zennCli";

describe("runZennCommand integration (real npx zenn)", () => {
  it(
    "initializes a Zenn project and creates an article",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "zenn-mcp-integration-"));
      try {
        const initResult = await runZennCommand(dir, ["init"]);
        expect(initResult.exitCode).toBe(0);
        expect(existsSync(join(dir, "articles"))).toBe(true);

        const newArticleResult = await runZennCommand(dir, [
          "new:article",
          "--slug",
          "integration-test-article",
        ]);
        expect(newArticleResult.exitCode).toBe(0);
        expect(
          existsSync(join(dir, "articles", "integration-test-article.md"))
        ).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    { timeout: 60_000 }
  );
});
```

- [ ] **Step 2: 統合テストを実行する**

Run: `npx vitest run test/integration/zennCli.integration.test.ts`
Expected: PASS（ネットワーク経由でzenn-cliを取得できる環境であれば成功する。オフライン/サンドボックス環境では `npx` のフェッチに失敗し得るため、その場合はネットワークアクセス制約による既知の失敗として扱う）

- [ ] **Step 3: vitest.config.tsで通常のユニットテストと統合テストを分離する**

`vitest.config.ts` を以下に更新（既存のincludeに統合テストが混ざらないよう明示）:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

（統合テストは `test/integration/` 配下に既に含まれる形のため、`npm test` で一緒に実行される。CI等でネットワーク不要なユニットテストのみ実行したい場合は `npx vitest run test --exclude test/integration/**` を使う運用とする。）

- [ ] **Step 4: コミット**

```bash
git add test/integration/zennCli.integration.test.ts
git commit -m "test: add integration test for real npx zenn init/new:article"
```
