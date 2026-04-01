import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import type { HookEntry } from "../types.js";
import { runHooks } from "../runner.js";

function makeHook(overrides: Partial<HookEntry> = {}): HookEntry {
  return {
    name: "test-hook",
    command: "echo test",
    order: 10,
    enabled: true,
    ...overrides,
  };
}

describe("runHooks", () => {
  it("returns success immediately when no hooks registered", () => {
    const result = runHooks([], Buffer.alloc(0), []);
    expect(result).toEqual({ exitCode: 0 });
  });

  it("runs hooks in order and returns success when all exit 0", () => {
    const hooks: HookEntry[] = [
      makeHook({ name: "second", command: "true", order: 20 }),
      makeHook({ name: "first", command: "true", order: 5 }),
    ];
    const result = runHooks(hooks, Buffer.alloc(0), []);
    expect(result).toEqual({ exitCode: 0 });
  });

  it("stops on first non-zero exit and returns that exit code and failed hook name", () => {
    const hooks: HookEntry[] = [
      makeHook({ name: "pass", command: "true", order: 1 }),
      makeHook({ name: "fail-hook", command: "false", order: 2 }),
      makeHook({ name: "never-runs", command: "true", order: 3 }),
    ];
    const result = runHooks(hooks, Buffer.alloc(0), []);
    expect(result.exitCode).toBe(1);
    expect(result.failedHook).toBe("fail-hook");
  });

  it("skips disabled hooks", () => {
    const hooks: HookEntry[] = [
      makeHook({ name: "disabled-fail", command: "false", order: 1, enabled: false }),
      makeHook({ name: "enabled-pass", command: "true", order: 2, enabled: true }),
    ];
    const result = runHooks(hooks, Buffer.alloc(0), []);
    expect(result).toEqual({ exitCode: 0 });
  });

  describe("stdin buffering", () => {
    let tmpDir: string;

    afterEach(() => {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("passes buffered stdin to each hook subprocess", () => {
      tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-runner-test-"));
      const outFile = join(tmpDir, "stdin-output.txt");
      const stdinData = "hello from stdin\n";

      const hooks: HookEntry[] = [
        makeHook({
          name: "cat-stdin",
          command: `sh -c cat>${outFile}`,
          order: 1,
        }),
      ];

      const result = runHooks(hooks, Buffer.from(stdinData), []);
      expect(result).toEqual({ exitCode: 0 });

      const written = readFileSync(outFile, "utf-8");
      expect(written).toBe(stdinData);
    });
  });
});
