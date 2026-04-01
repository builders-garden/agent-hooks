#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./setup/init.js";
import { uninstall } from "./setup/uninstall.js";
import { run } from "./run.js";

// CUSTOMIZE: Update the name, description, and version for your hook.
const program = new Command();

program
  .name("hook-template")
  .description("Template pre-push hook — customize this for your needs")
  .version("0.1.0");

program
  .command("init")
  .description("Install the git hook (detects hookrunner automatically)")
  .option("--husky", "Install via Husky")
  .action(async (opts) => {
    await init(opts);
  });

program
  .command("uninstall")
  .description("Remove the git hook")
  .option("--husky", "Uninstall Husky hook")
  .action(async (opts) => {
    await uninstall(opts);
  });

program
  .command("run [args...]")
  .description("Run the hook (called by git hook or hookrunner)")
  .allowUnknownOption()
  .action(async () => {
    const exitCode = await run();
    process.exit(exitCode);
  });

program.parse(process.argv);
