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

async function readStdin(): Promise<Buffer> {
  if (process.stdin.isTTY) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getHookType(opts: { type?: string }): HookType {
  const t = (opts.type ?? "pre-push") as HookType;
  if (!SUPPORTED_HOOK_TYPES.includes(t)) {
    console.error(`Unknown hook type "${t}". Supported: ${SUPPORTED_HOOK_TYPES.join(", ")}`);
    process.exit(1);
  }
  return t;
}

function getHooks(config: HookRunnerConfig, hookType: HookType) {
  if (!config[hookType]) config[hookType] = [];
  return config[hookType];
}

const program = new Command();

program
  .name("hookrunner")
  .description("Git hook orchestrator — manage execution order of multiple hooks")
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
  .option("--order <n>", "Execution order", parseInt)
  .option("--type <type>", "Hook type (pre-push, post-push)", "pre-push")
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = getHookType(opts);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hooks = getHooks(config, hookType);
    const order =
      opts.order ??
      (hooks.length > 0 ? Math.max(...hooks.map((h) => h.order)) + 1 : 1);
    hooks.push({ name, command: opts.command, order, enabled: true });
    if (opts.local) {
      saveRepoConfig(config);
    } else {
      saveGlobalConfig(config);
    }
    console.log(`Added ${hookType} hook "${name}" with order ${order}.`);
  });

program
  .command("remove <name>")
  .description("Remove a hook entry")
  .option("--type <type>", "Hook type (pre-push, post-push)", "pre-push")
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = getHookType(opts);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hooks = getHooks(config, hookType);
    const before = hooks.length;
    config[hookType] = hooks.filter((h) => h.name !== name);
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
    if (opts.json) {
      console.log(JSON.stringify(config, null, 2));
      return;
    }
    let hasAny = false;
    for (const hookType of SUPPORTED_HOOK_TYPES) {
      const hooks = [...(config[hookType] ?? [])].sort((a, b) => a.order - b.order);
      if (hooks.length === 0) continue;
      hasAny = true;
      console.log(`${hookType}:`);
      for (const hook of hooks) {
        const status = hook.enabled ? "enabled" : "disabled";
        console.log(
          `  ${hook.order}. ${hook.name} \u2192 ${hook.command} (${status})`,
        );
      }
    }
    if (!hasAny) {
      console.log("No hooks configured.");
    }
  });

program
  .command("reorder <name>")
  .description("Change the execution order of a hook")
  .requiredOption("--order <n>", "New execution order", parseInt)
  .option("--type <type>", "Hook type (pre-push, post-push)", "pre-push")
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = getHookType(opts);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = getHooks(config, hookType).find((h) => h.name === name);
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
  .option("--type <type>", "Hook type (pre-push, post-push)", "pre-push")
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = getHookType(opts);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = getHooks(config, hookType).find((h) => h.name === name);
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
  .option("--type <type>", "Hook type (pre-push, post-push)", "pre-push")
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const hookType = getHookType(opts);
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = getHooks(config, hookType).find((h) => h.name === name);
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
  .description("Show hookrunner status: registered hooks across all hook types")
  .action(() => {
    const config = loadConfig();
    console.log("hookrunner status:");
    for (const hookType of SUPPORTED_HOOK_TYPES) {
      const hooks = [...(config[hookType] ?? [])].sort((a, b) => a.order - b.order);
      const enabled = hooks.filter((h) => h.enabled);
      const disabled = hooks.filter((h) => !h.enabled);
      console.log(`\n  ${hookType}: ${hooks.length} hooks (${enabled.length} enabled, ${disabled.length} disabled)`);
      for (const hook of hooks) {
        const icon = hook.enabled ? "\u2713" : "\u2717";
        console.log(`    ${icon} ${hook.order}. ${hook.name} \u2192 ${hook.command}`);
      }
    }
  });

program
  .command("run-one <name> [args...]")
  .description("Run a single hook by name (useful for testing)")
  .option("--type <type>", "Hook type to search in (pre-push, post-push)", "pre-push")
  .allowUnknownOption()
  .passThroughOptions()
  .action(async (name, args, opts) => {
    const hookType = getHookType(opts);
    const config = loadConfig();
    const hook = getHooks(config, hookType).find((h) => h.name === name);
    if (!hook) {
      // Search all hook types
      for (const ht of SUPPORTED_HOOK_TYPES) {
        const found = (config[ht] ?? []).find((h) => h.name === name);
        if (found) {
          const stdinBuffer = await readStdin();
          const result = runHooks([{ ...found, enabled: true }], stdinBuffer, args);
          process.exit(result.exitCode);
        }
      }
      console.error(`Hook "${name}" not found.`);
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
    const config = loadConfig();
    const hooks = config[hookType as keyof typeof config] ?? [];
    const stdinBuffer = await readStdin();
    const result = runHooks(hooks, stdinBuffer, args);
    process.exit(result.exitCode);
  });

program.parse();
