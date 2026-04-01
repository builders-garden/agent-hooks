# Readmeguard & Hookrunner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two npm packages — hookrunner (git hook orchestrator) and readmeguard (AI-powered README updater) — in a TypeScript monorepo.

**Architecture:** Monorepo with npm workspaces under `packages/`. hookrunner owns the git hook and dispatches to registered CLI tools in order. readmeguard shells out to Claude Code or Codex CLI to analyze diffs and update READMEs. readmeguard works standalone or registered with hookrunner.

**Tech Stack:** TypeScript, Node.js >= 22.14.0, tsup (build), vitest (test), commander (CLI)

**Spec:** `docs/superpowers/specs/2026-04-01-readmeguard-hookrunner-design.md`

---

## File Structure

### Root

- `package.json` — npm workspaces root (`"workspaces": ["packages/*"]`)
- `tsconfig.base.json` — shared TypeScript config
- `vitest.config.ts` — root vitest config with projects

### packages/hookrunner/

| File | Responsibility |
|------|---------------|
| `src/types.ts` | TypeScript types (HookEntry, HookRunnerConfig) |
| `src/config/loader.ts` | Load and merge config from repo/global/package.json |
| `src/runner.ts` | Execute hooks sequentially, buffer/replay stdin, handle exit codes |
| `src/setup/init.ts` | Install global hook (core.hooksPath) or Husky hook |
| `src/setup/uninstall.ts` | Remove hook and config |
| `src/cli.ts` | Commander CLI: init, uninstall, add, remove, list, reorder, exec |
| `src/index.ts` | Public API exports |
| `package.json` | Package config with bin entry |
| `tsup.config.ts` | Build config |
| `README.md` | Package docs |

### packages/readmeguard/

| File | Responsibility |
|------|---------------|
| `src/types.ts` | TypeScript types (ReadmeguardConfig, AnalysisResult, Provider) |
| `src/config/loader.ts` | Load config from env/repo/global with defaults |
| `src/git/diff.ts` | Compute unpushed commits diff, apply exclude patterns |
| `src/analysis/providers/claude.ts` | Shell out to `claude` CLI |
| `src/analysis/providers/codex.ts` | Shell out to `codex` CLI |
| `src/analysis/analyzer.ts` | Build prompt, call provider, parse structured response |
| `src/output/formatter.ts` | Terminal output: spinner, diff preview, interactive prompts |
| `src/setup/init.ts` | Detect hookrunner or install standalone hook |
| `src/setup/uninstall.ts` | Unregister from hookrunner or remove standalone hook |
| `src/cli.ts` | Commander CLI: init, uninstall, run, update |
| `src/index.ts` | Public API exports |
| `package.json` | Package config with bin entry |
| `tsup.config.ts` | Build config |
| `README.md` | Package docs |

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `packages/hookrunner/package.json`
- Create: `packages/hookrunner/tsconfig.json`
- Create: `packages/hookrunner/tsup.config.ts`
- Create: `packages/readmeguard/package.json`
- Create: `packages/readmeguard/tsconfig.json`
- Create: `packages/readmeguard/tsup.config.ts`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "agent-automation",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "lint": "eslint packages/*/src/**/*.ts"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
  projects: ["packages/*"],
});
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 5: Create packages/hookrunner/package.json**

```json
{
  "name": "@agent-automation/hookrunner",
  "version": "0.1.0",
  "description": "Git hook orchestrator — manage execution order of multiple pre-push hooks",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "hookrunner": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run"
  },
  "files": ["dist", "bin"],
  "engines": {
    "node": ">=22.14.0"
  },
  "keywords": ["git", "hooks", "pre-push", "orchestrator"],
  "license": "MIT"
}
```

- [ ] **Step 6: Create packages/hookrunner/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Create packages/hookrunner/tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
});
```

Note: Do NOT add a shebang banner here — tsup would apply it to all entry points including `index.ts` (library). Instead, add the shebang directly in `src/cli.ts` as the first line: `#!/usr/bin/env node`. tsup preserves it in the output.

- [ ] **Step 8: Create packages/readmeguard/package.json**

```json
{
  "name": "@agent-automation/readmeguard",
  "version": "0.1.0",
  "description": "Pre-push hook that uses AI to update your README when substantial changes are detected",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "readmeguard": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run"
  },
  "files": ["dist", "bin"],
  "engines": {
    "node": ">=22.14.0"
  },
  "keywords": ["git", "hooks", "pre-push", "readme", "ai", "claude", "codex"],
  "license": "MIT"
}
```

