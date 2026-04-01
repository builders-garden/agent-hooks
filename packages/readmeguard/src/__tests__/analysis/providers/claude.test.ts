import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { callClaude } from "../../../analysis/providers/claude.js";

const mockExecSync = vi.mocked(execSync);

describe("callClaude", () => {
  const defaultOptions = { model: "claude-opus-4-6", timeout: 300_000 };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls the claude CLI with the correct command and model flag", () => {
    mockExecSync.mockReturnValue("response");

    callClaude("analyze this", defaultOptions);

    expect(mockExecSync).toHaveBeenCalledWith(
      "claude --print --model claude-opus-4-6",
      expect.objectContaining({
        encoding: "utf-8",
      }),
    );
  });

  it("passes prompt on stdin via the input option", () => {
    mockExecSync.mockReturnValue("response");

    callClaude("my prompt", defaultOptions);

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        input: "my prompt",
      }),
    );
  });

  it("returns stdout as a string", () => {
    mockExecSync.mockReturnValue("analysis result");

    const result = callClaude("prompt", defaultOptions);

    expect(result).toBe("analysis result");
  });

  it("throws on non-zero exit code (execSync default behavior)", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("Command failed with exit code 1");
    });

    expect(() => callClaude("prompt", defaultOptions)).toThrow(
      "Command failed",
    );
  });

  it("respects the timeout option", () => {
    mockExecSync.mockReturnValue("ok");

    callClaude("prompt", { model: "claude-opus-4-6", timeout: 60_000 });

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        timeout: 60_000,
      }),
    );
  });

  it("throws if the claude CLI is not found in PATH", () => {
    const err = new Error("spawnSync claude ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    mockExecSync.mockImplementation(() => {
      throw err;
    });

    expect(() => callClaude("prompt", defaultOptions)).toThrow("ENOENT");
  });
});
