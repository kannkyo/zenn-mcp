import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ZennCliError,
  validateProjectDir,
  validateZennProject,
} from "../src/zennCli";
import { EventEmitter } from "node:events";

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