- [ ] **Step 9: Create packages/readmeguard/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 10: Create packages/readmeguard/tsup.config.ts**

Same structure as hookrunner's tsup.config.ts.

- [ ] **Step 11: Install dependencies**

Run from repo root:
```bash
# Dev dependencies (build/test tooling)
npm install -D typescript tsup vitest eslint

# Runtime dependencies for both packages
npm install commander --workspace=packages/hookrunner --workspace=packages/readmeguard
```

- [ ] **Step 12: Verify build scaffolding**

Create minimal placeholder files so the build works:
- `packages/hookrunner/src/index.ts` → `export {};`
- `packages/hookrunner/src/cli.ts` → `#!/usr/bin/env node\nconsole.log("hookrunner");`
- `packages/readmeguard/src/index.ts` → `export {};`
- `packages/readmeguard/src/cli.ts` → `#!/usr/bin/env node\nconsole.log("readmeguard");`

Run: `npm run build`
Expected: builds succeed, `dist/` directories created in both packages.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with hookrunner and readmeguard packages"
```

---

## Task 2: hookrunner — Types & Config Loader

**Files:**
- Create: `packages/hookrunner/src/types.ts`
- Create: `packages/hookrunner/src/config/loader.ts`
- Test: `packages/hookrunner/src/__tests__/config/loader.test.ts`

- [ ] **Step 1: Write types.ts**

```typescript
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
```

- [ ] **Step 2: Write failing tests for config loader**

```typescript
// packages/hookrunner/src/__tests__/config/loader.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfig, mergeConfigs } from "../../config/loader.js";

describe("mergeConfigs", () => {
  it("returns global config when no repo config exists", () => {
    // ...
  });

  it("repo hooks override global hooks with same name", () => {
    // ...
  });

  it("includes global-only hooks alongside repo hooks", () => {
    // ...
  });
});

describe("loadConfig", () => {
  it("returns default config when no config files exist", () => {
    // ...
  });

  it("loads from .hookrunner.json in repo root", () => {
    // ...
  });

  it("loads from package.json hookrunner key", () => {
    // ...
  });
});
```

Write complete test implementations using `vi.mock` for `fs` and `path` operations. Use a temporary directory for file-based tests.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run packages/hookrunner/src/__tests__/config/loader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement config/loader.ts**

```typescript
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
  return { ...DEFAULT_CONFIG };
}

