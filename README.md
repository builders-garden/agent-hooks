# agent-automation

A collection of AI-powered git hook tools. Currently includes:

## Packages

| Package | Description |
|---------|-------------|
| [@agent-automation/hookrunner](packages/hookrunner/) | Git hook orchestrator -- manage execution order of multiple pre-push hooks |
| [@agent-automation/readmeguard](packages/readmeguard/) | Pre-push hook that uses AI to update your README when substantial changes are detected |

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
hookrunner add readmeguard --command "readmeguard run" --order 1
# Add other hooks as needed, e.g.:
# hookrunner add pushguard --command "pushguard run" --order 2
```

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
    hookrunner/    # Git hook orchestrator
    readmeguard/   # AI-powered README updater
```

See each package's README for detailed documentation:

- [hookrunner README](packages/hookrunner/README.md)
- [readmeguard README](packages/readmeguard/README.md)

## License

MIT
