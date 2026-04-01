import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import type { HookRunnerConfig, HookEntry } from "../../types.js";

// Mock node:os so we can control homedir()
const mockHomedir = vi.fn<() => string>();
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: (...args: Parameters<typeof actual.homedir>) => mockHomedir(...args),
  };
});

// Import after mocks are set up
import {
  mergeConfigs,
  loadConfig,
  loadGlobalConfigOnly,
  loadRepoConfig,
  saveGlobalConfig,
  saveRepoConfig,
} from "../../config/loader.js";

function makeHook(overrides: Partial<HookEntry> = {}): HookEntry {
  return {
    name: "test-hook",
    command: "echo test",
    order: 10,
    enabled: true,
    ...overrides,
  };
}

describe("mergeConfigs", () => {
  it("returns global config when no repo config exists", () => {
    const global: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "lint", order: 1 })],
    };
    const result = mergeConfigs(global, null);
    expect(result).toEqual(global);
  });

  it("repo hooks override global hooks with same name", () => {
    const global: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "lint", command: "global-lint", order: 1 })],
    };
    const repo: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "lint", command: "repo-lint", order: 2 })],
    };
    const result = mergeConfigs(global, repo);
    expect(result["pre-push"]).toHaveLength(1);
    expect(result["pre-push"][0].command).toBe("repo-lint");
  });

  it("includes global-only hooks alongside repo hooks", () => {
    const global: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "global-only", command: "g", order: 5 })],
    };
    const repo: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "repo-only", command: "r", order: 3 })],
    };
    const result = mergeConfigs(global, repo);
    expect(result["pre-push"]).toHaveLength(2);
    const names = result["pre-push"].map((h) => h.name);
    expect(names).toContain("global-only");
    expect(names).toContain("repo-only");
  });

  it("sorts merged hooks by order", () => {
    const global: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "second", order: 20 })],
    };
    const repo: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "first", order: 5 })],
    };
    const result = mergeConfigs(global, repo);
    expect(result["pre-push"][0].name).toBe("first");
    expect(result["pre-push"][1].name).toBe("second");
  });
});

describe("loadConfig", () => {
  let tmpDir: string;
  let fakeHome: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-test-"));
    fakeHome = join(tmpDir, "fakehome");
    mkdirSync(fakeHome, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    mockHomedir.mockReturnValue(fakeHome);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockHomedir.mockReset();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns default config when no config files exist", () => {
    const result = loadConfig();
    expect(result).toEqual({ "pre-push": [], "post-push": [] });
  });

  it("loads from .hookrunner.json in repo root", () => {
    const config: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "from-repo", order: 1 })],
    };
    writeFileSync(join(tmpDir, ".hookrunner.json"), JSON.stringify(config));

    const result = loadConfig();
    expect(result["pre-push"]).toHaveLength(1);
    expect(result["pre-push"][0].name).toBe("from-repo");
  });

  it("loads from package.json hookrunner key", () => {
    const config: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "from-pkg", order: 1 })],
    };
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", hookrunner: config }),
    );

    const result = loadConfig();
    expect(result["pre-push"]).toHaveLength(1);
    expect(result["pre-push"][0].name).toBe("from-pkg");
  });
});

describe("loadGlobalConfigOnly", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-global-test-"));
    mockHomedir.mockReturnValue(tmpDir);
  });

  afterEach(() => {
    mockHomedir.mockReset();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns default when file doesn't exist", () => {
    const result = loadGlobalConfigOnly();
    expect(result).toEqual({ "pre-push": [], "post-push": [] });
  });

  it("returns parsed config when file exists", () => {
    const dir = join(tmpDir, ".hookrunner");
    mkdirSync(dir, { recursive: true });
    const config: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "global-hook", order: 1 })],
    };
    writeFileSync(join(dir, "config.json"), JSON.stringify(config));

    const result = loadGlobalConfigOnly();
    expect(result["pre-push"]).toHaveLength(1);
    expect(result["pre-push"][0].name).toBe("global-hook");
  });
});

describe("loadRepoConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-repo-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns default when file doesn't exist", () => {
    const result = loadRepoConfig();
    expect(result).toEqual({ "pre-push": [], "post-push": [] });
  });

  it("returns parsed config when file exists", () => {
    const config: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "repo-hook", order: 1 })],
    };
    writeFileSync(join(tmpDir, ".hookrunner.json"), JSON.stringify(config));
    const result = loadRepoConfig();
    expect(result["pre-push"]).toHaveLength(1);
    expect(result["pre-push"][0].name).toBe("repo-hook");
  });
});

describe("saveGlobalConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-save-global-"));
    mockHomedir.mockReturnValue(tmpDir);
  });

  afterEach(() => {
    mockHomedir.mockReset();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes config to correct path", () => {
    const dir = join(tmpDir, ".hookrunner");
    mkdirSync(dir, { recursive: true });

    const config: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "saved-hook", order: 1 })],
    };
    saveGlobalConfig(config);

    const filePath = join(dir, "config.json");
    expect(existsSync(filePath)).toBe(true);
    const saved = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(saved["pre-push"][0].name).toBe("saved-hook");
  });

  it("creates directory if it doesn't exist", () => {
    const config: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "new-dir-hook", order: 1 })],
    };
    saveGlobalConfig(config);

    const filePath = join(tmpDir, ".hookrunner", "config.json");
    expect(existsSync(filePath)).toBe(true);
    const saved = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(saved["pre-push"][0].name).toBe("new-dir-hook");
  });
});

describe("saveRepoConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hookrunner-save-repo-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes config to correct path", () => {
    const config: HookRunnerConfig = {
      "pre-push": [makeHook({ name: "repo-saved", order: 1 })],
    };
    saveRepoConfig(config);

    const filePath = join(tmpDir, ".hookrunner.json");
    expect(existsSync(filePath)).toBe(true);
    const saved = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(saved["pre-push"][0].name).toBe("repo-saved");
  });
});
