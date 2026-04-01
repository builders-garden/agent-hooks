import { execSync } from "node:child_process";

/**
 * Get the diff of unpushed commits compared to the upstream tracking branch.
 * Excludes files matching the given patterns (converted to git pathspecs).
 * Truncates the diff if it exceeds maxDiffSize bytes.
 */
export function getUnpushedDiff(
  exclude: string[],
  maxDiffSize: number,
): { diff: string; branch: string } {
  const branch = getCurrentBranch();
  const upstream = getUpstream();

  // Check if there are unpushed commits
  const log = execSync(`git log ${upstream}..HEAD --oneline`, {
    encoding: "utf-8",
  }).trim();

  if (!log) {
    return { diff: "", branch };
  }

  // Build exclude pathspecs
  const excludeArgs = exclude
    .map((p) => `:(exclude)${p}`)
    .map((spec) => `"${spec}"`)
    .join(" ");

  // Get diff
  let diff = execSync(
    `git diff ${upstream}..HEAD -- . ${excludeArgs}`,
    { encoding: "utf-8", maxBuffer: Math.max(maxDiffSize * 2, 1024 * 1024) },
  );

  // Truncate if needed
  if (Buffer.byteLength(diff) > maxDiffSize) {
    diff = diff.slice(0, maxDiffSize);
  }

  return { diff, branch };
}

/**
 * Get the name of the current git branch.
 */
export function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf-8",
  }).trim();
}

/**
 * Get the upstream tracking branch, falling back to origin/main.
 */
function getUpstream(): string {
  try {
    return execSync("git rev-parse --abbrev-ref @{upstream}", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "origin/main";
  }
}
