# Readmeguard & Hookrunner Design Spec

## Overview

Two npm packages in a monorepo (`agent-automation`):

1. **hookrunner** — A git hook orchestrator that manages execution order of multiple pre-push hooks
2. **readmeguard** — A pre-push hook that uses AI to selectively update the README when substantial changes are detected

Both support Claude Code and Codex CLI as AI providers.

## Problem

- Developers forget to update READMEs when shipping features, leading to stale docs
- Multiple pre-push tools (pushguard, readmeguard, future hooks) conflict when each tries to own the git hook
- No standard way to order and chain multiple pre-push hooks

## Package 1: hookrunner

### Purpose

Owns the git `pre-push` hook and dispatches to registered tools in configurable order. Works with any CLI tool that returns an exit code.

### CLI Commands

```
hookrunner init                           # Install as global git pre-push hook
hookrunner init --husky                   # Install via Husky (per-project)
hookrunner uninstall                      # Remove git hook and config
hookrunner add <name> --command <cmd>     # Register a hook
hookrunner add <name> --command <cmd> --order <n>  # Register with explicit order
hookrunner remove <name>                  # Unregister a hook
hookrunner list                           # Show registered hooks and order
hookrunner reorder <name> --order <n>     # Change execution order
hookrunner exec pre-push                  # Run all registered pre-push hooks (called by git)
```

### Configuration

Config priority (highest first):
1. `.hookrunner.json` in repo root (per-project)
2. `"hookrunner"` key in `package.json` (per-project)
3. `~/.hookrunner/config.json` (global)

```json
{
  "pre-push": [
    { "name": "pushguard", "command": "pushguard run", "order": 1, "enabled": true },
    { "name": "readmeguard", "command": "readmeguard run", "order": 2, "enabled": true }
  ]
}
```

### Execution Model

When git fires `pre-push`:

1. The installed hook script calls `hookrunner exec pre-push`
2. Hookrunner loads config, sorts hooks by `order`
3. Executes each enabled hook sequentially as a subprocess
4. Passes through stdin (git provides ref info via stdin to pre-push hooks)
5. If any hook exits non-zero, the chain stops and push is blocked
6. If all hooks exit 0, push proceeds

### Global Install

Sets `core.hooksPath` to `~/.hookrunner/hooks/`, placing a `pre-push` shell script there:

```bash
#!/bin/sh
hookrunner exec pre-push "$@"
```

### Husky Install

Creates `.husky/pre-push`:

```bash
#!/bin/sh
hookrunner exec pre-push "$@"
```

## Package 2: readmeguard

### Purpose

Pre-push hook that analyzes unpushed commits and updates the project README when changes are substantial (new features, API changes, behavior changes). Skips minor changes (internal refactors, bug fixes, single function additions).

### CLI Commands

```
readmeguard init                  # Setup (detects hookrunner or standalone)
readmeguard init --husky          # Setup via Husky (standalone mode)
readmeguard uninstall             # Remove hook/registration
readmeguard run                   # Run analysis (called by git hook or hookrunner)
readmeguard update                # Run manually without pushing
```

### Init Logic

```
readmeguard init
  │
  ├─ hookrunner detected?
  │   YES → hookrunner add readmeguard --command "readmeguard run"
  │   NO  → install standalone pre-push hook (global or husky)
  │
  └─ done
```

Detection: check if `hookrunner` command exists in PATH.

### Configuration

Config priority (highest first):
1. Environment variables (`READMEGUARD_SKIP`, `READMEGUARD_PROVIDER`, `READMEGUARD_MODEL`)
2. `.readmeguard.json` in repo root
3. `"readmeguard"` key in `package.json`
4. `~/.readmeguard/config.json` (global)
5. Built-in defaults

```json
{
  "provider": "claude",
  "model": "claude-opus-4-6",
  "mode": "interactive",
  "exclude": ["*.lock", "*.min.js", "*.map", "dist/**", "node_modules/**"],
  "skipBranches": [],
  "timeout": 300000,
  "failOnError": false,
  "customPrompt": ""
}
```

#### Options

| Option | Default | Description |
|--------|---------|-------------|
| `provider` | `"claude"` | AI provider: `claude` or `codex` |
| `model` | Provider default | AI model override |
| `mode` | `"interactive"` | `"auto"` (commit silently) or `"interactive"` (show diff, prompt user) |
| `exclude` | `["*.lock", "*.min.js", "*.map", "dist/**", "node_modules/**"]` | File patterns to exclude from diff |
| `skipBranches` | `[]` | Branch patterns to skip (supports trailing `*` wildcard) |
| `timeout` | `300000` | Timeout in ms for AI CLI (5 min) |
| `failOnError` | `false` | Block push if AI errors (fail-open by default) |
| `customPrompt` | `""` | Additional instructions for AI analysis |

