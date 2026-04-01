import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import {
  DEFAULT_CONFIG,
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILE,
  SUPPORTED_HOOK_TYPES,
} from "../types.js";

export interface InitOptions {
  husky: boolean;
}

function baseRefLogic(): { save: string; load: string } {
  // Shared logic: pre-push saves the upstream ref, post-push reads it.
  // Uses repo path hash for per-repo isolation. File is cleaned up after use
  // or if pre-push fails. Stale files (>5 min) are ignored.
  const common = `REPO_HASH=$(git rev-parse --show-toplevel 2>/dev/null | shasum | cut -d' ' -f1)
HOOKRUNNER_BASE_REF_FILE="/tmp/.hookrunner-base-ref-\${REPO_HASH}"`;

  const save = `${common}
git rev-parse @{upstream} 2>/dev/null > "$HOOKRUNNER_BASE_REF_FILE" 2>/dev/null || true`;

  const load = `${common}
if [ -f "$HOOKRUNNER_BASE_REF_FILE" ]; then
  FILE_AGE=$(( $(date +%s) - $(stat -f %m "$HOOKRUNNER_BASE_REF_FILE" 2>/dev/null || stat -c %Y "$HOOKRUNNER_BASE_REF_FILE" 2>/dev/null || echo 0) ))
  if [ "$FILE_AGE" -lt 300 ]; then
    export READMEGUARD_BASE_REF=$(cat "$HOOKRUNNER_BASE_REF_FILE")
  fi
  rm -f "$HOOKRUNNER_BASE_REF_FILE"
fi`;

  return { save, load };
}

function makeHookScript(hookType: string): string {
  const { save, load } = baseRefLogic();

  if (hookType === "pre-push") {
    return `#!/bin/sh
${save}
hookrunner exec pre-push "$@"
RET=$?
if [ $RET -ne 0 ]; then
  rm -f "$HOOKRUNNER_BASE_REF_FILE"
fi
exit $RET
`;
  }
  if (hookType === "post-push") {
    return `#!/bin/sh
${load}
hookrunner exec post-push "$@"
`;
  }
  return `#!/bin/sh\nhookrunner exec ${hookType} "$@"\n`;
}

/**
 * Generate standalone hook scripts for readmeguard (used when hookrunner is not installed).
 * Installs both a pre-push (to capture base ref) and post-push (to run readmeguard).
 */
export function makeStandaloneHookScripts(): { prePush: string; postPush: string } {
  const { save, load } = baseRefLogic();
  return {
    prePush: `#!/bin/sh
${save}
`,
    postPush: `#!/bin/sh
${load}
readmeguard run "$@"
`,
  };
}

export function init(options: InitOptions): void {
  const home = homedir();
  const configDir = join(home, GLOBAL_CONFIG_DIR);
  const configPath = join(configDir, GLOBAL_CONFIG_FILE);

  if (options.husky) {
    // Husky mode: write hooks in .husky/ directory
    const huskyDir = join(process.cwd(), ".husky");
    if (!existsSync(huskyDir)) {
      mkdirSync(huskyDir, { recursive: true });
    }
    for (const hookType of SUPPORTED_HOOK_TYPES) {
      const hookPath = join(huskyDir, hookType);
      writeFileSync(hookPath, makeHookScript(hookType), { mode: 0o755 });
    }
  } else {
    // Global mode: create hooks and set core.hooksPath
    const hooksDir = join(configDir, "hooks");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    for (const hookType of SUPPORTED_HOOK_TYPES) {
      const hookPath = join(hooksDir, hookType);
      writeFileSync(hookPath, makeHookScript(hookType), { mode: 0o755 });
      chmodSync(hookPath, 0o755);
    }

    execSync(`git config --global core.hooksPath ${hooksDir}`);
  }

  // Create config.json with empty arrays if it doesn't exist
  if (!existsSync(configPath)) {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n",
    );
  }
}
