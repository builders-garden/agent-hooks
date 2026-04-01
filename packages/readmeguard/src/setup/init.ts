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
    execSync('hookrunner add readmeguard --command "readmeguard run" --type pre-commit');
    console.log("readmeguard: Registered with hookrunner as pre-commit hook.");
    return;
  }

  // Standalone installation
  if (opts.husky) {
    const huskyDir = join(process.cwd(), ".husky");
    const hookPath = join(huskyDir, "pre-commit");
    if (!existsSync(huskyDir)) {
      mkdirSync(huskyDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn("readmeguard: Warning — existing .husky/pre-commit will be overwritten.");
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log("readmeguard: Installed .husky/pre-commit hook.");
  } else {
    // Local repo install — write to .git/hooks/pre-commit
    // (Does NOT use core.hooksPath — that's hookrunner's domain)
    const hooksDir = join(process.cwd(), ".git", "hooks");
    const hookPath = join(hooksDir, "pre-commit");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn("readmeguard: Warning — existing .git/hooks/pre-commit will be overwritten.");
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log("readmeguard: Installed .git/hooks/pre-commit hook.");
  }
}