#### Environment Variables

| Variable | Description |
|----------|-------------|
| `READMEGUARD_SKIP` | Set to `1` to skip entirely |
| `READMEGUARD_PROVIDER` | Override provider (`claude` or `codex`) |
| `READMEGUARD_MODEL` | Override model |

### Core Flow

```
readmeguard run
  │
  ▼
Load config
  │
  ▼
Check skip conditions (READMEGUARD_SKIP=1, skipBranches, no README.md)
  │
  ▼
Compute diff of unpushed commits (apply exclude patterns)
  │
  ▼
Read current README.md
  │
  ▼
Send to AI provider:
  - The diff
  - The current README.md
  - Prompt: "Analyze this diff. If changes are substantial (new features,
    API changes, behavior changes), return the updated README. If changes
    are minor (refactors, internal functions, bug fixes), return NO_UPDATE."
  - Any customPrompt appended
  │
  ▼
AI returns NO_UPDATE → exit 0, push continues
  │
  ▼
AI returns updated README
  │
  ├─ mode: "auto"
  │   → Write README.md
  │   → git add README.md
  │   → git commit -m "docs: update README"
  │   → exit 0
  │
  └─ mode: "interactive"
      → Show diff between current and proposed README
      → Prompt: [Y] Apply & push  [n] Skip  [e] Edit first
      │
      ├─ Y → write, add, commit, exit 0
      ├─ n → exit 0 (push continues without update)
      └─ e → open $EDITOR with proposed README, then write, add, commit, exit 0
```

### AI Provider Interface

Both providers receive the same prompt via CLI subprocess.

**Claude:**
```bash
echo "<prompt>" | claude --print --model <model>
```

**Codex:**
```bash
echo "<prompt>" | codex --print --model <model>
```

The prompt instructs the AI to either return `NO_UPDATE` (as a single token) or the full updated README content. A structured output format separates the decision from the content:

```
DECISION: UPDATE
---
<full updated README content>
```

or:

```
DECISION: NO_UPDATE
```

### Error Handling

- AI CLI not found → warning, exit 0 (fail-open)
- AI CLI times out → warning, exit 0 (fail-open)
- AI CLI returns error → warning, exit 0 (fail-open, unless `failOnError: true`)
- No README.md in repo → skip silently, exit 0
- No unpushed commits → skip silently, exit 0
- Diff exceeds reasonable size → truncate (reuse `maxDiffSize` pattern, default 100KB)

## Monorepo Structure

```
agent-automation/
├── packages/
│   ├── hookrunner/
│   │   ├── src/
│   │   │   ├── cli.ts
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── config/
│   │   │   │   └── loader.ts
│   │   │   ├── hooks/
│   │   │   │   └── installer.ts
│   │   │   ├── setup/
│   │   │   │   ├── init.ts
│   │   │   │   └── uninstall.ts
│   │   │   └── runner.ts
│   │   ├── bin/
│   │   │   └── pre-push
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── readmeguard/
│       ├── src/
│       │   ├── cli.ts
│       │   ├── index.ts
│       │   ├── types.ts
│       │   ├── config/
│       │   │   └── loader.ts
│       │   ├── git/
│       │   │   └── diff.ts
│       │   ├── analysis/
│       │   │   ├── analyzer.ts
│       │   │   └── providers/
│       │   │       ├── claude.ts
│       │   │       └── codex.ts
│       │   ├── setup/
│       │   │   ├── init.ts
│       │   │   └── uninstall.ts
│       │   └── output/
│       │       └── formatter.ts
│       ├── bin/
│       │   └── pre-push
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── package.json              ← npm workspaces root
├── tsconfig.base.json        ← shared TypeScript config
└── README.md
```

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Node.js >= 22.14.0
- **Build:** tsup (fast, zero-config bundler for TypeScript)
- **Package manager:** npm with workspaces
- **Testing:** vitest
- **Linting:** eslint

## npm Publishing

- `hookrunner` → `@agent-automation/hookrunner` (or pick a scope)
- `readmeguard` → `@agent-automation/readmeguard`

## Usage Examples

### Standalone (readmeguard only)

```bash
npm install -g @agent-automation/readmeguard
readmeguard init
# Now every git push analyzes and optionally updates README
```

### With hookrunner (multiple hooks)

```bash
npm install -g @agent-automation/hookrunner @agent-automation/readmeguard
hookrunner init
hookrunner add pushguard --command "pushguard run" --order 1
hookrunner add readmeguard --command "readmeguard run" --order 2
# pushguard uninstall  ← remove pushguard's standalone hook to avoid double-run
```

### Skip on a single push

```bash
READMEGUARD_SKIP=1 git push
```

### Manual update

```bash
readmeguard update
```
