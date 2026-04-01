import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  DEFAULT_CONFIG,
  GLOBAL_CONFIG_DIR,
  GLOBAL_CONFIG_FILE,
  REPO_CONFIG_FILE,
  type Provider,
  type ReadmeguardConfig,
} from "../types.js";

export function loadConfig(): ReadmeguardConfig {
  let config: ReadmeguardConfig = { ...DEFAULT_CONFIG };

  // Overlay global (~/.readmeguard/config.json)
  const globalPath = join(homedir(), GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_FILE);
  if (existsSync(globalPath)) {
    const globalConfig = JSON.parse(readFileSync(globalPath, "utf-8"));
    config = { ...config, ...globalConfig };
  }

  // Overlay repo (.readmeguard.json or package.json)
  const repoPath = join(process.cwd(), REPO_CONFIG_FILE);
  const pkgPath = join(process.cwd(), "package.json");
  if (existsSync(repoPath)) {
    const repoConfig = JSON.parse(readFileSync(repoPath, "utf-8"));
    config = { ...config, ...repoConfig };
  } else if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (pkg.readmeguard) {
      config = { ...config, ...pkg.readmeguard };
    }
  }

  // Overlay env vars (highest priority)
  if (process.env.READMEGUARD_PROVIDER) {
    config.provider = process.env.READMEGUARD_PROVIDER as Provider;
  }
  if (process.env.READMEGUARD_MODEL) {
    config.model = process.env.READMEGUARD_MODEL;
  }

  return config;
}
