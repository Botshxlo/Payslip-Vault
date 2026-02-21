/**
 * Backfill script: downloads .enc files from Drive, decrypts to PDF,
 * extracts text, parses payslip data, encrypts JSON, stores in Turso.
 *
 * Usage: tsx scripts/backfill.ts
 */

import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { drive_v3 } from "@googleapis/drive";
import { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";
import { decryptBuffer, encryptBuffer } from "../src/lib/encrypt.js";
import {
  extractPayslipText,
  parsePayslipData,
} from "../src/lib/parse-payslip.js";
import {
  storePayslipData,
  payslipDataExists,
} from "../src/lib/payslip-store.js";

loadEnvFile(join(import.meta.dirname!, "..", ".env"));

function getDrive() {
  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return new drive_v3.Drive({ auth });
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function extractDateFromFilename(name: string): string | null {
  const match = name.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function main() {
  const vaultSecret = process.env.VAULT_SECRET;
  if (!vaultSecret) {
    console.error("Missing VAULT_SECRET in .env");
    process.exit(1);
  }

  const drive = getDrive();

  // Find Payslip Vault folder
  const folderRes = await drive.files.list({
    q: "name='Payslip Vault' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id)",
    spaces: "drive",
  });

  const folderId = folderRes.data.files?.[0]?.id;
  if (!folderId) {
    console.error("Payslip Vault folder not found in Drive.");
    process.exit(1);
  }

  // List all .enc files
  const filesRes = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,createdTime)",
    spaces: "drive",
    pageSize: 100,
    orderBy: "createdTime asc",
  });

  const files = filesRes.data.files ?? [];
  console.log(`Found ${files.length} file(s) in Payslip Vault.\n`);

  let stored = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const { id, name } = file;
    if (!id || !name) continue;

    process.stdout.write(`  ${name} → `);

    const payslipDate = extractDateFromFilename(name);
    if (!payslipDate) {
      console.log("⊘ no date in filename, skipping");
      skipped++;
      continue;
    }

    if (await payslipDataExists(id)) {
      console.log("⊘ already in DB, skipping");
      skipped++;
      continue;
    }

    try {
      // Download encrypted file
      const dlRes = await drive.files.get(
        { fileId: id, alt: "media" },
        { responseType: "stream" }
      );
      const encBuffer = await streamToBuffer(dlRes.data as unknown as Readable);

      // Decrypt to PDF
      const pdfBuffer = decryptBuffer(encBuffer, vaultSecret);

      // Extract and parse
      const text = await extractPayslipText(pdfBuffer);
      const data = parsePayslipData(text);

      // Store encrypted JSON in Turso
      await storePayslipData(id, payslipDate, data, vaultSecret);

      console.log(
        `✓ stored (gross: ${data.grossPay}, net: ${data.netPay})`
      );
      stored++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`✗ failed: ${msg}`);
      failed++;
    }
  }

  console.log(
    `\nDone: ${stored} stored, ${skipped} skipped, ${failed} failed.`
  );
}

main();
