import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { loadConfig } from "./config/loader.js";
import { getUnpushedDiff, getCurrentBranch } from "./git/diff.js";
import { analyze } from "./analysis/analyzer.js";
import {
  showDiff,
  promptUser,
  showUpdateMessage,
  showSkipMessage,
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
    if (config.skipBranches.some((pattern) => matchBranch(branch, pattern))) {
      return 0;
    }
  }

  // Check README exists
  const readmePath = join(process.cwd(), "README.md");
  if (!existsSync(readmePath)) {
    return 0;
  }

  // Get diff
  const { diff } = getUnpushedDiff(config.exclude, config.maxDiffSize);
  if (!diff) {
    return 0;
  }

  // Run analysis
  const currentReadme = readFileSync(readmePath, "utf-8");
  let result;
  try {
    result = analyze(diff, currentReadme, config);
  } catch (err) {
    showWarning(`Analysis failed: ${(err as Error).message}`);
    return config.failOnError ? 1 : 0;
  }

  if (result.decision === "NO_UPDATE") {
    return 0;
  }

  // Handle update
  const updatedReadme = result.updatedReadme!;

  if (config.mode === "auto") {
    writeFileSync(readmePath, updatedReadme);
    execSync("git add README.md");
    execSync('git commit -m "docs: update README"');
    showUpdateMessage();
    return 1; // Block push so user pushes again with README update included
  }

  // Interactive mode
  if (!isTTY()) {
    showWarning("Interactive mode requires a TTY. Skipping README update.");
    return 0;
  }

  showDiff(currentReadme, updatedReadme);
  const choice = await promptUser();

  if (choice === "n") {
    return 0;
  }

  if (choice === "e") {
    // Write proposed README, open in $EDITOR
    writeFileSync(readmePath, updatedReadme);
    const editor = process.env.EDITOR || "vi";
    execSync(`${editor} ${readmePath}`, { stdio: "inherit" });
  } else {
    writeFileSync(readmePath, updatedReadme);
  }

  execSync("git add README.md");
  execSync('git commit -m "docs: update README"');
  showUpdateMessage();
  return 1; // Block push so user pushes again with README update included
}

function matchBranch(branch: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return branch.startsWith(pattern.slice(0, -1));
  }
  return branch === pattern;
}
