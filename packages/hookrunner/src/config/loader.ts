import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  HookRunnerConfig,
  HookEntry,
  DEFAULT_CONFIG,
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILE,
  REPO_CONFIG_FILE,
} from "../types.js";

export function mergeConfigs(
  global: HookRunnerConfig,
  repo: HookRunnerConfig | null,
): HookRunnerConfig {
  if (!repo) return global;

  const repoNames = new Set(repo["pre-push"].map((h) => h.name));
  const globalOnly = global["pre-push"].filter((h) => !repoNames.has(h.name));
  const merged = [...repo["pre-push"], ...globalOnly];
  merged.sort((a, b) => a.order - b.order);

  return { "pre-push": merged };
}

export function loadConfig(): HookRunnerConfig {
  const globalPath = join(homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
  const repoPath = join(process.cwd(), REPO_CONFIG_FILE);
  const pkgPath = join(process.cwd(), "package.json");

  let globalConfig: HookRunnerConfig | null = null;
  let repoConfig: HookRunnerConfig | null = null;

  // Load global
  if (existsSync(globalPath)) {
    globalConfig = JSON.parse(readFileSync(globalPath, "utf-8"));
  }

  // Load repo (.hookrunner.json takes priority over package.json)
  if (existsSync(repoPath)) {
    repoConfig = JSON.parse(readFileSync(repoPath, "utf-8"));
  } else if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (pkg.hookrunner) {
      repoConfig = pkg.hookrunner;
    }
  }

  if (!globalConfig && !repoConfig) return { ...DEFAULT_CONFIG };
  if (!globalConfig) return repoConfig!;
  return mergeConfigs(globalConfig, repoConfig);
}

export function loadGlobalConfigOnly(): HookRunnerConfig {
  const globalPath = join(homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
  if (existsSync(globalPath)) {
    return JSON.parse(readFileSync(globalPath, "utf-8"));
  }
  return { "pre-push": [] };
}

export function loadRepoConfig(): HookRunnerConfig {
  const repoPath = join(process.cwd(), REPO_CONFIG_FILE);
  if (existsSync(repoPath)) {
    return JSON.parse(readFileSync(repoPath, "utf-8"));
  }
  return { "pre-push": [] };
}

export function saveGlobalConfig(config: HookRunnerConfig): void {
  const dir = join(homedir(), GLOBAL_CONFIG_DIR);
  const filePath = join(dir, GLOBAL_CONFIG_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n");
}

export function saveRepoConfig(config: HookRunnerConfig): void {
  const filePath = join(process.cwd(), REPO_CONFIG_FILE);
  writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n");
}
