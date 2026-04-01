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
    // hookrunner --version succeeds
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === "hookrunner --version") return Buffer.from("1.0.0");
      return Buffer.from("");
    });

    await init({});

    expect(mockExecSync).toHaveBeenCalledWith("hookrunner --version", {
      stdio: "ignore",
    });
    expect(mockExecSync).toHaveBeenCalledWith(
      'hookrunner add readmeguard --command "readmeguard run"',
    );
    expect(console.log).toHaveBeenCalledWith(
      "readmeguard: Registered with hookrunner.",
    );
  });

  it("installs standalone .git/hooks/pre-push when no hookrunner", async () => {
    // hookrunner --version fails
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd === "hookrunner --version") throw new Error("not found");
      return Buffer.from("");
    });

    // Create .git/hooks dir
    mkdirSync(join(tmpDir, ".git", "hooks"), { recursive: true });

    await init({});

    const hookPath = join(tmpDir, ".git", "hooks", "pre-push");
    expect(existsSync(hookPath)).toBe(true);

    const content = readFileSync(hookPath, "utf-8");
    expect(content).toBe('#!/bin/sh\nreadmeguard run "$@"\n');

    const stat = statSync(hookPath);
    // Check executable bit (owner execute)
    expect(stat.mode & 0o755).toBe(0o755);

    expect(console.log).toHaveBeenCalledWith(
      "readmeguard: Installed .git/hooks/pre-push hook.",
    );
  });

  it("creates .git/hooks directory if it does not exist", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    // Don't create .git/hooks - init should create it
    await init({});

    const hookPath = join(tmpDir, ".git", "hooks", "pre-push");
    expect(existsSync(hookPath)).toBe(true);
  });

  it("warns about overwriting existing .git/hooks/pre-push", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    // Create an existing hook
    const hooksDir = join(tmpDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "pre-push"), "#!/bin/sh\nold hook\n");

    await init({});

    expect(console.warn).toHaveBeenCalledWith(
      "readmeguard: Warning — existing .git/hooks/pre-push will be overwritten.",
    );
  });

  it("installs .husky/pre-push in husky mode", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    await init({ husky: true });

    const hookPath = join(tmpDir, ".husky", "pre-push");
    expect(existsSync(hookPath)).toBe(true);

    const content = readFileSync(hookPath, "utf-8");
    expect(content).toBe('#!/bin/sh\nreadmeguard run "$@"\n');

    const stat = statSync(hookPath);
    expect(stat.mode & 0o755).toBe(0o755);

    expect(console.log).toHaveBeenCalledWith(
      "readmeguard: Installed .husky/pre-push hook.",
    );
  });

  it("warns about overwriting existing .husky/pre-push", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const huskyDir = join(tmpDir, ".husky");
    mkdirSync(huskyDir, { recursive: true });
    writeFileSync(join(huskyDir, "pre-push"), "#!/bin/sh\nold hook\n");

    await init({ husky: true });

    expect(console.warn).toHaveBeenCalledWith(
      "readmeguard: Warning — existing .husky/pre-push will be overwritten.",
    );
  });

  it("hook script has correct content and executable permissions", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    await init({});

    const hookPath = join(tmpDir, ".git", "hooks", "pre-push");
    const content = readFileSync(hookPath, "utf-8");
    expect(content).toBe('#!/bin/sh\nreadmeguard run "$@"\n');
    expect(content).toMatch(/^#!\/bin\/sh\n/);

    const stat = statSync(hookPath);
    expect(stat.mode & 0o755).toBe(0o755);
  });
});
