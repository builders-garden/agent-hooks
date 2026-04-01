import { execSync } from "node:child_process";

export interface ProviderOptions {
  model: string;
  timeout: number;
}

/**
 * Calls the Codex CLI with the given prompt.
 *
 * NOTE: The exact CLI flags (`--print --model`) are a best-guess based on
 * the Claude CLI pattern. These may need adjustment once the Codex CLI
 * interface is verified.
 */
export function callCodex(prompt: string, options: ProviderOptions): string {
  const result = execSync(
    `codex --print --model ${options.model}`,
    {
      input: prompt,
      encoding: "utf-8",
      timeout: options.timeout,
      maxBuffer: 1024 * 1024 * 10,
    },
  );
  return result;
}
