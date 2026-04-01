import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../config/loader.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("../git/diff.js", () => ({
  getCurrentBranch: vi.fn(),
}));

vi.mock("../git/readme-discovery.js", () => ({
  discoverReadmes: vi.fn(),
  getChangedFiles: vi.fn(),
  groupFilesByReadme: vi.fn(),
  getDiffForFiles: vi.fn(),
  getUpstream: vi.fn(),
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
  execFileSync: vi.fn(),
}));

import { run } from "../run.js";
import { loadConfig } from "../config/loader.js";
import { getCurrentBranch } from "../git/diff.js";
import {
  discoverReadmes,
  getChangedFiles,
  groupFilesByReadme,
  getDiffForFiles,
  getUpstream,
} from "../git/readme-discovery.js";
import { analyze } from "../analysis/analyzer.js";
import {
  showDiff,
  promptUser,
  showUpdateMessage,
  showWarning,
  isTTY,
} from "../output/formatter.js";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { ReadmeguardConfig } from "../types.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockGetCurrentBranch = vi.mocked(getCurrentBranch);
const mockDiscoverReadmes = vi.mocked(discoverReadmes);
const mockGetChangedFiles = vi.mocked(getChangedFiles);
const mockGroupFilesByReadme = vi.mocked(groupFilesByReadme);
const mockGetDiffForFiles = vi.mocked(getDiffForFiles);
const mockGetUpstream = vi.mocked(getUpstream);
const mockAnalyze = vi.mocked(analyze);
const mockShowDiff = vi.mocked(showDiff);
const mockPromptUser = vi.mocked(promptUser);
const mockShowUpdateMessage = vi.mocked(showUpdateMessage);
const mockShowWarning = vi.mocked(showWarning);
const mockIsTTY = vi.mocked(isTTY);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockExecFileSync = vi.mocked(execFileSync);

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

/** Set up mocks for a standard multi-README scenario */
function setupStandardMocks(config: ReadmeguardConfig) {
  mockLoadConfig.mockReturnValue(config);
  mockGetCurrentBranch.mockReturnValue("feature/test");
  mockGetUpstream.mockReturnValue("origin/main");
  mockDiscoverReadmes.mockReturnValue(["README.md", "packages/hookrunner/README.md"]);
  mockGetChangedFiles.mockReturnValue(["packages/hookrunner/src/cli.ts"]);
  mockGroupFilesByReadme.mockReturnValue(
    new Map([["packages/hookrunner/README.md", ["packages/hookrunner/src/cli.ts"]]]),
  );
  mockGetDiffForFiles.mockReturnValue("some diff content");
  mockReadFileSync.mockReturnValue("# Old README" as any);
}

