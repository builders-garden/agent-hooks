import { execFileSync, execSync } from "node:child_process";

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

  if (!upstream) {
    // No upstream ref exists (e.g., first push to empty remote) — skip
    return { diff: "", branch };
  }

  // Check if there are unpushed commits
  let log: string;
  try {
    log = execFileSync("git", ["log", `${upstream}..HEAD`, "--oneline"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    // Upstream ref doesn't exist in git history — skip
    return { diff: "", branch };
  }

  if (!log) {
    return { diff: "", branch };
  }

  // Build args with exclude pathspecs (using argument array to avoid injection)
  const pathspecs = ["--", ".", ...exclude.map((p) => `:(exclude)${p}`)];

  // Get diff
  let diff = execFileSync(
    "git",
    ["diff", `${upstream}..HEAD`, ...pathspecs],
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
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf-8",
  }).trim();
}

/**
 * Get the upstream tracking branch, falling back to origin/main.
 */
function getUpstream(): string | null {
  try {
    const upstream = execFileSync(
      "git",
      ["rev-parse", "--abbrev-ref", "@{upstream}"],
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    // Verify the ref actually exists
    execFileSync("git", ["rev-parse", "--verify", upstream], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    return upstream;
  } catch {
    // Try origin/main as fallback
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
