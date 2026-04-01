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
  SUPPORTED_HOOK_TYPES,
  HookType,
} from "../types.js";

/** Ensure a loaded config has all supported hook type keys (deep-copies arrays) */
function normalizeConfig(config: Partial<HookRunnerConfig>): HookRunnerConfig {
  const result: HookRunnerConfig = { "pre-push": [], "post-push": [] };
  for (const hookType of SUPPORTED_HOOK_TYPES) {
    if (Array.isArray(config[hookType])) {
      result[hookType] = [...config[hookType]];
    }
  }
  return result;
}

export function mergeConfigs(
  global: HookRunnerConfig,
  repo: HookRunnerConfig | null,
): HookRunnerConfig {
  if (!repo) return global;

  const result: HookRunnerConfig = { ...DEFAULT_CONFIG };

  for (const hookType of SUPPORTED_HOOK_TYPES) {
    const globalHooks = global[hookType] ?? [];
    const repoHooks = repo[hookType] ?? [];
    const repoNames = new Set(repoHooks.map((h) => h.name));
    const globalOnly = globalHooks.filter((h) => !repoNames.has(h.name));
    const merged = [...repoHooks, ...globalOnly];
    merged.sort((a, b) => a.order - b.order);
    result[hookType] = merged;
  }

  return result;
}

export function loadConfig(): HookRunnerConfig {
  const globalPath = join(homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
  const repoPath = join(process.cwd(), REPO_CONFIG_FILE);
  const pkgPath = join(process.cwd(), "package.json");

  let globalConfig: HookRunnerConfig | null = null;
  let repoConfig: HookRunnerConfig | null = null;

  // Load global
  if (existsSync(globalPath)) {
    globalConfig = normalizeConfig(JSON.parse(readFileSync(globalPath, "utf-8")));
  }

  // Load repo (.hookrunner.json takes priority over package.json)
  if (existsSync(repoPath)) {
    repoConfig = normalizeConfig(JSON.parse(readFileSync(repoPath, "utf-8")));
  } else if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (pkg.hookrunner) {
      repoConfig = normalizeConfig(pkg.hookrunner);
    }
  }

  if (!globalConfig && !repoConfig) return { "pre-push": [], "post-push": [] };
  if (!globalConfig) return repoConfig!;
  return mergeConfigs(globalConfig, repoConfig);
}

export function loadGlobalConfigOnly(): HookRunnerConfig {
  const globalPath = join(homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
  if (existsSync(globalPath)) {
    return normalizeConfig(JSON.parse(readFileSync(globalPath, "utf-8")));
  }
  return { ...DEFAULT_CONFIG };
}

export function loadRepoConfig(): HookRunnerConfig {
  const repoPath = join(process.cwd(), REPO_CONFIG_FILE);
  if (existsSync(repoPath)) {
    return normalizeConfig(JSON.parse(readFileSync(repoPath, "utf-8")));
  }
  return { ...DEFAULT_CONFIG };
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
