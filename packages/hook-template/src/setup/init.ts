import { execSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";

// CUSTOMIZE: Change these to match your hook
const HOOK_NAME = "hook-template";
const HOOK_TYPE = "pre-push"; // CUSTOMIZE: "pre-push", "pre-commit", "commit-msg", etc.

function isHookrunnerInstalled(): boolean {
  try {
    execSync("hookrunner --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function init(opts: { husky?: boolean }): Promise<void> {
  const hookScript = `#!/bin/sh\n${HOOK_NAME} run "$@"\n`;

  // If hookrunner is available, register with it
  if (isHookrunnerInstalled()) {
    execSync(`hookrunner add ${HOOK_NAME} --command "${HOOK_NAME} run" --type ${HOOK_TYPE}`);
    console.log(`${HOOK_NAME}: Registered with hookrunner as ${HOOK_TYPE} hook.`);
    return;
  }

  // Standalone installation
  if (opts.husky) {
    const huskyDir = join(process.cwd(), ".husky");
    const hookPath = join(huskyDir, HOOK_TYPE);
    if (!existsSync(huskyDir)) {
      mkdirSync(huskyDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn(`${HOOK_NAME}: Warning — existing .husky/${HOOK_TYPE} will be overwritten.`);
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log(`${HOOK_NAME}: Installed .husky/${HOOK_TYPE} hook.`);
  } else {
    const hooksDir = join(process.cwd(), ".git", "hooks");
    const hookPath = join(hooksDir, HOOK_TYPE);
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn(`${HOOK_NAME}: Warning — existing .git/hooks/${HOOK_TYPE} will be overwritten.`);
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log(`${HOOK_NAME}: Installed .git/hooks/${HOOK_TYPE} hook.`);
  }
}
