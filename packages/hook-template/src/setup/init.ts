import { execSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";

// CUSTOMIZE: Change "hook-template" to your hook's CLI name throughout this file.
const HOOK_NAME = "hook-template";

function isHookrunnerInstalled(): boolean {
  try {
    execSync("hookrunner --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function init(opts: { husky?: boolean }): Promise<void> {
  // CUSTOMIZE: Update the shell command to match your hook's CLI name
  const hookScript = `#!/bin/sh\n${HOOK_NAME} run "$@"\n`;

  // If hookrunner is available, register with it instead of installing standalone
  if (isHookrunnerInstalled()) {
    execSync(`hookrunner add ${HOOK_NAME} --command "${HOOK_NAME} run"`);
    console.log(`${HOOK_NAME}: Registered with hookrunner.`);
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
      console.warn(`${HOOK_NAME}: Warning — existing .husky/pre-push will be overwritten.`);
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log(`${HOOK_NAME}: Installed .husky/pre-push hook.`);
  } else {
    // Local repo install — write to .git/hooks/pre-push
    // (Does NOT use core.hooksPath — that's hookrunner's domain)
    const hooksDir = join(process.cwd(), ".git", "hooks");
    const hookPath = join(hooksDir, "pre-push");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      console.warn(`${HOOK_NAME}: Warning — existing .git/hooks/pre-push will be overwritten.`);
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log(`${HOOK_NAME}: Installed .git/hooks/pre-push hook.`);
  }
}
