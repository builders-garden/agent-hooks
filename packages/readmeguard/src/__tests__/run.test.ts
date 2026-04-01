import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../config/loader.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("../git/diff.js", () => ({
  getUnpushedDiff: vi.fn(),
  getCurrentBranch: vi.fn(),
}));

vi.mock("../analysis/analyzer.js", () => ({
  analyze: vi.fn(),
}));

vi.mock("../output/formatter.js", () => ({
  showDiff: vi.fn(),
  promptUser: vi.fn(),
  showUpdateMessage: vi.fn(),
  showSkipMessage: vi.fn(),
  showWarning: vi.fn(),
  isTTY: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { run } from "../run.js";
import { loadConfig } from "../config/loader.js";
import { getUnpushedDiff, getCurrentBranch } from "../git/diff.js";
import { analyze } from "../analysis/analyzer.js";
import {
  showDiff,
  promptUser,
  showUpdateMessage,
  showWarning,
  isTTY,
} from "../output/formatter.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import type { ReadmeguardConfig } from "../types.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockGetUnpushedDiff = vi.mocked(getUnpushedDiff);
const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockAnalyze = vi.mocked(analyze);
const mockShowDiff = vi.mocked(showDiff);
const mockPromptUser = vi.mocked(promptUser);
const mockShowUpdateMessage = vi.mocked(showUpdateMessage);
const mockShowWarning = vi.mocked(showWarning);
const mockIsTTY = vi.mocked(isTTY);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockExecSync = vi.mocked(execSync);

function makeConfig(overrides: Partial<ReadmeguardConfig> = {}): ReadmeguardConfig {
  return {
    provider: "claude",
    mode: "interactive",
    exclude: [],
    skipBranches: [],
    timeout: 300_000,
    failOnError: false,
    customPrompt: "",
    maxDiffSize: 100_000,
    ...overrides,
  };
}

describe("run", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.resetAllMocks();
    originalEnv = { ...process.env };
    delete process.env.READMEGUARD_SKIP;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // --- Skip conditions ---

  describe("skip conditions", () => {
    it("returns 0 when READMEGUARD_SKIP=1", async () => {
      process.env.READMEGUARD_SKIP = "1";
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
      expect(mockExistsSync).not.toHaveBeenCalled();
    });

    it("returns 0 when current branch matches exact skipBranches entry", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ skipBranches: ["main"] }));
      mockGetCurrentBranch.mockReturnValue("main");

      const result = await run();

      expect(result).toBe(0);
    });

    it("returns 0 when no README.md exists", async () => {
      mockLoadConfig.mockReturnValue(makeConfig());
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(false);

      const result = await run();

      expect(result).toBe(0);
      expect(mockGetUnpushedDiff).not.toHaveBeenCalled();
    });

    it("returns 0 when no unpushed commits (empty diff)", async () => {
      mockLoadConfig.mockReturnValue(makeConfig());
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "", branch: "feature/test" });

      const result = await run();

      expect(result).toBe(0);
      expect(mockAnalyze).not.toHaveBeenCalled();
    });
  });

  // --- Analysis results ---

  describe("analysis results", () => {
    it("returns 0 when AI returns NO_UPDATE", async () => {
      mockLoadConfig.mockReturnValue(makeConfig());
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# README");
      mockAnalyze.mockReturnValue({ decision: "NO_UPDATE" });

      const result = await run();

      expect(result).toBe(0);
    });

    it("auto mode: writes README, commits, returns 1", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ mode: "auto" }));
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# Old README");
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });

      const result = await run();

      expect(result).toBe(1);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("README.md"),
        "# New README",
      );
      expect(mockExecSync).toHaveBeenCalledWith("git add README.md");
      expect(mockExecSync).toHaveBeenCalledWith('git commit -m "docs: update README"');
      expect(mockShowUpdateMessage).toHaveBeenCalled();
    });

    it("interactive mode non-TTY: skips with warning, returns 0", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ mode: "interactive" }));
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# Old README");
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(false);

      const result = await run();

      expect(result).toBe(0);
      expect(mockShowWarning).toHaveBeenCalledWith(
        "Interactive mode requires a TTY. Skipping README update.",
      );
    });

    it("interactive mode with TTY: shows diff, prompts user, applies on Y", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ mode: "interactive" }));
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# Old README");
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(true);
      mockPromptUser.mockResolvedValue("Y");

      const result = await run();

      expect(result).toBe(1);
      expect(mockShowDiff).toHaveBeenCalledWith("# Old README", "# New README");
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("README.md"),
        "# New README",
      );
      expect(mockExecSync).toHaveBeenCalledWith("git add README.md");
      expect(mockShowUpdateMessage).toHaveBeenCalled();
    });

    it("interactive mode with TTY: returns 0 when user chooses n", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ mode: "interactive" }));
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# Old README");
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(true);
      mockPromptUser.mockResolvedValue("n");

      const result = await run();

      expect(result).toBe(0);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("interactive mode with TTY: opens editor when user chooses e", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ mode: "interactive" }));
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# Old README");
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(true);
      mockPromptUser.mockResolvedValue("e");

      const result = await run();

      expect(result).toBe(1);
      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("vi"),
        expect.objectContaining({ stdio: "inherit" }),
      );
    });
  });

  // --- Error handling ---

  describe("error handling", () => {
    it("returns 0 when analysis fails and failOnError is false", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ failOnError: false }));
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# README");
      mockAnalyze.mockImplementation(() => {
        throw new Error("API error");
      });

      const result = await run();

      expect(result).toBe(0);
      expect(mockShowWarning).toHaveBeenCalledWith("Analysis failed: API error");
    });

    it("returns 1 when analysis fails and failOnError is true", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ failOnError: true }));
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# README");
      mockAnalyze.mockImplementation(() => {
        throw new Error("API error");
      });

      const result = await run();

      expect(result).toBe(1);
      expect(mockShowWarning).toHaveBeenCalledWith("Analysis failed: API error");
    });
  });

  // --- RunOptions ---

  describe("RunOptions", () => {
    it("forceInteractive overrides config mode to interactive", async () => {
      const config = makeConfig({ mode: "auto" });
      mockLoadConfig.mockReturnValue(config);
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "feature/test" });
      mockReadFileSync.mockReturnValue("# Old README");
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(true);
      mockPromptUser.mockResolvedValue("Y");

      await run({ forceInteractive: true });

      // Should show diff (interactive) instead of auto-writing
      expect(mockShowDiff).toHaveBeenCalled();
      expect(mockPromptUser).toHaveBeenCalled();
    });

    it("ignoreSkipBranches bypasses branch check", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ skipBranches: ["main"] }));
      mockGetCurrentBranch.mockReturnValue("main");
      mockExistsSync.mockReturnValue(true);
      mockGetUnpushedDiff.mockReturnValue({ diff: "some diff", branch: "main" });
      mockReadFileSync.mockReturnValue("# README");
      mockAnalyze.mockReturnValue({ decision: "NO_UPDATE" });

      const result = await run({ ignoreSkipBranches: true });

      // Should have reached analysis instead of skipping early
      expect(mockAnalyze).toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });
});
