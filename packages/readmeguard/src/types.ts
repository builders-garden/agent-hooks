export type Provider = "claude" | "codex";
export type Mode = "auto" | "interactive";

export interface ReadmeguardConfig {
  provider: Provider;
  model?: string;
  mode: Mode;
  exclude: string[];
  skipBranches: string[];
  timeout: number;
  failOnError: boolean;
  customPrompt: string;
  maxDiffSize: number;
}

export const DEFAULT_CONFIG: ReadmeguardConfig = {
  provider: "claude",
  mode: "auto",
  exclude: ["*.lock", "*.min.js", "*.map", "dist/**", "node_modules/**"],
  skipBranches: [],
  timeout: 300_000,
  failOnError: false,
  customPrompt: "",
  maxDiffSize: 100_000,
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  claude: "claude-opus-4-6",
  codex: "gpt-5.3-codex",
};

export interface AnalysisResult {
  decision: "UPDATE" | "NO_UPDATE";
  updatedReadme?: string;
}

export const GLOBAL_CONFIG_DIR = ".readmeguard";
export const GLOBAL_CONFIG_FILE = "config.json";
export const REPO_CONFIG_FILE = ".readmeguard.json";
