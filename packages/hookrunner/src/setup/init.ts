import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import {
  DEFAULT_CONFIG,
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILE,
} from "../types.js";

export interface InitOptions {
  husky: boolean;
}

const HOOK_SCRIPT = `#!/bin/sh\nhookrunner exec pre-push "$@"\n`;

export function init(options: InitOptions): void {
  const home = homedir();
  const configDir = join(home, GLOBAL_CONFIG_DIR);
  const configPath = join(configDir, GLOBAL_CONFIG_FILE);

  if (options.husky) {
    // Husky mode: write .husky/pre-push in the current working directory
    const huskyDir = join(process.cwd(), ".husky");
    if (!existsSync(huskyDir)) {
      mkdirSync(huskyDir, { recursive: true });
    }
    const hookPath = join(huskyDir, "pre-push");
    writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });
  } else {
    // Global mode: create ~/.hookrunner/hooks/pre-push and set core.hooksPath
    const hooksDir = join(configDir, "hooks");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    const hookPath = join(hooksDir, "pre-push");
    writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });
    chmodSync(hookPath, 0o755);

    execSync(`git config --global core.hooksPath ${hooksDir}`);
  }

  // Create config.json with empty pre-push array if it doesn't exist
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
