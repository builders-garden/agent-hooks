import { describe, it, expect } from "vitest";
import { findClosestReadme, groupFilesByReadme } from "../../git/readme-discovery.js";

describe("readme-discovery", () => {
  describe("findClosestReadme", () => {
    const readmes = [
      "README.md",
      "packages/hookrunner/README.md",
      "packages/readmeguard/README.md",
    ];

    it("finds package-level README for file in package", () => {
      expect(findClosestReadme("packages/hookrunner/src/cli.ts", readmes))
        .toBe("packages/hookrunner/README.md");
    });

    it("finds root README for file in root", () => {
      expect(findClosestReadme("src/app.ts", readmes))
        .toBe("README.md");
    });

    it("finds root README for file not under any package", () => {
      expect(findClosestReadme("scripts/build.sh", readmes))
        .toBe("README.md");
    });

    it("finds deeply nested package README", () => {
      expect(findClosestReadme("packages/hookrunner/src/config/loader.ts", readmes))
        .toBe("packages/hookrunner/README.md");
    });

    it("returns null when no README covers the path", () => {
      expect(findClosestReadme("packages/unknown/file.ts", ["packages/hookrunner/README.md"]))
        .toBe(null);
    });

    it("handles single root README", () => {
      expect(findClosestReadme("any/deep/path/file.ts", ["README.md"]))
        .toBe("README.md");
    });
  });

  describe("groupFilesByReadme", () => {
    const readmes = [
      "README.md",
      "packages/hookrunner/README.md",
      "packages/readmeguard/README.md",
    ];

    it("groups files by closest README and includes sub-package files in root", () => {
      const files = [
        "packages/hookrunner/src/cli.ts",
        "packages/hookrunner/src/runner.ts",
        "packages/readmeguard/src/run.ts",
        "src/app.ts",
      ];

      const groups = groupFilesByReadme(files, readmes);

      expect(groups.get("packages/hookrunner/README.md")).toEqual([
        "packages/hookrunner/src/cli.ts",
        "packages/hookrunner/src/runner.ts",
      ]);
      expect(groups.get("packages/readmeguard/README.md")).toEqual([
        "packages/readmeguard/src/run.ts",
      ]);
      // Root README gets root-level files + all sub-package files
      expect(groups.get("README.md")).toEqual([
        "packages/hookrunner/src/cli.ts",
        "packages/hookrunner/src/runner.ts",
        "packages/readmeguard/src/run.ts",
        "src/app.ts",
      ]);
    });

    it("excludes README files from grouping", () => {
      const files = ["README.md", "packages/hookrunner/README.md", "src/app.ts"];
      const groups = groupFilesByReadme(files, readmes);

      expect(groups.get("README.md")).toEqual(["src/app.ts"]);
      expect(groups.size).toBe(1);
    });

    it("returns empty map when no files match any README", () => {
      const groups = groupFilesByReadme(
        ["packages/unknown/file.ts"],
        ["packages/hookrunner/README.md"],
      );
      expect(groups.size).toBe(0);
    });

    it("does not duplicate root files when they already belong to root README", () => {
      const files = ["src/app.ts", "config.json"];
      const groups = groupFilesByReadme(files, readmes);

      // Root-level files should appear once, not duplicated
      expect(groups.get("README.md")).toEqual(["src/app.ts", "config.json"]);
      expect(groups.size).toBe(1);
    });

    it("includes sub-package files in root only when root README exists", () => {
      // No root README in the list
      const subReadmes = [
        "packages/hookrunner/README.md",
        "packages/readmeguard/README.md",
      ];
      const files = ["packages/hookrunner/src/cli.ts"];

      const groups = groupFilesByReadme(files, subReadmes);

      // No root README entry should be created
      expect(groups.has("README.md")).toBe(false);
      expect(groups.get("packages/hookrunner/README.md")).toEqual([
        "packages/hookrunner/src/cli.ts",
      ]);
    });
  });
});
