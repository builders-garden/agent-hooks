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
    // Husky mode: remove all hook files from .husky/
    const huskyDir = join(process.cwd(), ".husky");
    for (const hookType of ["pre-push", "pre-commit"]) {
      const hookPath = join(huskyDir, hookType);
      if (existsSync(hookPath)) {
        unlinkSync(hookPath);
      }
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
