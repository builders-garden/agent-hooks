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
    execSync('hookrunner add readmeguard --command "readmeguard run"');
    console.log("readmeguard: Registered with hookrunner.");
    return;
  }

  // Standalone installation
  if (opts.husky) {
    const huskyDir = join(process.cwd(), ".husky");
    const hookPath = join(huskyDir, "pre-push");
    if (!existsSync(huskyDir)) {
      mkdirSync(huskyDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn("readmeguard: Warning — existing .husky/pre-push will be overwritten.");
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log("readmeguard: Installed .husky/pre-push hook.");
  } else {
    // Local repo install — write to .git/hooks/pre-push
    // (Does NOT use core.hooksPath — that's hookrunner's domain)
    const hooksDir = join(process.cwd(), ".git", "hooks");
    const hookPath = join(hooksDir, "pre-push");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn("readmeguard: Warning — existing .git/hooks/pre-push will be overwritten.");
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log("readmeguard: Installed .git/hooks/pre-push hook.");
  }
}
