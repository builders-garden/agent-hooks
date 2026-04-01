import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { diffLines } from "diff";

export function showDiff(oldContent: string, newContent: string): void {
  const changes = diffLines(oldContent, newContent);
  for (const change of changes) {
    if (change.added) {
      process.stderr.write(`\x1b[32m+ ${change.value}\x1b[0m`);
    } else if (change.removed) {
      process.stderr.write(`\x1b[31m- ${change.value}\x1b[0m`);
    }
  }
}

export function isTTY(): boolean {
  // When running as a subprocess (via hookrunner), process.stdin is piped
  // and isTTY is false. Check /dev/tty directly instead — that's the real
  // terminal, and it's how git itself handles prompts inside hooks.
  try {
    const fd = require("node:fs").openSync("/dev/tty", "r");
    require("node:fs").closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

export async function promptUser(): Promise<"Y" | "n" | "e"> {
  // Read from /dev/tty instead of process.stdin — when running as a
  // hookrunner subprocess, stdin is piped (git ref data), not the terminal.
  const ttyInput = createReadStream("/dev/tty");
  const rl = createInterface({ input: ttyInput, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(
      "\nreadmeguard: Apply README update? [Y] Apply & push again  [n] Skip  [e] Edit first: ",
      (answer) => {
        rl.close();
        ttyInput.close();
        const choice = answer.trim().toLowerCase();
        if (choice === "n") resolve("n");
        else if (choice === "e") resolve("e");
        else resolve("Y");
      },
    );
  });
}

export function showUpdateMessage(): void {
  process.stderr.write(
    "\nreadmeguard: README updated and committed. Run `git push` again to include the update.\n",
  );
}

export function showSkipMessage(reason: string): void {
  process.stderr.write(`readmeguard: Skipping \u2014 ${reason}\n`);
}

export function showWarning(message: string): void {
  process.stderr.write(`readmeguard: warning: ${message}\n`);
}
