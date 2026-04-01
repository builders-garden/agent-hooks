import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import { callCodex } from "../../../analysis/providers/codex.js";

const mockExecSync = vi.mocked(execSync);

describe("callCodex", () => {
  const defaultOptions = { model: "gpt-5.3-codex", timeout: 300_000 };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls the codex CLI with the correct command and model flag", () => {
    mockExecSync.mockReturnValue("response");

    callCodex("analyze this", defaultOptions);

    expect(mockExecSync).toHaveBeenCalledWith(
      "codex --print --model gpt-5.3-codex",
      expect.objectContaining({
        encoding: "utf-8",
      }),
    );
  });

  it("passes prompt on stdin via the input option", () => {
    mockExecSync.mockReturnValue("response");

    callCodex("my prompt", defaultOptions);

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        input: "my prompt",
      }),
    );
  });

  it("returns stdout as a string", () => {
    mockExecSync.mockReturnValue("analysis result");

    const result = callCodex("prompt", defaultOptions);

    expect(result).toBe("analysis result");
  });

  it("throws on non-zero exit code (execSync default behavior)", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("Command failed with exit code 1");
    });

    expect(() => callCodex("prompt", defaultOptions)).toThrow(
      "Command failed",
    );
  });

  it("respects the timeout option", () => {
    mockExecSync.mockReturnValue("ok");

    callCodex("prompt", { model: "gpt-5.3-codex", timeout: 60_000 });

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        timeout: 60_000,
      }),
    );
  });

  it("throws if the codex CLI is not found in PATH", () => {
    const err = new Error("spawnSync codex ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    mockExecSync.mockImplementation(() => {
      throw err;
    });

    expect(() => callCodex("prompt", defaultOptions)).toThrow("ENOENT");
  });
});
