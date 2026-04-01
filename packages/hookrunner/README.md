# @agent-automation/hookrunner

Git hook orchestrator that manages multiple pre-push hooks. Define hooks globally or per-repo, control execution order, and enable/disable individual hooks without editing git config.

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

Installs a `pre-push` hook via Git's `core.hooksPath` mechanism. Hooks are stored in `~/.hookrunner/hooks/`.

### Husky-style

```bash
hookrunner init --husky
```

Installs a `pre-push` hook in the `.husky/` directory of the current repository.

## CLI Usage

### Add a hook

```bash
hookrunner add pushguard --command "pushguard run"
hookrunner add readmeguard --command "readmeguard check" --order 2
hookrunner add my-hook --command "my-hook run" --local
```

- `--command <cmd>` (required) -- command to execute
- `--order <n>` -- execution order (defaults to next available)
- `--local` -- save to repo-level config (`.hookrunner.json`) instead of global

### Remove a hook

```bash
hookrunner remove pushguard
hookrunner remove my-hook --local
```

### List hooks

```bash
hookrunner list
```

Shows all configured hooks (merged global + repo) sorted by execution order.

### Reorder a hook

```bash
hookrunner reorder pushguard --order 5
hookrunner reorder my-hook --order 1 --local
```

### Execute hooks (called by git)

```bash
hookrunner exec pre-push
```

This is invoked automatically by the installed git hook. It reads stdin and passes positional arguments through to each hook command.

## Uninstall

```bash
hookrunner uninstall
hookrunner uninstall --husky
```

Removes the installed git hooks.

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
    },
    {
      "name": "readmeguard",
      "command": "readmeguard check",
      "order": 2,
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
hookrunner add readmeguard --command "readmeguard check" --order 2
```

On `git push`, hookrunner runs pushguard first, then readmeguard. If pushguard fails, readmeguard is skipped and the push is blocked.

## Skipping hooks

hookrunner itself always runs when the git hook fires. Individual hooks are responsible for handling their own skip logic (e.g., via environment variables). To disable a specific hook without removing it, set `"enabled": false` in the config.

## License

MIT
