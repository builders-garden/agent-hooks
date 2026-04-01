# hook-template

A minimal, well-documented template for creating new **pre-push hooks** in the agent-hooks monorepo. Copy this package, rename it, and replace the placeholder logic with your own.

Out of the box, the template is a fully runnable hook that prints a success message with branch name and diff size. This lets you verify the wiring works before writing real logic.

## Quick Start

### 1. Copy the template

```bash
cp -r packages/hook-template packages/my-hook
cd packages/my-hook
```

### 2. Update package.json

Open `package.json` and change:

- `"name"` — from `@agent-automation/hook-template` to `@agent-automation/my-hook`
- `"description"` — describe what your hook does
- `"bin"` key — from `"hook-template"` to `"my-hook"`

```json
{
  "name": "@agent-automation/my-hook",
  "description": "Pre-push hook that does something useful",
  "bin": {
    "my-hook": "./dist/cli.js"
  }
}
```

### 3. Rename identifiers throughout the source

Do a project-wide find-and-replace in your new package:

| Find               | Replace with      | Files affected                       |
|---------------------|--------------------|--------------------------------------|
| `hook-template`    | `my-hook`          | cli.ts, init.ts, uninstall.ts, run.ts, types.ts, config/loader.ts |
| `HOOK_TEMPLATE`    | `MY_HOOK`          | run.ts (env var prefix)              |
| `HookTemplate`     | `MyHook`           | types.ts, index.ts, tests            |
| `.hook-template`   | `.my-hook`         | types.ts (config dir and file names) |

### 4. Add your hook logic

Open `src/run.ts` and replace the placeholder section:

```typescript
// ============================================
// YOUR HOOK LOGIC GOES HERE
// ============================================
```

You have access to `diff` (the unpushed git diff), `branch` (current branch name), and `config` (your hook's configuration). Return `0` to allow the push or a non-zero code to block it.

### 5. Update config (if needed)

If your hook needs custom configuration options, edit `src/types.ts`:

- Add fields to the `HookTemplateConfig` interface
- Set sensible defaults in `DEFAULT_CONFIG`
- Add env var overrides in `src/config/loader.ts`

### 6. Build and test

```bash
npm run build && npm test
```

### 7. Link globally

```bash
npm link
```

### 8. Install the hook

If you have hookrunner:

```bash
hookrunner add my-hook --command "my-hook run"
```

Or standalone:

```bash
my-hook init
```

## Architecture

The template follows the same architecture as all hooks in this monorepo:

```
my-hook init       →  Detects hookrunner → registers, else installs standalone
my-hook uninstall  →  Detects hookrunner → unregisters, else removes standalone
my-hook run        →  Loads config → checks skip conditions → gets diff → runs logic
```

### Config precedence (highest to lowest)

1. **Environment variables** — e.g., `MY_HOOK_SKIP=1`
2. **Repo-level config** — `.my-hook.json` in the repo root, or a `"my-hook"` key in `package.json`
3. **Global config** — `~/.my-hook/config.json`
4. **Defaults** — hardcoded in `src/types.ts`

### Exit codes

- `0` — Allow the push
- Non-zero — Block the push (git aborts the push operation)

## File-by-File Guide

### `package.json`

Standard npm package config. The `bin` field maps the CLI command name to `dist/cli.ts`. Update the name, description, and bin key.

### `tsconfig.json`

Extends the root `tsconfig.base.json`. No changes needed unless you add special compiler requirements.

### `tsup.config.ts`

Build configuration. Compiles `src/cli.ts` (the CLI entry point) and `src/index.ts` (the library entry point) to ESM with type declarations. No changes needed.

### `src/types.ts`

**Customize this.** Defines your hook's configuration interface and defaults. This is where you add config options like API keys, thresholds, file patterns, etc.

### `src/config/loader.ts`

**Customize the env var section.** Loads configuration from global config, repo config, and environment variables (in that precedence order). The loading logic itself rarely needs changes — just add your env var overrides at the bottom.

### `src/git/diff.ts`

**Rarely needs changes.** Provides `getUnpushedDiff()` and `getCurrentBranch()`. These are the same utilities used by readmeguard. Handles upstream detection, fallback to `origin/main`, and diff truncation.

### `src/setup/init.ts`

**Rename the HOOK_NAME constant.** Handles installation: detects hookrunner and registers with it, otherwise installs a standalone `.git/hooks/pre-push` script. Supports `--husky` flag.

### `src/setup/uninstall.ts`

**Rename the HOOK_NAME constant.** Mirror of init — unregisters from hookrunner or removes the standalone hook file.

### `src/run.ts`

**This is the main file you customize.** Contains the hook's execution logic. The template provides the standard skeleton (load config, check skip conditions, get diff) and a clearly marked section where you insert your logic.

### `src/cli.ts`

**Rename the command name and description.** Commander CLI with three commands: `init`, `uninstall`, `run`. The `run` command accepts variadic args so hookrunner can pass through git's hook arguments.

### `src/index.ts`

Public API exports. Update the type export names after renaming.

### `src/__tests__/run.test.ts`

**Extend with your own tests.** Example test suite showing how to mock config and git utilities. Covers skip conditions, success path, and error handling. Add tests for your custom logic.
