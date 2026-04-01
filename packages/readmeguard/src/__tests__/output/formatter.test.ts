import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  showDiff,
  showUpdateMessage,
  showSkipMessage,
  showWarning,
  isTTY,
} from "../../output/formatter.js";

describe("output/formatter", () => {
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrWriteSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrWriteSpy.mockRestore();
  });

  describe("showDiff", () => {
    it("outputs green for added lines to stderr", () => {
      showDiff("line1\nline2\n", "line1\nline2\nline3\n");

      const output = stderrWriteSpy.mock.calls
        .map(([arg]) => arg)
        .join("");

      // Should contain green ANSI code for additions
      expect(output).toContain("\x1b[32m");
      // Should contain the added content
      expect(output).toContain("line3");
      // Should reset color
      expect(output).toContain("\x1b[0m");
    });

    it("outputs red for removed lines to stderr", () => {
      showDiff("line1\nline2\nline3\n", "line1\nline2\n");

      const output = stderrWriteSpy.mock.calls
        .map(([arg]) => arg)
        .join("");

      // Should contain red ANSI code for removals
      expect(output).toContain("\x1b[31m");
      // Should contain the removed content
      expect(output).toContain("line3");
      expect(output).toContain("\x1b[0m");
    });

    it("outputs both red and green for modified content", () => {
      showDiff("hello world\n", "hello universe\n");

      const output = stderrWriteSpy.mock.calls
        .map(([arg]) => arg)
        .join("");

      expect(output).toContain("\x1b[31m"); // red for removal
      expect(output).toContain("\x1b[32m"); // green for addition
      expect(output).toContain("hello world");
      expect(output).toContain("hello universe");
    });

    it("outputs nothing when content is identical", () => {
      showDiff("same content\n", "same content\n");

      const output = stderrWriteSpy.mock.calls
        .map(([arg]) => arg)
        .join("");

      expect(output).not.toContain("\x1b[31m");
      expect(output).not.toContain("\x1b[32m");
    });

    it("writes to stderr, not stdout", () => {
      const stdoutSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);

      showDiff("old\n", "new\n");

      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrWriteSpy).toHaveBeenCalled();

      stdoutSpy.mockRestore();
    });
  });

  describe("showUpdateMessage", () => {
    it("writes update message to stderr", () => {
      showUpdateMessage();

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "\nreadmeguard: README updated and committed. Run `git push` again to include the update.\n",
      );
    });
  });

  describe("showSkipMessage", () => {
    it("writes skip message with reason to stderr", () => {
      showSkipMessage("no changes detected");

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "readmeguard: Skipping \u2014 no changes detected\n",
      );
    });

    it("includes the provided reason in the message", () => {
      showSkipMessage("user declined");

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "readmeguard: Skipping \u2014 user declined\n",
      );
    });
  });

  describe("showWarning", () => {
    it("writes warning message to stderr", () => {
      showWarning("API key not set");

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "readmeguard: warning: API key not set\n",
      );
    });
  });

  describe("isTTY", () => {
    it("returns true when stdin is a TTY", () => {
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });

      expect(isTTY()).toBe(true);

      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    });

    it("returns false when stdin is not a TTY", () => {
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(isTTY()).toBe(false);

      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    });
  });
});
