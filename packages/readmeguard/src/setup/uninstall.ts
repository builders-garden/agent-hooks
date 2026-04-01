import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

function isRegisteredWithHookrunner(): boolean {
  try {
    const output = execSync("hookrunner list", { encoding: "utf-8" });
    return output.includes("readmeguard");
  } catch {
    return false;
  }
}

export async function uninstall(opts: { husky?: boolean }): Promise<void> {
  if (isRegisteredWithHookrunner()) {
    execSync("hookrunner remove readmeguard --type post-push");
    console.log("readmeguard: Unregistered from hookrunner.");
    return;
  }

  // Standalone uninstall: remove both pre-push and post-push hooks
  if (opts.husky) {
    for (const hook of ["pre-push", "post-push"]) {
      const hookPath = join(process.cwd(), ".husky", hook);
      if (existsSync(hookPath)) {
        unlinkSync(hookPath);
        console.log(`readmeguard: Removed .husky/${hook} hook.`);
      }
    }
  } else {
    for (const hook of ["pre-push", "post-push"]) {
      const hookPath = join(process.cwd(), ".git", "hooks", hook);
      if (existsSync(hookPath)) {
        unlinkSync(hookPath);
        console.log(`readmeguard: Removed .git/hooks/${hook} hook.`);
      }
    }
  }
}
