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
    execSync("hookrunner remove readmeguard --type pre-commit");
    console.log("readmeguard: Unregistered from hookrunner.");
    return;
  }

  // Standalone uninstall
  if (opts.husky) {
    const hookPath = join(process.cwd(), ".husky", "pre-commit");
    if (existsSync(hookPath)) {
      unlinkSync(hookPath);
      console.log("readmeguard: Removed .husky/pre-commit hook.");
    }
  } else {
    const hookPath = join(process.cwd(), ".git", "hooks", "pre-commit");
    if (existsSync(hookPath)) {
      unlinkSync(hookPath);
      console.log("readmeguard: Removed .git/hooks/pre-commit hook.");
    }
  }
}