describe("run", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    originalEnv = { ...process.env };
    delete process.env.READMEGUARD_SKIP;
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    process.env = originalEnv;
    stderrSpy.mockRestore();
  });

  // --- Skip conditions ---

  describe("skip conditions", () => {
    it("returns 0 when READMEGUARD_SKIP=1", async () => {
      process.env.READMEGUARD_SKIP = "1";
      mockLoadConfig.mockReturnValue(makeConfig());

      expect(await run()).toBe(0);
      expect(mockGetUpstream).not.toHaveBeenCalled();
    });

    it("returns 0 when current branch matches skipBranches", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ skipBranches: ["release/*"] }));
      mockGetCurrentBranch.mockReturnValue("release/v1.0");

      expect(await run()).toBe(0);
      expect(mockGetUpstream).not.toHaveBeenCalled();
    });

    it("returns 0 when no upstream ref exists", async () => {
      mockLoadConfig.mockReturnValue(makeConfig());
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockGetUpstream.mockReturnValue(null);

      expect(await run()).toBe(0);
      expect(mockDiscoverReadmes).not.toHaveBeenCalled();
    });

    it("returns 0 when no README files found", async () => {
      mockLoadConfig.mockReturnValue(makeConfig());
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockGetUpstream.mockReturnValue("origin/main");
      mockDiscoverReadmes.mockReturnValue([]);

      expect(await run()).toBe(0);
    });

    it("returns 0 when no changed files", async () => {
      mockLoadConfig.mockReturnValue(makeConfig());
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockGetUpstream.mockReturnValue("origin/main");
      mockDiscoverReadmes.mockReturnValue(["README.md"]);
      mockGetChangedFiles.mockReturnValue([]);

      expect(await run()).toBe(0);
    });
  });

  // --- Analysis results ---

  describe("analysis results", () => {
    it("returns 0 when AI returns NO_UPDATE", async () => {
      setupStandardMocks(makeConfig());
      mockAnalyze.mockReturnValue({ decision: "NO_UPDATE" });

      expect(await run()).toBe(0);
    });

    it("auto mode: writes README, commits, returns 1", async () => {
      setupStandardMocks(makeConfig({ mode: "auto" }));
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });

      const result = await run();

      expect(result).toBe(1);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("packages/hookrunner/README.md"),
        "# New README",
      );
      expect(mockExecFileSync).toHaveBeenCalledWith("git", ["add", "packages/hookrunner/README.md"]);
      expect(mockExecFileSync).toHaveBeenCalledWith("git", ["commit", "-m", "docs: update README(s)"]);
      expect(mockShowUpdateMessage).toHaveBeenCalled();
    });

    it("interactive mode non-TTY: skips with warning, returns 0", async () => {
      setupStandardMocks(makeConfig({ mode: "interactive" }));
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(false);

      const result = await run();

      expect(result).toBe(0);
      expect(mockShowWarning).toHaveBeenCalledWith(
        "Interactive mode requires a TTY. Skipping README update.",
      );
    });

    it("interactive mode with TTY: shows diff, prompts user, applies on Y", async () => {
      setupStandardMocks(makeConfig({ mode: "interactive" }));
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(true);
      mockPromptUser.mockResolvedValue("Y");
      mockExecFileSync.mockReturnValue("packages/hookrunner/README.md\n" as any);

      const result = await run();

      expect(result).toBe(1);
      expect(mockShowDiff).toHaveBeenCalledWith("# Old README", "# New README");
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("packages/hookrunner/README.md"),
        "# New README",
      );
      expect(mockShowUpdateMessage).toHaveBeenCalled();
    });

    it("interactive mode with TTY: returns 0 when user chooses n for all", async () => {
      setupStandardMocks(makeConfig({ mode: "interactive" }));
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(true);
      mockPromptUser.mockResolvedValue("n");
      mockExecFileSync.mockReturnValue("" as any); // nothing staged

      const result = await run();

      expect(result).toBe(0);
    });
  });

  // --- Multi-README ---

  describe("multi-README support", () => {
    it("analyzes multiple READMEs when changes span scopes", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ mode: "auto" }));
      mockGetCurrentBranch.mockReturnValue("feature/test");
      mockGetUpstream.mockReturnValue("origin/main");
      mockDiscoverReadmes.mockReturnValue(["README.md", "packages/hookrunner/README.md"]);
      mockGetChangedFiles.mockReturnValue(["src/app.ts", "packages/hookrunner/src/cli.ts"]);
      mockGroupFilesByReadme.mockReturnValue(
        new Map([
          ["README.md", ["src/app.ts"]],
          ["packages/hookrunner/README.md", ["packages/hookrunner/src/cli.ts"]],
        ]),
      );
      mockGetDiffForFiles.mockReturnValue("diff content");
      mockReadFileSync.mockReturnValue("# README" as any);
      mockAnalyze
        .mockReturnValueOnce({ decision: "UPDATE", updatedReadme: "# Updated Root" })
        .mockReturnValueOnce({ decision: "NO_UPDATE" });

      const result = await run();

      expect(mockAnalyze).toHaveBeenCalledTimes(2);
      expect(result).toBe(1);
      // Only root README should be written (hookrunner got NO_UPDATE)
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("README.md"),
        "# Updated Root",
      );
    });

    it("passes readmePath to analyze for scoped prompts", async () => {
      setupStandardMocks(makeConfig({ mode: "auto" }));
      mockAnalyze.mockReturnValue({ decision: "NO_UPDATE" });

      await run();

      expect(mockAnalyze).toHaveBeenCalledWith(
        "some diff content",
        "# Old README",
        expect.any(Object),
        "packages/hookrunner/README.md",
      );
    });
  });

  // --- Error handling ---

  describe("error handling", () => {
    it("returns 0 when analysis fails and failOnError is false", async () => {
      setupStandardMocks(makeConfig({ failOnError: false }));
      mockAnalyze.mockImplementation(() => {
        throw new Error("API error");
      });

      const result = await run();

      expect(result).toBe(0);
      expect(mockShowWarning).toHaveBeenCalledWith(
        "Analysis failed for packages/hookrunner/README.md: API error",
      );
    });

    it("returns 1 when analysis fails and failOnError is true", async () => {
      setupStandardMocks(makeConfig({ failOnError: true }));
      mockAnalyze.mockImplementation(() => {
        throw new Error("API error");
      });

      const result = await run();

      expect(result).toBe(1);
    });
  });

  // --- RunOptions ---

  describe("RunOptions", () => {
    it("forceInteractive overrides config mode to interactive", async () => {
      setupStandardMocks(makeConfig({ mode: "auto" }));
      mockAnalyze.mockReturnValue({ decision: "UPDATE", updatedReadme: "# New README" });
      mockIsTTY.mockReturnValue(true);
      mockPromptUser.mockResolvedValue("Y");
      mockExecFileSync.mockReturnValue("packages/hookrunner/README.md\n" as any);

      await run({ forceInteractive: true });

      expect(mockShowDiff).toHaveBeenCalled();
      expect(mockPromptUser).toHaveBeenCalled();
    });

    it("ignoreSkipBranches bypasses branch check", async () => {
      mockLoadConfig.mockReturnValue(makeConfig({ skipBranches: ["main"] }));
      mockGetCurrentBranch.mockReturnValue("main");
      mockGetUpstream.mockReturnValue("origin/main");
      mockDiscoverReadmes.mockReturnValue(["README.md"]);
      mockGetChangedFiles.mockReturnValue(["src/app.ts"]);
      mockGroupFilesByReadme.mockReturnValue(
        new Map([["README.md", ["src/app.ts"]]]),
      );
      mockGetDiffForFiles.mockReturnValue("diff");
      mockReadFileSync.mockReturnValue("# README" as any);
      mockAnalyze.mockReturnValue({ decision: "NO_UPDATE" });

      const result = await run({ ignoreSkipBranches: true });

      expect(mockAnalyze).toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });
});
