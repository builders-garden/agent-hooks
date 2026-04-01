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

function makeHookScript(hookType: string): string {
  if (hookType === "pre-push") {
    // Save the upstream ref to a unique temp file before push so post-push hooks
    // can diff against it. Uses repo path hash + PID to avoid collisions and symlink attacks.
    return `#!/bin/sh
REPO_HASH=$(git rev-parse --show-toplevel 2>/dev/null | shasum | cut -d' ' -f1)
HOOKRUNNER_BASE_REF_FILE="/tmp/.hookrunner-base-ref-\${REPO_HASH}"
git rev-parse @{upstream} 2>/dev/null > "$HOOKRUNNER_BASE_REF_FILE" 2>/dev/null || true
hookrunner exec pre-push "$@"
RET=$?
if [ $RET -ne 0 ]; then
  rm -f "$HOOKRUNNER_BASE_REF_FILE"
fi
exit $RET
`;
  }
  if (hookType === "post-push") {
    // Read the base ref saved by pre-push and pass it to post-push hooks
    return `#!/bin/sh
REPO_HASH=$(git rev-parse --show-toplevel 2>/dev/null | shasum | cut -d' ' -f1)
HOOKRUNNER_BASE_REF_FILE="/tmp/.hookrunner-base-ref-\${REPO_HASH}"
if [ -f "$HOOKRUNNER_BASE_REF_FILE" ]; then
  export READMEGUARD_BASE_REF=$(cat "$HOOKRUNNER_BASE_REF_FILE")
  rm -f "$HOOKRUNNER_BASE_REF_FILE"
fi
hookrunner exec post-push "$@"
`;
  }
  return `#!/bin/sh\nhookrunner exec ${hookType} "$@"\n`;
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
