# @agent-automation/readmeguard

Pre-push hook that uses AI to selectively update your READMEs when substantial changes are detected. Supports monorepos with multiple READMEs and scoped analysis. Uses Claude Code or Codex CLI as AI providers.

## How it works

1. You run `git push`.
2. readmeguard detects the upstream branch (or falls back to `origin/main`).
3. It discovers all `README.md` files tracked by git in the repository.
4. It diffs your unpushed commits against the upstream and groups changed files by their closest README.
5. An AI provider analyzes each scoped diff alongside the corresponding README.
6. If any README needs updating, it either auto-commits the changes or prompts you to review each one individually (depending on mode).
7. The push is blocked so you can push again with the README updates included.

## Prerequisites

- Node.js >= 22.14.0
- Git
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) or [Codex CLI](https://github.com/openai/codex) installed and authenticated

## Install

```bash
npm install -g @agent-automation/readmeguard
```

## Setup

### Standalone (core.hooksPath)

```bash
readmeguard init
```

Installs a `pre-push` hook via Git's `core.hooksPath` mechanism.

### With Husky

```bash
readmeguard init --husky
```

Installs a `pre-push` hook in the `.husky/` directory of the current repository.

### With hookrunner

```bash
hookrunner add readmeguard --command "readmeguard run"
```

Registers readmeguard as a managed hook under hookrunner.

## Monorepo support

readmeguard automatically discovers all `README.md` files tracked by git and scopes its analysis accordingly. When files change in a package that has its own README, only that README is analyzed and updated — the root README is not affected by those changes, and vice versa.

For example, in a repo with:

```
README.md
packages/foo/README.md
packages/bar/README.md
```

A change to `packages/foo/src/index.ts` will only trigger analysis of `packages/foo/README.md`. Changes to `src/app.ts` will only trigger analysis of the root `README.md`.

In interactive mode, each README that needs updating is presented separately with its own diff and prompt, so you can accept, edit, or skip updates individually.

## Configuration

readmeguard loads configuration from multiple sources with the following priority (highest first):

1. Environment variables
2. Repo-level config (`.readmeguard.json` in the repository root)
3. Global config (`~/.readmeguard/config.json`)
4. Built-in defaults

### Example config

```json
{
  "provider": "claude",
  "mode": "interactive",
  "exclude": ["*.lock", "*.min.js", "dist/**"],
  "skipBranches": ["staging", "release/*"],
  "timeout": 300000,
  "failOnError": false,
  "customPrompt": "",
  "maxDiffSize": 100000
}
```

### Options

| Option         | Type     | Default                                              | Description                                          |
|----------------|----------|------------------------------------------------------|------------------------------------------------------|
| `provider`     | string   | `"claude"`                                           | AI provider (`"claude"` or `"codex"`)                |
| `model`        | string   | Provider default                                     | Model to use (overrides provider default)            |
| `mode`         | string   | `"interactive"`                                      | `"auto"` commits automatically, `"interactive"` prompts |
| `exclude`      | string[] | `["*.lock", "*.min.js", "*.map", "dist/**", "node_modules/**"]` | Glob patterns to exclude from the diff               |
| `skipBranches` | string[] | `[]`                                                 | Branch patterns to skip (supports trailing `*` wildcard) |
| `timeout`      | number   | `300000`                                             | AI provider timeout in milliseconds                  |
| `failOnError`  | boolean  | `false`                                              | Block push if analysis fails                         |
| `customPrompt` | string   | `""`                                                 | Additional instructions appended to the AI prompt    |
| `maxDiffSize`  | number   | `100000`                                             | Maximum diff size in bytes (truncated if exceeded)   |

### Environment variables

| Variable              | Maps to      |
|-----------------------|--------------|
| `READMEGUARD_PROVIDER`  | `provider`   |
| `READMEGUARD_MODEL`     | `model`      |
| `READMEGUARD_MODE`      | `mode`       |
| `READMEGUARD_SKIP`      | Skip entirely when set to `1` |

## CLI Commands

### `readmeguard init`

Install the pre-push hook.

```bash
readmeguard init          # standalone (core.hooksPath)
readmeguard init --husky  # Husky integration
```

### `readmeguard uninstall`

Remove the pre-push hook.

```bash
readmeguard uninstall          # standalone
readmeguard uninstall --husky  # Husky integration
```

### `readmeguard run`

Run the analysis. This is the command invoked by the git hook or hookrunner.

```bash
readmeguard run
```

### `readmeguard update`

Run analysis manually in interactive mode, ignoring `skipBranches`. Useful for updating the README on-demand without pushing.

```bash
readmeguard update
```

## Programmatic API

readmeguard exports its core functions for use in custom tooling:

```ts
import {
  run,
  analyze,
  buildPrompt,
  parseResponse,
  discoverReadmes,
  groupFilesByReadme,
  findClosestReadme,
  getDiffForFiles,
  getUnpushedDiff,
  getCurrentBranch,
} from "@agent-automation/readmeguard";
```

The `discoverReadmes`, `groupFilesByReadme`, `findClosestReadme`, and `getDiffForFiles` functions provide the README-scoping logic, useful for building custom analysis pipelines on top of readmeguard.

## Example output

When READMEs are updated:

```
readmeguard: Analyzing changes across 2 README scope(s)...
readmeguard: Checking packages/foo/README.md (3 changed file(s))...
readmeguard: Checking README.md (1 changed file(s))...
readmeguard: 1 README(s) to update: packages/foo/README.md

--- packages/foo/README.md ---
@@ -10,6 +10,8 @@
 ## Features
+- New export API for programmatic usage
+- Support for custom prompts

Apply this update? (y)es / (n)o / (e)dit: y

readmeguard: README updated and committed. Run `git push` again to include the update.
```

When no update is needed:

```
readmeguard: No README updates needed.
```

## Skip

To push without running readmeguard:

```bash
READMEGUARD_SKIP=1 git push
```

## Uninstall

```bash
readmeguard uninstall
readmeguard uninstall --husky
```

## License

MIT