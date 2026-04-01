#!/usr/bin/env node
import { Command } from "commander";
import { init } from "./setup/init.js";
import { uninstall } from "./setup/uninstall.js";
import { run } from "./run.js";

const program = new Command();

program
  .name("readmeguard")
  .description("Pre-push hook that uses AI to update your README")
  .version("0.1.0");

program
  .command("init")
  .option("--husky", "Install via Husky")
  .action(async (opts) => {
    await init(opts);
  });

program
  .command("uninstall")
  .option("--husky", "Uninstall Husky hook")
  .action(async (opts) => {
    await uninstall(opts);
  });

program
  .command("run [args...]")
  .description("Run analysis (called by git hook or hookrunner)")
  .allowUnknownOption()
  .action(async () => {
    const exitCode = await run();
    process.exit(exitCode);
  });

program
  .command("update")
  .description("Run analysis manually (always interactive, ignores skipBranches)")
  .action(async () => {
    const exitCode = await run({ forceInteractive: true, ignoreSkipBranches: true });
    process.exit(exitCode === 1 ? 0 : exitCode); // Don't block on manual update
  });

program.parse();
