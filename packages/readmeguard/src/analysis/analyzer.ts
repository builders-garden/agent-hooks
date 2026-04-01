import { ReadmeguardConfig, AnalysisResult, DEFAULT_MODELS } from "../types.js";
import { callClaude } from "./providers/claude.js";
import { callCodex } from "./providers/codex.js";

export function buildPrompt(diff: string, currentReadme: string, customPrompt: string, readmePath?: string): string {
  const readmeContext = readmePath && readmePath !== "README.md"
    ? `\n\nNote: This README is located at \`${readmePath}\`. Only update it with information relevant to its scope. Do not include information about other parts of the project that have their own READMEs.`
    : "";

  return `You are analyzing a git diff to decide if a project README needs updating.

## Current README (${readmePath ?? "README.md"})
${currentReadme}

## Git Diff (only changes relevant to this README)
${diff}

## Instructions
Analyze the diff. If the changes are substantial (new features, API changes, behavior changes, new configuration options), return an updated README. If the changes are minor (internal refactors, bug fixes, single function additions, test changes), return NO_UPDATE.${readmeContext}

${customPrompt ? `## Additional Instructions\n${customPrompt}\n` : ""}
## Response Format
Respond with EXACTLY one of these formats:

DECISION: NO_UPDATE

OR

DECISION: UPDATE
---
<the full updated README content>`;
}

export function parseResponse(response: string): AnalysisResult {
  const trimmed = response.trim();
  if (trimmed.startsWith("DECISION: NO_UPDATE")) {
    return { decision: "NO_UPDATE" };
  }
  if (!trimmed.startsWith("DECISION: UPDATE")) {
    // Malformed response — treat as no update but log warning
    process.stderr.write("readmeguard: warning: could not parse AI response, skipping update\n");
    return { decision: "NO_UPDATE" };
  }
  const separatorIndex = trimmed.indexOf("\n---\n");
  if (separatorIndex === -1) {
    process.stderr.write("readmeguard: warning: AI returned UPDATE but no README content found\n");
    return { decision: "NO_UPDATE" };
  }
  const readme = trimmed.slice(separatorIndex + 5).trim();
  return { decision: "UPDATE", updatedReadme: readme };
}

export function analyze(
  diff: string,
  currentReadme: string,
  config: ReadmeguardConfig,
  readmePath?: string,
): AnalysisResult {
  const prompt = buildPrompt(diff, currentReadme, config.customPrompt, readmePath);
  const model = config.model ?? DEFAULT_MODELS[config.provider];
  const options = { model, timeout: config.timeout };

  const call = config.provider === "claude" ? callClaude : callCodex;
  const response = call(prompt, options);
  return parseResponse(response);
}
