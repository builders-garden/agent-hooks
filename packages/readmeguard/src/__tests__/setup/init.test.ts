import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
  statSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";

// Mock node:child_process
const mockExecSync = vi.fn();
vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Import after mocks
import { init } from "../../setup/init.js";

describe("init", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "readmeguard-init-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects hookrunner and registers with it", async () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === "hookrunner --version") return Buffer.from("1.0.0");
      return Buffer.from("");
    });

    await init({});

    expect(mockExecSync).toHaveBeenCalledWith("hookrunner --version", {
      stdio: "ignore",
    });
    expect(mockExecSync).toHaveBeenCalledWith(
      'hookrunner add readmeguard --command "readmeguard run" --type post-push',
    );
    expect(console.log).toHaveBeenCalledWith(
      "readmeguard: Registered with hookrunner as post-push hook.",
    );
  });

  it("installs both pre-push and post-push hooks when no hookrunner", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    mkdirSync(join(tmpDir, ".git", "hooks"), { recursive: true });
    await init({});

    // Both hooks should be installed
    const prePushPath = join(tmpDir, ".git", "hooks", "pre-push");
    const postPushPath = join(tmpDir, ".git", "hooks", "post-push");
    expect(existsSync(prePushPath)).toBe(true);
    expect(existsSync(postPushPath)).toBe(true);

    // Pre-push saves the base ref
    const prePush = readFileSync(prePushPath, "utf-8");
    expect(prePush).toContain("#!/bin/sh");
    expect(prePush).toContain("git rev-parse @{upstream}");
    expect(prePush).toContain("hookrunner-base-ref");

    // Post-push loads the base ref and runs readmeguard
    const postPush = readFileSync(postPushPath, "utf-8");
    expect(postPush).toContain("#!/bin/sh");
    expect(postPush).toContain("READMEGUARD_BASE_REF");
    expect(postPush).toContain("readmeguard run");
  });

  it("creates .git/hooks directory if it does not exist", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    await init({});

    expect(existsSync(join(tmpDir, ".git", "hooks", "post-push"))).toBe(true);
  });

  it("warns about overwriting existing hooks", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const hooksDir = join(tmpDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "pre-push"), "old");
    writeFileSync(join(hooksDir, "post-push"), "old");

    await init({});

    expect(console.warn).toHaveBeenCalledWith(
      "readmeguard: Warning — existing pre-push will be overwritten.",
    );
    expect(console.warn).toHaveBeenCalledWith(
      "readmeguard: Warning — existing post-push will be overwritten.",
    );
  });

  it("installs husky hooks in husky mode", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    await init({ husky: true });

    expect(existsSync(join(tmpDir, ".husky", "pre-push"))).toBe(true);
    expect(existsSync(join(tmpDir, ".husky", "post-push"))).toBe(true);

    const postPush = readFileSync(join(tmpDir, ".husky", "post-push"), "utf-8");
    expect(postPush).toContain("readmeguard run");
  });

  it("hook scripts are executable", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    await init({});

    for (const hook of ["pre-push", "post-push"]) {
      const stat = statSync(join(tmpDir, ".git", "hooks", hook));
      expect(stat.mode & 0o755).toBe(0o755);
    }
  });
});
