import { execSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";

function isHookrunnerInstalled(): boolean {
  try {
    execSync("hookrunner --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function init(opts: { husky?: boolean }): Promise<void> {
  const hookScript = '#!/bin/sh\nreadmeguard run "$@"\n';

  if (isHookrunnerInstalled()) {
    execSync('hookrunner add readmeguard --command "readmeguard run" --type post-push');
    console.log("readmeguard: Registered with hookrunner as post-push hook.");
    return;
  }

  // Standalone installation — use post-push hook
  if (opts.husky) {
    const huskyDir = join(process.cwd(), ".husky");
    const hookPath = join(huskyDir, "post-push");
    if (!existsSync(huskyDir)) {
      mkdirSync(huskyDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn("readmeguard: Warning — existing .husky/post-push will be overwritten.");
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log("readmeguard: Installed .husky/post-push hook.");
  } else {
    // Local repo install — write to .git/hooks/post-push
    const hooksDir = join(process.cwd(), ".git", "hooks");
    const hookPath = join(hooksDir, "post-push");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn("readmeguard: Warning — existing .git/hooks/post-push will be overwritten.");
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log("readmeguard: Installed .git/hooks/post-push hook.");
  }
}
