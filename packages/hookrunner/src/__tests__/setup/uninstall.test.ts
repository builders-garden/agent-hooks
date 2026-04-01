import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  existsSync,
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
import { uninstall } from "../../setup/uninstall.js";

describe("uninstall — global mode", () => {
  let tmpDir: string;
  let fakeHome: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-uninstall-test-"));
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

  it("removes core.hooksPath global git config", () => {
    uninstall({ husky: false });

    expect(mockExecSync).toHaveBeenCalledWith(
      "git config --global --unset core.hooksPath",
    );
  });

  it("removes ~/.hookrunner/hooks/ directory", () => {
    const hooksDir = join(fakeHome, ".hookrunner", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, "pre-push"), "#!/bin/sh\n");

    uninstall({ husky: false });

    expect(existsSync(hooksDir)).toBe(false);
  });

  it("does not throw if hooks directory doesn't exist", () => {
    expect(() => uninstall({ husky: false })).not.toThrow();
  });
});

describe("uninstall — husky mode", () => {
  let tmpDir: string;
  let fakeHome: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-uninstall-husky-test-"));
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

  it("removes .husky/pre-push", () => {
    const huskyDir = join(tmpDir, ".husky");
    mkdirSync(huskyDir, { recursive: true });
    writeFileSync(join(huskyDir, "pre-push"), "#!/bin/sh\n");

    uninstall({ husky: true });

    expect(existsSync(join(huskyDir, "pre-push"))).toBe(false);
  });

  it("does not throw if .husky/pre-push doesn't exist", () => {
    expect(() => uninstall({ husky: true })).not.toThrow();
  });

  it("does not call git config --unset in husky mode", () => {
    uninstall({ husky: true });

    expect(mockExecSync).not.toHaveBeenCalled();
  });
});
