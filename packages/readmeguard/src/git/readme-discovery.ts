import { execFileSync } from "node:child_process";
import { dirname, join, relative } from "node:path";

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
 * Get list of files changed in unpushed commits.
 * Returns paths relative to the repo root.
 */
export function getChangedFiles(upstream: string, exclude: string[]): string[] {
  const pathspecs = ["--", ".", ...exclude.map((p) => `:(exclude)${p}`)];
  const output = execFileSync(
    "git",
    ["diff", "--name-only", `${upstream}..HEAD`, ...pathspecs],
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
 */
export function groupFilesByReadme(
  changedFiles: string[],
  readmes: string[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const file of changedFiles) {
    // Skip README files themselves — they're the target, not the source
    if (file.endsWith("README.md")) continue;

    const readme = findClosestReadme(file, readmes);
    if (!readme) continue;

    const existing = groups.get(readme) ?? [];
    existing.push(file);
    groups.set(readme, existing);
  }

  return groups;
}

/**
 * Get the diff for a specific set of file paths.
 */
export function getDiffForFiles(
  upstream: string,
  files: string[],
  maxDiffSize: number,
): string {
  if (files.length === 0) return "";

  let diff = execFileSync(
    "git",
    ["diff", `${upstream}..HEAD`, "--", ...files],
    { encoding: "utf-8", maxBuffer: Math.max(maxDiffSize * 2, 1024 * 1024) },
  );

  if (Buffer.byteLength(diff) > maxDiffSize) {
    diff = diff.slice(0, maxDiffSize);
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
