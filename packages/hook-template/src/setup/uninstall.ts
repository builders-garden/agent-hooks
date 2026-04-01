import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// CUSTOMIZE: Change "hook-template" to your hook's CLI name throughout this file.
const HOOK_NAME = "hook-template";

function isRegisteredWithHookrunner(): boolean {
  try {
    const output = execSync("hookrunner list", { encoding: "utf-8" });
    return output.includes(HOOK_NAME);
  } catch {
    return false;
  }
}

export async function uninstall(opts: { husky?: boolean }): Promise<void> {
  if (isRegisteredWithHookrunner()) {
    execSync(`hookrunner remove ${HOOK_NAME}`);
    console.log(`${HOOK_NAME}: Unregistered from hookrunner.`);
    return;
  }

  // Standalone uninstall
  if (opts.husky) {
    const hookPath = join(process.cwd(), ".husky", "pre-push");
    if (existsSync(hookPath)) {
      unlinkSync(hookPath);
      console.log(`${HOOK_NAME}: Removed .husky/pre-push hook.`);
    }
  } else {
    const hookPath = join(process.cwd(), ".git", "hooks", "pre-push");
    if (existsSync(hookPath)) {
      unlinkSync(hookPath);
      console.log(`${HOOK_NAME}: Removed .git/hooks/pre-push hook.`);
    }
  }
}
