import { existsSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { GLOBAL_CONFIG_DIR } from "../types.js";

export interface UninstallOptions {
  husky: boolean;
}

export function uninstall(options: UninstallOptions): void {
  if (options.husky) {
    // Husky mode: remove .husky/pre-push
    const huskyPrePush = join(process.cwd(), ".husky", "pre-push");
    if (existsSync(huskyPrePush)) {
      unlinkSync(huskyPrePush);
    }
  } else {
    // Global mode: unset core.hooksPath and remove hooks directory
    execSync("git config --global --unset core.hooksPath");

    const hooksDir = join(homedir(), GLOBAL_CONFIG_DIR, "hooks");
    if (existsSync(hooksDir)) {
      rmSync(hooksDir, { recursive: true, force: true });
    }
  }
}
