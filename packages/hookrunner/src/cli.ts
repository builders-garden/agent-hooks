#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./setup/init.js";
import { uninstall } from "./setup/uninstall.js";
import {
  loadConfig,
  loadGlobalConfigOnly,
  loadRepoConfig,
  saveGlobalConfig,
  saveRepoConfig,
} from "./config/loader.js";
import { runHooks } from "./runner.js";
import type { HookRunnerConfig, HookType } from "./types.js";
import { SUPPORTED_HOOK_TYPES } from "./types.js";

const DEFAULT_HOOK_TYPE: HookType = "pre-push";

function validateHookType(value: string): HookType {
  if (!SUPPORTED_HOOK_TYPES.includes(value as HookType)) {
    throw new Error(`Unsupported hook type "${value}". Supported: ${SUPPORTED_HOOK_TYPES.join(", ")}`);
  }
  return value as HookType;
}

async function readStdin(): Promise<Buffer> {
  if (process.stdin.isTTY) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const program = new Command();

program
  .name("hookrunner")
  .description("Git hook orchestrator — manage execution order of multiple git hooks")
  .version("0.1.0")
  .enablePositionalOptions();

program
  .command("init")
  .description("Initialize hookrunner (install git hooks)")
  .option("--husky", "Use husky-style .husky/ directory", false)
  .action((opts) => {
    init({ husky: opts.husky });
    console.log("hookrunner initialized.");
  });

program
  .command("uninstall")
  .description("Uninstall hookrunner (remove git hooks)")
  .option("--husky", "Remove husky-style hooks", false)
  .action((opts) => {
    uninstall({ husky: opts.husky });
    console.log("hookrunner uninstalled.");
  });

program
  .command("add <name>")
  .description("Add a hook entry")
  .requiredOption("--command <cmd>", "Command to run")
  .option("--type <hook-type>", "Hook type", DEFAULT_HOOK_TYPE)
  .option("--order <n>", "Execution order", parseInt)
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = validateHookType(opts.type);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hooks = config[hookType];
    const order =
      opts.order ??
      (hooks.length > 0 ? Math.max(...hooks.map((h) => h.order)) + 1 : 1);
    hooks.push({ name, command: opts.command, order, enabled: true });
    if (opts.local) {
      saveRepoConfig(config);
    } else {
      saveGlobalConfig(config);
    }
    console.log(`Added hook "${name}" (${hookType}) with order ${order}.`);
  });

program
  .command("remove <name>")
  .description("Remove a hook entry")
  .option("--type <hook-type>", "Hook type", DEFAULT_HOOK_TYPE)
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = validateHookType(opts.type);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const before = config[hookType].length;
    config[hookType] = config[hookType].filter((h) => h.name !== name);
    if (config[hookType].length === before) {
      console.error(`Hook "${name}" not found in ${hookType}.`);
      process.exit(1);
    }
    if (opts.local) {
      saveRepoConfig(config);
    } else {
      saveGlobalConfig(config);
    }
    console.log(`Removed hook "${name}" from ${hookType}.`);
  });

program
  .command("list")
  .description("List all configured hooks (merged view)")
  .option("--json", "Output as JSON for scripting", false)
  .action((opts) => {
    const config = loadConfig();
    let anyHooks = false;

    for (const hookType of SUPPORTED_HOOK_TYPES) {
      const hooks = [...config[hookType]].sort((a, b) => a.order - b.order);
      if (hooks.length === 0) continue;
      anyHooks = true;

      if (opts.json) {
        console.log(JSON.stringify({ [hookType]: hooks }, null, 2));
      } else {
        console.log(`  ${hookType}:`);
        for (const hook of hooks) {
          const status = hook.enabled ? "enabled" : "disabled";
          console.log(
            `    ${hook.order}. ${hook.name} → ${hook.command} (${status})`,
          );
        }
      }
    }

    if (!anyHooks && !opts.json) {
      console.log("No hooks configured.");
    }
  });

