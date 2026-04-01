# agent-automation

A collection of AI-powered git hook tools. Currently includes:

## Packages

| Package | Description |
|---------|-------------|
| [@agent-automation/hookrunner](packages/hookrunner/) | Git hook orchestrator -- manage execution order of multiple git hooks (pre-push, pre-commit) |
| [@agent-automation/readmeguard](packages/readmeguard/) | Pre-commit hook that uses AI to update your README when substantial changes are detected |
| [hook-template](packages/hook-template/) | Starter template for creating new git hooks (supports any hook type) |

## Creating Your Own Hook

Copy the template and customize it:

```bash
cp -r packages/hook-template packages/my-hook
cd packages/my-hook
# Edit package.json (name, description, bin key)
# Edit src/run.ts (your hook logic)
# Edit src/types.ts (your config options)
npm run build
npm link
hookrunner add my-hook --command "my-hook run"
```

See the [hook-template README](packages/hook-template/README.md) for a detailed guide.

## Quick Start

### Standalone (readmeguard only)

```bash
npm install -g @agent-automation/readmeguard
readmeguard init
```

### With hookrunner (multiple hooks)

```bash
npm install -g @agent-automation/hookrunner @agent-automation/readmeguard
hookrunner init
hookrunner add readmeguard --command "readmeguard run" --type pre-commit
# Add other hooks as needed, e.g.:
# hookrunner add pushguard --command "pushguard run" --type pre-push
```

### Testing a single hook

You can run an individual hook in isolation without triggering the full hook pipeline:

```bash
hookrunner run-one readmeguard
```

This is useful for testing and debugging hooks during development.

## Development

```bash
git clone <repo-url>
npm install
npm run build
npm test
```

## Monorepo Structure

This repository is organized as an npm workspaces monorepo:

```
agent-automation/
  packages/
    hookrunner/      # Git hook orchestrator
    readmeguard/     # AI-powered README updater
    hook-template/   # Starter template for new hooks
```

See each package's README for detailed documentation:

- [hookrunner README](packages/hookrunner/README.md)
- [readmeguard README](packages/readmeguard/README.md)
- [hook-template README](packages/hook-template/README.md)

## License

MIT