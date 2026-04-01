import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import type { ReadmeguardConfig } from "../../types.js";
import { DEFAULT_CONFIG } from "../../types.js";

// Mock node:os so we can control homedir()
const mockHomedir = vi.fn<() => string>();
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: (...args: Parameters<typeof actual.homedir>) =>
      mockHomedir(...args),
  };
});

// Import after mocks are set up
import { loadConfig } from "../../config/loader.js";

describe("loadConfig", () => {
  let tmpDir: string;
  let fakeHome: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "readmeguard-test-"));
    fakeHome = join(tmpDir, "fakehome");
    mkdirSync(fakeHome, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    mockHomedir.mockReturnValue(fakeHome);
    // Clean env vars
    delete process.env.READMEGUARD_PROVIDER;
    delete process.env.READMEGUARD_MODEL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockHomedir.mockReset();
    rmSync(tmpDir, { recursive: true, force: true });
    // Restore env
    process.env = originalEnv;
  });

  it("returns defaults when no config exists", () => {
    const result = loadConfig();
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  it("env vars override everything", () => {
    // Set up a repo config with provider=codex
    writeFileSync(
      join(tmpDir, ".readmeguard.json"),
      JSON.stringify({ provider: "codex" }),
    );

    // Env vars should win
    process.env.READMEGUARD_PROVIDER = "claude";
    process.env.READMEGUARD_MODEL = "custom-model";

    const result = loadConfig();
    expect(result.provider).toBe("claude");
    expect(result.model).toBe("custom-model");
  });

  it(".readmeguard.json overrides global config", () => {
    // Set up global config
    const globalDir = join(fakeHome, ".readmeguard");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "config.json"),
      JSON.stringify({ mode: "auto", timeout: 60_000 }),
    );

    // Set up repo config that overrides mode
    writeFileSync(
      join(tmpDir, ".readmeguard.json"),
      JSON.stringify({ mode: "interactive" }),
    );

    const result = loadConfig();
    // repo overrides global for mode
    expect(result.mode).toBe("interactive");
    // global timeout still applies
    expect(result.timeout).toBe(60_000);
  });

  it("package.json readmeguard key is used as fallback", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({
        name: "test-pkg",
        readmeguard: { provider: "codex", failOnError: true },
      }),
    );

    const result = loadConfig();
    expect(result.provider).toBe("codex");
    expect(result.failOnError).toBe(true);
    // Other defaults preserved
    expect(result.mode).toBe("interactive");
  });

  it("partial config merges with defaults", () => {
    writeFileSync(
      join(tmpDir, ".readmeguard.json"),
      JSON.stringify({ mode: "auto" }),
    );

    const result = loadConfig();
    expect(result.mode).toBe("auto");
    // All other defaults preserved
    expect(result.provider).toBe("claude");
    expect(result.exclude).toEqual(DEFAULT_CONFIG.exclude);
    expect(result.timeout).toBe(300_000);
    expect(result.failOnError).toBe(false);
    expect(result.customPrompt).toBe("");
    expect(result.maxDiffSize).toBe(100_000);
  });

  it(".readmeguard.json takes precedence over package.json", () => {
    writeFileSync(
      join(tmpDir, "package.json"),
      JSON.stringify({
        name: "test-pkg",
        readmeguard: { provider: "codex", mode: "auto" },
      }),
    );
    writeFileSync(
      join(tmpDir, ".readmeguard.json"),
      JSON.stringify({ provider: "claude" }),
    );

    const result = loadConfig();
    // .readmeguard.json wins for provider
    expect(result.provider).toBe("claude");
    // package.json is ignored entirely when .readmeguard.json exists
    expect(result.mode).toBe("interactive");
  });

  it("global config is applied when no repo config exists", () => {
    const globalDir = join(fakeHome, ".readmeguard");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "config.json"),
      JSON.stringify({ provider: "codex", timeout: 120_000 }),
    );

    const result = loadConfig();
    expect(result.provider).toBe("codex");
    expect(result.timeout).toBe(120_000);
    // Defaults for the rest
    expect(result.mode).toBe("interactive");
  });

  it("full priority chain: env > repo > global > defaults", () => {
    // Global sets provider and timeout
    const globalDir = join(fakeHome, ".readmeguard");
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(
      join(globalDir, "config.json"),
      JSON.stringify({ provider: "codex", timeout: 60_000, mode: "auto" }),
    );

    // Repo overrides mode
    writeFileSync(
      join(tmpDir, ".readmeguard.json"),
      JSON.stringify({ mode: "interactive", provider: "codex" }),
    );

    // Env overrides provider
    process.env.READMEGUARD_PROVIDER = "claude";

    const result = loadConfig();
    expect(result.provider).toBe("claude"); // env
    expect(result.mode).toBe("interactive"); // repo
    expect(result.timeout).toBe(60_000); // global
    expect(result.failOnError).toBe(false); // default
  });
});
