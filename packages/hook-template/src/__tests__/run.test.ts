import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../config/loader.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("../git/diff.js", () => ({
  getUnpushedDiff: vi.fn(),
  getCurrentBranch: vi.fn(),
}));

import { run } from "../run.js";
import { loadConfig } from "../config/loader.js";
import { getUnpushedDiff, getCurrentBranch } from "../git/diff.js";
import type { HookTemplateConfig } from "../types.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockGetUnpushedDiff = vi.mocked(getUnpushedDiff);
const mockGetCurrentBranch = vi.mocked(getCurrentBranch);

function makeConfig(overrides: Partial<HookTemplateConfig> = {}): HookTemplateConfig {
  return {
    skipBranches: [],
    timeout: 300_000,
    failOnError: false,
    maxDiffSize: 100_000,
    ...overrides,
  };
}

describe("run", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.resetAllMocks();
    originalEnv = { ...process.env };
    delete process.env.HOOK_TEMPLATE_SKIP;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 0 when HOOK_TEMPLATE_SKIP=1", async () => {
    process.env.HOOK_TEMPLATE_SKIP = "1";
    mockLoadConfig.mockReturnValue(makeConfig());

    const result = await run();

    expect(result).toBe(0);
    expect(mockGetUnpushedDiff).not.toHaveBeenCalled();
  });

  it("returns 0 when current branch matches skipBranches", async () => {
    mockLoadConfig.mockReturnValue(makeConfig({ skipBranches: ["release/*"] }));
    mockGetCurrentBranch.mockReturnValue("release/v1.0");

    const result = await run();

    expect(result).toBe(0);
    expect(mockGetUnpushedDiff).not.toHaveBeenCalled();
  });

  it("returns 0 when there is no diff (nothing to push)", async () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    mockGetCurrentBranch.mockReturnValue("feature/test");
    mockGetUnpushedDiff.mockReturnValue({ diff: "", branch: "feature/test" });

    const result = await run();

    expect(result).toBe(0);
  });

  it("returns 0 and prints success when diff exists", async () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    mockGetCurrentBranch.mockReturnValue("feature/test");
    mockGetUnpushedDiff.mockReturnValue({ diff: "some diff content", branch: "feature/test" });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await run();

    expect(result).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith("hook-template: Hook ran successfully!");
    expect(consoleSpy).toHaveBeenCalledWith("  Branch: feature/test");
    expect(consoleSpy).toHaveBeenCalledWith("  Diff size: 17 bytes");

    consoleSpy.mockRestore();
  });

  it("returns 0 on error when failOnError is false", async () => {
    mockLoadConfig.mockReturnValue(makeConfig({ failOnError: false }));
    mockGetCurrentBranch.mockReturnValue("main");
    // Simulate getUnpushedDiff throwing
    mockGetUnpushedDiff.mockImplementation(() => {
      throw new Error("git failed");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await run();

    expect(result).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith("hook-template: Error — git failed");

    consoleSpy.mockRestore();
  });

  it("returns 1 on error when failOnError is true", async () => {
    mockLoadConfig.mockReturnValue(makeConfig({ failOnError: true }));
    mockGetCurrentBranch.mockReturnValue("main");
    mockGetUnpushedDiff.mockImplementation(() => {
      throw new Error("git failed");
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await run();

    expect(result).toBe(1);

    consoleSpy.mockRestore();
  });
});
