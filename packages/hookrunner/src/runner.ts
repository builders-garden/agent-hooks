import { spawnSync } from "node:child_process";
import { HookEntry } from "./types.js";

export function runHooks(
  hooks: HookEntry[],
  stdinBuffer: Buffer,
  args: string[],
): { exitCode: number; failedHook?: string } {
  const enabled = hooks
    .filter((h) => h.enabled)
    .sort((a, b) => a.order - b.order);

  for (const hook of enabled) {
    const [cmd, ...cmdArgs] = hook.command.split(" ");
    const result = spawnSync(cmd, [...cmdArgs, ...args], {
      input: stdinBuffer,
      stdio: ["pipe", "inherit", "inherit"],
      timeout: 300_000,
    });

    if (result.status !== 0) {
      return { exitCode: result.status ?? 1, failedHook: hook.name };
    }
  }

  return { exitCode: 0 };
}
