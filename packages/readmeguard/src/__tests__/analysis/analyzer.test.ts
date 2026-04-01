import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../analysis/providers/claude.js", () => ({
  callClaude: vi.fn(),
}));

vi.mock("../../analysis/providers/codex.js", () => ({
  callCodex: vi.fn(),
}));

import { buildPrompt, parseResponse, analyze } from "../../analysis/analyzer.js";
import { callClaude } from "../../analysis/providers/claude.js";
import { callCodex } from "../../analysis/providers/codex.js";
import { ReadmeguardConfig, DEFAULT_MODELS } from "../../types.js";

const mockCallClaude = vi.mocked(callClaude);
const mockCallCodex = vi.mocked(callCodex);

function makeConfig(overrides: Partial<ReadmeguardConfig> = {}): ReadmeguardConfig {
  return {
    provider: "claude",
    mode: "auto",
    exclude: [],
    skipBranches: [],
    timeout: 300_000,
    failOnError: false,
    customPrompt: "",
    maxDiffSize: 100_000,
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("includes diff and current README in the prompt", () => {
    const result = buildPrompt("diff content here", "# My README", "");
    expect(result).toContain("diff content here");
    expect(result).toContain("# My README");
  });

  it("includes customPrompt when provided", () => {
    const result = buildPrompt("diff", "readme", "Please focus on API changes");
    expect(result).toContain("## Additional Instructions");
    expect(result).toContain("Please focus on API changes");
  });

  it("omits Additional Instructions section when customPrompt is empty", () => {
    const result = buildPrompt("diff", "readme", "");
    expect(result).not.toContain("## Additional Instructions");
  });
});

describe("parseResponse", () => {
  it("parses DECISION: NO_UPDATE response correctly", () => {
    const result = parseResponse("DECISION: NO_UPDATE");
    expect(result).toEqual({ decision: "NO_UPDATE" });
  });

  it("parses DECISION: UPDATE with separator and extracts README content", () => {
    const response = "DECISION: UPDATE\n---\n# Updated README\n\nNew content here.";
    const result = parseResponse(response);
    expect(result).toEqual({
      decision: "UPDATE",
      updatedReadme: "# Updated README\n\nNew content here.",
    });
  });

  it("returns NO_UPDATE for malformed response (no DECISION prefix)", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const result = parseResponse("Some random AI text without proper format");
    expect(result).toEqual({ decision: "NO_UPDATE" });
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("could not parse AI response"),
    );
    stderrSpy.mockRestore();
  });

  it("returns NO_UPDATE when UPDATE is returned but no separator found", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const result = parseResponse("DECISION: UPDATE\nSome content without separator");
    expect(result).toEqual({ decision: "NO_UPDATE" });
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("no README content found"),
    );
    stderrSpy.mockRestore();
  });

  it("strips whitespace from extracted README content", () => {
    const response = "DECISION: UPDATE\n---\n  \n# README\n\nContent\n  ";
    const result = parseResponse(response);
    expect(result.decision).toBe("UPDATE");
    expect(result.updatedReadme).toBe("# README\n\nContent");
  });

  it("handles response with extra whitespace/newlines around content", () => {
    const response = "  \n  DECISION: NO_UPDATE  \n  ";
    const result = parseResponse(response);
    expect(result).toEqual({ decision: "NO_UPDATE" });
  });
});

describe("analyze", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uses claude provider when config.provider is 'claude'", () => {
    mockCallClaude.mockReturnValue("DECISION: NO_UPDATE");

    analyze("diff", "readme", makeConfig({ provider: "claude" }));

    expect(mockCallClaude).toHaveBeenCalled();
    expect(mockCallCodex).not.toHaveBeenCalled();
  });

  it("uses codex provider when config.provider is 'codex'", () => {
    mockCallCodex.mockReturnValue("DECISION: NO_UPDATE");

    analyze("diff", "readme", makeConfig({ provider: "codex" }));

    expect(mockCallCodex).toHaveBeenCalled();
    expect(mockCallClaude).not.toHaveBeenCalled();
  });

  it("uses default model when config.model is undefined", () => {
    mockCallClaude.mockReturnValue("DECISION: NO_UPDATE");

    analyze("diff", "readme", makeConfig({ provider: "claude", model: undefined }));

    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: DEFAULT_MODELS.claude }),
    );
  });

  it("uses config.model when specified", () => {
    mockCallClaude.mockReturnValue("DECISION: NO_UPDATE");

    analyze("diff", "readme", makeConfig({ provider: "claude", model: "claude-custom-model" }));

    expect(mockCallClaude).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ model: "claude-custom-model" }),
    );
  });

  it("passes through the response parsing", () => {
    mockCallClaude.mockReturnValue("DECISION: UPDATE\n---\n# New README");

    const result = analyze("diff", "readme", makeConfig({ provider: "claude" }));

    expect(result).toEqual({
      decision: "UPDATE",
      updatedReadme: "# New README",
    });
  });
});