export function loadRepoConfig(): HookRunnerConfig {
  const repoPath = join(process.cwd(), REPO_CONFIG_FILE);
  if (existsSync(repoPath)) {
    return JSON.parse(readFileSync(repoPath, "utf-8"));
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/hookrunner/src/__tests__/config/loader.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/hookrunner/src/types.ts packages/hookrunner/src/config/ packages/hookrunner/src/__tests__/
git commit -m "feat(hookrunner): add types and config loader with merge strategy"
```

---

## Task 3: hookrunner — Runner (exec command)

**Files:**
- Create: `packages/hookrunner/src/runner.ts`
- Test: `packages/hookrunner/src/__tests__/runner.test.ts`

- [ ] **Step 1: Write failing tests for runner**

Test cases:
- Runs hooks in order, returns success when all exit 0
- Stops on first non-zero exit, returns that exit code
- Skips disabled hooks
- Passes buffered stdin to each hook subprocess
- Returns success immediately when no hooks registered

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/hookrunner/src/__tests__/runner.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement runner.ts**

```typescript
import { spawnSync } from "node:child_process";
import { HookEntry } from "./types.js";

export function runHooks(
  hooks: HookEntry[],
  stdinBuffer: Buffer,
  args: string[],
): { exitCode: number; failedHook?: string } {
  const enabled = hooks
    .filter((h) => h.enabled)
    .sort((a, b) => a.order - b.order);

  for (const hook of enabled) {
    const [cmd, ...cmdArgs] = hook.command.split(" ");
    const result = spawnSync(cmd, [...cmdArgs, ...args], {
      input: stdinBuffer,
      stdio: ["pipe", "inherit", "inherit"],
      timeout: 300_000,
    });

    if (result.status !== 0) {
      return { exitCode: result.status ?? 1, failedHook: hook.name };
    }
  }

  return { exitCode: 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/hookrunner/src/__tests__/runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/hookrunner/src/runner.ts packages/hookrunner/src/__tests__/runner.test.ts
git commit -m "feat(hookrunner): add hook runner with stdin buffering and sequential execution"
```

---

## Task 4: hookrunner — Setup (init/uninstall)

**Files:**
- Create: `packages/hookrunner/src/setup/init.ts`
- Create: `packages/hookrunner/src/setup/uninstall.ts`
- Test: `packages/hookrunner/src/__tests__/setup/init.test.ts`
- Test: `packages/hookrunner/src/__tests__/setup/uninstall.test.ts`

- [ ] **Step 1: Write failing tests for init**

Test cases:
- Global init: creates `~/.hookrunner/hooks/pre-push` script, sets `core.hooksPath`
- Husky init: creates `.husky/pre-push` script
- Chains existing local hooks if found (`.git/hooks/pre-push`, `.husky/pre-push`)

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement init.ts**

The init function should:
1. Accept `--husky` flag
2. If global: create `~/.hookrunner/hooks/` dir, write `pre-push` script, run `git config --global core.hooksPath ~/.hookrunner/hooks`
3. If husky: write `.husky/pre-push` with `hookrunner exec pre-push "$@"`
4. Create `~/.hookrunner/config.json` with empty pre-push array if it doesn't exist

- [ ] **Step 4: Write failing tests for uninstall**

Test cases:
- Removes `core.hooksPath` global git config
- Removes `~/.hookrunner/hooks/` directory
- Removes `.husky/pre-push` in husky mode

- [ ] **Step 5: Implement uninstall.ts**

- [ ] **Step 6: Run all tests to verify they pass**

Run: `npx vitest run packages/hookrunner/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/hookrunner/src/setup/ packages/hookrunner/src/__tests__/setup/
git commit -m "feat(hookrunner): add init and uninstall for global and husky modes"
```

---

## Task 5: hookrunner — CLI

**Files:**
- Modify: `packages/hookrunner/src/cli.ts`
- Test: `packages/hookrunner/src/__tests__/cli.test.ts`

- [ ] **Step 1: Write failing tests for CLI commands**

Test cases for `add`, `remove`, `list`, `reorder`:
- `add` appends a hook entry to config, auto-assigns order if not specified
- `add` with `--order` sets explicit order
- `remove` deletes hook by name
- `list` outputs registered hooks in order
- `reorder` changes a hook's order
- `exec pre-push` calls `runHooks` with loaded config and buffered stdin

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement cli.ts**

Use `commander` to define the CLI:

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig, saveGlobalConfig } from "./config/loader.js";
import { runHooks } from "./runner.js";
import { init } from "./setup/init.js";
import { uninstall } from "./setup/uninstall.js";

const program = new Command();

program.name("hookrunner").description("Git hook orchestrator").version("0.1.0");

program
  .command("init")
  .option("--husky", "Install via Husky")
  .action(async (opts) => { await init(opts); });

program
  .command("uninstall")
  .action(async () => { await uninstall(); });

// add/remove/reorder modify the global config (~/.hookrunner/config.json) by default.
// Use --local to modify the repo-level config (.hookrunner.json) instead.

program
  .command("add <name>")
  .requiredOption("--command <cmd>", "Command to execute")
  .option("--order <n>", "Execution order", parseInt)
  .option("--local", "Modify repo-level config instead of global")
  .action(async (name, opts) => {
    const config = opts.local ? loadRepoConfig() : loadGlobalConfigOnly();
    const hooks = config["pre-push"];
    const order = opts.order ?? (hooks.length > 0 ? Math.max(...hooks.map(h => h.order)) + 1 : 1);
    hooks.push({ name, command: opts.command, order, enabled: true });
    opts.local ? saveRepoConfig(config) : saveGlobalConfig(config);
    console.log(`Added ${name} (order: ${order})`);
  });

program
  .command("remove <name>")
  .option("--local", "Modify repo-level config instead of global")
  .action(async (name, opts) => {
    const config = opts.local ? loadRepoConfig() : loadGlobalConfigOnly();
    config["pre-push"] = config["pre-push"].filter(h => h.name !== name);
    opts.local ? saveRepoConfig(config) : saveGlobalConfig(config);
    console.log(`Removed ${name}`);
  });

program
  .command("list")
  .action(async () => {
    const config = loadConfig(); // merged view
    const hooks = config["pre-push"].sort((a, b) => a.order - b.order);
    if (hooks.length === 0) { console.log("No hooks registered."); return; }
    for (const h of hooks) {
      const status = h.enabled ? "enabled" : "disabled";
      console.log(`  ${h.order}. ${h.name} → ${h.command} (${status})`);
    }
  });

program
  .command("reorder <name>")
  .requiredOption("--order <n>", "New execution order", parseInt)
  .option("--local", "Modify repo-level config instead of global")
  .action(async (name, opts) => {
    const config = opts.local ? loadRepoConfig() : loadGlobalConfigOnly();
    const hook = config["pre-push"].find(h => h.name === name);
    if (!hook) { console.error(`Hook "${name}" not found.`); process.exit(1); }
    hook.order = opts.order;
    opts.local ? saveRepoConfig(config) : saveGlobalConfig(config);
    console.log(`Reordered ${name} to position ${opts.order}`);
  });

program
  .command("exec <hook-type>")
  .allowUnknownOption()
  .passThroughOptions()
  .action(async (hookType, _opts, cmd) => {
    const config = loadConfig();
    const hooks = config[hookType as keyof typeof config] ?? [];
    const stdinBuffer = await readStdin();
    const result = runHooks(hooks, stdinBuffer, cmd.args.slice(1));
    process.exit(result.exitCode);
  });

program.parse();
```

Implement `readStdin()` helper:

```typescript
async function readStdin(): Promise<Buffer> {
  if (process.stdin.isTTY) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Build and verify CLI works**

```bash
npm run build --workspace=packages/hookrunner
node packages/hookrunner/dist/cli.js --help
```

Expected: help text showing all commands.

- [ ] **Step 6: Commit**

```bash
git add packages/hookrunner/src/cli.ts packages/hookrunner/src/__tests__/cli.test.ts
git commit -m "feat(hookrunner): add CLI with init, add, remove, list, reorder, exec commands"
```

---

## Task 6: hookrunner — Update index.ts & README

**Files:**
- Modify: `packages/hookrunner/src/index.ts`
- Create: `packages/hookrunner/README.md`

- [ ] **Step 1: Update index.ts with public exports**

```typescript
export { loadConfig, mergeConfigs, saveGlobalConfig } from "./config/loader.js";
export { runHooks } from "./runner.js";
export { init } from "./setup/init.js";
export { uninstall } from "./setup/uninstall.js";
export type { HookEntry, HookRunnerConfig } from "./types.js";
```

- [ ] **Step 2: Write README.md**

Include: description, install instructions (global + husky), CLI usage, config format, usage with pushguard example.

- [ ] **Step 3: Build and run full test suite**

```bash
npm run build --workspace=packages/hookrunner
npx vitest run packages/hookrunner/
```

Expected: all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/hookrunner/
git commit -m "feat(hookrunner): finalize public API and add README"
```

---

## Task 7: readmeguard — Types & Config Loader

**Files:**
- Create: `packages/readmeguard/src/types.ts`
- Create: `packages/readmeguard/src/config/loader.ts`
- Test: `packages/readmeguard/src/__tests__/config/loader.test.ts`

- [ ] **Step 1: Write types.ts**

```typescript
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
  mode: "interactive",
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
```

- [ ] **Step 2: Write failing tests for config loader**

Test cases:
- Returns defaults when no config exists
- Env vars override everything (READMEGUARD_PROVIDER, READMEGUARD_MODEL, READMEGUARD_SKIP)
- `.readmeguard.json` overrides global config
- `package.json` readmeguard key is used as fallback
- Partial config merges with defaults (e.g. only `mode` specified keeps other defaults)

- [ ] **Step 3: Run tests to verify they fail**

- [ ] **Step 4: Implement config/loader.ts**

Same pattern as hookrunner's loader but with env var overrides at the top. Config files are deep-merged with defaults (not replaced).

```typescript
export function loadConfig(): ReadmeguardConfig {
  // 1. Start with defaults
  // 2. Merge global config
  // 3. Merge repo config (.readmeguard.json or package.json key)
  // 4. Apply env var overrides (READMEGUARD_PROVIDER, READMEGUARD_MODEL)
  // Return merged config
}
```

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/readmeguard/src/types.ts packages/readmeguard/src/config/ packages/readmeguard/src/__tests__/
git commit -m "feat(readmeguard): add types and config loader with env var overrides"
```

---

## Task 8: readmeguard — Git Diff Module

**Files:**
- Create: `packages/readmeguard/src/git/diff.ts`
- Test: `packages/readmeguard/src/__tests__/git/diff.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
- Returns diff of unpushed commits against remote tracking branch
- Falls back to `origin/main` when no tracking branch
- Applies exclude patterns (filters out `*.lock` files etc.)
- Returns empty string when no unpushed commits
- Truncates diff to maxDiffSize
- Returns current branch name

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement git/diff.ts**

Uses `execSync` to run git commands:
- `git rev-parse --abbrev-ref @{upstream}` to find tracking branch (fallback: `origin/main`)
- `git log <upstream>..HEAD --oneline` to check for unpushed commits
- `git diff <upstream>..HEAD -- . <exclude patterns>` to get the diff
- Exclude patterns converted to git pathspec: `:(exclude)*.lock`

```typescript
import { execSync } from "node:child_process";

export function getUnpushedDiff(
  exclude: string[],
  maxDiffSize: number,
): { diff: string; branch: string } {
  // ...
}

export function getCurrentBranch(): string {
  return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/readmeguard/src/git/ packages/readmeguard/src/__tests__/git/
git commit -m "feat(readmeguard): add git diff module with exclude patterns and truncation"
```

---

## Task 9: readmeguard — AI Providers

**Files:**
- Create: `packages/readmeguard/src/analysis/providers/claude.ts`
- Create: `packages/readmeguard/src/analysis/providers/codex.ts`
- Test: `packages/readmeguard/src/__tests__/analysis/providers/claude.test.ts`
- Test: `packages/readmeguard/src/__tests__/analysis/providers/codex.test.ts`

- [ ] **Step 1: Write failing tests for Claude provider**

Test cases:
- Calls `claude --print --model <model>` with prompt on stdin
- Returns stdout as string
- Throws on non-zero exit code
- Throws on timeout
- Throws if `claude` not found in PATH

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement claude.ts**

```typescript
import { execSync } from "node:child_process";

export interface ProviderOptions {
  model: string;
  timeout: number;
}

export function callClaude(prompt: string, options: ProviderOptions): string {
  const result = execSync(
    `claude --print --model ${options.model}`,
    {
      input: prompt,
      encoding: "utf-8",
      timeout: options.timeout,
      maxBuffer: 1024 * 1024 * 10,
    },
  );
  return result;
}
```

- [ ] **Step 4: Write failing tests for Codex provider**

Same test pattern as Claude but with `codex` CLI. Note: exact flags need verification. Implement with best-guess flags and document as needing verification.

- [ ] **Step 5: Implement codex.ts**

Same pattern as claude.ts but calling `codex` CLI.

- [ ] **Step 6: Run all provider tests**

Run: `npx vitest run packages/readmeguard/src/__tests__/analysis/providers/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/readmeguard/src/analysis/providers/ packages/readmeguard/src/__tests__/analysis/providers/
git commit -m "feat(readmeguard): add Claude and Codex CLI provider modules"
```

---

## Task 10: readmeguard — Analyzer

**Files:**
- Create: `packages/readmeguard/src/analysis/analyzer.ts`
- Test: `packages/readmeguard/src/__tests__/analysis/analyzer.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
- Builds correct prompt with diff, current README, and customPrompt
- Parses `DECISION: NO_UPDATE` response correctly
- Parses `DECISION: UPDATE` response and extracts README content after `---` separator
- Uses correct provider based on config
- Returns AnalysisResult type

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement analyzer.ts**

```typescript
import { ReadmeguardConfig, AnalysisResult, DEFAULT_MODELS } from "../types.js";
import { callClaude } from "./providers/claude.js";
import { callCodex } from "./providers/codex.js";

export function buildPrompt(diff: string, currentReadme: string, customPrompt: string): string {
  return `You are analyzing a git diff to decide if a project README needs updating.

## Current README
${currentReadme}

## Git Diff
${diff}

## Instructions
Analyze the diff. If the changes are substantial (new features, API changes, behavior changes, new configuration options), return an updated README. If the changes are minor (internal refactors, bug fixes, single function additions, test changes), return NO_UPDATE.

${customPrompt ? `## Additional Instructions\n${customPrompt}\n` : ""}
## Response Format
Respond with EXACTLY one of these formats:

DECISION: NO_UPDATE

OR

DECISION: UPDATE
---
<the full updated README content>`;
}

export function parseResponse(response: string): AnalysisResult {
  const trimmed = response.trim();
  if (trimmed.startsWith("DECISION: NO_UPDATE")) {
    return { decision: "NO_UPDATE" };
  }
  if (!trimmed.startsWith("DECISION: UPDATE")) {
    // Malformed response — treat as no update but log warning
    process.stderr.write("readmeguard: warning: could not parse AI response, skipping update\n");
    return { decision: "NO_UPDATE" };
  }
  const separatorIndex = trimmed.indexOf("\n---\n");
  if (separatorIndex === -1) {
    process.stderr.write("readmeguard: warning: AI returned UPDATE but no README content found\n");
    return { decision: "NO_UPDATE" };
  }
  const readme = trimmed.slice(separatorIndex + 5).trim();
  return { decision: "UPDATE", updatedReadme: readme };
}

export function analyze(
  diff: string,
  currentReadme: string,
  config: ReadmeguardConfig,
): AnalysisResult {
  const prompt = buildPrompt(diff, currentReadme, config.customPrompt);
  const model = config.model ?? DEFAULT_MODELS[config.provider];
  const options = { model, timeout: config.timeout };

  const call = config.provider === "claude" ? callClaude : callCodex;
  const response = call(prompt, options);
  return parseResponse(response);
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/readmeguard/src/analysis/analyzer.ts packages/readmeguard/src/__tests__/analysis/analyzer.test.ts
git commit -m "feat(readmeguard): add analyzer with prompt building and response parsing"
```

---

## Task 11: readmeguard — Output Formatter

**Files:**
- Create: `packages/readmeguard/src/output/formatter.ts`
- Test: `packages/readmeguard/src/__tests__/output/formatter.test.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
- `showDiff` outputs a readable diff between old and new README
- `promptUser` returns user's choice (Y/n/e)
- `showSkipMessage` outputs skip reason
- `showUpdateMessage` outputs the "push again" message
- `isTTY` correctly detects terminal

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement formatter.ts**

```typescript
import { createInterface } from "node:readline";
import { diffLines } from "diff"; // Add 'diff' as dependency

export function showDiff(oldContent: string, newContent: string): void {
  const changes = diffLines(oldContent, newContent);
  for (const change of changes) {
    if (change.added) {
      process.stderr.write(`\x1b[32m+ ${change.value}\x1b[0m`);
    } else if (change.removed) {
      process.stderr.write(`\x1b[31m- ${change.value}\x1b[0m`);
    }
  }
}

export function isTTY(): boolean {
  return process.stdin.isTTY === true;
}

export async function promptUser(): Promise<"Y" | "n" | "e"> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(
      "\nreadmeguard: Apply README update? [Y] Apply & push again  [n] Skip  [e] Edit first: ",
      (answer) => {
        rl.close();
        const choice = answer.trim().toLowerCase();
        if (choice === "n") resolve("n");
        else if (choice === "e") resolve("e");
        else resolve("Y");
      },
    );
  });
}

export function showUpdateMessage(): void {
  process.stderr.write(
    "\nreadmeguard: README updated and committed. Run `git push` again to include the update.\n",
  );
}

export function showSkipMessage(reason: string): void {
  process.stderr.write(`readmeguard: Skipping — ${reason}\n`);
}

export function showWarning(message: string): void {
  process.stderr.write(`readmeguard: ⚠ ${message}\n`);
}
```

Note: Add `diff` package as a dependency: `npm install diff --workspace=packages/readmeguard` and `npm install -D @types/diff --workspace=packages/readmeguard`.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/readmeguard/src/output/ packages/readmeguard/src/__tests__/output/
git commit -m "feat(readmeguard): add output formatter with diff display and interactive prompts"
```

---

## Task 12: readmeguard — Setup (init/uninstall)

**Files:**
- Create: `packages/readmeguard/src/setup/init.ts`
- Create: `packages/readmeguard/src/setup/uninstall.ts`
- Test: `packages/readmeguard/src/__tests__/setup/init.test.ts`
- Test: `packages/readmeguard/src/__tests__/setup/uninstall.test.ts`

- [ ] **Step 1: Write failing tests for init**

Test cases:
- Detects hookrunner in PATH → calls `hookrunner add readmeguard --command "readmeguard run"`
- No hookrunner, no existing hook → installs standalone pre-push hook
- No hookrunner, existing hook found → warns and asks to overwrite
- Husky mode → creates `.husky/pre-push`

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement init.ts**

```typescript
import { execSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function isHookrunnerInstalled(): boolean {
  try {
    execSync("hookrunner --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function init(opts: { husky?: boolean }): Promise<void> {
  if (isHookrunnerInstalled()) {
    execSync('hookrunner add readmeguard --command "readmeguard run"');
    console.log("readmeguard: Registered with hookrunner.");
    return;
  }

  // Standalone installation
  const hookScript = '#!/bin/sh\nreadmeguard run "$@"\n';

  if (opts.husky) {
    const huskyDir = join(process.cwd(), ".husky");
    const hookPath = join(huskyDir, "pre-push");
    if (existsSync(hookPath)) {
      // Warn and prompt to overwrite
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log("readmeguard: Installed .husky/pre-push hook.");
  } else {
    // Local repo install — write to .git/hooks/pre-push
    // (Does NOT use core.hooksPath — that's hookrunner's domain)
    const hooksDir = join(process.cwd(), ".git", "hooks");
    const hookPath = join(hooksDir, "pre-push");
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    if (existsSync(hookPath)) {
      // Warn and prompt to overwrite
    }
    writeFileSync(hookPath, hookScript);
    chmodSync(hookPath, 0o755);
    console.log("readmeguard: Installed .git/hooks/pre-push hook.");
  }
}
```

- [ ] **Step 4: Write failing tests for uninstall**

Test cases:
- Registered with hookrunner → calls `hookrunner remove readmeguard`
- Standalone → removes hook and git config

- [ ] **Step 5: Implement uninstall.ts**

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Commit**

```bash
git add packages/readmeguard/src/setup/ packages/readmeguard/src/__tests__/setup/
git commit -m "feat(readmeguard): add init and uninstall with hookrunner detection"
```

---

## Task 13: readmeguard — CLI & Main Run Logic

**Files:**
- Modify: `packages/readmeguard/src/cli.ts`
- Create: `packages/readmeguard/src/run.ts` (extracted run logic for testability)
- Test: `packages/readmeguard/src/__tests__/run.test.ts`

- [ ] **Step 1: Write failing tests for the run command**

Test cases:
- Skips when READMEGUARD_SKIP=1
- Skips when current branch matches skipBranches
- Skips when no README.md exists
- Skips when no unpushed commits (empty diff)
- Calls analyzer with diff + README, returns 0 when NO_UPDATE
- Auto mode: writes README, commits, returns 1 with message
- Interactive mode: shows diff, prompts user, handles Y/n/e
- Interactive mode on non-TTY: skips with warning, returns 0
- Handles AI errors gracefully (fail-open unless failOnError)

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement run.ts**

```typescript
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { loadConfig } from "./config/loader.js";
import { getUnpushedDiff, getCurrentBranch } from "./git/diff.js";
import { analyze } from "./analysis/analyzer.js";
import {
  showDiff,
  promptUser,
  showUpdateMessage,
  showSkipMessage,
  showWarning,
  isTTY,
} from "./output/formatter.js";

export interface RunOptions {
  forceInteractive?: boolean;
  ignoreSkipBranches?: boolean;
}

export async function run(options: RunOptions = {}): Promise<number> {
  const config = loadConfig();

  if (options.forceInteractive) {
    config.mode = "interactive";
  }

  // Check READMEGUARD_SKIP
  if (process.env.READMEGUARD_SKIP === "1") {
    return 0;
  }

  // Check skipBranches (unless bypassed by update command)
  if (!options.ignoreSkipBranches) {
    const branch = getCurrentBranch();
    if (config.skipBranches.some((pattern) => matchBranch(branch, pattern))) {
      return 0;
    }
  }

  // Check README exists
  const readmePath = join(process.cwd(), "README.md");
  if (!existsSync(readmePath)) {
    return 0;
  }

  // Get diff
  const { diff } = getUnpushedDiff(config.exclude, config.maxDiffSize);
  if (!diff) {
    return 0;
  }

  // Run analysis
  const currentReadme = readFileSync(readmePath, "utf-8");
  let result;
  try {
    result = analyze(diff, currentReadme, config);
  } catch (err) {
    showWarning(`Analysis failed: ${(err as Error).message}`);
    return config.failOnError ? 1 : 0;
  }

  if (result.decision === "NO_UPDATE") {
    return 0;
  }

  // Handle update
  const updatedReadme = result.updatedReadme!;

  if (config.mode === "auto") {
    writeFileSync(readmePath, updatedReadme);
    execSync("git add README.md");
    execSync('git commit -m "docs: update README"');
    showUpdateMessage();
    return 1;
  }

  // Interactive mode
  if (!isTTY()) {
    showWarning("Interactive mode requires a TTY. Skipping README update.");
    return 0;
  }

  showDiff(currentReadme, updatedReadme);
  const choice = await promptUser();

  if (choice === "n") {
    return 0;
  }

  if (choice === "e") {
    // Write proposed README to temp file, open in $EDITOR
    writeFileSync(readmePath, updatedReadme);
    const editor = process.env.EDITOR || "vi";
    execSync(`${editor} ${readmePath}`, { stdio: "inherit" });
  } else {
    writeFileSync(readmePath, updatedReadme);
  }

  execSync("git add README.md");
  execSync('git commit -m "docs: update README"');
  showUpdateMessage();
  return 1;
}

function matchBranch(branch: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return branch.startsWith(pattern.slice(0, -1));
  }
  return branch === pattern;
}
```

- [ ] **Step 4: Implement cli.ts**

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./setup/init.js";
import { uninstall } from "./setup/uninstall.js";
import { run } from "./run.js";

const program = new Command();

program
  .name("readmeguard")
  .description("Pre-push hook that uses AI to update your README")
  .version("0.1.0");

program
  .command("init")
  .option("--husky", "Install via Husky")
  .action(async (opts) => {
    await init(opts);
  });

program
  .command("uninstall")
  .action(async () => {
    await uninstall();
  });

program
  .command("run")
  .description("Run analysis (called by git hook or hookrunner)")
  .action(async () => {
    const exitCode = await run();
    process.exit(exitCode);
  });

program
  .command("update")
  .description("Run analysis manually (always interactive, ignores skipBranches)")
  .action(async () => {
    const exitCode = await run({ forceInteractive: true, ignoreSkipBranches: true });
    process.exit(exitCode === 1 ? 0 : exitCode); // Don't block on manual update
  });

program.parse();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run packages/readmeguard/`
Expected: PASS

- [ ] **Step 6: Build and verify CLI**

```bash
npm run build --workspace=packages/readmeguard
node packages/readmeguard/dist/cli.js --help
```

- [ ] **Step 7: Commit**

```bash
git add packages/readmeguard/src/cli.ts packages/readmeguard/src/run.ts packages/readmeguard/src/__tests__/run.test.ts
git commit -m "feat(readmeguard): add CLI and main run logic with auto/interactive modes"
```

---

## Task 14: readmeguard — Finalize & README

**Files:**
- Modify: `packages/readmeguard/src/index.ts`
- Create: `packages/readmeguard/README.md`

- [ ] **Step 1: Update index.ts with public exports**

```typescript
export { loadConfig } from "./config/loader.js";
export { run } from "./run.js";
export { analyze, buildPrompt, parseResponse } from "./analysis/analyzer.js";
export { getUnpushedDiff, getCurrentBranch } from "./git/diff.js";
export { init } from "./setup/init.js";
export { uninstall } from "./setup/uninstall.js";
export type { ReadmeguardConfig, AnalysisResult, Provider, Mode } from "./types.js";
```

- [ ] **Step 2: Write README.md**

Include: description, prerequisites (Claude Code or Codex CLI), install (standalone + hookrunner), config options table, env vars, usage examples, example output.

- [ ] **Step 3: Build and run full test suite**

```bash
npm run build
npx vitest run
```

Expected: all packages build, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/readmeguard/
git commit -m "feat(readmeguard): finalize public API and add README"
```

---

## Task 15: Root README & Final Integration Test

**Files:**
- Create: `README.md` (root)

- [ ] **Step 1: Write root README**

Describe the monorepo, list packages with links to their READMEs, quick start for both standalone and orchestrated usage.

- [ ] **Step 2: Run full build and test suite**

```bash
npm run build
npx vitest run
```

Expected: everything green.

- [ ] **Step 3: Manual smoke test hookrunner**

```bash
node packages/hookrunner/dist/cli.js init
node packages/hookrunner/dist/cli.js add test-hook --command "echo hello" --order 1
node packages/hookrunner/dist/cli.js list
node packages/hookrunner/dist/cli.js remove test-hook
node packages/hookrunner/dist/cli.js uninstall
```

Verify each command works as expected.

- [ ] **Step 4: Manual smoke test readmeguard**

```bash
node packages/readmeguard/dist/cli.js --help
node packages/readmeguard/dist/cli.js init
node packages/readmeguard/dist/cli.js uninstall
```

Verify init detects hookrunner (or falls back to standalone).

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add root README with monorepo overview and quick start"
```
