import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runZennCommand } from "../../src/zennCli";

describe("runZennCommand integration (real npx zenn)", () => {
  it(
    "initializes a Zenn project and creates an article",
    { timeout: 60_000 },
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
    }
  );
});
