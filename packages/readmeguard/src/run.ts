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
  showWarning,
  isTTY,
} from "./output/formatter.js";

export interface RunOptions {
  forceInteractive?: boolean;
  ignoreSkipBranches?: boolean;
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
    if (!branch) {
      // No HEAD yet (initial commit in a fresh repo) — skip
      return 0;
    }
    if (config.skipBranches.some((pattern) => matchBranch(branch, pattern))) {
      return 0;
    }
  }

  // Find upstream ref
  const upstream = getUpstream();
  if (!upstream) {
    return 0;
  }

  // Discover all READMEs in the repo
  const readmes = discoverReadmes();
  if (readmes.length === 0) {
    return 0;
  }

  // Get changed files and group by closest README
  const changedFiles = getChangedFiles(upstream, config.exclude);
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
    const scopedDiff = getDiffForFiles(upstream, files, config.maxDiffSize);

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

  // Collect paths that should be committed
  const pathsToCommit: string[] = [];

  if (config.mode === "auto") {
    // Auto mode: write all updates, no prompts
    for (const update of updates) {
      writeFileSync(join(process.cwd(), update.path), update.content);
      pathsToCommit.push(update.path);
    }
  } else {
    // Interactive mode
    if (!isTTY()) {
      // No TTY available — fall back to auto mode (agent-friendly)
      process.stderr.write("readmeguard: No TTY detected, applying updates automatically.\n");
      for (const update of updates) {
        writeFileSync(join(process.cwd(), update.path), update.content);
        pathsToCommit.push(update.path);
      }
    } else {
      // TTY available — prompt per README
      for (const update of updates) {
        const fullPath = join(process.cwd(), update.path);
        const currentContent = readFileSync(fullPath, "utf-8");

        process.stderr.write(`\n--- ${update.path} ---\n`);
        showDiff(currentContent, update.content);

        const choice = await promptUser();

        if (choice === "n") continue;

        if (choice === "e") {
          writeFileSync(fullPath, update.content);
          const editor = process.env.EDITOR || "vi";
          execFileSync(editor, [fullPath], { stdio: "inherit" });
        } else {
          writeFileSync(fullPath, update.content);
        }

        pathsToCommit.push(update.path);
      }
    }
  }

  if (pathsToCommit.length === 0) {
    process.stderr.write("readmeguard: All updates skipped.\n");
    return 0;
  }

  // Stage the README updates so they're included in the current commit.
  // As a pre-commit hook, we just add to the index — git will include
  // these in the commit that's about to be created.
  for (const p of pathsToCommit) {
    execFileSync("git", ["add", p]);
  }

  process.stderr.write(
    `readmeguard: README(s) updated and staged: ${pathsToCommit.join(", ")}\n`,
  );

  // Return 0 to let the commit proceed with the README updates included.
  return 0;
}

function matchBranch(branch: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return branch.startsWith(pattern.slice(0, -1));
  }
  return branch === pattern;
}
