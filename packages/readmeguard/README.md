# @agent-automation/readmeguard

Pre-push hook that uses AI to selectively update your README when substantial changes are detected. Supports Claude Code and Codex CLI as AI providers.

## How it works

1. You run `git push`.
2. readmeguard diffs your unpushed commits against the upstream branch.
3. An AI provider analyzes the diff and your current README.
4. If the README needs updating, it either auto-commits the change or prompts you to review it (depending on mode).
5. The push is blocked so you can push again with the README update included.

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

## Example output

When the README is updated:

```
readmeguard: README update detected.

--- a/README.md
+++ b/README.md
@@ -10,6 +10,8 @@
 ## Features
+- New export API for programmatic usage
+- Support for custom prompts

Apply this update? (y)es / (n)o / (e)dit: y

readmeguard: README updated and committed. Run `git push` again to include the update.
```

When no update is needed:

```
readmeguard: No README update needed.
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
