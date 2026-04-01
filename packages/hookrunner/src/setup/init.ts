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

function hookScript(hookType: string): string {
  return `#!/bin/sh\nhookrunner exec ${hookType} "$@"\n`;
}

export function init(options: InitOptions): void {
  const home = homedir();
  const configDir = join(home, GLOBAL_CONFIG_DIR);
  const configPath = join(configDir, GLOBAL_CONFIG_FILE);

  if (options.husky) {
    // Husky mode: write hook scripts in .husky/
    const huskyDir = join(process.cwd(), ".husky");
    if (!existsSync(huskyDir)) {
      mkdirSync(huskyDir, { recursive: true });
    }
    for (const hookType of SUPPORTED_HOOK_TYPES) {
      const hookPath = join(huskyDir, hookType);
      writeFileSync(hookPath, hookScript(hookType), { mode: 0o755 });
    }
  } else {
    // Global mode: create ~/.hookrunner/hooks/<type> for each type and set core.hooksPath
    const hooksDir = join(configDir, "hooks");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    for (const hookType of SUPPORTED_HOOK_TYPES) {
      const hookPath = join(hooksDir, hookType);
      writeFileSync(hookPath, hookScript(hookType), { mode: 0o755 });
      chmodSync(hookPath, 0o755);
    }

    execSync(`git config --global core.hooksPath ${hooksDir}`);
  }

  // Create config.json with default config if it doesn't exist
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
