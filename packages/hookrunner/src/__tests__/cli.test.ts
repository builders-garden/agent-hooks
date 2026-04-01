import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { execSync } from "node:child_process";
import type { HookRunnerConfig, HookEntry } from "../types.js";

/**
 * These tests exercise the CLI by building the project first and then
 * invoking the built CLI with execSync. This tests the real end-to-end
 * behavior including commander argument parsing.
 *
 * For add/remove/reorder/list we set up a temporary HOME and CWD to
 * isolate config file operations.
 */

const ROOT = join(import.meta.dirname, "..", "..");
const CLI = join(ROOT, "dist", "cli.js");

// Build once before all tests
let built = false;
function ensureBuilt() {
  if (!built) {
    execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
    built = true;
  }
}

function runCli(args: string, env: Record<string, string> = {}): string {
  ensureBuilt();
  return execSync(`node ${CLI} ${args}`, {
    encoding: "utf-8",
    env: { ...process.env, ...env },
    timeout: 10_000,
  }).trim();
}

function runCliWithCwd(
  args: string,
  cwd: string,
  env: Record<string, string> = {},
): string {
  ensureBuilt();
  return execSync(`node ${CLI} ${args}`, {
    encoding: "utf-8",
    cwd,
    env: { ...process.env, ...env },
    timeout: 10_000,
  }).trim();
}

