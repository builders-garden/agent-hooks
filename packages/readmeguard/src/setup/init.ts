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

// Standalone hook scripts: pre-push saves base ref, post-push reads it and runs readmeguard.
// This mirrors what hookrunner does when managing hooks.
const BASE_REF_COMMON = `REPO_HASH=$(git rev-parse --show-toplevel 2>/dev/null | shasum | cut -d' ' -f1)
HOOKRUNNER_BASE_REF_FILE="/tmp/.hookrunner-base-ref-\${REPO_HASH}"`;

const STANDALONE_PRE_PUSH = `#!/bin/sh
${BASE_REF_COMMON}
git rev-parse @{upstream} 2>/dev/null > "$HOOKRUNNER_BASE_REF_FILE" 2>/dev/null || true
`;

const STANDALONE_POST_PUSH = `#!/bin/sh
${BASE_REF_COMMON}
if [ -f "$HOOKRUNNER_BASE_REF_FILE" ]; then
  FILE_AGE=$(( $(date +%s) - $(stat -f %m "$HOOKRUNNER_BASE_REF_FILE" 2>/dev/null || stat -c %Y "$HOOKRUNNER_BASE_REF_FILE" 2>/dev/null || echo 0) ))
  if [ "$FILE_AGE" -lt 300 ]; then
    export READMEGUARD_BASE_REF=$(cat "$HOOKRUNNER_BASE_REF_FILE")
  fi
  rm -f "$HOOKRUNNER_BASE_REF_FILE"
fi
readmeguard run "$@"
`;

function installHookFile(dir: string, name: string, content: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const hookPath = join(dir, name);
  if (existsSync(hookPath)) {
    console.warn(`readmeguard: Warning — existing ${name} will be overwritten.`);
  }
  writeFileSync(hookPath, content);
  chmodSync(hookPath, 0o755);
}

export async function init(opts: { husky?: boolean }): Promise<void> {
  if (isHookrunnerInstalled()) {
    execSync('hookrunner add readmeguard --command "readmeguard run" --type post-push');
    console.log("readmeguard: Registered with hookrunner as post-push hook.");
    return;
  }

  // Standalone: install both pre-push (save base ref) and post-push (run readmeguard)
  if (opts.husky) {
    const huskyDir = join(process.cwd(), ".husky");
    installHookFile(huskyDir, "pre-push", STANDALONE_PRE_PUSH);
    installHookFile(huskyDir, "post-push", STANDALONE_POST_PUSH);
    console.log("readmeguard: Installed .husky/pre-push and .husky/post-push hooks.");
  } else {
    const hooksDir = join(process.cwd(), ".git", "hooks");
    installHookFile(hooksDir, "pre-push", STANDALONE_PRE_PUSH);
    installHookFile(hooksDir, "post-push", STANDALONE_POST_PUSH);
    console.log("readmeguard: Installed .git/hooks/pre-push and .git/hooks/post-push hooks.");
  }
}
