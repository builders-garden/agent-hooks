import { execSync } from "node:child_process";

export interface ProviderOptions {
  model: string;
  timeout: number;
}

export function callClaude(prompt: string, options: ProviderOptions): string {
  const result = execSync(
    `claude --print --model ${options.model}`,
    {
      input: prompt,
      encoding: "utf-8",
      timeout: options.timeout,
      maxBuffer: 1024 * 1024 * 10,
    },
  );
  return result;
}
