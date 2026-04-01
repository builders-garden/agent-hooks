export interface HookEntry {
  name: string;
  command: string;
  order: number;
  enabled: boolean;
}

export type HookType = "pre-push" | "pre-commit";

export const SUPPORTED_HOOK_TYPES: HookType[] = ["pre-push", "pre-commit"];

export interface HookRunnerConfig {
  "pre-push": HookEntry[];
  "pre-commit": HookEntry[];
}

export const DEFAULT_CONFIG: HookRunnerConfig = {
  "pre-push": [],
  "pre-commit": [],
};

export const GLOBAL_CONFIG_DIR = ".hookrunner";
export const GLOBAL_CONFIG_FILE = "config.json";
export const REPO_CONFIG_FILE = ".hookrunner.json";
