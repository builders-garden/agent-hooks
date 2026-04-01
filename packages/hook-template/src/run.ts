import { loadConfig } from "./config/loader.js";
import { getUnpushedDiff, getCurrentBranch } from "./git/diff.js";

// CUSTOMIZE: Change "HOOK_TEMPLATE" to your hook's env var prefix (e.g., "MY_HOOK")
const ENV_PREFIX = "HOOK_TEMPLATE";

/**
 * Main hook execution logic.
 *
 * This is the primary file you'll customize. The structure is:
 *   1. Load config
 *   2. Check skip conditions
 *   3. Get the git diff
 *   4. Run your hook logic
 *   5. Return exit code (0 = allow push, non-zero = block push)
 */
export async function run(): Promise<number> {
  const config = loadConfig();

  // Skip via environment variable (e.g., HOOK_TEMPLATE_SKIP=1 git push)
  // CUSTOMIZE: Update env var name after changing ENV_PREFIX
  if (process.env[`${ENV_PREFIX}_SKIP`] === "1") {
    return 0;
  }

  // Skip certain branches
  const branch = getCurrentBranch();
  if (config.skipBranches.some((pattern) => matchBranch(branch, pattern))) {
    return 0;
  }

  try {
    // Get diff of unpushed commits
    const { diff } = getUnpushedDiff([], config.maxDiffSize);
    if (!diff) {
      return 0;
    }

    // ============================================
    // YOUR HOOK LOGIC GOES HERE
    //
    // You have access to:
    // - diff: string containing the git diff of unpushed commits
    // - branch: current branch name
    // - config: your hook's configuration
    //
    // Return 0 to allow the push, non-zero to block it.
    // ============================================

    // TODO: Replace this placeholder with your actual hook logic.
    // Examples of what you might do:
    //   - Lint the diff for secrets or sensitive data
    //   - Run an AI analysis on the changes
    //   - Validate commit messages
    //   - Check for missing test coverage
    //   - Enforce code style rules

    console.log("hook-template: Hook ran successfully!");
    console.log(`  Branch: ${branch}`);
    console.log(`  Diff size: ${diff.length} bytes`);

    return 0;
  } catch (err) {
    console.error(`hook-template: Error — ${(err as Error).message}`);
    return config.failOnError ? 1 : 0;
  }
}

/**
 * Match a branch name against a pattern.
 * Supports exact matches and trailing wildcard (e.g., "release/*").
 */
function matchBranch(branch: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return branch.startsWith(pattern.slice(0, -1));
  }
  return branch === pattern;
}
