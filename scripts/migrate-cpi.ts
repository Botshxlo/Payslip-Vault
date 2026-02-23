/**
 * Creates the cpi_data table in Turso.
 * Usage: tsx scripts/migrate-cpi.ts
 */

import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { getTursoClient } from "../src/lib/turso.js";

loadEnvFile(join(import.meta.dirname!, "..", ".env"));

async function main() {
  const client = getTursoClient();

  console.log("Creating cpi_data table...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS cpi_data (
      month TEXT PRIMARY KEY,
      value REAL NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  console.log("Migration complete.");
}

main();
