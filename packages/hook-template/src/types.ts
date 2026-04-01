// CUSTOMIZE: Define your hook's configuration options here.
// These are the settings users can override via env vars, repo config, or global config.

export interface HookTemplateConfig {
  // TODO: Add your config options here
  skipBranches: string[];
  timeout: number;
  failOnError: boolean;
  maxDiffSize: number;
}

export const DEFAULT_CONFIG: HookTemplateConfig = {
  skipBranches: [],
  timeout: 300_000,
  failOnError: false,
  maxDiffSize: 100_000,
};

// CUSTOMIZE: Rename these to match your hook name (e.g., ".my-hook", "my-hook.json")
export const GLOBAL_CONFIG_DIR = ".hook-template";
export const GLOBAL_CONFIG_FILE = "config.json";
export const REPO_CONFIG_FILE = ".hook-template.json";
