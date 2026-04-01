import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { getUnpushedDiff, getCurrentBranch } from "../../git/diff.js";

/**
 * Helper: create a bare "remote" repo and a cloned working repo.
 * Returns the working repo path. The remote acts as origin.
 */
function setupRepos(): { workDir: string; remoteDir: string } {
  const base = mkdtempSync(join(tmpdir(), "diff-test-"));
  const remoteDir = join(base, "remote.git");
  const workDir = join(base, "work");

  // Create bare remote
  execSync(`git init --bare "${remoteDir}"`, { encoding: "utf-8" });

  // Clone it to get a working copy with origin set up
  execSync(`git clone "${remoteDir}" "${workDir}"`, { encoding: "utf-8" });

  // Configure user in working copy
  execSync('git config user.email "test@test.com"', { cwd: workDir });
  execSync('git config user.name "Test"', { cwd: workDir });

  // Create an initial commit and push so origin/main exists
  writeFileSync(join(workDir, "README.md"), "# Hello\n");
  execSync("git add . && git commit -m 'initial'", { cwd: workDir });
  execSync("git push origin HEAD", { cwd: workDir });

  return { workDir, remoteDir };
}

describe("git/diff", () => {
  let workDir: string;
  let remoteDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    const repos = setupRepos();
    workDir = repos.workDir;
    remoteDir = repos.remoteDir;
    process.chdir(workDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // Clean up temp dirs
    rmSync(join(workDir, ".."), { recursive: true, force: true });
  });

  describe("getCurrentBranch", () => {
    it("returns the current branch name", () => {
      // The default branch from clone should be main or master
      const branch = getCurrentBranch();
      expect(["main", "master"]).toContain(branch);
    });

    it("returns a new branch name after checkout", () => {
      execSync("git checkout -b feature/test-branch", { cwd: workDir });
      expect(getCurrentBranch()).toBe("feature/test-branch");
    });
  });

  describe("getUnpushedDiff", () => {
    it("returns empty diff when no unpushed commits", () => {
      const result = getUnpushedDiff([], 100_000);
      expect(result.diff).toBe("");
      expect(["main", "master"]).toContain(result.branch);
    });

    it("returns diff of unpushed commits", () => {
      writeFileSync(join(workDir, "newfile.ts"), "export const x = 1;\n");
      execSync("git add . && git commit -m 'add newfile'", { cwd: workDir });

      const result = getUnpushedDiff([], 100_000);
      expect(result.diff).toContain("newfile.ts");
      expect(result.diff).toContain("export const x = 1;");
    });

    it("returns current branch name", () => {
      execSync("git checkout -b feat/my-feature", { cwd: workDir });
      // Need a commit so we have something unpushed (branch has no upstream, falls back to origin/main)
      writeFileSync(join(workDir, "somefile.ts"), "hello\n");
      execSync("git add . && git commit -m 'on feature branch'", {
        cwd: workDir,
      });

      const result = getUnpushedDiff([], 100_000);
      expect(result.branch).toBe("feat/my-feature");
    });

    it("falls back to origin/main when no tracking branch", () => {
      execSync("git checkout -b untracked-branch", { cwd: workDir });
      writeFileSync(join(workDir, "untracked.ts"), "code\n");
      execSync("git add . && git commit -m 'untracked commit'", {
        cwd: workDir,
      });

      // No upstream set for this branch — should fall back to origin/main
      const result = getUnpushedDiff([], 100_000);
      expect(result.diff).toContain("untracked.ts");
    });

    it("applies exclude patterns (filters out specified files)", () => {
      writeFileSync(join(workDir, "code.ts"), "real code\n");
      writeFileSync(join(workDir, "package-lock.json"), "lock content\n");
      execSync("git add . && git commit -m 'add files'", { cwd: workDir });

      const result = getUnpushedDiff(["package-lock.json"], 100_000);
      expect(result.diff).toContain("code.ts");
      expect(result.diff).not.toContain("lock content");
    });

    it("applies glob exclude patterns", () => {
      writeFileSync(join(workDir, "app.ts"), "app code\n");
      writeFileSync(join(workDir, "data.min.js"), "minified\n");
      execSync("git add . && git commit -m 'add files'", { cwd: workDir });

      const result = getUnpushedDiff(["*.min.js"], 100_000);
      expect(result.diff).toContain("app.ts");
      expect(result.diff).not.toContain("minified");
    });

    it("truncates diff to maxDiffSize", () => {
      // Create a file large enough to exceed a small maxDiffSize
      const bigContent = "x".repeat(5000) + "\n";
      writeFileSync(join(workDir, "big.ts"), bigContent);
      execSync("git add . && git commit -m 'add big file'", { cwd: workDir });

      const maxSize = 200;
      const result = getUnpushedDiff([], maxSize);
      expect(Buffer.byteLength(result.diff)).toBeLessThanOrEqual(maxSize);
    });
  });
});
