import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";

// Mock node:child_process
const mockExecSync = vi.fn();
vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Import after mocks
import { uninstall } from "../../setup/uninstall.js";

describe("uninstall", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "readmeguard-uninstall-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("unregisters from hookrunner when registered", async () => {
    mockExecSync.mockImplementation((cmd: string, opts?: unknown) => {
      if (cmd === "hookrunner list") return "readmeguard\nothertool\n";
      return Buffer.from("");
    });

    await uninstall({});

    expect(mockExecSync).toHaveBeenCalledWith("hookrunner list", {
      encoding: "utf-8",
    });
    expect(mockExecSync).toHaveBeenCalledWith("hookrunner remove readmeguard");
    expect(console.log).toHaveBeenCalledWith(
      "readmeguard: Unregistered from hookrunner.",
    );
  });

  it("removes standalone .git/hooks/pre-push", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const hooksDir = join(tmpDir, ".git", "hooks");
    mkdirSync(hooksDir, { recursive: true });
    const hookPath = join(hooksDir, "pre-push");
    writeFileSync(hookPath, '#!/bin/sh\nreadmeguard run "$@"\n');

    await uninstall({});

    expect(existsSync(hookPath)).toBe(false);
    expect(console.log).toHaveBeenCalledWith(
      "readmeguard: Removed .git/hooks/pre-push hook.",
    );
  });

  it("removes .husky/pre-push in husky mode", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const huskyDir = join(tmpDir, ".husky");
    mkdirSync(huskyDir, { recursive: true });
    const hookPath = join(huskyDir, "pre-push");
    writeFileSync(hookPath, '#!/bin/sh\nreadmeguard run "$@"\n');

    await uninstall({ husky: true });

    expect(existsSync(hookPath)).toBe(false);
    expect(console.log).toHaveBeenCalledWith(
      "readmeguard: Removed .husky/pre-push hook.",
    );
  });

  it("does not error when hook file is missing", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    // No hook file exists — should not throw
    await expect(uninstall({})).resolves.toBeUndefined();
  });

  it("does not error when husky hook file is missing", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });

    await expect(uninstall({ husky: true })).resolves.toBeUndefined();
  });
});