function readJsonFile(path: string): HookRunnerConfig {
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("CLI", () => {
  it("prints help", () => {
    const output = runCli("--help");
    expect(output).toContain("hookrunner");
    expect(output).toContain("init");
    expect(output).toContain("add");
    expect(output).toContain("remove");
    expect(output).toContain("list");
    expect(output).toContain("reorder");
    expect(output).toContain("exec");
  });

  it("prints version", () => {
    const output = runCli("--version");
    expect(output).toBe("0.1.0");
  });

  describe("add command", () => {
    let tmpHome: string;
    let globalConfigPath: string;

    beforeEach(() => {
      tmpHome = mkdtempSync(join(tmpdir(), "hookrunner-cli-test-"));
      const configDir = join(tmpHome, ".hookrunner");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ "pre-push": [], "post-push": [] }, null, 2) + "\n",
      );
      globalConfigPath = join(configDir, "config.json");
    });

    afterEach(() => {
      rmSync(tmpHome, { recursive: true, force: true });
    });

    it("adds a hook to global config", () => {
      const output = runCli(
        'add pushguard --command "pushguard run"',
        { HOME: tmpHome },
      );
      expect(output).toContain("Added pre-push hook");
      expect(output).toContain("pushguard");

      const config = readJsonFile(globalConfigPath);
      expect(config["pre-push"]).toHaveLength(1);
      expect(config["pre-push"][0]).toMatchObject({
        name: "pushguard",
        command: "pushguard run",
        order: 1,
        enabled: true,
      });
    });

    it("auto-increments order when adding multiple hooks", () => {
      runCli('add first --command "cmd1"', { HOME: tmpHome });
      runCli('add second --command "cmd2"', { HOME: tmpHome });

      const config = readJsonFile(globalConfigPath);
      expect(config["pre-push"]).toHaveLength(2);
      expect(config["pre-push"][0].order).toBe(1);
      expect(config["pre-push"][1].order).toBe(2);
    });

    it("respects explicit --order", () => {
      runCli('add myhook --command "my cmd" --order 42', { HOME: tmpHome });

      const config = readJsonFile(globalConfigPath);
      expect(config["pre-push"][0].order).toBe(42);
    });

    it("adds hook to local config with --local", () => {
      const tmpCwd = mkdtempSync(join(tmpdir(), "hookrunner-cli-local-"));
      try {
        const output = runCliWithCwd(
          'add localhook --command "local cmd" --local',
          tmpCwd,
          { HOME: tmpHome },
        );
        expect(output).toContain("Added pre-push hook");

        const repoConfig = readJsonFile(join(tmpCwd, ".hookrunner.json"));
        expect(repoConfig["pre-push"]).toHaveLength(1);
        expect(repoConfig["pre-push"][0].name).toBe("localhook");

        // Global config should be unchanged
        const globalConfig = readJsonFile(globalConfigPath);
        expect(globalConfig["pre-push"]).toHaveLength(0);
      } finally {
        rmSync(tmpCwd, { recursive: true, force: true });
      }
    });
  });

  describe("remove command", () => {
    let tmpHome: string;
    let globalConfigPath: string;

    beforeEach(() => {
      tmpHome = mkdtempSync(join(tmpdir(), "hookrunner-cli-test-"));
      const configDir = join(tmpHome, ".hookrunner");
      mkdirSync(configDir, { recursive: true });
      const config: HookRunnerConfig = {
        "pre-push": [
          { name: "pushguard", command: "pushguard run", order: 1, enabled: true },
          { name: "readmeguard", command: "readmeguard run", order: 2, enabled: true },
        ],
        "post-push": [],
      };
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify(config, null, 2) + "\n",
      );
      globalConfigPath = join(configDir, "config.json");
    });

    afterEach(() => {
      rmSync(tmpHome, { recursive: true, force: true });
    });

    it("removes a hook by name", () => {
      runCli("remove pushguard", { HOME: tmpHome });

      const config = readJsonFile(globalConfigPath);
      expect(config["pre-push"]).toHaveLength(1);
      expect(config["pre-push"][0].name).toBe("readmeguard");
    });

    it("exits with error when hook not found", () => {
      expect(() => {
        runCli("remove nonexistent", { HOME: tmpHome });
      }).toThrow();
    });
  });

  describe("list command", () => {
    let tmpHome: string;
    let tmpCwd: string;

    beforeEach(() => {
      tmpHome = mkdtempSync(join(tmpdir(), "hookrunner-cli-test-"));
      tmpCwd = mkdtempSync(join(tmpdir(), "hookrunner-cli-cwd-"));
      const configDir = join(tmpHome, ".hookrunner");
      mkdirSync(configDir, { recursive: true });
      const config: HookRunnerConfig = {
        "pre-push": [
          { name: "pushguard", command: "pushguard run", order: 1, enabled: true },
          { name: "readmeguard", command: "readmeguard run", order: 2, enabled: true },
        ],
        "post-push": [],
      };
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify(config, null, 2) + "\n",
      );
    });

    afterEach(() => {
      rmSync(tmpHome, { recursive: true, force: true });
      rmSync(tmpCwd, { recursive: true, force: true });
    });

    it("lists hooks in order", () => {
      const output = runCliWithCwd("list", tmpCwd, { HOME: tmpHome });
      expect(output).toContain("1. pushguard");
      expect(output).toContain("pushguard run");
      expect(output).toContain("(enabled)");
      expect(output).toContain("2. readmeguard");
      expect(output).toContain("readmeguard run");
    });

    it("shows message when no hooks configured", () => {
      const emptyHome = mkdtempSync(join(tmpdir(), "hookrunner-cli-empty-"));
      try {
        const output = runCliWithCwd("list", tmpCwd, { HOME: emptyHome });
        expect(output).toContain("No hooks configured");
      } finally {
        rmSync(emptyHome, { recursive: true, force: true });
      }
    });
  });

  describe("reorder command", () => {
    let tmpHome: string;
    let globalConfigPath: string;

    beforeEach(() => {
      tmpHome = mkdtempSync(join(tmpdir(), "hookrunner-cli-test-"));
      const configDir = join(tmpHome, ".hookrunner");
      mkdirSync(configDir, { recursive: true });
      const config: HookRunnerConfig = {
        "pre-push": [
          { name: "pushguard", command: "pushguard run", order: 1, enabled: true },
          { name: "readmeguard", command: "readmeguard run", order: 2, enabled: true },
        ],
        "post-push": [],
      };
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify(config, null, 2) + "\n",
      );
      globalConfigPath = join(configDir, "config.json");
    });

    afterEach(() => {
      rmSync(tmpHome, { recursive: true, force: true });
    });

    it("changes hook order", () => {
      runCli("reorder pushguard --order 99", { HOME: tmpHome });

      const config = readJsonFile(globalConfigPath);
      const hook = config["pre-push"].find((h) => h.name === "pushguard");
      expect(hook?.order).toBe(99);
    });

    it("exits with error when hook not found", () => {
      expect(() => {
        runCli("reorder nonexistent --order 5", { HOME: tmpHome });
      }).toThrow();
    });
  });

  describe("exec command", () => {
    let tmpHome: string;
    let tmpCwd: string;

    beforeEach(() => {
      tmpHome = mkdtempSync(join(tmpdir(), "hookrunner-cli-test-"));
      tmpCwd = mkdtempSync(join(tmpdir(), "hookrunner-cli-cwd-"));
      const configDir = join(tmpHome, ".hookrunner");
      mkdirSync(configDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpHome, { recursive: true, force: true });
      rmSync(tmpCwd, { recursive: true, force: true });
    });

    it("exits 0 when all hooks pass", () => {
      const config: HookRunnerConfig = {
        "pre-push": [
          { name: "pass1", command: "true", order: 1, enabled: true },
          { name: "pass2", command: "true", order: 2, enabled: true },
        ],
        "post-push": [],
      };
      writeFileSync(
        join(tmpHome, ".hookrunner", "config.json"),
        JSON.stringify(config, null, 2) + "\n",
      );

      // Should not throw (exit code 0)
      const output = runCliWithCwd("exec pre-push", tmpCwd, { HOME: tmpHome });
    });

    it("exits non-zero when a hook fails", () => {
      const config: HookRunnerConfig = {
        "pre-push": [
          { name: "fail", command: "false", order: 1, enabled: true },
        ],
        "post-push": [],
      };
      writeFileSync(
        join(tmpHome, ".hookrunner", "config.json"),
        JSON.stringify(config, null, 2) + "\n",
      );

      expect(() => {
        runCliWithCwd("exec pre-push", tmpCwd, { HOME: tmpHome });
      }).toThrow();
    });

    it("exits 0 when hook type has no hooks", () => {
      const config: HookRunnerConfig = { "pre-push": [], "post-push": [] };
      writeFileSync(
        join(tmpHome, ".hookrunner", "config.json"),
        JSON.stringify(config, null, 2) + "\n",
      );

      // Should not throw
      runCliWithCwd("exec pre-push", tmpCwd, { HOME: tmpHome });
    });
  });
});
