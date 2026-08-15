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
