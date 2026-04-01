import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  existsSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";

// Mock node:os so we can control homedir()
const mockHomedir = vi.fn<() => string>();
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: (...args: Parameters<typeof actual.homedir>) =>
      mockHomedir(...args),
  };
});

// Mock child_process execSync
const mockExecSync = vi.fn();
vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Import after mocks
import { init } from "../../setup/init.js";

// Tests check that hook scripts contain the expected command, not exact content
// (since the scripts now include temp file logic for base ref passing)
function assertHookScriptContains(content: string, hookType: string) {
  expect(content).toContain("#!/bin/sh");
  expect(content).toContain(`hookrunner exec ${hookType}`);
}

describe("init — global mode", () => {
  let tmpDir: string;
  let fakeHome: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-init-test-"));
    fakeHome = join(tmpDir, "fakehome");
    mkdirSync(fakeHome, { recursive: true });
    mockHomedir.mockReturnValue(fakeHome);
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockHomedir.mockReset();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates ~/.hookrunner/hooks/pre-push with correct content and executable permissions", () => {
    init({ husky: false });

    const prePushPath = join(fakeHome, ".hookrunner", "hooks", "pre-push");
    expect(existsSync(prePushPath)).toBe(true);
    assertHookScriptContains(readFileSync(prePushPath, "utf-8"), "pre-push");

    const stat = statSync(prePushPath);
    // Check executable bit (owner execute = 0o100)
    expect(stat.mode & 0o111).not.toBe(0);
  });

  it("creates ~/.hookrunner/hooks/post-push with correct content and executable permissions", () => {
    init({ husky: false });

    const postPushPath = join(fakeHome, ".hookrunner", "hooks", "post-push");
    expect(existsSync(postPushPath)).toBe(true);
    assertHookScriptContains(readFileSync(postPushPath, "utf-8"), "post-push");

    const stat = statSync(postPushPath);
    expect(stat.mode & 0o111).not.toBe(0);
  });

  it("sets core.hooksPath via git config", () => {
    init({ husky: false });

    const expectedPath = join(fakeHome, ".hookrunner", "hooks");
    expect(mockExecSync).toHaveBeenCalledWith(
      `git config --global core.hooksPath ${expectedPath}`,
    );
  });

  it("creates config.json if it doesn't exist", () => {
    init({ husky: false });

    const configPath = join(fakeHome, ".hookrunner", "config.json");
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).toEqual({ "pre-push": [], "post-push": [] });
  });

  it("does not overwrite existing config.json", () => {
    const configDir = join(fakeHome, ".hookrunner");
    mkdirSync(configDir, { recursive: true });
    const existingConfig = { "pre-push": [{ name: "existing", command: "echo hi", order: 1, enabled: true }] };
    writeFileSync(join(configDir, "config.json"), JSON.stringify(existingConfig));

    init({ husky: false });

    const configPath = join(configDir, "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config["pre-push"]).toHaveLength(1);
    expect(config["pre-push"][0].name).toBe("existing");
  });
});

describe("init — husky mode", () => {
  let tmpDir: string;
  let fakeHome: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-init-husky-test-"));
    fakeHome = join(tmpDir, "fakehome");
    mkdirSync(fakeHome, { recursive: true });
    mockHomedir.mockReturnValue(fakeHome);
    mockExecSync.mockReset();
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockHomedir.mockReset();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates .husky/pre-push and .husky/post-push with correct content", () => {
    init({ husky: true });

    const prePushPath = join(tmpDir, ".husky", "pre-push");
    expect(existsSync(prePushPath)).toBe(true);
    assertHookScriptContains(readFileSync(prePushPath, "utf-8"), "pre-push");

    const postPushPath = join(tmpDir, ".husky", "post-push");
    expect(existsSync(postPushPath)).toBe(true);
    assertHookScriptContains(readFileSync(postPushPath, "utf-8"), "post-push");
  });

  it("creates .husky/ directory if it doesn't exist", () => {
    const huskyDir = join(tmpDir, ".husky");
    expect(existsSync(huskyDir)).toBe(false);

    init({ husky: true });

    expect(existsSync(huskyDir)).toBe(true);
  });

  it("creates config.json if it doesn't exist", () => {
    init({ husky: true });

    const configPath = join(fakeHome, ".hookrunner", "config.json");
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config).toEqual({ "pre-push": [], "post-push": [] });
  });

  it("does not call git config for hooksPath in husky mode", () => {
    init({ husky: true });

    expect(mockExecSync).not.toHaveBeenCalled();
  });
});
