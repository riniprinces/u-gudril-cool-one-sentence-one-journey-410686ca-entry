// Entry runner for make.fun's "One Sentence, One Journey" bounty.
// The story lives in entry.txt next to this file. This script is the
// entrypoint the grader runs: it reads the sentence, checks it against
// every rule of the bounty gate, prints it, and drops a validated copy
// into the harness output directory when one is available.
//
// Gate, restated from the bounty:
//   - exactly one sentence, told in one line
//   - 1 to 300 characters of UTF-8 text, not only whitespace
//   - exactly one sentence-ending mark (., ! or ?), and it must close
//     the sentence — no title, no second sentence, no trailing fragment.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENTRY_FILE = "entry.txt";
const MIN_LENGTH = 1;
const MAX_LENGTH = 300;
const CLOSERS = [".", "!", "?"] as const;

type Closer = (typeof CLOSERS)[number];

class GateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GateError";
  }
}

function scriptDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function readEntryText(): string {
  const entryPath = resolve(scriptDir(), ENTRY_FILE);
  if (!existsSync(entryPath)) {
    throw new GateError(`cannot find ${ENTRY_FILE} beside main.ts (${entryPath})`);
  }
  const bytes = readFileSync(entryPath);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GateError(`${ENTRY_FILE} is not valid UTF-8`);
  }
  return text.replace(/\r\n?/g, "\n").trim();
}

function countChars(text: string): number {
  return Array.from(text).length;
}

function assertSingleSentence(text: string): void {
  if (text.length === 0) {
    throw new GateError("entry is empty or only whitespace");
  }
  const length = countChars(text);
  if (length < MIN_LENGTH || length > MAX_LENGTH) {
    throw new GateError(
      `entry is ${length} characters; the gate allows ${MIN_LENGTH}-${MAX_LENGTH}`,
    );
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    throw new GateError("entry contains control characters");
  }
  if (text.includes("\n")) {
    throw new GateError("entry spans more than one line");
  }
  if (/\s{2,}/.test(text)) {
    throw new GateError("entry contains a run of two or more spaces");
  }
  if (!/^[A-Z"“]/.test(text)) {
    throw new GateError("entry must start with a capital letter");
  }
  const closers = Array.from(text).filter((ch) =>
    (CLOSERS as readonly string[]).includes(ch),
  ) as Closer[];
  if (closers.length !== 1) {
    throw new GateError(
      `entry has ${closers.length} sentence-ending marks; exactly one is allowed`,
    );
  }
  const finalChar = text[text.length - 1];
  if (!(CLOSERS as readonly string[]).includes(finalChar)) {
    throw new GateError(
      `entry must end with its one sentence-ending mark, not ${JSON.stringify(finalChar)}`,
    );
  }
}

function publish(text: string): string | null {
  const dir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  if (!existsSync(dir)) return null;
  mkdirSync(dir, { recursive: true });
  const target = resolve(dir, ENTRY_FILE);
  writeFileSync(target, `${text}\n`, "utf8");
  return target;
}

function main(): void {
  let sentence: string;
  try {
    sentence = readEntryText();
    assertSingleSentence(sentence);
  } catch (err) {
    if (err instanceof GateError) {
      console.error(`gate failed: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
  console.log(sentence);
  console.log(`— ${countChars(sentence)} characters, one sentence, gate passed`);
  const written = publish(sentence);
  if (written) console.log(`wrote validated entry to ${written}`);
}

main();
