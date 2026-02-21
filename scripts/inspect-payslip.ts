/**
 * One-off script to inspect raw text extracted from a payslip PDF.
 * Usage: tsx scripts/inspect-payslip.ts [path-to-pdf]
 *
 * If no path given, reads the first PDF in imports/.
 * Strips the PDF password using ID_NUMBER from .env, then extracts text.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { stripPdfPassword } from "../src/lib/decrypt-pdf.js";
import { extractPayslipText, parsePayslipData } from "../src/lib/parse-payslip.js";

loadEnvFile(join(import.meta.dirname!, "..", ".env"));

async function main() {
  const idNumber = process.env.ID_NUMBER;
  if (!idNumber) {
    console.error("Missing ID_NUMBER in .env");
    process.exit(1);
  }

  let pdfPath = process.argv[2];
  if (!pdfPath) {
    const importsDir = join(import.meta.dirname!, "..", "imports");
    const files = (await readdir(importsDir)).filter((f) =>
      f.toLowerCase().endsWith(".pdf")
    );
    if (files.length === 0) {
      console.error("No PDFs found in imports/. Pass a path as argument.");
      process.exit(1);
    }
    pdfPath = join(importsDir, files.sort()[0]);
    console.log(`Using: ${pdfPath}\n`);
  }

  const pdfBuffer = await readFile(pdfPath);
  const unlocked = await stripPdfPassword(pdfBuffer, idNumber);

  const text = await extractPayslipText(unlocked);

  console.log("=== Raw Text ===");
  console.log(text);
  console.log();
  console.log("=== Lines ===");
  const lines = text.split("\n").filter((l: string) => l.trim());
  lines.forEach((line: string, i: number) => {
    console.log(`${String(i + 1).padStart(3)}: ${line}`);
  });
  console.log();
  console.log("=== Parsed Data ===");
  console.log(JSON.stringify(parsePayslipData(text), null, 2));
}

main();
