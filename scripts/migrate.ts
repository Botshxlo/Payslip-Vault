/**
 * Creates the payslip_data table in Turso.
 * Usage: tsx scripts/migrate.ts
 */

import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { getTursoClient } from "../src/lib/turso.js";

loadEnvFile(join(import.meta.dirname!, "..", ".env"));

async function main() {
  const client = getTursoClient();

  console.log("Creating payslip_data table...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS payslip_data (
      id TEXT PRIMARY KEY,
      drive_file_id TEXT NOT NULL UNIQUE,
      payslip_date TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_payslip_data_date
    ON payslip_data(payslip_date)
  `);

  console.log("Migration complete.");
}

main();
