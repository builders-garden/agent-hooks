# @agent-automation/hookrunner

Git hook orchestrator that manages multiple git hooks. Define hooks globally or per-repo, control execution order, and enable/disable individual hooks without editing git config.

## Supported Hook Types

- `pre-push` (default)
- `pre-commit`

## Prerequisites

- Node.js >= 22.14.0
- Git

## Install

```bash
npm install -g @agent-automation/hookrunner
```

## Setup

### Global (core.hooksPath)

```bash
hookrunner init
```

Installs hook scripts for all supported types via Git's `core.hooksPath` mechanism. Hooks are stored in `~/.hookrunner/hooks/`.

### Husky-style

```bash
hookrunner init --husky
```

Installs hook scripts for all supported types in the `.husky/` directory of the current repository.

## CLI Usage

### Add a hook

```bash
hookrunner add pushguard --command "pushguard run"
hookrunner add readmeguard --command "readmeguard check" --type pre-commit
hookrunner add my-hook --command "my-hook run" --order 2 --local
```

- `--command <cmd>` (required) -- command to execute
- `--type <hook-type>` -- hook type (`pre-push` or `pre-commit`, defaults to `pre-push`)
- `--order <n>` -- execution order (defaults to next available)
- `--local` -- save to repo-level config (`.hookrunner.json`) instead of global

### Remove a hook

```bash
hookrunner remove pushguard
hookrunner remove readmeguard --type pre-commit
hookrunner remove my-hook --local
```

### List hooks

```bash
hookrunner list
```

Shows all configured hooks (merged global + repo) grouped by hook type and sorted by execution order.

### Reorder a hook

```bash
hookrunner reorder pushguard --order 5
hookrunner reorder my-hook --order 1 --type pre-commit --local
```

### Enable / disable a hook

```bash
hookrunner enable my-hook
hookrunner disable my-hook --type pre-commit
```

### Execute hooks (called by git)

```bash
hookrunner exec pre-push
hookrunner exec pre-commit
```

This is invoked automatically by the installed git hooks. It reads stdin and passes positional arguments through to each hook command.

### Run a single hook

```bash
hookrunner run-one pushguard
hookrunner run-one readmeguard --type pre-commit
```

Useful for testing individual hooks.

## Uninstall

```bash
hookrunner uninstall
hookrunner uninstall --husky
```

Removes all installed git hook scripts.

## Configuration

hookrunner uses a two-layer config system:

- **Global:** `~/.hookrunner/config.json`
- **Repo-level:** `.hookrunner.json` in the repository root

Repo-level hooks are merged with global hooks. If both define a hook with the same name, the repo-level entry takes precedence.

### Config format

```json
{
  "pre-push": [
    {
      "name": "pushguard",
      "command": "pushguard run",
      "order": 1,
      "enabled": true
    }
  ],
  "pre-commit": [
    {
      "name": "readmeguard",
      "command": "readmeguard check",
      "order": 1,
      "enabled": true
    }
  ]
}
```

### Fields

| Field     | Type    | Description                        |
|-----------|---------|------------------------------------|
| `name`    | string  | Unique identifier for the hook     |
| `command` | string  | Shell command to execute            |
| `order`   | number  | Execution order (lower runs first) |
| `enabled` | boolean | Whether the hook is active          |

## Example: pushguard + readmeguard

```bash
hookrunner init
hookrunner add pushguard --command "pushguard run" --order 1
hookrunner add readmeguard --command "readmeguard check" --type pre-commit --order 1
```

On `git push`, hookrunner runs pushguard. On `git commit`, hookrunner runs readmeguard. If any hook fails, the git operation is blocked.

## Skipping hooks

hookrunner itself always runs when the git hook fires. Individual hooks are responsible for handling their own skip logic (e.g., via environment variables). To disable a specific hook without removing it, set `"enabled": false` in the config.

## License

MIT