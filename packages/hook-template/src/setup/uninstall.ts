import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

// CUSTOMIZE: Change these to match your hook
const HOOK_NAME = "hook-template";
const HOOK_TYPE = "pre-push"; // CUSTOMIZE: must match init.ts

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
    execSync(`hookrunner remove ${HOOK_NAME} --type ${HOOK_TYPE}`);
    console.log(`${HOOK_NAME}: Unregistered from hookrunner.`);
    return;
  }

  // Standalone uninstall
  if (opts.husky) {
    const hookPath = join(process.cwd(), ".husky", HOOK_TYPE);
    if (existsSync(hookPath)) {
      unlinkSync(hookPath);
      console.log(`${HOOK_NAME}: Removed .husky/${HOOK_TYPE} hook.`);
    }
  } else {
    const hookPath = join(process.cwd(), ".git", "hooks", HOOK_TYPE);
    if (existsSync(hookPath)) {
      unlinkSync(hookPath);
      console.log(`${HOOK_NAME}: Removed .git/hooks/${HOOK_TYPE} hook.`);
    }
  }
}