program
  .command("reorder <name>")
  .description("Change the execution order of a hook")
  .requiredOption("--order <n>", "New execution order", parseInt)
  .option("--type <hook-type>", "Hook type", DEFAULT_HOOK_TYPE)
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = validateHookType(opts.type);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = config[hookType].find((h) => h.name === name);
    if (!hook) {
      console.error(`Hook "${name}" not found in ${hookType}.`);
      process.exit(1);
    }
    hook.order = opts.order;
    if (opts.local) {
      saveRepoConfig(config);
    } else {
      saveGlobalConfig(config);
    }
    console.log(`Reordered hook "${name}" to order ${opts.order}.`);
  });

program
  .command("enable <name>")
  .description("Enable a disabled hook")
  .option("--type <hook-type>", "Hook type", DEFAULT_HOOK_TYPE)
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = validateHookType(opts.type);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = config[hookType].find((h) => h.name === name);
    if (!hook) {
      console.error(`Hook "${name}" not found in ${hookType}.`);
      process.exit(1);
    }
    if (hook.enabled) {
      console.log(`Hook "${name}" is already enabled.`);
      return;
    }
    hook.enabled = true;
    if (opts.local) {
      saveRepoConfig(config);
    } else {
      saveGlobalConfig(config);
    }
    console.log(`Enabled hook "${name}".`);
  });

program
  .command("disable <name>")
  .description("Disable a hook without removing it")
  .option("--type <hook-type>", "Hook type", DEFAULT_HOOK_TYPE)
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = validateHookType(opts.type);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = config[hookType].find((h) => h.name === name);
    if (!hook) {
      console.error(`Hook "${name}" not found in ${hookType}.`);
      process.exit(1);
    }
    if (!hook.enabled) {
      console.log(`Hook "${name}" is already disabled.`);
      return;
    }
    hook.enabled = false;
    if (opts.local) {
      saveRepoConfig(config);
    } else {
      saveGlobalConfig(config);
    }
    console.log(`Disabled hook "${name}".`);
  });

program
  .command("status")
  .description("Show hookrunner status: installation mode, hooks, and config sources")
  .action(() => {
    const config = loadConfig();
    console.log("hookrunner status:");

    for (const hookType of SUPPORTED_HOOK_TYPES) {
      const hooks = [...config[hookType]].sort((a, b) => a.order - b.order);
      if (hooks.length === 0) continue;

      const enabled = hooks.filter((h) => h.enabled);
      const disabled = hooks.filter((h) => !h.enabled);
      console.log(`\n  ${hookType} pipeline (${enabled.length} enabled, ${disabled.length} disabled):`);
      for (const hook of hooks) {
        const icon = hook.enabled ? "\u2713" : "\u2717";
        console.log(`    ${icon} ${hook.order}. ${hook.name} \u2192 ${hook.command}`);
      }
    }

    const allHooks = SUPPORTED_HOOK_TYPES.flatMap((t) => config[t]);
    if (allHooks.length === 0) {
      console.log("  No hooks registered. Use 'hookrunner add' to register a hook.");
    }
  });

program
  .command("run-one <name> [args...]")
  .description("Run a single hook by name (useful for testing)")
  .option("--type <hook-type>", "Hook type", DEFAULT_HOOK_TYPE)
  .allowUnknownOption()
  .passThroughOptions()
  .action(async (name, args, opts) => {
    const hookType = validateHookType(opts.type);
    const config = loadConfig();
    const hook = config[hookType].find((h) => h.name === name);
    if (!hook) {
      console.error(`Hook "${name}" not found in ${hookType}.`);
      process.exit(1);
    }
    const stdinBuffer = await readStdin();
    const result = runHooks([{ ...hook, enabled: true }], stdinBuffer, args);
    process.exit(result.exitCode);
  });

program
  .command("exec <hook-type> [args...]")
  .description("Execute hooks for a given hook type (called by git)")
  .allowUnknownOption()
  .passThroughOptions()
  .action(async (hookType, args) => {
    const validated = validateHookType(hookType);
    const config = loadConfig();
    const hooks = config[validated] ?? [];
    const stdinBuffer = await readStdin();
    const result = runHooks(hooks, stdinBuffer, args);
    process.exit(result.exitCode);
  });

program.parse();
