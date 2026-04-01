import { execFileSync } from "node:child_process";
import { dirname } from "node:path";

/**
 * Discover all README.md files tracked by git in the repository.
 * Returns paths relative to the repo root.
 */
export function discoverReadmes(): string[] {
  const output = execFileSync(
    "git",
    ["ls-files", "--full-name", "README.md", "**/README.md"],
    { encoding: "utf-8" },
  ).trim();

  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

/**
 * Get list of files changed since upstream, including staged changes.
 * Uses `git diff --cached` against upstream to capture both committed
 * (unpushed) and staged changes in one pass.
 * Returns paths relative to the repo root.
 */
export function getChangedFiles(upstream: string, exclude: string[]): string[] {
  const pathspecs = ["--", ".", ...exclude.map((p) => `:(exclude)${p}`)];
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", upstream, ...pathspecs],
    { encoding: "utf-8" },
  ).trim();

  if (!output) return [];
  return output.split("\n").filter(Boolean);
}

/**
 * For a given file path, find the closest README.md from the list of known READMEs.
 * Walks up from the file's directory looking for the nearest README.
 *
 * Example:
 *   file: "packages/hookrunner/src/cli.ts"
 *   readmes: ["README.md", "packages/hookrunner/README.md"]
 *   result: "packages/hookrunner/README.md"
 */
export function findClosestReadme(filePath: string, readmes: string[]): string | null {
  // Build a set of readme directories for quick lookup
  const readmeByDir = new Map<string, string>();
  for (const readme of readmes) {
    readmeByDir.set(dirname(readme), readme);
  }

  // Walk up from the file's directory
  let dir = dirname(filePath);
  while (true) {
    const readme = readmeByDir.get(dir);
    if (readme) return readme;

    const parent = dirname(dir);
    if (parent === dir) break; // reached root
    dir = parent;
  }

  return null;
}

/**
 * Group changed files by their closest README.
 * Returns a map: README path → list of changed files in its scope.
 *
 * In a monorepo with nested READMEs, the root README acts as an umbrella
 * overview. When files change under sub-package READMEs, the root README
 * also receives those files so the AI can decide if the overview needs
 * updating (e.g. new features, renamed packages, changed commands).
 */
export function groupFilesByReadme(
  changedFiles: string[],
  readmes: string[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const hasRootReadme = readmes.includes("README.md");

  for (const file of changedFiles) {
    // Skip README files themselves — they're the target, not the source
    if (file.endsWith("README.md")) continue;

    const readme = findClosestReadme(file, readmes);
    if (!readme) continue;

    const existing = groups.get(readme) ?? [];
    existing.push(file);
    groups.set(readme, existing);

    // Also include in root README scope if the file was grouped under
    // a sub-package README — the root overview may need updating too.
    if (hasRootReadme && readme !== "README.md") {
      const rootFiles = groups.get("README.md") ?? [];
      rootFiles.push(file);
      groups.set("README.md", rootFiles);
    }
  }

  return groups;
}

/**
 * Get the diff for a specific set of file paths.
 * Uses `git diff --cached` against upstream to include staged changes.
 */
export function getDiffForFiles(
  upstream: string,
  files: string[],
  maxDiffSize: number,
): string {
  if (files.length === 0) return "";

  let diff = execFileSync(
    "git",
    ["diff", "--cached", upstream, "--", ...files],
    { encoding: "utf-8", maxBuffer: Math.max(maxDiffSize * 2, 1024 * 1024) },
  );

  if (Buffer.byteLength(diff) > maxDiffSize) {
    diff = Buffer.from(diff).subarray(0, maxDiffSize).toString("utf-8");
  }

  return diff;
}

/**
 * Get the upstream ref, or null if none exists.
 */
export function getUpstream(): string | null {
  try {
    const upstream = execFileSync(
      "git",
      ["rev-parse", "--abbrev-ref", "@{upstream}"],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    execFileSync("git", ["rev-parse", "--verify", upstream], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    return upstream;
  } catch {
    try {
      execFileSync("git", ["rev-parse", "--verify", "origin/main"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
      return "origin/main";
    } catch {
      return null;
    }
  }
}
