import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  DEFAULT_CONFIG,
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILE,
  REPO_CONFIG_FILE,
  type HookTemplateConfig,
} from "../types.js";

/**
 * Load configuration with the standard precedence:
 *   env vars > repo config > global config > defaults
 *
 * CUSTOMIZE: Add your own env var overrides at the bottom of this function.
 */
export function loadConfig(): HookTemplateConfig {
  let config: HookTemplateConfig = { ...DEFAULT_CONFIG };

  // 1. Overlay global config (~/.hook-template/config.json)
  // CUSTOMIZE: Update the path after renaming GLOBAL_CONFIG_DIR
  const globalPath = join(homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
  if (existsSync(globalPath)) {
    const globalConfig = JSON.parse(readFileSync(globalPath, "utf-8"));
    config = { ...config, ...globalConfig };
  }

  // 2. Overlay repo-level config (.hook-template.json or package.json key)
  // CUSTOMIZE: Update REPO_CONFIG_FILE and the package.json key after renaming
  const repoPath = join(process.cwd(), REPO_CONFIG_FILE);
  const pkgPath = join(process.cwd(), "package.json");
  if (existsSync(repoPath)) {
    const repoConfig = JSON.parse(readFileSync(repoPath, "utf-8"));
    config = { ...config, ...repoConfig };
  } else if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    // CUSTOMIZE: Change "hook-template" to your hook's package.json key
    if (pkg["hook-template"]) {
      config = { ...config, ...pkg["hook-template"] };
    }
  }

  // 3. Overlay env vars (highest priority)
  // TODO: Add your custom env var overrides here. Examples:
  //
  //   if (process.env.MY_HOOK_TIMEOUT) {
  //     config.timeout = Number(process.env.MY_HOOK_TIMEOUT);
  //   }
  //   if (process.env.MY_HOOK_FAIL_ON_ERROR) {
  //     config.failOnError = process.env.MY_HOOK_FAIL_ON_ERROR === "1";
  //   }

  return config;
}
