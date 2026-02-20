import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { stripPdfPassword } from "../src/lib/decrypt-pdf.js";
import { encryptBuffer } from "../src/lib/encrypt.js";
import { uploadToGoogleDrive, payslipExists } from "../src/lib/storage.js";

const IMPORTS_DIR = join(import.meta.dirname!, "..", "imports");

async function main() {
  const idNumber = process.env.ID_NUMBER;
  const vaultSecret = process.env.VAULT_SECRET;

  if (!idNumber || !vaultSecret) {
    console.error("Missing ID_NUMBER or VAULT_SECRET in .env");
    process.exit(1);
  }

  let files: string[];
  try {
    files = (await readdir(IMPORTS_DIR)).filter((f) =>
      f.toLowerCase().endsWith(".pdf")
    );
  } catch {
    console.error(`No imports/ directory found. Create it and add your PDFs.`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("No PDF files found in imports/");
    return;
  }

  console.log(`Found ${files.length} PDF(s) to import:\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files.sort()) {
    const filepath = join(IMPORTS_DIR, file);
    const basename = file.replace(/\.pdf$/i, "");
    const encFilename = `${basename}_${Date.now()}.enc`;

    try {
      process.stdout.write(`  ${file} → `);

      if (await payslipExists(basename)) {
        console.log(`⊘ already exists, skipping`);
        skipped++;
        continue;
      }

      const pdfBuffer = await readFile(filepath);

      const unlockedPdf = await stripPdfPassword(pdfBuffer, idNumber);

      const encrypted = encryptBuffer(unlockedPdf, vaultSecret);

      const driveFile = await uploadToGoogleDrive(encrypted, encFilename);

      console.log(`✓ uploaded as ${driveFile.name} (${driveFile.id})`);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ failed: ${msg}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} imported, ${skipped} skipped, ${failed} failed.`);
}

main();
