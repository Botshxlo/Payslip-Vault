#!/usr/bin/env tsx

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, platform } from "node:process";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { decryptBuffer } from "../src/lib/encrypt.js";

const execFile = promisify(execFileCb);

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("Usage: npx tsx scripts/decrypt.ts <file.enc> [output.pdf]");
    process.exit(1);
  }

  if (!existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath =
    process.argv[3] ?? inputPath.replace(/\.enc$/, "") + "_decrypted.pdf";

  const rl = createInterface({ input: stdin, output: stdout });
  const password = await rl.question("Enter vault password: ");
  rl.close();

  if (!password) {
    console.error("Password cannot be empty");
    process.exit(1);
  }

  try {
    const encryptedData = await readFile(inputPath);
    const decrypted = decryptBuffer(encryptedData, password);
    await writeFile(outputPath, decrypted);
    console.log(`Decrypted PDF written to: ${outputPath}`);

    // Auto-open the PDF
    const openCmd = platform === "darwin" ? "open" : "xdg-open";
    await execFile(openCmd, [outputPath]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Unsupported state") ||
      message.includes("unable to authenticate")
    ) {
      console.error("Decryption failed — wrong password?");
    } else {
      console.error(`Error: ${message}`);
    }
    process.exit(1);
  }
}

main();
