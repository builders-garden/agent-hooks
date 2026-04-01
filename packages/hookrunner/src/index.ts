export { loadConfig, mergeConfigs, saveGlobalConfig, loadGlobalConfigOnly, loadRepoConfig, saveRepoConfig } from "./config/loader.js";
export { runHooks } from "./runner.js";
export { init } from "./setup/init.js";
export { uninstall } from "./setup/uninstall.js";
export type { HookEntry, HookRunnerConfig } from "./types.js";
