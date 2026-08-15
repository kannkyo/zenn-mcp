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
