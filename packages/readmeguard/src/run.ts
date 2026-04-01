import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadConfig } from "./config/loader.js";
import { getCurrentBranch } from "./git/diff.js";
import {
  discoverReadmes,
  getChangedFiles,
  groupFilesByReadme,
  getDiffForFiles,
  getUpstream,
} from "./git/readme-discovery.js";
import { analyze } from "./analysis/analyzer.js";
import {
  showDiff,
  promptUser,
  showUpdateMessage,
  showWarning,
  isTTY,
} from "./output/formatter.js";

export interface RunOptions {
  forceInteractive?: boolean;
  ignoreSkipBranches?: boolean;
}

/**
 * Get the ref range to analyze.
 *
 * As a post-push hook, we analyze what was just pushed.
 * We use READMEGUARD_BASE_REF (set by the hook script or hookrunner)
 * or fall back to HEAD~1..HEAD for manual runs.
 *
 * As a fallback for pre-push or manual mode, we diff against upstream.
 */
function getRefRange(): { base: string; head: string } | null {
  // Check if base ref was passed via env (set by post-push hook)
  const baseRef = process.env.READMEGUARD_BASE_REF;
  if (baseRef) {
    return { base: baseRef, head: "HEAD" };
  }

  // Fall back to upstream diff
  const upstream = getUpstream();
  if (!upstream) return null;
  return { base: upstream, head: "HEAD" };
}

export async function run(options: RunOptions = {}): Promise<number> {
  const config = loadConfig();

  if (options.forceInteractive) {
    config.mode = "interactive";
  }

  // Check READMEGUARD_SKIP
  if (process.env.READMEGUARD_SKIP === "1") {
    return 0;
  }

  // Check skipBranches (unless bypassed by update command)
  if (!options.ignoreSkipBranches) {
    const branch = getCurrentBranch();
    if (config.skipBranches.some((pattern) => matchBranch(branch, pattern))) {
      return 0;
    }
  }

  // Get ref range to analyze
  const refRange = getRefRange();
  if (!refRange) {
    return 0;
  }

  // Discover all READMEs in the repo
  const readmes = discoverReadmes();
  if (readmes.length === 0) {
    return 0;
  }

  // Get changed files and group by closest README
  const changedFiles = getChangedFiles(refRange.base, config.exclude);
  if (changedFiles.length === 0) {
    return 0;
  }

  const readmeGroups = groupFilesByReadme(changedFiles, readmes);
  if (readmeGroups.size === 0) {
    return 0;
  }

  process.stderr.write(
    `readmeguard: Analyzing changes across ${readmeGroups.size} README scope(s)...\n`,
  );

  // Analyze each README that has relevant changes
  const updates: Array<{ path: string; content: string }> = [];

  for (const [readmePath, files] of readmeGroups) {
    const fullPath = join(process.cwd(), readmePath);
    const currentReadme = readFileSync(fullPath, "utf-8");
    const scopedDiff = getDiffForFiles(refRange.base, files, config.maxDiffSize);

    if (!scopedDiff) continue;

    process.stderr.write(
      `readmeguard: Checking ${readmePath} (${files.length} changed file(s))...\n`,
    );

    let result;
    try {
      result = analyze(scopedDiff, currentReadme, config, readmePath);
    } catch (err) {
      showWarning(`Analysis failed for ${readmePath}: ${(err as Error).message}`);
      if (config.failOnError) return 1;
      continue;
    }

    if (result.decision === "UPDATE" && result.updatedReadme) {
      updates.push({ path: readmePath, content: result.updatedReadme });
    }
  }

  if (updates.length === 0) {
    process.stderr.write("readmeguard: No README updates needed.\n");
    return 0;
  }

  process.stderr.write(
    `readmeguard: ${updates.length} README(s) to update: ${updates.map((u) => u.path).join(", ")}\n`,
  );

  // Handle updates based on mode
  const updatedPaths = updates.map((u) => u.path);

  if (config.mode === "auto") {
    for (const update of updates) {
      writeFileSync(join(process.cwd(), update.path), update.content);
      execFileSync("git", ["add", update.path]);
    }
    execFileSync("git", ["commit", "-m", "docs: update README(s)", "--", ...updatedPaths]);
    // Auto-push the README update
    try {
      execFileSync("git", ["push"], { stdio: "inherit" });
      process.stderr.write("readmeguard: README(s) updated, committed, and pushed.\n");
    } catch {
      showWarning("README committed but auto-push failed. Run `git push` to push the update.");
    }
    return 0;
  }

  // Interactive mode
  if (!isTTY()) {
    showWarning("Interactive mode requires a TTY. Skipping README update.");
    return 0;
  }

  // Show diff for each update and prompt
  for (const update of updates) {
    const fullPath = join(process.cwd(), update.path);
    const currentContent = readFileSync(fullPath, "utf-8");

    process.stderr.write(`\n--- ${update.path} ---\n`);
    showDiff(currentContent, update.content);

    const choice = await promptUser();

    if (choice === "n") {
      continue;
    }

    if (choice === "e") {
      writeFileSync(fullPath, update.content);
      const editor = process.env.EDITOR || "vi";
      execFileSync(editor, [fullPath], { stdio: "inherit" });
    } else {
      writeFileSync(fullPath, update.content);
    }

    execFileSync("git", ["add", update.path]);
  }

  // Track which paths were actually staged
  const stagedPaths: string[] = [];
  for (const update of updates) {
    const status = execFileSync("git", ["diff", "--cached", "--name-only", "--", update.path], {
      encoding: "utf-8",
    }).trim();
    if (status) stagedPaths.push(update.path);
  }

  if (stagedPaths.length === 0) {
    process.stderr.write("readmeguard: All updates skipped.\n");
    return 0;
  }

  execFileSync("git", ["commit", "-m", "docs: update README(s)", "--", ...stagedPaths]);
  // Auto-push the README update
  try {
    execFileSync("git", ["push"], { stdio: "inherit" });
    process.stderr.write("readmeguard: README(s) updated, committed, and pushed.\n");
  } catch {
    showWarning("README committed but auto-push failed. Run `git push` to push the update.");
  }
  return 0;
}

function matchBranch(branch: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return branch.startsWith(pattern.slice(0, -1));
  }
  return branch === pattern;
}
