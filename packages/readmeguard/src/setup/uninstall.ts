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
    execSync("hookrunner remove readmeguard");
    console.log("readmeguard: Unregistered from hookrunner.");
    return;
  }

  // Standalone uninstall
  if (opts.husky) {
    const hookPath = join(process.cwd(), ".husky", "pre-push");
    if (existsSync(hookPath)) {
      unlinkSync(hookPath);
      console.log("readmeguard: Removed .husky/pre-push hook.");
    }
  } else {
    const hookPath = join(process.cwd(), ".git", "hooks", "pre-push");
    if (existsSync(hookPath)) {
      unlinkSync(hookPath);
      console.log("readmeguard: Removed .git/hooks/pre-push hook.");
    }
  }
}
