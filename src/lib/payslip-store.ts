import { randomUUID } from "node:crypto";
import { encryptBuffer, decryptBuffer } from "./encrypt.js";
import { getTursoClient } from "./turso.js";
import type { PayslipData } from "./parse-payslip.js";

/**
 * Encrypt payslip data as JSON and store as base64 in Turso.
 */
export async function storePayslipData(
  driveFileId: string,
  payslipDate: string,
  data: PayslipData,
  vaultSecret: string
): Promise<void> {
  const json = JSON.stringify(data);
  const encrypted = encryptBuffer(Buffer.from(json, "utf-8"), vaultSecret);
  const base64 = encrypted.toString("base64");

  const client = getTursoClient();
  await client.execute({
    sql: `INSERT OR IGNORE INTO payslip_data (id, drive_file_id, payslip_date, encrypted_data, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      randomUUID(),
      driveFileId,
      payslipDate,
      base64,
      new Date().toISOString(),
    ],
  });
}

/**
 * Retrieve and decrypt the payslip data for the month before the given date.
 * Returns null if no previous payslip exists.
 */
export async function getPreviousPayslipData(
  payslipDate: string,
  vaultSecret: string
): Promise<{ date: string; data: PayslipData } | null> {
  const client = getTursoClient();
  const result = await client.execute({
    sql: `SELECT payslip_date, encrypted_data FROM payslip_data
          WHERE payslip_date < ? ORDER BY payslip_date DESC LIMIT 1`,
    args: [payslipDate],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const encrypted = Buffer.from(row.encrypted_data as string, "base64");
  const decrypted = decryptBuffer(encrypted, vaultSecret);
  const data: PayslipData = JSON.parse(decrypted.toString("utf-8"));

  return { date: row.payslip_date as string, data };
}

/**
 * Check if payslip data already exists for a given Drive file ID.
 */
export async function payslipDataExists(driveFileId: string): Promise<boolean> {
  const client = getTursoClient();
  const result = await client.execute({
    sql: `SELECT 1 FROM payslip_data WHERE drive_file_id = ? LIMIT 1`,
    args: [driveFileId],
  });
  return result.rows.length > 0;
}
