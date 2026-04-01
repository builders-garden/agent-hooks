export interface HookEntry {
  name: string;
  command: string;
  order: number;
  enabled: boolean;
}

export interface HookRunnerConfig {
  "pre-push": HookEntry[];
}

export const DEFAULT_CONFIG: HookRunnerConfig = {
  "pre-push": [],
};

export const GLOBAL_CONFIG_DIR = ".hookrunner";
export const GLOBAL_CONFIG_FILE = "config.json";
export const REPO_CONFIG_FILE = ".hookrunner.json";
