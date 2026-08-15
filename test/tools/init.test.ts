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
      expect(spawn).toHaveBeenCalledWith(
        "npx",
        ["--yes", "-p", "zenn-cli", "zenn", "init"],
        {
          cwd: dir,
        }
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
