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
import type { HookRunnerConfig } from "./types.js";

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
  .description("Git hook orchestrator — manage execution order of multiple pre-push hooks")
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
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hooks = config["pre-push"];
    const order =
      opts.order ??
      (hooks.length > 0 ? Math.max(...hooks.map((h) => h.order)) + 1 : 1);
    hooks.push({ name, command: opts.command, order, enabled: true });
    if (opts.local) {
      saveRepoConfig(config);
    } else {
      saveGlobalConfig(config);
    }
    console.log(`Added hook "${name}" with order ${order}.`);
  });

program
  .command("remove <name>")
  .description("Remove a hook entry")
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const before = config["pre-push"].length;
    config["pre-push"] = config["pre-push"].filter((h) => h.name !== name);
    if (config["pre-push"].length === before) {
      console.error(`Hook "${name}" not found.`);
      process.exit(1);
    }
    if (opts.local) {
      saveRepoConfig(config);
    } else {
      saveGlobalConfig(config);
    }
    console.log(`Removed hook "${name}".`);
  });

program
  .command("list")
  .description("List all configured hooks (merged view)")
  .option("--json", "Output as JSON for scripting", false)
  .action((opts) => {
    const config = loadConfig();
    const hooks = [...config["pre-push"]].sort((a, b) => a.order - b.order);
    if (opts.json) {
      console.log(JSON.stringify(hooks, null, 2));
      return;
    }
    if (hooks.length === 0) {
      console.log("No hooks configured.");
      return;
    }
    for (const hook of hooks) {
      const status = hook.enabled ? "enabled" : "disabled";
      console.log(
        `  ${hook.order}. ${hook.name} → ${hook.command} (${status})`,
      );
    }
  });

program
  .command("reorder <name>")
  .description("Change the execution order of a hook")
  .requiredOption("--order <n>", "New execution order", parseInt)
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = config["pre-push"].find((h) => h.name === name);
    if (!hook) {
      console.error(`Hook "${name}" not found.`);
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
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = config["pre-push"].find((h) => h.name === name);
    if (!hook) {
      console.error(`Hook "${name}" not found.`);
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
  .option("--local", "Modify repo-level config instead of global", false)
  .action((name, opts) => {
    const config: HookRunnerConfig = opts.local
      ? loadRepoConfig()
      : loadGlobalConfigOnly();
    const hook = config["pre-push"].find((h) => h.name === name);
    if (!hook) {
      console.error(`Hook "${name}" not found.`);
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
